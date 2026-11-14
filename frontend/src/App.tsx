import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal.tsx';
import { CvStudioView } from './components/CvStudioView.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { JobsView } from './components/JobsView.tsx';
import { MessagingView } from './components/MessagingView.tsx';
import { Navbar } from './components/Navbar.tsx';
import { TalentsView } from './components/TalentsView.tsx';
import { api, getAuthToken, setAuthToken } from './lib/api.ts';
import {
  ActiveTab,
  Application,
  CandidateProfile,
  ConversationSummary,
  CVAudit,
  Job,
  User,
  UserRole,
} from './types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('jobs');
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [myProfile, setMyProfile] = useState<CandidateProfile | null>(null);
  const [myAudit, setMyAudit] = useState<CVAudit | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const refreshPublicData = useCallback(async () => {
    try {
      const [jobsRes, candRes] = await Promise.all([api.listJobs(), api.listCandidates()]);
      setJobs(jobsRes.jobs);
      setCandidates(candRes.candidates);
    } catch (err) {
      console.error('Error loading public listings:', err);
    }
  }, []);

  const refreshPrivateData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setApplications([]);
      setMyProfile(null);
      setMyAudit(null);
      setConversations([]);
      setActiveConversationId(null);
      return;
    }
    try {
      const [appsRes, convRes, profRes, jobsRes] = await Promise.all([
        api.listMyApplications(),
        api.listConversations(),
        currentUser.role === 'candidate'
          ? api.getMyProfile()
          : Promise.resolve({ profile: null, audit: null }),
        api.listJobs(),
      ]);
      setApplications(appsRes.applications);
      setConversations(convRes.conversations);
      setMyProfile(profRes.profile);
      setMyAudit(profRes.audit ?? null);
      setJobs(jobsRes.jobs);
      setActiveConversationId((prev) => prev || convRes.conversations[0]?.id || null);
    } catch (err) {
      console.error('Error loading user session data:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshPublicData();
      const token = getAuthToken();
      if (token) {
        try {
          const { user: me } = await api.getMe();
          if (mounted) {
            setUser(me);
            await refreshPrivateData(me);
          }
        } catch {
          setAuthToken(null);
        }
      }
      if (mounted) setInitialLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshPublicData, refreshPrivateData]);

  const handleAuthenticated = async (authedUser: User) => {
    setUser(authedUser);
    await refreshPrivateData(authedUser);
  };

  const handleSwitchDemoRole = async (role: UserRole) => {
    try {
      const { user: demoUser } = await api.loginDemo(role);
      await handleAuthenticated(demoUser);
    } catch (err) {
      console.error('Failed to switch demo role:', err);
    }
  };

  const handleLogout = async () => {
    setAuthToken(null);
    setUser(null);
    await refreshPrivateData(null);
    await refreshPublicData();
  };

  const handleStartChat = async (targetUserId: string, jobId?: string) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const { conversation } = await api.startConversation(targetUserId, jobId);
      const { conversations: updatedConvs } = await api.listConversations();
      setConversations(updatedConvs);
      setActiveConversationId(conversation.id);
      setActiveTab('messages');
    } catch (err) {
      console.error('Could not start conversation:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        user={user}
        unreadCount={conversations.length}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <HeroSection
        user={user}
        jobCount={jobs.length}
        candidateCount={candidates.length}
        onNavigate={setActiveTab}
        onSwitchDemoRole={handleSwitchDemoRole}
        onSearchQuery={setSearchQuery}
      />

      <main className="flex-1">
        {initialLoading ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
            <div className="lg:col-span-7 h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {activeTab === 'jobs' && (
              <JobsView
                jobs={jobs}
                applications={applications}
                user={user}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onJobCreated={(job) => setJobs((prev) => [job, ...prev])}
                onApplicationSubmitted={(app) => setApplications((prev) => [app, ...prev])}
                onApplicationUpdated={(updated) =>
                  setApplications((prev) =>
                    prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
                  )
                }
                onStartChat={handleStartChat}
                onRequireAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeTab === 'talents' && (
              <TalentsView
                candidates={candidates}
                jobs={jobs}
                user={user}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onStartChat={handleStartChat}
                onRequireAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeTab === 'cv-studio' && (
              <CvStudioView
                user={user}
                profile={myProfile}
                audit={myAudit}
                onProfileUpdated={(updated, nextAudit) => {
                  setMyProfile(updated);
                  if (nextAudit !== undefined) {
                    setMyAudit(nextAudit);
                  }
                  refreshPublicData();
                }}
                onRequireAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeTab === 'messages' && (
              <MessagingView
                user={user}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={setActiveConversationId}
                onConversationsRefresh={() => {
                  if (user) {
                    api.listConversations().then((res) => setConversations(res.conversations));
                  }
                }}
                onSwitchDemoRole={handleSwitchDemoRole}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>TalentMatch · Recrutement, Studio CV &amp; Messagerie Directe</span>
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => setActiveTab('jobs')} className="hover:text-slate-900 cursor-pointer">
              Offres d’emploi
            </button>
            <button type="button" onClick={() => setActiveTab('talents')} className="hover:text-slate-900 cursor-pointer">
              Annuaire Talents
            </button>
            <button type="button" onClick={() => setActiveTab('cv-studio')} className="hover:text-slate-900 cursor-pointer">
              Créer un CV
            </button>
            <button type="button" onClick={() => setActiveTab('messages')} className="hover:text-slate-900 cursor-pointer">
              Messagerie
            </button>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
