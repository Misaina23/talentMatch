export type UserRole = 'candidate' | 'recruiter';

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

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  companyName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  companyName: string | null;
  avatarUrl: string | null;
}

export interface CandidateProfileRecord {
  id: string;
  userId: string;
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
  rawCvText: string;
  updatedAt: string;
}

export interface CandidateWithUser extends CandidateProfileRecord {
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface JobRecord {
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
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  candidateId: string;
  coverNote: string;
  matchScore: number;
  status: 'pending' | 'shortlisted' | 'interview' | 'rejected';
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  recruiterId: string;
  candidateId: string;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ParsedCVResult {
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
