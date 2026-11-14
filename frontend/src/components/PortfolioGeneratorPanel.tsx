import { useEffect, useState } from 'react';
import { Check, Code2, Copy, Download, Eye, Globe, Monitor, Smartphone } from 'lucide-react';
import { api } from '../lib/api.ts';
import { CandidateProfile } from '../types.ts';

interface PortfolioGeneratorPanelProps {
  profile: CandidateProfile;
}

export function PortfolioGeneratorPanel({ profile }: PortfolioGeneratorPanelProps) {
  const [framework, setFramework] = useState<'tailwind' | 'bootstrap'>('tailwind');
  const [stylePreset, setStylePreset] = useState<'editorial' | 'dark-tech' | 'corporate'>('editorial');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [viewportWidth, setViewportWidth] = useState<'desktop' | 'mobile'>('desktop');

  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [generatedBy, setGeneratedBy] = useState<'gemini' | 'template' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (
    targetFramework: 'tailwind' | 'bootstrap' = framework,
    targetStyle: 'editorial' | 'dark-tech' | 'corporate' = stylePreset
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.generatePortfolio({
        profile,
        framework: targetFramework,
        style: targetStyle,
      });
      setGeneratedHtml(res.html);
      setGeneratedBy(res.generatedBy);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la génération du portfolio.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!generatedHtml) {
      handleGenerate('tailwind', 'editorial');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyCode = async () => {
    if (!generatedHtml) return;
    try {
      await navigator.clipboard.writeText(generatedHtml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier dans le presse-papiers.');
    }
  };

  const handleDownloadHtml = () => {
    if (!generatedHtml) return;
    const slug = (profile.fullName || 'portfolio')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${slug || 'talentmatch'}-${framework}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Générateur de Portfolio Web depuis votre CV
            </h3>
            <p className="text-xs text-slate-600">
              Source active : <span className="font-semibold text-slate-900">{profile.fullName}</span> ·{' '}
              {profile.headline} · <span className="font-mono tabular-nums">{profile.skills.length}</span> compétences ·{' '}
              <span className="font-mono tabular-nums">{profile.experiences.length}</span> expériences
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleGenerate(framework, stylePreset)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            {loading ? 'Génération en cours...' : 'Régénérer le portfolio'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Framework Choice */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              Stack générée (HTML + CSS + JavaScript)
            </span>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setFramework('tailwind');
                  handleGenerate('tailwind', stylePreset);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  framework === 'tailwind'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                HTML + Tailwind + JS
              </button>
              <button
                type="button"
                onClick={() => {
                  setFramework('bootstrap');
                  handleGenerate('bootstrap', stylePreset);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  framework === 'bootstrap'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                HTML + Bootstrap 5 + JS
              </button>
            </div>
          </div>

          {/* Aesthetic Preset */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              Direction visuelle du portfolio
            </span>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(
                [
                  { id: 'editorial', label: 'Éditorial Clair' },
                  { id: 'dark-tech', label: 'Studio Sombre' },
                  { id: 'corporate', label: 'Exécutif' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setStylePreset(preset.id);
                    handleGenerate(framework, preset.id);
                  }}
                  className={`py-2 px-2.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    stylePreset === preset.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border bg-red-50 border-red-200 text-red-900 text-sm">
          {error}
        </div>
      )}

      {/* Preview & Code Output Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                viewMode === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Aperçu interactif
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                viewMode === 'code' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code source HTML / JS
            </button>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'preview' && (
              <div className="hidden sm:flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200 mr-1">
                <button
                  type="button"
                  onClick={() => setViewportWidth('desktop')}
                  title="Vue Desktop"
                  className={`p-1.5 rounded cursor-pointer ${
                    viewportWidth === 'desktop' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewportWidth('mobile')}
                  title="Vue Mobile"
                  className={`p-1.5 rounded cursor-pointer ${
                    viewportWidth === 'mobile' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {generatedBy && (
              <span className="text-xs text-slate-500 hidden md:inline mr-2">
                {generatedBy === 'gemini' ? 'Rédaction enrichie IA' : 'Génération structurée'}
              </span>
            )}

            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!generatedHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copié' : 'Copier le code'}
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              disabled={!generatedHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger index.html
            </button>
          </div>
        </div>

        {loading && !generatedHtml ? (
          <div className="h-[580px] flex items-center justify-center text-sm text-slate-500">
            Génération du code HTML / {framework === 'bootstrap' ? 'Bootstrap 5' : 'Tailwind CSS'} / JS en cours...
          </div>
        ) : viewMode === 'preview' ? (
          <div className="bg-slate-100 p-4 sm:p-6 flex justify-center">
            <iframe
              title="Aperçu du portfolio généré"
              sandbox="allow-scripts"
              srcDoc={generatedHtml}
              className={`bg-white border border-slate-300 rounded-lg shadow-xs h-[640px] transition-all duration-200 ${
                viewportWidth === 'mobile' ? 'w-[390px]' : 'w-full'
              }`}
            />
          </div>
        ) : (
          <pre className="p-5 bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto max-h-[640px] leading-relaxed">
            <code>{generatedHtml}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
