import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  FileUp,
  Globe,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { CandidateProfile, CVAudit, ParsedCV, User } from '../types.ts';
import { PortfolioGeneratorPanel } from './PortfolioGeneratorPanel.tsx';

interface CvStudioViewProps {
  user: User | null;
  profile: CandidateProfile | null;
  audit?: CVAudit | null;
  onProfileUpdated: (profile: CandidateProfile, audit?: CVAudit | null) => void;
  onRequireAuth: () => void;
}

const SAMPLE_CV_TEXT = `Lucas Martin
Architecte Cloud & Développeur Full-Stack Senior
Paris, France · +33 6 54 12 98 76 · lucas.martin@cloudmail.fr · https://lucasmartin.dev

RÉSUMÉ
Ingénieur logiciel avec 6 ans d'expérience dans la conception d'applications SaaS distribuées en TypeScript, React, Node.js et PostgreSQL. Habitué aux environnements Docker, CI/CD et architectures haute disponibilité.

COMPÉTENCES
TypeScript, React, Node.js, PostgreSQL, Docker, Kubernetes, AWS, GraphQL, Tailwind CSS, WebSockets

EXPÉRIENCES PROFESSIONNELLES
Lead Full-Stack Engineer — Scaleway Apps | Paris | 2023 – Présent
Pilotage technique d'une équipe de 5 développeurs. Migration de services critiques vers PostgreSQL 16 et déploiement de pipelines temps réel WebSocket.

Développeur Full-Stack — Ledger Enterprise | Paris | 2020 – 2023
Développement de tableaux de bord React haute sécurité et API Node.js auditées.

FORMATION
Diplôme d'Ingénieur Systèmes & Réseaux — Télécom Paris | 2019

LANGUES
Français (Natif), Anglais (Courant C1)`;

const EMPTY_PROFILE: CandidateProfile = {
  fullName: 'Nouveau Profil',
  email: '',
  headline: 'Développeur / Designer / Chef de projet',
  summary: '',
  location: 'Paris, France',
  phone: '',
  website: '',
  availability: 'Immédiate',
  experienceYears: 3,
  salaryExpectation: '50k – 65k €',
  skills: ['TypeScript', 'React', 'Node.js'],
  experiences: [
    {
      id: 'exp_default_1',
      role: 'Poste actuel',
      company: 'Entreprise',
      location: 'Paris',
      period: '2023 – Présent',
      description: 'Réalisations clés et responsabilités.',
    },
  ],
  education: [
    {
      id: 'edu_default_1',
      degree: 'Master / Diplôme',
      school: 'École ou Université',
      year: '2022',
    },
  ],
  languages: [
    { name: 'Français', level: 'Natif' },
    { name: 'Anglais', level: 'Professionnel' },
  ],
  cvTemplate: 'editorial',
};

export function CvStudioView({
  user,
  profile,
  audit,
  onProfileUpdated,
  onRequireAuth,
}: CvStudioViewProps) {
  const [studioMode, setStudioMode] = useState<'import' | 'builder' | 'portfolio'>('import');
  const [draft, setDraft] = useState<CandidateProfile>(profile || EMPTY_PROFILE);
  const [newSkill, setNewSkill] = useState('');

  // Import & Parsing states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawCvText, setRawCvText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedCV | null>(null);
  const [localAudit, setLocalAudit] = useState<CVAudit | null>(audit ?? null);
  const [improving, setImproving] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setDraft(profile);
    } else if (user) {
      setDraft({
        ...EMPTY_PROFILE,
        fullName: user.fullName,
        email: user.email,
      });
    }
  }, [profile, user]);

  useEffect(() => {
    if (audit !== undefined) {
      setLocalAudit(audit);
    }
  }, [audit]);

  const handleParseAndAutoLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !rawCvText.trim()) {
      setNotice({
        type: 'error',
        text: 'Sélectionnez un fichier CV (PDF, DOCX, TXT, PNG/JPG) ou collez le contenu texte de votre CV.',
      });
      return;
    }

    setParsing(true);
    setNotice(null);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      if (rawCvText.trim()) {
        formData.append('rawText', rawCvText.trim());
      }
      formData.append('autoApply', user?.role === 'candidate' ? 'true' : 'false');

      const { parsed, savedProfile } = await api.parseCV(formData);
      setParsedResult(parsed);
      if (parsed.audit) {
        setLocalAudit(parsed.audit);
      }

      const mergedDraft: CandidateProfile = {
        ...draft,
        fullName: parsed.fullName || draft.fullName,
        email: parsed.email || draft.email,
        headline: parsed.headline || draft.headline,
        summary: parsed.summary || draft.summary,
        location: parsed.location || draft.location,
        phone: parsed.phone || draft.phone,
        website: parsed.website || draft.website,
        experienceYears: parsed.experienceYears || draft.experienceYears,
        skills: parsed.skills.length > 0 ? parsed.skills : draft.skills,
        experiences: parsed.experiences.length > 0 ? parsed.experiences : draft.experiences,
        education: parsed.education.length > 0 ? parsed.education : draft.education,
        languages: parsed.languages.length > 0 ? parsed.languages : draft.languages,
      };
      setDraft(mergedDraft);

      if (savedProfile) {
        onProfileUpdated(savedProfile, parsed.audit ?? localAudit);
        setNotice({
          type: 'success',
          text: 'CV analysé et chargé automatiquement dans votre profil TalentMatch.',
        });
      } else {
        setNotice({
          type: 'success',
          text: 'CV analysé avec succès. Vérifiez les champs dans le Studio CV et enregistrez votre profil.',
        });
      }
      setStudioMode('builder');
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erreur lors de l’analyse du CV.',
      });
    } finally {
      setParsing(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const { profile: updated, audit: nextAudit } = await api.updateMyProfile(draft);
      if (nextAudit) {
        setLocalAudit(nextAudit);
      }
      onProfileUpdated(updated, nextAudit);
      setNotice({ type: 'success', text: 'Profil CV enregistré et synchronisé dans TalentMatch.' });
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImproveCV = async () => {
    setImproving(true);
    setNotice(null);
    try {
      const result = await api.improveCV(draft, draft.headline);
      setDraft((prev) => ({
        ...prev,
        headline: result.headline || prev.headline,
        summary: result.summary || prev.summary,
        experiences: result.experiences?.length ? result.experiences : prev.experiences,
      }));
      setAiSuggestions(result.suggestions || []);
      setNotice({
        type: 'success',
        text:
          result.mode === 'gemini'
            ? 'Rédaction du CV optimisée via Gemini sans inventer d’informations.'
            : 'Rédaction du CV restructurée localement pour plus d’impact.',
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erreur lors de l’optimisation du CV.',
      });
    } finally {
      setImproving(false);
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || draft.skills.includes(s)) return;
    setDraft({ ...draft, skills: [...draft.skills, s] });
    setNewSkill('');
  };

  const addExperience = () => {
    setDraft({
      ...draft,
      experiences: [
        ...draft.experiences,
        {
          id: `exp_${Date.now().toString(36)}`,
          role: 'Nouveau poste',
          company: 'Entreprise',
          location: draft.location || 'Paris',
          period: '2024 – Présent',
          description: '',
        },
      ],
    });
  };

  const addEducation = () => {
    setDraft({
      ...draft,
      education: [
        ...draft.education,
        {
          id: `edu_${Date.now().toString(36)}`,
          degree: 'Diplôme / Certification',
          school: 'Établissement',
          year: '2024',
        },
      ],
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Studio Mode Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Studio CV Moderne &amp; Import Intelligent</h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Importez un CV existant pour remplir automatiquement votre profil ou concevez un CV structuré exportable en PDF.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start">
          <button
            type="button"
            onClick={() => setStudioMode('import')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'import'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            Importer un CV
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('builder')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'builder'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Éditeur &amp; Aperçu CV
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('portfolio')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'portfolio'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Portfolio HTML / JS
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-center justify-between ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {notice.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {notice.text}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs underline ml-4 cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      {studioMode === 'portfolio' ? (
        <PortfolioGeneratorPanel profile={draft} />
      ) : studioMode === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleParseAndAutoLoad}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                1. Importer votre CV (PDF, DOCX, image, TXT ou texte brut)
              </h3>
              <p className="text-xs text-slate-500">
                Le moteur TalentMatch extrait automatiquement identité, titre, compétences, expériences et formations.
              </p>
            </div>

            <label className="block border-2 border-dashed border-slate-300 hover:border-blue-700 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/70">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
              <Upload className="w-7 h-7 text-blue-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                {selectedFile ? selectedFile.name : 'Choisir un fichier CV sur votre appareil'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Formats pris en charge : PDF, DOCX, TXT, Markdown, PNG, JPG (max 8 Mo)
              </p>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">
                  Ou coller le contenu texte du CV
                </label>
                <button
                  type="button"
                  onClick={() => setRawCvText(SAMPLE_CV_TEXT)}
                  className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  Charger un exemple de CV
                </button>
              </div>
              <textarea
                rows={9}
                value={rawCvText}
                onChange={(e) => setRawCvText(e.target.value)}
                placeholder="Collez ici le texte d'un CV pour tester le parsing intelligent..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 font-sans"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-500">
                {user?.role === 'candidate'
                  ? 'Le profil sera automatiquement mis à jour après analyse.'
                  : 'Les données extraites ouvriront directement l’éditeur de CV.'}
              </span>
              <button
                type="submit"
                disabled={parsing}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 transition-colors cursor-pointer"
              >
                {parsing ? 'Analyse intelligente en cours...' : 'Analyser & charger dans le profil'}
              </button>
            </div>
          </form>

          {/* Right: How Auto-Load Works & Last Extraction Summary */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Comment fonctionne le chargement automatique
            </h3>
            <ol className="space-y-3 text-sm text-slate-600">
              <li>
                <span className="font-mono text-xs font-semibold text-blue-700 mr-2">01.</span>
                Extraction sémantique de vos coordonnées, intitulé de poste et synthèse.
              </li>
              <li>
                <span className="font-mono text-xs font-semibold text-blue-700 mr-2">02.</span>
                Normalisation des compétences pour calculer votre score de compatibilité avec les offres.
              </li>
              <li>
                <span className="font-mono text-xs font-semibold text-blue-700 mr-2">03.</span>
                Hydratation immédiate de votre CV moderne et mise à disposition dans l’annuaire Talents.
              </li>
            </ol>

            {parsedResult && (
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <p className="text-xs font-semibold text-emerald-700">
                  Dernière extraction réussie ({parsedResult.parserMode === 'gemini' ? 'IA Gemini' : 'Analyse locale'})
                </p>
                <p className="text-sm font-semibold text-slate-900">{parsedResult.fullName}</p>
                <p className="text-xs text-slate-600">{parsedResult.headline}</p>
                <p className="text-xs text-slate-500">
                  {parsedResult.skills.length} compétences · {parsedResult.experiences.length} expériences ·{' '}
                  {parsedResult.education.length} formations
                </p>
              </div>
            )}

            {localAudit && (
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">Qualité du CV</span>
                  <span className="font-mono text-xs font-bold text-blue-700 tabular-nums">
                    {localAudit.completenessPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-700 transition-all"
                    style={{ width: `${localAudit.completenessPct}%` }}
                  />
                </div>
                {localAudit.strengths.length > 0 && (
                  <p className="text-xs text-emerald-700">
                    Points forts : {localAudit.strengths.join(' · ')}
                  </p>
                )}
                {localAudit.improvements.length > 0 && (
                  <ul className="text-xs text-slate-600 space-y-1">
                    {localAudit.improvements.map((imp) => (
                      <li key={imp}>• {imp}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Modern CV Builder + Live A4 Preview */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Structured Editor */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['editorial', 'executive', 'minimal'] as const).map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setDraft({ ...draft, cvTemplate: tpl })}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
                      draft.cvTemplate === tpl ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {tpl === 'editorial' ? 'Éditorial' : tpl === 'executive' ? 'Exécutif' : 'Minimal'}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleImproveCV}
                  disabled={improving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {improving ? 'Optimisation...' : 'Optimiser la rédaction'}
                </button>
                <button
                  type="button"
                  onClick={() => setStudioMode('portfolio')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Portfolio
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </div>

            {(localAudit || aiSuggestions.length > 0) && (
              <div className="pb-4 border-b border-slate-200 space-y-2">
                {localAudit && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Complétude &amp; lisibilité recruteur
                    </span>
                    <span className="font-mono font-bold text-blue-700 tabular-nums">
                      {localAudit.completenessPct}%
                    </span>
                  </div>
                )}
                {localAudit && localAudit.improvements.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Pistes : {localAudit.improvements.slice(0, 2).join(' · ')}
                  </p>
                )}
                {aiSuggestions.length > 0 && (
                  <div className="text-xs text-slate-700 space-y-1 pt-1">
                    <p className="font-semibold text-amber-800">Améliorations appliquées :</p>
                    {aiSuggestions.map((s) => (
                      <p key={s}>• {s}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom complet</label>
                <input
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ville / Pays</label>
                <input
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Titre professionnel</label>
                <input
                  value={draft.headline}
                  onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Disponibilité</label>
                <select
                  value={draft.availability}
                  onChange={(e) => setDraft({ ...draft, availability: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Immédiate">Immédiate</option>
                  <option value="Sous 2 semaines">Sous 2 semaines</option>
                  <option value="Sous 1 mois">Sous 1 mois</option>
                  <option value="En veille">En veille</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Résumé professionnel</label>
              <textarea
                rows={3}
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Compétences</label>
              <div className="flex gap-2">
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Ajouter une compétence (ex: PostgreSQL)"
                  className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Ajouter
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {draft.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, skills: draft.skills.filter((s) => s !== skill) })
                      }
                      aria-label={`Supprimer ${skill}`}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Experiences */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Expériences</span>
                <button
                  type="button"
                  onClick={addExperience}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              </div>
              {draft.experiences.map((exp, idx) => (
                <div key={exp.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={exp.role}
                      onChange={(e) => {
                        const next = [...draft.experiences];
                        next[idx] = { ...exp, role: e.target.value };
                        setDraft({ ...draft, experiences: next });
                      }}
                      placeholder="Poste"
                      className="flex-1 px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          experiences: draft.experiences.filter((x) => x.id !== exp.id),
                        })
                      }
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label="Supprimer cette expérience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={exp.company}
                      onChange={(e) => {
                        const next = [...draft.experiences];
                        next[idx] = { ...exp, company: e.target.value };
                        setDraft({ ...draft, experiences: next });
                      }}
                      placeholder="Entreprise"
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded"
                    />
                    <input
                      value={exp.period}
                      onChange={(e) => {
                        const next = [...draft.experiences];
                        next[idx] = { ...exp, period: e.target.value };
                        setDraft({ ...draft, experiences: next });
                      }}
                      placeholder="Période"
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={exp.description}
                    onChange={(e) => {
                      const next = [...draft.experiences];
                      next[idx] = { ...exp, description: e.target.value };
                      setDraft({ ...draft, experiences: next });
                    }}
                    placeholder="Réalisations..."
                    className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
              ))}
            </div>

            {/* Education */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Formations</span>
                <button
                  type="button"
                  onClick={addEducation}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              </div>
              {draft.education.map((edu, idx) => (
                <div key={edu.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={edu.degree}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, degree: e.target.value };
                        setDraft({ ...draft, education: next });
                      }}
                      placeholder="Diplôme"
                      className="flex-1 px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          education: draft.education.filter((x) => x.id !== edu.id),
                        })
                      }
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label="Supprimer cette formation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={edu.school}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, school: e.target.value };
                        setDraft({ ...draft, education: next });
                      }}
                      placeholder="École"
                      className="col-span-2 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded"
                    />
                    <input
                      value={edu.year}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, year: e.target.value };
                        setDraft({ ...draft, education: next });
                      }}
                      placeholder="Année"
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live A4 Printable Modern CV Sheet */}
          <div className="lg:col-span-7">
            <div
              id="cv-print-sheet"
              className={`bg-white border border-slate-200 rounded-xl p-8 sm:p-10 space-y-7 ${
                draft.cvTemplate === 'executive' ? 'bg-slate-50/30' : ''
              }`}
            >
              {/* CV Header */}
              <div
                className={`pb-6 border-b ${
                  draft.cvTemplate === 'executive'
                    ? 'border-slate-900'
                    : draft.cvTemplate === 'editorial'
                    ? 'border-blue-700'
                    : 'border-slate-200'
                }`}
              >
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {draft.fullName || 'Votre Nom'}
                </h1>
                <p
                  className={`text-base font-semibold mt-1 ${
                    draft.cvTemplate === 'editorial' ? 'text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {draft.headline}
                </p>
                <p className="text-xs text-slate-500 mt-3">
                  {[draft.location, draft.email, draft.phone, draft.website]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {/* Summary */}
              {draft.summary && (
                <div className="space-y-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Profil
                  </h2>
                  <p className="text-sm text-slate-700 leading-relaxed">{draft.summary}</p>
                </div>
              )}

              {/* Skills */}
              {draft.skills.length > 0 && (
                <div className="space-y-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Compétences clés
                  </h2>
                  <p className="text-sm font-medium text-slate-800">
                    {draft.skills.join(' · ')}
                  </p>
                </div>
              )}

              {/* Experiences */}
              {draft.experiences.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Expérience professionnelle
                  </h2>
                  <div className="space-y-4">
                    {draft.experiences.map((exp) => (
                      <div key={exp.id} className="space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            {exp.role}{' '}
                            <span className="font-medium text-slate-600">— {exp.company}</span>
                          </h3>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            {exp.period}
                          </span>
                        </div>
                        {exp.description && (
                          <p className="text-sm text-slate-600 leading-relaxed">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education & Languages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Formation
                  </h2>
                  {draft.education.map((edu) => (
                    <div key={edu.id}>
                      <p className="text-sm font-semibold text-slate-900">{edu.degree}</p>
                      <p className="text-xs text-slate-500">
                        {edu.school} · <span className="font-mono tabular-nums">{edu.year}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Langues &amp; Disponibilité
                  </h2>
                  <p className="text-sm text-slate-700">
                    {draft.languages.map((l) => `${l.name} (${l.level})`).join(' · ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    Disponibilité : {draft.availability}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
