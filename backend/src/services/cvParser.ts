import { GoogleGenAI, Type } from '@google/genai';
import zlib from 'node:zlib';
import { CVAuditResult, EducationItem, ExperienceItem, LanguageItem, ParsedCVResult } from '../types.ts';

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

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2, timeoutMs = 12000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini request timeout')), timeoutMs)
        ),
      ]);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = 400 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Lightweight DOCX (ZIP) XML text extractor with zero native dependencies.
 */
function extractTextFromDocxBuffer(buf: Buffer): string {
  try {
    // Locate ZIP local file entries for word/document.xml
    const marker = Buffer.from('word/document.xml');
    let offset = buf.indexOf(marker);
    if (offset === -1) return '';

    // Search backwards for PK\x03\x04 local file header
    const headerStart = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset);
    if (headerStart === -1) return '';

    const compressionMethod = buf.readUInt16LE(headerStart + 8);
    const compressedSize = buf.readUInt32LE(headerStart + 18);
    const fileNameLen = buf.readUInt16LE(headerStart + 26);
    const extraLen = buf.readUInt16LE(headerStart + 28);
    const dataStart = headerStart + 30 + fileNameLen + extraLen;
    const slice = buf.subarray(dataStart, compressedSize > 0 ? dataStart + compressedSize : undefined);

    let xmlText = '';
    if (compressionMethod === 0) {
      xmlText = slice.toString('utf-8');
    } else if (compressionMethod === 8) {
      xmlText = zlib.inflateRawSync(slice).toString('utf-8');
    }

    return xmlText
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/ \n /g, '\n')
      .trim();
  } catch {
    return '';
  }
}

export function auditCVQuality(cv: {
  fullName?: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  summary?: string;
  skills: string[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  languages: LanguageItem[];
}): CVAuditResult {
  let score = 0;
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (cv.fullName && cv.headline) {
    score += 18;
    strengths.push('Identité et intitulé de poste clairement définis');
  } else {
    improvements.push('Précisez un titre professionnel ciblé (ex: Développeur Full-Stack React/Node.js).');
  }

  if (cv.email || cv.phone) {
    score += 12;
  } else {
    improvements.push('Ajoutez un email ou numéro de téléphone pour faciliter la prise de contact.');
  }

  if (cv.summary && cv.summary.trim().length >= 60) {
    score += 18;
    strengths.push('Synthèse professionnelle structurée');
  } else {
    improvements.push('Rédigez une synthèse de 2 à 3 phrases mettant en avant votre valeur ajoutée.');
  }

  if (cv.skills.length >= 5) {
    score += 20;
    strengths.push(`${cv.skills.length} compétences clés détectées pour le matching`);
  } else {
    score += Math.min(12, cv.skills.length * 3);
    improvements.push('Listez au moins 5 compétences techniques ou métiers clés pour optimiser votre score de compatibilité.');
  }

  const hasQuantifiedExp = cv.experiences.some((e) => /\d+|%|€|\$|k|m\b/i.test(e.description || ''));
  if (cv.experiences.length >= 1) {
    score += 20;
    if (hasQuantifiedExp) {
      strengths.push('Expériences appuyées par des indicateurs concrets');
    } else {
      improvements.push('Ajoutez des résultats chiffrés (ex: +30% performance, 5 projets livrés) dans vos descriptions.');
    }
  } else {
    improvements.push('Ajoutez au moins une expérience professionnelle ou un projet significatif.');
  }

  if (cv.education.length >= 1 && cv.languages.length >= 1) {
    score += 12;
  } else {
    score += 5;
    if (!cv.website) {
      improvements.push('Ajoutez un lien GitHub, LinkedIn ou portfolio personnel.');
    }
  }

  return {
    completenessPct: Math.min(100, score),
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
  };
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
  'Prototypage',
  'Tailwind CSS',
  'Bootstrap',
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
  'CI/CD',
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

  const cityCandidates = [
    'Paris',
    'Lyon',
    'Bordeaux',
    'Marseille',
    'Toulouse',
    'Nantes',
    'Lille',
    'Bruxelles',
    'Genève',
    'Montréal',
    'Remote',
    'Télétravail',
  ];
  const detectedCity = cityCandidates.find((c) => lower.includes(c.toLowerCase())) ?? 'France';

  const experiences = lines
    .filter((l) => /(20\d{2}|19\d{2}|présent|present)/i.test(l) && l.length > 15)
    .slice(0, 5)
    .map((l, idx) => ({
      id: `exp_imp_${idx + 1}`,
      role: l.split(/[-—|]/)[0]?.trim().slice(0, 65) || l.slice(0, 60),
      company: l.split(/[-—|]/)[1]?.trim().slice(0, 55) || 'Entreprise',
      location: detectedCity,
      period: l.match(/(?:20\d{2}|19\d{2}).{0,15}(?:20\d{2}|présent|present)/i)?.[0] ?? '2022 – Présent',
      description: l,
    }));

  const education = lines
    .filter((l) => /(master|licence|bachelor|ingénieur|diplôme|université|école|msc|phd|but|bts)/i.test(l))
    .slice(0, 3)
    .map((l, idx) => ({
      id: `edu_imp_${idx + 1}`,
      degree: l.split(/[-—|]/)[0]?.trim().slice(0, 75) || l.slice(0, 75),
      school: l.split(/[-—|]/)[1]?.trim().slice(0, 60) || 'Établissement',
      year: l.match(/(20\d{2}|19\d{2})/)?.[0] ?? '2021',
    }));

  const summaryLines = lines.slice(1, 5).join(' ').slice(0, 380);

  const result: Omit<ParsedCVResult, 'audit'> = {
    fullName,
    headline,
    email: emailMatch?.[0] ?? '',
    phone: phoneMatch?.[0]?.trim() ?? '',
    location: detectedCity,
    website: urlMatch?.[0] ?? '',
    summary: summaryLines || 'Profil importé et structuré automatiquement par TalentMatch.',
    experienceYears: yearsMatch ? Math.min(40, parseInt(yearsMatch[1], 10)) : Math.max(1, experiences.length * 2),
    skills: skills.length > 0 ? skills : ['Communication', 'Gestion de projet', 'Analyse'],
    experiences,
    education,
    languages: [
      { name: 'Français', level: 'Courant' },
      ...(lower.includes('english') || lower.includes('anglais')
        ? [{ name: 'Anglais', level: 'Professionnel' }]
        : []),
    ],
    rawText: rawText.slice(0, 5000),
    parserMode: 'heuristic',
  };

  return {
    ...result,
    audit: auditCVQuality(result),
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
  const lowerName = input.fileName?.toLowerCase() ?? '';
  const isDocx =
    lowerName.endsWith('.docx') ||
    input.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isTextFile =
    input.fileBuffer &&
    (input.mimeType?.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md'));

  let decodedFileText = '';
  if (isDocx && input.fileBuffer) {
    decodedFileText = extractTextFromDocxBuffer(input.fileBuffer);
  } else if (isTextFile && input.fileBuffer) {
    decodedFileText = input.fileBuffer.toString('utf-8');
  }

  const combinedText = [textContent, decodedFileText].filter(Boolean).join('\n\n').trim();

  if (!ai) {
    if (combinedText) {
      return heuristicParseCV(combinedText);
    }
    throw new Error(
      'GEMINI_API_KEY non configuré pour lire les PDF/images binaires. Collez le texte du CV ou importez un fichier .docx/.txt/.md.'
    );
  }

  const promptInstruction = `Tu es un analyseur intelligent de CV haute précision pour la plateforme TalentMatch.
Extrait fidèlement toutes les informations structurées du CV fourni (en conservant la langue principale du CV).
Ne fabrique aucune information absente : laisse une chaîne vide ou un tableau vide si une donnée n'apparaît pas.
Normalise les compétences techniques et métiers en tags concis et standards.
Estime experienceYears à partir des dates d'expériences professionnelles réelles si non mentionné explicitement.`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (input.fileBuffer && input.mimeType && !isTextFile && !isDocx) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.fileBuffer.toString('base64'),
      },
    });
  }

  parts.push({
    text: combinedText ? `${promptInstruction}\n\nContenu du CV :\n${combinedText}` : promptInstruction,
  });

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
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
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const baseResult: Omit<ParsedCVResult, 'audit'> = {
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

    return {
      ...baseResult,
      audit: auditCVQuality(baseResult),
    };
  } catch (error) {
    console.error('Gemini CV parsing failed, falling back if text available:', error);
    if (combinedText) {
      return heuristicParseCV(combinedText);
    }
    throw new Error('Impossible d’analyser ce document CV. Vérifiez le format (PDF, DOCX, image, TXT) ou collez le texte.');
  }
}

export async function enhanceCVWithAI(profile: {
  fullName: string;
  headline: string;
  summary: string;
  skills: string[];
  experiences: ExperienceItem[];
  targetRole?: string;
}): Promise<{
  headline: string;
  summary: string;
  experiences: ExperienceItem[];
  suggestions: string[];
  mode: 'gemini' | 'local';
}> {
  const ai = getGeminiClient();
  if (!ai) {
    const cleanSummary =
      profile.summary?.trim() ||
      `${profile.headline || 'Professionnel'} maîtrisant ${profile.skills.slice(0, 5).join(', ')}, orienté qualité produit et résultats mesurables.`;
    return {
      headline: profile.headline,
      summary: cleanSummary,
      experiences: profile.experiences,
      suggestions: [
        'Ajoutez des chiffres d’impact (latence, revenus, conversion, utilisateurs) à vos expériences.',
        'Mettez en premier les 6 compétences les plus recherchées pour votre poste cible.',
      ],
      mode: 'local',
    };
  }

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Améliore la formulation du CV ci-dessous en français professionnel clair, concis et orienté impact (verbes d'action), sans JAMAIS inventer de fausses entreprises, dates ou métriques absentes.
${profile.targetRole ? `Objectif ciblé par le candidat : ${profile.targetRole}` : ''}

CV actuel :
${JSON.stringify(profile)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              experienceDescriptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['headline', 'summary', 'experienceDescriptions', 'suggestions'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const updatedExperiences = profile.experiences.map((exp, idx) => ({
      ...exp,
      description: parsed.experienceDescriptions?.[idx] || exp.description,
    }));

    return {
      headline: parsed.headline || profile.headline,
      summary: parsed.summary || profile.summary,
      experiences: updatedExperiences,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [],
      mode: 'gemini',
    };
  } catch (err) {
    console.warn('CV AI enhancement fallback:', err);
    return {
      headline: profile.headline,
      summary: profile.summary,
      experiences: profile.experiences,
      suggestions: ['Reformulez vos missions avec des verbes d’action et des résultats concrets.'],
      mode: 'local',
    };
  }
}
