import { ActiveTab, User } from '../types.ts';

interface NavbarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  user: User | null;
  unreadCount: number;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function Navbar({
  activeTab,
  onNavigate,
  user,
  unreadCount,
  onOpenAuth,
  onLogout,
}: NavbarProps) {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'jobs', label: 'Offres' },
    { id: 'talents', label: 'Talents' },
    { id: 'cv-studio', label: 'Studio CV' },
    { id: 'messages', label: unreadCount > 0 ? `Messagerie (${unreadCount})` : 'Messagerie' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('jobs')}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700 rounded"
        >
          TalentMatch
        </button>

        {/* Zone 2: 4 Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Navigation principale">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'text-blue-700 border-blue-700'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onLogout}
              title={`Connecté en tant que ${user.fullName} — Cliquer pour changer de compte`}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              {user.fullName} · Déconnexion
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Connexion
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
