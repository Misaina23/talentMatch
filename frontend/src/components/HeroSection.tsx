import { useState } from 'react';
import { ArrowRight, FileUp, Search } from 'lucide-react';
import { ActiveTab, User, UserRole } from '../types.ts';

interface HeroSectionProps {
  user: User | null;
  jobCount: number;
  candidateCount: number;
  onNavigate: (tab: ActiveTab) => void;
  onSwitchDemoRole: (role: UserRole) => void;
  onSearchQuery: (q: string) => void;
}

export function HeroSection({
  user,
  jobCount,
  candidateCount,
  onNavigate,
  onSwitchDemoRole,
  onSearchQuery,
}: HeroSectionProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchQuery(quickSearch);
    onNavigate(user?.role === 'recruiter' ? 'talents' : 'jobs');
  };

  return (
    <section className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Column: Editorial Headline, Workspace Switch & Search */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wider text-blue-700">
                Plateforme de recrutement &amp; gestion de carrière
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                Trouvez votre prochain poste ou recrutez les profils adaptés.
              </h1>
              <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
                Explorez les offres vérifiées, créez un CV moderne exportable en PDF, importez votre CV existant pour pré-remplir automatiquement votre profil et échangez en direct via la messagerie sécurisée.
              </p>
            </div>

            {/* Workspace Role Switcher + Quick Search */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
                  role="group"
                  aria-label="Mode d'espace de travail"
                >
                  <button
                    type="button"
                    onClick={() => onSwitchDemoRole('candidate')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      user?.role !== 'recruiter'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Espace Candidat
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchDemoRole('recruiter')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      user?.role === 'recruiter'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Espace Recruteur
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('cv-studio')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileUp className="w-4 h-4" />
                  Importer ou créer un CV
                </button>
              </div>

              <form onSubmit={handleQuickSearch} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder={
                      user?.role === 'recruiter'
                        ? 'Rechercher un talent : React, TypeScript, Design System, Paris...'
                        : 'Rechercher un poste : Full-Stack, Product Designer, Remote...'
                    }
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Rechercher
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Stretched 16:9 Architectural Photography */}
          <div className="lg:col-span-5 flex">
            <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[240px]">
              {!imgFailed ? (
                <img
                  src="/images/hero_talentmatch_office.jpg"
                  alt="Équipe de recrutement et candidat examinant un portfolio dans un studio lumineux"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-8 text-center bg-slate-100">
                  <p className="text-base font-semibold text-slate-800">TalentMatch Studio</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Recrutement ciblé · Parsing CV intelligent · Messagerie directe
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Capability & Metric Strip */}
        <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">{jobCount}</p>
            <p className="text-xs text-slate-600 mt-1">Offres actives vérifiées</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">{candidateCount}</p>
            <p className="text-xs text-slate-600 mt-1">Profils CV structurés</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">3 modèles</p>
            <p className="text-xs text-slate-600 mt-1">Studio CV moderne &amp; export PDF</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">Temps réel</p>
            <p className="text-xs text-slate-600 mt-1">Messagerie directe WebSocket</p>
          </div>
        </div>
      </div>
    </section>
  );
}
