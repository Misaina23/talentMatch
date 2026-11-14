import { useEffect, useRef, useState } from 'react';
import { Lock, MessageSquare, Send } from 'lucide-react';
import { api, getAuthToken, getWebSocketUrl } from '../lib/api.ts';
import { ChatMessage, ConversationSummary, User, UserRole } from '../types.ts';
import { Avatar } from './Avatar.tsx';

interface MessagingViewProps {
  user: User | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onConversationsRefresh: () => void;
  onSwitchDemoRole: (role: UserRole) => void;
  onOpenAuth: () => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function MessagingView({
  user,
  conversations,
  activeConversationId,
  onSelectConversation,
  onConversationsRefresh,
  onSwitchDemoRole,
  onOpenAuth,
}: MessagingViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const activeConvRef = useRef<string | null>(activeConversationId);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;

    let closedIntentionally = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const ws = new WebSocket(getWebSocketUrl(token));
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        if (!closedIntentionally) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'message:new' && payload.message) {
            const msg: ChatMessage = payload.message;
            if (msg.conversationId === activeConvRef.current) {
              setMessages((prev) =>
                prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
              );
              setRemoteTyping(false);
            }
            onConversationsRefresh();
          } else if (payload.type === 'typing' && payload.conversationId === activeConvRef.current) {
            setRemoteTyping(true);
            window.setTimeout(() => setRemoteTyping(false), 2000);
          }
        } catch {
          // Ignore malformed ws event
        }
      };
    };

    connect();

    return () => {
      closedIntentionally = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !activeConversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMsgs(true);
    api
      .listMessages(activeConversationId)
      .then((res) => {
        if (!cancelled) setMessages(res.messages);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoadingMsgs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-5">
          <Lock className="w-9 h-9 text-blue-700 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">
            Messagerie sécurisée Recruteur – Candidat
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Connectez-vous ou activez un profil de démonstration pour échanger en temps réel par WebSocket avec les recruteurs et candidats.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onSwitchDemoRole('candidate')}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              Tester en tant que Candidate (Camille)
            </button>
            <button
              type="button"
              onClick={() => onSwitchDemoRole('recruiter')}
              className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer"
            >
              Tester en tant que Recruteuse (Claire)
            </button>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 underline cursor-pointer"
            >
              Connexion / Inscription
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeConversationId) || conversations[0] || null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draftText.trim();
    if (!content || !activeConv) return;
    setDraftText('');
    setSending(true);
    try {
      const { message } = await api.sendMessage(activeConv.id, content);
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
      onConversationsRefresh();
    } catch (err) {
      console.error(err);
      setDraftText(content);
    } finally {
      setSending(false);
    }
  };

  const emitTyping = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeConv) {
      wsRef.current.send(JSON.stringify({ type: 'typing', conversationId: activeConv.id }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
        {/* Left: Conversation List */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Conversations</h2>
              <p className="text-xs text-slate-500">
                {user.fullName} · {user.role === 'recruiter' ? 'Recruteur' : 'Candidat'}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {wsConnected ? 'Temps réel actif' : 'Synchronisation'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 space-y-2">
                <MessageSquare className="w-6 h-6 text-slate-400 mx-auto" />
                <p>Aucune conversation pour le moment.</p>
                <p className="text-xs">
                  Ouvrez une offre ou un profil talent pour démarrer un échange direct.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConv?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Avatar src={conv.otherUser.avatarUrl} name={conv.otherUser.fullName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {conv.otherUser.fullName}
                        </p>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                          {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {conv.otherUser.companyName || (conv.otherUser.role === 'candidate' ? 'Candidat' : 'Recruteur')}
                        {conv.jobTitle ? ` · ${conv.jobTitle}` : ''}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-xs text-slate-600 mt-1 truncate">
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Thread */}
        <div className="lg:col-span-8 flex flex-col bg-slate-50/40">
          {activeConv ? (
            <>
              <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={activeConv.otherUser.avatarUrl}
                    name={activeConv.otherUser.fullName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {activeConv.otherUser.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {activeConv.jobTitle || 'Discussion directe sécurisée'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1 shrink-0">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  Canal chiffré TLS
                </span>
              </div>

              <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[420px]">
                {loadingMsgs ? (
                  <p className="text-xs text-slate-500 text-center py-8">Chargement des messages...</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    Démarrez la conversation en envoyant votre premier message ci-dessous.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                            isMine
                              ? 'bg-blue-700 text-white'
                              : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p
                            className={`font-mono text-[10px] mt-1 tabular-nums text-right ${
                              isMine ? 'text-blue-100' : 'text-slate-400'
                            }`}
                          >
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                {remoteTyping && (
                  <p className="text-xs text-slate-500 italic">
                    {activeConv.otherUser.fullName} est en train d’écrire...
                  </p>
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="p-4 bg-white border-t border-slate-200 flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={draftText}
                  onChange={(e) => {
                    setDraftText(e.target.value);
                    emitTyping();
                  }}
                  placeholder={`Écrire un message à ${activeConv.otherUser.fullName}...`}
                  className="flex-1 px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                />
                <button
                  type="submit"
                  disabled={sending || !draftText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  Envoyer
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500">
              Sélectionnez une conversation pour afficher les messages.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
