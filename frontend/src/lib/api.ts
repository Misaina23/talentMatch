import {
  Application,
  CandidateProfile,
  ChatMessage,
  ConversationSummary,
  Job,
  ParsedCV,
  User,
  UserRole,
} from '../types.ts';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'talentmatch_auth_token';

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage restriction
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

export function getWebSocketUrl(token: string): string {
  if (API_BASE) {
    const wsBase = API_BASE.replace(/^http/i, 'ws');
    return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erreur serveur (${res.status})`);
  }
  return data as T;
}

export const api = {
  async loginDemo(role: UserRole): Promise<{ token: string; user: User }> {
    const data = await request<{ token: string; user: User }>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    setAuthToken(data.token);
    return data;
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async register(payload: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    companyName?: string;
  }): Promise<{ token: string; user: User }> {
    const data = await request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthToken(data.token);
    return data;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  async listJobs(): Promise<{ jobs: Job[] }> {
    return request<{ jobs: Job[] }>('/api/jobs');
  },

  async createJob(payload: {
    title: string;
    company: string;
    location: string;
    workMode: 'Hybride' | 'Télétravail' | 'Présentiel';
    contractType: 'CDI' | 'CDD' | 'Freelance' | 'Stage';
    salaryRange: string;
    description: string;
    requirements: string[];
  }): Promise<{ job: Job }> {
    return request<{ job: Job }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async applyToJob(jobId: string, coverNote: string): Promise<{ application: Application }> {
    return request<{ application: Application }>(`/api/jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ coverNote }),
    });
  },

  async listMyApplications(): Promise<{ applications: Application[] }> {
    return request<{ applications: Application[] }>('/api/applications/mine');
  },

  async listCandidates(): Promise<{ candidates: CandidateProfile[] }> {
    return request<{ candidates: CandidateProfile[] }>('/api/candidates');
  },

  async getMyProfile(): Promise<{ profile: CandidateProfile | null }> {
    return request<{ profile: CandidateProfile | null }>('/api/profile/me');
  },

  async updateMyProfile(profile: Partial<CandidateProfile>): Promise<{ profile: CandidateProfile }> {
    return request<{ profile: CandidateProfile }>('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  },

  async parseCV(formData: FormData): Promise<{ parsed: ParsedCV; savedProfile: CandidateProfile | null }> {
    return request<{ parsed: ParsedCV; savedProfile: CandidateProfile | null }>('/api/cv/parse', {
      method: 'POST',
      body: formData,
    });
  },

  async listConversations(): Promise<{ conversations: ConversationSummary[] }> {
    return request<{ conversations: ConversationSummary[] }>('/api/conversations');
  },

  async startConversation(targetUserId: string, jobId?: string | null): Promise<{ conversation: { id: string } }> {
    return request<{ conversation: { id: string } }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, jobId }),
    });
  },

  async listMessages(conversationId: string): Promise<{ messages: ChatMessage[] }> {
    return request<{ messages: ChatMessage[] }>(`/api/conversations/${conversationId}/messages`);
  },

  async sendMessage(conversationId: string, content: string): Promise<{ message: ChatMessage }> {
    return request<{ message: ChatMessage }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};
