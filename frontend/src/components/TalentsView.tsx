import { useMemo, useState } from 'react';
import { FileText, MessageSquare, Search, Users } from 'lucide-react';
import { CandidateProfile, Job, User } from '../types.ts';
import { Avatar } from './Avatar.tsx';

interface TalentsViewProps {
  candidates: CandidateProfile[];
  jobs: Job[];
  user: User | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onStartChat: (candidateUserId: string, jobId?: string) => void;
  onRequireAuth: () => void;
}

function computeCandidateJobMatch(skills: string[], requirements: string[]): number {
  if (!requirements.length) return 75;
  const norm = new Set(skills.map((s) => s.toLowerCase()));
  let hits = 0;
  for (const r of requirements) {
    const rl = r.toLowerCase();
    if (norm.has(rl) || Array.from(norm).some((s) => s.includes(rl) || rl.includes(s))) {
      hits += 1;
    }
  }
  return Math.min(99, Math.max(30, Math.round(32 + (hits / requirements.length) * 67)));
}

export function TalentsView({
  candidates,
  jobs,
  user,
  searchQuery,
  onSearchQueryChange,
  onStartChat,
  onRequireAuth,
}: TalentsViewProps) {
  const [availabilityFilter, setAvailabilityFilter] = useState('Toutes');
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    candidates[0]?.userId || ''
  );

  const referenceJob = jobs.find((j) => j.id === selectedJobId) || null;

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return candidates.filter((c) => {
      if (availabilityFilter !== 'Toutes' && c.availability !== availabilityFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.headline.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [candidates, searchQuery, availabilityFilter]);

  const activeCandidate =
    filteredCandidates.find((c) => c.userId === selectedCandidateId) ||
    filteredCandidates[0] ||
    null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Talent Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Rechercher un talent par compétence, titre ou ville..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </div>

          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            aria-label="Filtrer par disponibilité"
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700"
          >
            <option value="Toutes">Toutes disponibilités</option>
            <option value="Immédiate">Immédiate</option>
            <option value="Sous 2 semaines">Sous 2 semaines</option>
            <option value="Sous 1 mois">Sous 1 mois</option>
          </select>
        </div>

        {jobs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Comparer à l’offre :</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 max-w-xs truncate"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-base font-semibold text-slate-900">Aucun profil trouvé</p>
          <p className="text-sm text-slate-500">Essayez d’élargir les mots-clés de compétence.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Candidates Directory */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {filteredCandidates.map((cand) => {
              const isSelected = activeCandidate?.userId === cand.userId;
              const score = referenceJob
                ? computeCandidateJobMatch(cand.skills, referenceJob.requirements)
                : null;
              return (
                <button
                  key={cand.userId || cand.email}
                  type="button"
                  onClick={() => setSelectedCandidateId(cand.userId || '')}
                  className={`w-full text-left p-5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <Avatar src={cand.avatarUrl} name={cand.fullName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {cand.fullName}
                        </h3>
                        {score !== null && (
                          <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums shrink-0">
                            {score}% match
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">
                        {cand.headline}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5">
                        <span className="font-mono tabular-nums">{cand.experienceYears}</span> ans d’exp. ·{' '}
                        {cand.location} · Dispo {cand.availability.toLowerCase()}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5 truncate">
                        {cand.skills.join(' · ')}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Structured CV & Direct Contact */}
          {activeCandidate && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6 lg:sticky lg:top-24">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  <Avatar src={activeCandidate.avatarUrl} name={activeCandidate.fullName} size="lg" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{activeCandidate.fullName}</h2>
                    <p className="text-sm font-medium text-slate-700">{activeCandidate.headline}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeCandidate.location} · Disponibilité : {activeCandidate.availability}
                      {activeCandidate.salaryExpectation ? ` · ${activeCandidate.salaryExpectation}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      onRequireAuth();
                    } else if (activeCandidate.userId) {
                      onStartChat(activeCandidate.userId, referenceJob?.id);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <MessageSquare className="w-4 h-4" />
                  Contacter ce talent
                </button>
              </div>

              {activeCandidate.summary && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Synthèse professionnelle
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{activeCandidate.summary}</p>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Compétences vérifiées
                </h3>
                <p className="text-sm text-slate-800 font-medium">
                  {activeCandidate.skills.join(' · ')}
                </p>
              </div>

              {activeCandidate.experiences.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Expériences clés
                  </h3>
                  <div className="space-y-4 divide-y divide-slate-100">
                    {activeCandidate.experiences.map((exp) => (
                      <div key={exp.id} className="pt-3 first:pt-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {exp.role} — {exp.company}
                          </p>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            {exp.period}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{exp.location}</p>
                        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                          {exp.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeCandidate.education.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-slate-200">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Formation &amp; Langues
                  </h3>
                  {activeCandidate.education.map((edu) => (
                    <p key={edu.id} className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">{edu.degree}</span> · {edu.school}{' '}
                      <span className="font-mono text-xs text-slate-500 tabular-nums">({edu.year})</span>
                    </p>
                  ))}
                  {activeCandidate.languages.length > 0 && (
                    <p className="text-xs text-slate-500 pt-1">
                      Langues :{' '}
                      {activeCandidate.languages.map((l) => `${l.name} (${l.level})`).join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
