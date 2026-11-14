export type UserRole = 'candidate' | 'recruiter';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  companyName: string | null;
  avatarUrl: string | null;
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  description: string;
}

export interface EducationItem {
  id: string;
  degree: string;
  school: string;
  year: string;
}

export interface LanguageItem {
  name: string;
  level: string;
}

export interface CandidateProfile {
  id?: string;
  userId?: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  headline: string;
  summary: string;
  location: string;
  phone: string;
  website: string;
  availability: string;
  experienceYears: number;
  salaryExpectation: string;
  skills: string[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  languages: LanguageItem[];
  cvTemplate: 'editorial' | 'executive' | 'minimal';
  rawCvText?: string;
  updatedAt?: string;
}

export interface Job {
  id: string;
  recruiterId: string;
  recruiterName?: string;
  recruiterAvatar?: string | null;
  title: string;
  company: string;
  location: string;
  workMode: 'Hybride' | 'Télétravail' | 'Présentiel';
  contractType: 'CDI' | 'CDD' | 'Freelance' | 'Stage';
  salaryRange: string;
  description: string;
  requirements: string[];
  status: 'open' | 'closed';
  createdAt: string;
  matchScore?: number | null;
}

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  coverNote: string;
  matchScore: number;
  status: 'pending' | 'shortlisted' | 'interview' | 'rejected';
  createdAt: string;
  jobTitle?: string;
  company?: string;
  candidateName?: string;
  candidateHeadline?: string;
}

export interface ConversationSummary {
  id: string;
  recruiterId: string;
  candidateId: string;
  jobId: string | null;
  jobTitle: string | null;
  otherUser: User;
  lastMessage: ChatMessage | null;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ParsedCV {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  experienceYears: number;
  skills: string[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  languages: LanguageItem[];
  rawText?: string;
  parserMode: 'gemini' | 'heuristic';
}

export type ActiveTab = 'jobs' | 'talents' | 'cv-studio' | 'messages';
