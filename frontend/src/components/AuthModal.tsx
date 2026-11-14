import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api.ts';
import { User, UserRole } from '../types.ts';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
}

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('candidate');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register({ email, password, fullName, role, companyName });
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d’authentification.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (demoRole: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.loginDemo(demoRole);
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur session démo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'login' ? 'Connexion à TalentMatch' : 'Créer un compte TalentMatch'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Access */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
          <p className="text-xs font-semibold text-slate-700">Accès rapide démonstration</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemo('candidate')}
              className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:border-blue-700 rounded-lg cursor-pointer"
            >
              Camille (Candidate)
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemo('recruiter')}
              className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:border-blue-700 rounded-lg cursor-pointer"
            >
              Claire (Recruteuse)
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRole('candidate')}
                  className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    role === 'candidate' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Candidat
                </button>
                <button
                  type="button"
                  onClick={() => setRole('recruiter')}
                  className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    role === 'recruiter' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Recruteur
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom complet</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              {role === 'recruiter' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Entreprise</label>
                  <input
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email professionnel</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
          >
            {mode === 'login'
              ? 'Pas encore de compte ? Créer un profil'
              : 'Déjà inscrit ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
