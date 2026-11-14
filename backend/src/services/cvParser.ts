import { GoogleGenAI, Type } from '@google/genai';
import { ParsedCVResult } from '../types.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const KNOWN_SKILLS = [
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Node.js',
  'Express',
  'PostgreSQL',
  'SQL',
  'Python',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Figma',
  'Design Systems',
  'UX Research',
  'Tailwind CSS',
  'GraphQL',
  'WebSockets',
  'Java',
  'Spring Boot',
  'Go',
  'FastAPI',
  'NLP',
  'Product Strategy',
  'Accessibilité WCAG',
  'Git',
];

function heuristicParseCV(rawText: string): ParsedCVResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(?:\+33|0|\+\d{1,3})[\s.-]?(?:\d[\s.-]?){8,12}/);
  const urlMatch = rawText.match(/https?:\/\/[^\s]+/);
  const yearsMatch = rawText.match(/(\d{1,2})\s*(?:ans|years|années)/i);

  const fullName =
    lines.find((l) => l.length > 3 && l.length < 48 && !l.includes('@') && !l.startsWith('http')) ??
    'Profil Importé';
  const headline =
    lines.find((l) => l !== fullName && l.length > 8 && l.length < 90 && !l.includes('@')) ??
    'Professionnel·le qualifié·e';

  const lower = rawText.toLowerCase();
  const skills = KNOWN_SKILLS.filter((skill) => lower.includes(skill.toLowerCase()));

  const cityCandidates = ['Paris', 'Lyon', 'Bordeaux', 'Marseille', 'Toulouse', 'Nantes', 'Lille', 'Remote', 'Télétravail'];
  const detectedCity = cityCandidates.find((c) => lower.includes(c.toLowerCase())) ?? 'France';

  const experiences = lines
    .filter((l) => /(20\d{2}|19\d{2}|présent|present)/i.test(l) && l.length > 15)
    .slice(0, 4)
    .map((l, idx) => ({
      id: `exp_imp_${idx + 1}`,
      role: l.slice(0, 60),
      company: 'Entreprise extraite du CV',
      location: detectedCity,
      period: l.match(/(?:20\d{2}|19\d{2}).{0,15}(?:20\d{2}|présent|present)/i)?.[0] ?? '2022 – Présent',
      description: l,
    }));

  const education = lines
    .filter((l) => /(master|licence|bachelor|ingénieur|diplôme|université|école|msc|phd)/i.test(l))
    .slice(0, 3)
    .map((l, idx) => ({
      id: `edu_imp_${idx + 1}`,
      degree: l.slice(0, 75),
      school: 'Établissement extrait',
      year: l.match(/(20\d{2}|19\d{2})/)?.[0] ?? '2021',
    }));

  const summaryLines = lines.slice(1, 5).join(' ').slice(0, 380);

  return {
    fullName,
    headline,
    email: emailMatch?.[0] ?? '',
    phone: phoneMatch?.[0]?.trim() ?? '',
    location: detectedCity,
    website: urlMatch?.[0] ?? '',
    summary:
      summaryLines ||
      'Profil importé et structuré automatiquement par TalentMatch.',
    experienceYears: yearsMatch ? Math.min(40, parseInt(yearsMatch[1], 10)) : Math.max(1, experiences.length * 2),
    skills: skills.length > 0 ? skills : ['Communication', 'Gestion de projet', 'Analyse'],
    experiences,
    education,
    languages: [
      { name: 'Français', level: 'Courant' },
      ...(lower.includes('english') || lower.includes('anglais') ? [{ name: 'Anglais', level: 'Professionnel' }] : []),
    ],
    rawText: rawText.slice(0, 5000),
    parserMode: 'heuristic',
  };
}

export async function parseResumeIntelligently(input: {
  rawText?: string;
  fileBuffer?: Buffer;
  mimeType?: string;
  fileName?: string;
}): Promise<ParsedCVResult> {
  const ai = getGeminiClient();

  const textContent = (input.rawText ?? '').trim();
  const isTextFile =
    input.fileBuffer &&
    input.mimeType &&
    (input.mimeType.startsWith('text/') ||
      input.fileName?.toLowerCase().endsWith('.txt') ||
      input.fileName?.toLowerCase().endsWith('.md'));

  const decodedFileText = isTextFile && input.fileBuffer ? input.fileBuffer.toString('utf-8') : '';
  const combinedText = [textContent, decodedFileText].filter(Boolean).join('\n\n').trim();

  if (!ai) {
    if (combinedText) {
      return heuristicParseCV(combinedText);
    }
    throw new Error(
      'GEMINI_API_KEY non configuré pour lire les PDF/images binaires. Collez le texte du CV ou importez un fichier .txt/.md.'
    );
  }

  const promptInstruction = `Tu es un analyseur intelligent de CV pour la plateforme de recrutement TalentMatch.
Extrait fidèlement toutes les informations structurées du CV fourni (en français ou en anglais, en conservant la langue principale du CV).
Ne fabrique aucune donnée absente : laisse une chaîne vide ou un tableau vide si une information n'apparaît pas.
Normalise les compétences techniques et métiers en tags concis.`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (input.fileBuffer && input.mimeType && !isTextFile) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.fileBuffer.toString('base64'),
      },
    });
  }

  parts.push({
    text: combinedText
      ? `${promptInstruction}\n\nContenu du CV :\n${combinedText}`
      : promptInstruction,
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            headline: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            location: { type: Type.STRING },
            website: { type: Type.STRING },
            summary: { type: Type.STRING },
            experienceYears: { type: Type.INTEGER },
            skills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            experiences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  company: { type: Type.STRING },
                  location: { type: Type.STRING },
                  period: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
              },
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  school: { type: Type.STRING },
                  year: { type: Type.STRING },
                },
              },
            },
            languages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  level: { type: Type.STRING },
                },
              },
            },
          },
          required: ['fullName', 'headline', 'summary', 'skills', 'experiences', 'education', 'languages'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return {
      fullName: parsed.fullName || '',
      headline: parsed.headline || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      location: parsed.location || '',
      website: parsed.website || '',
      summary: parsed.summary || '',
      experienceYears: typeof parsed.experienceYears === 'number' ? parsed.experienceYears : 0,
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 20) : [],
      experiences: Array.isArray(parsed.experiences)
        ? parsed.experiences.map((e: any, idx: number) => ({
            id: `exp_ai_${idx + 1}_${Date.now().toString(36)}`,
            role: e.role || '',
            company: e.company || '',
            location: e.location || '',
            period: e.period || '',
            description: e.description || '',
          }))
        : [],
      education: Array.isArray(parsed.education)
        ? parsed.education.map((e: any, idx: number) => ({
            id: `edu_ai_${idx + 1}_${Date.now().toString(36)}`,
            degree: e.degree || '',
            school: e.school || '',
            year: e.year || '',
          }))
        : [],
      languages: Array.isArray(parsed.languages)
        ? parsed.languages.map((l: any) => ({
            name: l.name || '',
            level: l.level || '',
          }))
        : [],
      rawText: combinedText.slice(0, 5000),
      parserMode: 'gemini',
    };
  } catch (error) {
    console.error('Gemini CV parsing failed, falling back if text available:', error);
    if (combinedText) {
      return heuristicParseCV(combinedText);
    }
    throw new Error('Impossible d’analyser ce document CV. Vérifiez le format (PDF, image, TXT) ou collez le texte.');
  }
}
