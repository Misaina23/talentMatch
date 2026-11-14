import { useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, MessageSquare, Plus, Search, X } from 'lucide-react';
import { Application, Job, User } from '../types.ts';
import { api } from '../lib/api.ts';

interface JobsViewProps {
  jobs: Job[];
  applications: Application[];
  user: User | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onJobCreated: (job: Job) => void;
  onApplicationSubmitted: (app: Application) => void;
  onApplicationUpdated?: (app: Application) => void;
  onStartChat: (recruiterId: string, jobId: string) => void;
  onRequireAuth: () => void;
}

const APPLICATION_STATUS_LABELS: Record<Application['status'], string> = {
  pending: 'En attente',
  shortlisted: 'Présélectionné',
  interview: 'Entretien',
  rejected: 'Non retenu',
};

export function JobsView({
  jobs,
  applications,
  user,
  searchQuery,
  onSearchQueryChange,
  onJobCreated,
  onApplicationSubmitted,
  onApplicationUpdated,
  onStartChat,
  onRequireAuth,
}: JobsViewProps) {
  const [contractFilter, setContractFilter] = useState<string>('Tous');
  const [workModeFilter, setWorkModeFilter] = useState<string>('Tous');
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');
  const [coverNote, setCoverNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '',
    company: user?.companyName || '',
    location: 'Paris, France',
    workMode: 'Hybride' as 'Hybride' | 'Télétravail' | 'Présentiel',
    contractType: 'CDI' as 'CDI' | 'CDD' | 'Freelance' | 'Stage',
    salaryRange: '55k – 70k €',
    description: '',
    requirements: 'React, TypeScript, PostgreSQL',
  });
  const [creating, setCreating] = useState(false);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      if (contractFilter !== 'Tous' && job.contractType !== contractFilter) return false;
      if (workModeFilter !== 'Tous' && job.workMode !== workModeFilter) return false;
      if (!q) return true;
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.requirements.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [jobs, searchQuery, contractFilter, workModeFilter]);

  const selectedJob =
    filteredJobs.find((j) => j.id === selectedJobId) || filteredJobs[0] || null;

  const candidateApplication = selectedJob
    ? applications.find((a) => a.jobId === selectedJob.id) || null
    : null;
  const alreadyApplied = Boolean(candidateApplication);

  const jobApplications = useMemo(() => {
    if (!selectedJob) return [];
    return applications
      .filter((a) => a.jobId === selectedJob.id)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [applications, selectedJob]);

  const handleStatusChange = async (applicationId: string, status: Application['status']) => {
    setUpdatingStatusId(applicationId);
    setFeedback(null);
    try {
      const { application } = await api.updateApplicationStatus(applicationId, status);
      onApplicationUpdated?.(application);
      setFeedback({
        type: 'success',
        text: `Statut mis à jour : ${APPLICATION_STATUS_LABELS[status]}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Impossible de mettre à jour le statut.',
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    if (!user) {
      onRequireAuth();
      return;
    }
    setApplying(true);
    setFeedback(null);
    try {
      const { application } = await api.applyToJob(selectedJob.id, coverNote);
      onApplicationSubmitted(application);
      setCoverNote('');
      setFeedback({ type: 'success', text: 'Candidature envoyée au recruteur avec votre score de compatibilité.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erreur lors de la candidature.',
      });
    } finally {
      setApplying(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'recruiter') {
      onRequireAuth();
      return;
    }
    setCreating(true);
    setFeedback(null);
    try {
      const { job } = await api.createJob({
        ...newJob,
        company: newJob.company || user.companyName || 'Entreprise',
        requirements: newJob.requirements
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
      });
      onJobCreated(job);
      setSelectedJobId(job.id);
      setShowCreateForm(false);
      setNewJob({
        title: '',
        company: user.companyName || '',
        location: 'Paris, France',
        workMode: 'Hybride',
        contractType: 'CDI',
        salaryRange: '55k – 70k €',
        description: '',
        requirements: 'React, TypeScript, PostgreSQL',
      });
      setFeedback({ type: 'success', text: 'Offre publiée et visible par tous les candidats.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Impossible de publier l’offre.',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toolbar: Search + Filters + Recruiter CTA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Filtrer par poste, entreprise, ville ou compétence..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {['Tous', 'CDI', 'Freelance', 'CDD'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setContractFilter(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  contractFilter === type
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <select
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
            aria-label="Filtrer par mode de travail"
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-blue-700"
          >
            <option value="Tous">Tous les modes</option>
            <option value="Hybride">Hybride</option>
            <option value="Télétravail">Télétravail</option>
            <option value="Présentiel">Présentiel</option>
          </select>
        </div>

        {user?.role === 'recruiter' && (
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreateForm ? 'Fermer le formulaire' : 'Publier une offre'}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline ml-4 cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      {/* Recruiter Create Job Panel */}
      {showCreateForm && user?.role === 'recruiter' && (
        <form
          onSubmit={handleCreateJob}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900">Nouvelle offre d’emploi</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Intitulé du poste</label>
              <input
                required
                value={newJob.title}
                onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                placeholder="Ex: Architecte Cloud PostgreSQL"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Entreprise</label>
              <input
                required
                value={newJob.company}
                onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Localisation</label>
              <input
                required
                value={newJob.location}
                onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contrat</label>
              <select
                value={newJob.contractType}
                onChange={(e) => setNewJob({ ...newJob, contractType: e.target.value as Job['contractType'] })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Freelance">Freelance</option>
                <option value="Stage">Stage</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Organisation</label>
              <select
                value={newJob.workMode}
                onChange={(e) => setNewJob({ ...newJob, workMode: e.target.value as Job['workMode'] })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Hybride">Hybride</option>
                <option value="Télétravail">Télétravail</option>
                <option value="Présentiel">Présentiel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rémunération</label>
              <input
                value={newJob.salaryRange}
                onChange={(e) => setNewJob({ ...newJob, salaryRange: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Compétences clés (séparées par des virgules)</label>
            <input
              value={newJob.requirements}
              onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description détaillée</label>
            <textarea
              required
              rows={3}
              value={newJob.description}
              onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
              placeholder="Missions, contexte technique, équipe..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Publication...' : 'Enregistrer et publier'}
            </button>
          </div>
        </form>
      )}

      {/* Split Layout: Job List + Selected Job Detail */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-base font-semibold text-slate-900">Aucune offre ne correspond à vos critères</p>
          <p className="text-sm text-slate-500">Modifiez vos filtres ou réinitialisez la recherche.</p>
          <button
            type="button"
            onClick={() => {
              onSearchQueryChange('');
              setContractFilter('Tous');
              setWorkModeFilter('Tous');
            }}
            className="px-4 py-2 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 rounded-lg cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Clean List */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {filteredJobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              const isApplied = applications.some((a) => a.jobId === job.id);
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">{job.title}</h3>
                    {typeof job.matchScore === 'number' && (
                      <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums shrink-0">
                        {job.matchScore}% match
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700 mt-1">{job.company}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {job.contractType} · {job.workMode} · {job.location} ·{' '}
                    <span className="font-mono tabular-nums text-slate-700">{job.salaryRange}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-2 truncate">
                    {job.requirements.join(' · ')}
                  </p>
                  {isApplied && (
                    <p className="text-xs font-medium text-emerald-700 mt-2 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Candidature transmise
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Job Details & Actions */}
          {selectedJob && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6 lg:sticky lg:top-24">
              <div className="space-y-2 pb-6 border-b border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-medium text-slate-500">
                    {selectedJob.company} · Publiée par {selectedJob.recruiterName || 'Équipe RH'}
                  </p>
                  {typeof selectedJob.matchScore === 'number' && (
                    <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                      Compatibilité profil : {selectedJob.matchScore}%
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {selectedJob.title}
                </h2>
                <p className="text-sm text-slate-600">
                  {selectedJob.contractType} · {selectedJob.workMode} · {selectedJob.location} ·{' '}
                  <span className="font-mono font-medium text-slate-900 tabular-nums">
                    {selectedJob.salaryRange}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">À propos du poste</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {selectedJob.description}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Compétences attendues</h3>
                <p className="text-sm text-slate-700">
                  {selectedJob.requirements.join(' · ')}
                </p>
              </div>

              {user?.role !== 'recruiter' && typeof selectedJob.matchScore === 'number' && (
                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Analyse de compatibilité</h3>
                    <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                      {selectedJob.matchScore}% d’adéquation
                    </span>
                  </div>
                  {selectedJob.matchReason && (
                    <p className="text-xs text-slate-600">{selectedJob.matchReason}</p>
                  )}
                  {selectedJob.matchedSkills && selectedJob.matchedSkills.length > 0 && (
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold text-emerald-700">Points alignés :</span>{' '}
                      {selectedJob.matchedSkills.join(' · ')}
                    </p>
                  )}
                  {selectedJob.missingSkills && selectedJob.missingSkills.length > 0 && (
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">À valoriser ou acquérir :</span>{' '}
                      {selectedJob.missingSkills.join(' · ')}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                {user?.role !== 'recruiter' ? (
                  <form onSubmit={handleApply} className="space-y-3">
                    {candidateApplication && (
                      <p className="text-xs font-medium text-emerald-700">
                        Candidature envoyée · Statut actuel :{' '}
                        <span className="font-semibold">
                          {APPLICATION_STATUS_LABELS[candidateApplication.status]}
                        </span>
                      </p>
                    )}
                    <label className="block text-xs font-medium text-slate-700">
                      Message d’accompagnement pour le recruteur (optionnel)
                    </label>
                    <textarea
                      rows={2}
                      value={coverNote}
                      onChange={(e) => setCoverNote(e.target.value)}
                      placeholder="Présentez brièvement votre disponibilité ou un projet marquant..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={applying || alreadyApplied}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {alreadyApplied
                          ? 'Déjà postulé'
                          : applying
                          ? 'Envoi en cours...'
                          : 'Postuler avec mon profil CV'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            onRequireAuth();
                          } else {
                            onStartChat(selectedJob.recruiterId, selectedJob.id);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Contacter le recruteur
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Candidatures reçues sur ce poste ({jobApplications.length})
                      </h3>
                      <span className="text-xs text-slate-500 tabular-nums">
                        Total portefeuille : {applications.length}
                      </span>
                    </div>

                    {jobApplications.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Aucune candidature reçue sur cette offre pour le moment. Vous pouvez également sourcer directement dans l’onglet Talents.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                        {jobApplications.map((app) => (
                          <div
                            key={app.id}
                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {app.candidateName || 'Candidat'}
                                </span>
                                <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                                  {app.matchScore}% match
                                </span>
                              </div>
                              {app.candidateHeadline && (
                                <p className="text-xs text-slate-600">{app.candidateHeadline}</p>
                              )}
                              {app.coverNote && (
                                <p className="text-xs text-slate-500 line-clamp-2">{app.coverNote}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={app.status}
                                disabled={updatingStatusId === app.id}
                                onChange={(e) =>
                                  handleStatusChange(app.id, e.target.value as Application['status'])
                                }
                                aria-label={`Statut de ${app.candidateName || 'candidat'}`}
                                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-blue-700"
                              >
                                <option value="pending">En attente</option>
                                <option value="shortlisted">Présélectionné</option>
                                <option value="interview">Entretien</option>
                                <option value="rejected">Non retenu</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => onStartChat(app.candidateId, selectedJob.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Contacter
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
