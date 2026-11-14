export interface MatchDetails {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  summaryReason: string;
}

const SYNONYM_GROUPS: string[][] = [
  ['typescript', 'ts'],
  ['javascript', 'js', 'ecmascript'],
  ['postgresql', 'postgres', 'psql', 'pg'],
  ['node.js', 'nodejs', 'node'],
  ['react', 'reactjs', 'react.js'],
  ['next.js', 'nextjs'],
  ['tailwind css', 'tailwind', 'tailwindcss'],
  ['kubernetes', 'k8s'],
  ['docker', 'conteneurisation', 'containers'],
  ['design systems', 'design system', 'ui kit'],
  ['ux research', 'recherche utilisateur', 'ux'],
  ['accessibilité wcag', 'wcag', 'a11y', 'accessibilité'],
  ['nlp', 'traitement du langage', 'llm', 'ia', 'ai'],
  ['sql', 'postgresql', 'mysql'],
  ['websockets', 'websocket', 'ws', 'temps réel'],
];

function canonicalToken(raw: string): string {
  const clean = raw.trim().toLowerCase();
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(clean)) {
      return group[0];
    }
  }
  return clean;
}

function skillsMatch(candidateSkill: string, jobReq: string): boolean {
  const cNorm = canonicalToken(candidateSkill);
  const jNorm = canonicalToken(jobReq);
  if (cNorm === jNorm) return true;
  if (cNorm.length >= 3 && jNorm.length >= 3) {
    return cNorm.includes(jNorm) || jNorm.includes(cNorm);
  }
  return false;
}

export function computeDetailedMatch(
  candidate: {
    skills: string[];
    headline?: string;
    experienceYears?: number;
    location?: string;
  },
  job: {
    title: string;
    requirements: string[];
    location?: string;
    workMode?: string;
  }
): MatchDetails {
  const requirements = job.requirements || [];
  const candidateSkills = candidate.skills || [];

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of requirements) {
    const found = candidateSkills.some((cs) => skillsMatch(cs, req));
    if (found) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  }

  const skillRatio = requirements.length > 0 ? matchedSkills.length / requirements.length : 0.75;

  // Headline / Title semantic overlap
  const titleWords = job.title
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/i)
    .filter((w) => w.length >= 4);
  const headlineLower = (candidate.headline || '').toLowerCase();
  const titleOverlap =
    titleWords.length > 0
      ? titleWords.filter((w) => headlineLower.includes(w)).length / titleWords.length
      : 0;

  // Seniority bonus
  const years = candidate.experienceYears ?? 0;
  const requiresSenior = /(senior|lead|staff|architecte|principal)/i.test(job.title);
  const seniorityScore = requiresSenior
    ? years >= 5
      ? 1
      : years >= 3
      ? 0.65
      : 0.35
    : years >= 1
    ? 0.9
    : 0.65;

  // Location / Remote alignment
  const isRemote = job.workMode === 'Télétravail' || /remote|télétravail/i.test(job.location || '');
  const locScore = isRemote
    ? 1
    : candidate.location && job.location && job.location.toLowerCase().includes(candidate.location.split(',')[0].trim().toLowerCase())
    ? 1
    : 0.6;

  const weighted =
    skillRatio * 72 +
    Math.min(1, titleOverlap * 2) * 13 +
    seniorityScore * 10 +
    locScore * 5;

  const score = Math.min(99, Math.max(25, Math.round(weighted)));

  const parts: string[] = [];
  if (matchedSkills.length > 0) {
    parts.push(`${matchedSkills.length}/${requirements.length || 1} compétences clés alignées`);
  }
  if (titleOverlap > 0.2) {
    parts.push('titre de poste cohérent');
  }
  if (isRemote) {
    parts.push('télétravail compatible');
  }

  return {
    score,
    matchedSkills,
    missingSkills,
    summaryReason: parts.length ? parts.join(' · ') : 'Profil à évaluer sur les prérequis techniques',
  };
}
