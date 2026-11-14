import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { createInitialSeed, StoreSnapshot } from './seedData.ts';
import {
  ApplicationRecord,
  CandidateProfileRecord,
  CandidateWithUser,
  ConversationRecord,
  JobRecord,
  MessageRecord,
  PublicUser,
  UserRecord,
  UserRole,
} from '../types.ts';

function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    fullName: u.fullName,
    companyName: u.companyName,
    avatarUrl: u.avatarUrl,
  };
}

export function computeSkillMatch(candidateSkills: string[], jobRequirements: string[]): number {
  if (!jobRequirements.length) return 75;
  const normalizedCandidate = new Set(candidateSkills.map((s) => s.trim().toLowerCase()));
  let matched = 0;
  for (const req of jobRequirements) {
    const r = req.trim().toLowerCase();
    if (
      normalizedCandidate.has(r) ||
      Array.from(normalizedCandidate).some((c) => c.includes(r) || r.includes(c))
    ) {
      matched += 1;
    }
  }
  const ratio = matched / jobRequirements.length;
  return Math.min(99, Math.max(28, Math.round(32 + ratio * 67)));
}

class TalentMatchRepository {
  private pool: Pool | null = null;
  private pgInitialized = false;
  private pgInitPromise: Promise<void> | null = null;
  private localStorePath = path.resolve(process.cwd(), '.data', 'talentmatch.json');
  private memoryStore: StoreSnapshot | null = null;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.trim().length > 0) {
      const useSsl = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('@postgres:');
      this.pool = new Pool({
        connectionString: dbUrl,
        max: 10,
        connectionTimeoutMillis: 10000,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      });
      this.pool.on('error', (err) => {
        console.error('PostgreSQL pool idle error:', err);
      });
    }
  }

  public isPostgresEnabled(): boolean {
    return this.pool !== null;
  }

  private async ensurePgReady(): Promise<Pool> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not configured');
    }
    if (this.pgInitialized) {
      return this.pool;
    }
    if (!this.pgInitPromise) {
      this.pgInitPromise = (async () => {
        const schemaCandidates = [
          path.resolve(process.cwd(), 'backend', 'src', 'db', 'schema.sql'),
          path.resolve(process.cwd(), 'src', 'db', 'schema.sql'),
          path.resolve(process.cwd(), 'dist', 'db', 'schema.sql'),
        ];
        const schemaPath = schemaCandidates.find((p) => fs.existsSync(p));
        if (schemaPath) {
          const sql = fs.readFileSync(schemaPath, 'utf-8');
          await this.pool!.query(sql);
        }

        const countRes = await this.pool!.query('SELECT COUNT(*)::int AS total FROM users');
        if ((countRes.rows[0]?.total ?? 0) === 0) {
          const seed = createInitialSeed();
          for (const u of seed.users) {
            await this.pool!.query(
              `INSERT INTO users (id, email, password_hash, role, full_name, company_name, avatar_url, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
              [u.id, u.email, u.passwordHash, u.role, u.fullName, u.companyName, u.avatarUrl, u.createdAt]
            );
          }
          for (const p of seed.profiles) {
            await this.pool!.query(
              `INSERT INTO candidate_profiles
               (id, user_id, headline, summary, location, phone, website, availability, experience_years, salary_expectation, skills, experiences, education, languages, cv_template, raw_cv_text, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17)
               ON CONFLICT (id) DO NOTHING`,
              [
                p.id,
                p.userId,
                p.headline,
                p.summary,
                p.location,
                p.phone,
                p.website,
                p.availability,
                p.experienceYears,
                p.salaryExpectation,
                JSON.stringify(p.skills),
                JSON.stringify(p.experiences),
                JSON.stringify(p.education),
                JSON.stringify(p.languages),
                p.cvTemplate,
                p.rawCvText,
                p.updatedAt,
              ]
            );
          }
          for (const j of seed.jobs) {
            await this.pool!.query(
              `INSERT INTO jobs (id, recruiter_id, title, company, location, work_mode, contract_type, salary_range, description, requirements, status, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
               ON CONFLICT (id) DO NOTHING`,
              [
                j.id,
                j.recruiterId,
                j.title,
                j.company,
                j.location,
                j.workMode,
                j.contractType,
                j.salaryRange,
                j.description,
                JSON.stringify(j.requirements),
                j.status,
                j.createdAt,
              ]
            );
          }
          for (const a of seed.applications) {
            await this.pool!.query(
              `INSERT INTO applications (id, job_id, candidate_id, cover_note, match_score, status, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
              [a.id, a.jobId, a.candidateId, a.coverNote, a.matchScore, a.status, a.createdAt]
            );
          }
          for (const c of seed.conversations) {
            await this.pool!.query(
              `INSERT INTO conversations (id, recruiter_id, candidate_id, job_id, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
              [c.id, c.recruiterId, c.candidateId, c.jobId, c.createdAt, c.updatedAt]
            );
          }
          for (const m of seed.messages) {
            await this.pool!.query(
              `INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
              [m.id, m.conversationId, m.senderId, m.content, m.createdAt]
            );
          }
        }
        this.pgInitialized = true;
      })();
    }
    await this.pgInitPromise;
    return this.pool;
  }

  private getLocalStore(): StoreSnapshot {
    if (this.memoryStore) return this.memoryStore;
    try {
      if (fs.existsSync(this.localStorePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.localStorePath, 'utf-8')) as StoreSnapshot;
        if (parsed && Array.isArray(parsed.users)) {
          this.memoryStore = parsed;
          return this.memoryStore;
        }
      }
    } catch (err) {
      console.warn('Could not load local store, seeding fresh snapshot:', err);
    }
    this.memoryStore = createInitialSeed();
    this.saveLocalStore();
    return this.memoryStore;
  }

  private saveLocalStore(): void {
    if (!this.memoryStore) return;
    try {
      const dir = path.dirname(this.localStorePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.localStorePath, JSON.stringify(this.memoryStore, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Could not persist local store:', err);
    }
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        id: r.id,
        email: r.email,
        passwordHash: r.password_hash,
        role: r.role,
        fullName: r.full_name,
        companyName: r.company_name,
        avatarUrl: r.avatar_url,
        createdAt: new Date(r.created_at).toISOString(),
      };
    }
    const store = this.getLocalStore();
    return store.users.find((u) => u.email.toLowerCase() === cleanEmail) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        id: r.id,
        email: r.email,
        passwordHash: r.password_hash,
        role: r.role,
        fullName: r.full_name,
        companyName: r.company_name,
        avatarUrl: r.avatar_url,
        createdAt: new Date(r.created_at).toISOString(),
      };
    }
    const store = this.getLocalStore();
    return store.users.find((u) => u.id === id) ?? null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    role: UserRole;
    fullName: string;
    companyName?: string | null;
  }): Promise<PublicUser> {
    const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const user: UserRecord = {
      id,
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      fullName: input.fullName.trim(),
      companyName: input.companyName?.trim() || null,
      avatarUrl: null,
      createdAt: now,
    };

    if (this.pool) {
      const pool = await this.ensurePgReady();
      await pool.query(
        `INSERT INTO users (id, email, password_hash, role, full_name, company_name, avatar_url, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [user.id, user.email, user.passwordHash, user.role, user.fullName, user.companyName, user.avatarUrl, user.createdAt]
      );
      if (user.role === 'candidate') {
        await this.upsertCandidateProfile(user.id, {
          headline: 'Candidat TalentMatch',
          summary: '',
          location: 'France',
        });
      }
      return toPublicUser(user);
    }

    const store = this.getLocalStore();
    store.users.push(user);
    if (user.role === 'candidate') {
      store.profiles.push({
        id: `prof_${Date.now().toString(36)}`,
        userId: user.id,
        headline: 'Candidat TalentMatch',
        summary: '',
        location: 'France',
        phone: '',
        website: '',
        availability: 'Immédiate',
        experienceYears: 0,
        salaryExpectation: '',
        skills: [],
        experiences: [],
        education: [],
        languages: [{ name: 'Français', level: 'Courant' }],
        cvTemplate: 'editorial',
        rawCvText: '',
        updatedAt: now,
      });
    }
    this.saveLocalStore();
    return toPublicUser(user);
  }

  async listCandidates(): Promise<CandidateWithUser[]> {
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query(`
        SELECT p.*, u.full_name, u.email, u.avatar_url
        FROM candidate_profiles p
        INNER JOIN users u ON u.id = p.user_id
        ORDER BY p.updated_at DESC
      `);
      return rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        fullName: r.full_name,
        email: r.email,
        avatarUrl: r.avatar_url,
        headline: r.headline,
        summary: r.summary,
        location: r.location,
        phone: r.phone,
        website: r.website,
        availability: r.availability,
        experienceYears: r.experience_years,
        salaryExpectation: r.salary_expectation,
        skills: Array.isArray(r.skills) ? r.skills : [],
        experiences: Array.isArray(r.experiences) ? r.experiences : [],
        education: Array.isArray(r.education) ? r.education : [],
        languages: Array.isArray(r.languages) ? r.languages : [],
        cvTemplate: r.cv_template || 'editorial',
        rawCvText: r.raw_cv_text || '',
        updatedAt: new Date(r.updated_at).toISOString(),
      }));
    }

    const store = this.getLocalStore();
    return store.profiles
      .map((p) => {
        const user = store.users.find((u) => u.id === p.userId);
        if (!user) return null;
        return {
          ...p,
          fullName: user.fullName,
          email: user.email,
          avatarUrl: user.avatarUrl,
        };
      })
      .filter((x): x is CandidateWithUser => x !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getCandidateProfileByUserId(userId: string): Promise<CandidateWithUser | null> {
    const all = await this.listCandidates();
    return all.find((c) => c.userId === userId) ?? null;
  }

  async upsertCandidateProfile(
    userId: string,
    patch: Partial<CandidateProfileRecord> & { fullName?: string }
  ): Promise<CandidateWithUser> {
    const now = new Date().toISOString();

    if (this.pool) {
      const pool = await this.ensurePgReady();
      if (patch.fullName && patch.fullName.trim()) {
        await pool.query('UPDATE users SET full_name = $1 WHERE id = $2', [patch.fullName.trim(), userId]);
      }
      const existing = await this.getCandidateProfileByUserId(userId);
      const merged: CandidateProfileRecord = {
        id: existing?.id ?? `prof_${Date.now().toString(36)}`,
        userId,
        headline: patch.headline ?? existing?.headline ?? '',
        summary: patch.summary ?? existing?.summary ?? '',
        location: patch.location ?? existing?.location ?? '',
        phone: patch.phone ?? existing?.phone ?? '',
        website: patch.website ?? existing?.website ?? '',
        availability: patch.availability ?? existing?.availability ?? 'Immédiate',
        experienceYears: patch.experienceYears ?? existing?.experienceYears ?? 0,
        salaryExpectation: patch.salaryExpectation ?? existing?.salaryExpectation ?? '',
        skills: patch.skills ?? existing?.skills ?? [],
        experiences: patch.experiences ?? existing?.experiences ?? [],
        education: patch.education ?? existing?.education ?? [],
        languages: patch.languages ?? existing?.languages ?? [],
        cvTemplate: patch.cvTemplate ?? existing?.cvTemplate ?? 'editorial',
        rawCvText: patch.rawCvText ?? existing?.rawCvText ?? '',
        updatedAt: now,
      };
      await pool.query(
        `INSERT INTO candidate_profiles
         (id, user_id, headline, summary, location, phone, website, availability, experience_years, salary_expectation, skills, experiences, education, languages, cv_template, raw_cv_text, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17)
         ON CONFLICT (user_id) DO UPDATE SET
           headline = EXCLUDED.headline,
           summary = EXCLUDED.summary,
           location = EXCLUDED.location,
           phone = EXCLUDED.phone,
           website = EXCLUDED.website,
           availability = EXCLUDED.availability,
           experience_years = EXCLUDED.experience_years,
           salary_expectation = EXCLUDED.salary_expectation,
           skills = EXCLUDED.skills,
           experiences = EXCLUDED.experiences,
           education = EXCLUDED.education,
           languages = EXCLUDED.languages,
           cv_template = EXCLUDED.cv_template,
           raw_cv_text = EXCLUDED.raw_cv_text,
           updated_at = EXCLUDED.updated_at`,
        [
          merged.id,
          merged.userId,
          merged.headline,
          merged.summary,
          merged.location,
          merged.phone,
          merged.website,
          merged.availability,
          merged.experienceYears,
          merged.salaryExpectation,
          JSON.stringify(merged.skills),
          JSON.stringify(merged.experiences),
          JSON.stringify(merged.education),
          JSON.stringify(merged.languages),
          merged.cvTemplate,
          merged.rawCvText,
          merged.updatedAt,
        ]
      );
      const updated = await this.getCandidateProfileByUserId(userId);
      if (!updated) throw new Error('Profile sync failed');
      return updated;
    }

    const store = this.getLocalStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error('Utilisateur introuvable');
    if (patch.fullName && patch.fullName.trim()) {
      user.fullName = patch.fullName.trim();
    }

    let profile = store.profiles.find((p) => p.userId === userId);
    if (!profile) {
      profile = {
        id: `prof_${Date.now().toString(36)}`,
        userId,
        headline: '',
        summary: '',
        location: '',
        phone: '',
        website: '',
        availability: 'Immédiate',
        experienceYears: 0,
        salaryExpectation: '',
        skills: [],
        experiences: [],
        education: [],
        languages: [],
        cvTemplate: 'editorial',
        rawCvText: '',
        updatedAt: now,
      };
      store.profiles.push(profile);
    }

    Object.assign(profile, {
      headline: patch.headline ?? profile.headline,
      summary: patch.summary ?? profile.summary,
      location: patch.location ?? profile.location,
      phone: patch.phone ?? profile.phone,
      website: patch.website ?? profile.website,
      availability: patch.availability ?? profile.availability,
      experienceYears: patch.experienceYears ?? profile.experienceYears,
      salaryExpectation: patch.salaryExpectation ?? profile.salaryExpectation,
      skills: patch.skills ?? profile.skills,
      experiences: patch.experiences ?? profile.experiences,
      education: patch.education ?? profile.education,
      languages: patch.languages ?? profile.languages,
      cvTemplate: patch.cvTemplate ?? profile.cvTemplate,
      rawCvText: patch.rawCvText ?? profile.rawCvText,
      updatedAt: now,
    });
    this.saveLocalStore();

    return {
      ...profile,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }

  async listJobs(): Promise<JobRecord[]> {
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query(`
        SELECT j.*, u.full_name AS recruiter_name, u.avatar_url AS recruiter_avatar
        FROM jobs j
        INNER JOIN users u ON u.id = j.recruiter_id
        ORDER BY j.created_at DESC
      `);
      return rows.map((r) => ({
        id: r.id,
        recruiterId: r.recruiter_id,
        recruiterName: r.recruiter_name,
        recruiterAvatar: r.recruiter_avatar,
        title: r.title,
        company: r.company,
        location: r.location,
        workMode: r.work_mode,
        contractType: r.contract_type,
        salaryRange: r.salary_range,
        description: r.description,
        requirements: Array.isArray(r.requirements) ? r.requirements : [],
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    }

    const store = this.getLocalStore();
    return store.jobs
      .map((j) => {
        const rec = store.users.find((u) => u.id === j.recruiterId);
        return {
          ...j,
          recruiterName: rec?.fullName ?? 'Recruteur',
          recruiterAvatar: rec?.avatarUrl ?? null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createJob(
    recruiterId: string,
    input: {
      title: string;
      company: string;
      location: string;
      workMode: 'Hybride' | 'Télétravail' | 'Présentiel';
      contractType: 'CDI' | 'CDD' | 'Freelance' | 'Stage';
      salaryRange: string;
      description: string;
      requirements: string[];
    }
  ): Promise<JobRecord> {
    const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const job: JobRecord = {
      id,
      recruiterId,
      title: input.title.trim(),
      company: input.company.trim(),
      location: input.location.trim(),
      workMode: input.workMode,
      contractType: input.contractType,
      salaryRange: input.salaryRange.trim(),
      description: input.description.trim(),
      requirements: input.requirements,
      status: 'open',
      createdAt: now,
    };

    if (this.pool) {
      const pool = await this.ensurePgReady();
      await pool.query(
        `INSERT INTO jobs (id, recruiter_id, title, company, location, work_mode, contract_type, salary_range, description, requirements, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
        [
          job.id,
          job.recruiterId,
          job.title,
          job.company,
          job.location,
          job.workMode,
          job.contractType,
          job.salaryRange,
          job.description,
          JSON.stringify(job.requirements),
          job.status,
          job.createdAt,
        ]
      );
      const recruiter = await this.findUserById(recruiterId);
      return { ...job, recruiterName: recruiter?.fullName, recruiterAvatar: recruiter?.avatarUrl ?? null };
    }

    const store = this.getLocalStore();
    store.jobs.unshift(job);
    this.saveLocalStore();
    const recruiter = store.users.find((u) => u.id === recruiterId);
    return { ...job, recruiterName: recruiter?.fullName, recruiterAvatar: recruiter?.avatarUrl ?? null };
  }

  async applyToJob(jobId: string, candidateId: string, coverNote: string): Promise<ApplicationRecord> {
    const jobs = await this.listJobs();
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Offre introuvable');
    const profile = await this.getCandidateProfileByUserId(candidateId);
    const matchScore = computeSkillMatch(profile?.skills ?? [], job.requirements);
    const now = new Date().toISOString();
    const id = `app_${Date.now().toString(36)}`;

    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query(
        `INSERT INTO applications (id, job_id, candidate_id, cover_note, match_score, status, created_at)
         VALUES ($1,$2,$3,$4,$5,'pending',$6)
         ON CONFLICT (job_id, candidate_id) DO UPDATE SET cover_note = EXCLUDED.cover_note, match_score = EXCLUDED.match_score
         RETURNING *`,
        [id, jobId, candidateId, coverNote.trim(), matchScore, now]
      );
      const r = rows[0];
      return {
        id: r.id,
        jobId: r.job_id,
        candidateId: r.candidate_id,
        coverNote: r.cover_note,
        matchScore: r.match_score,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
      };
    }

    const store = this.getLocalStore();
    const existing = store.applications.find((a) => a.jobId === jobId && a.candidateId === candidateId);
    if (existing) {
      existing.coverNote = coverNote.trim();
      existing.matchScore = matchScore;
      this.saveLocalStore();
      return existing;
    }
    const app: ApplicationRecord = {
      id,
      jobId,
      candidateId,
      coverNote: coverNote.trim(),
      matchScore,
      status: 'pending',
      createdAt: now,
    };
    store.applications.unshift(app);
    this.saveLocalStore();
    return app;
  }

  async listApplicationsForUser(userId: string, role: UserRole): Promise<
    Array<
      ApplicationRecord & {
        jobTitle: string;
        company: string;
        candidateName: string;
        candidateHeadline: string;
      }
    >
  > {
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const whereClause = role === 'recruiter' ? 'j.recruiter_id = $1' : 'a.candidate_id = $1';
      const { rows } = await pool.query(
        `SELECT a.*, j.title AS job_title, j.company, u.full_name AS candidate_name,
                COALESCE(p.headline, '') AS candidate_headline
         FROM applications a
         INNER JOIN jobs j ON j.id = a.job_id
         INNER JOIN users u ON u.id = a.candidate_id
         LEFT JOIN candidate_profiles p ON p.user_id = a.candidate_id
         WHERE ${whereClause}
         ORDER BY a.created_at DESC`,
        [userId]
      );
      return rows.map((r) => ({
        id: r.id,
        jobId: r.job_id,
        candidateId: r.candidate_id,
        coverNote: r.cover_note,
        matchScore: r.match_score,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
        jobTitle: r.job_title,
        company: r.company,
        candidateName: r.candidate_name,
        candidateHeadline: r.candidate_headline,
      }));
    }

    const store = this.getLocalStore();
    return store.applications
      .filter((a) => {
        if (role === 'candidate') return a.candidateId === userId;
        const job = store.jobs.find((j) => j.id === a.jobId);
        return job?.recruiterId === userId;
      })
      .map((a) => {
        const job = store.jobs.find((j) => j.id === a.jobId);
        const cand = store.users.find((u) => u.id === a.candidateId);
        const prof = store.profiles.find((p) => p.userId === a.candidateId);
        return {
          ...a,
          jobTitle: job?.title ?? 'Offre',
          company: job?.company ?? '',
          candidateName: cand?.fullName ?? 'Candidat',
          candidateHeadline: prof?.headline ?? '',
        };
      });
  }

  async listConversationsForUser(userId: string): Promise<
    Array<{
      id: string;
      recruiterId: string;
      candidateId: string;
      jobId: string | null;
      jobTitle: string | null;
      otherUser: PublicUser;
      lastMessage: MessageRecord | null;
      updatedAt: string;
    }>
  > {
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query(
        `SELECT c.*, j.title AS job_title
         FROM conversations c
         LEFT JOIN jobs j ON j.id = c.job_id
         WHERE c.recruiter_id = $1 OR c.candidate_id = $1
         ORDER BY c.updated_at DESC`,
        [userId]
      );
      const results = [];
      for (const c of rows) {
        const otherId = c.recruiter_id === userId ? c.candidate_id : c.recruiter_id;
        const other = await this.findUserById(otherId);
        if (!other) continue;
        const msgRes = await pool.query(
          'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
          [c.id]
        );
        const lm = msgRes.rows[0]
          ? {
              id: msgRes.rows[0].id,
              conversationId: msgRes.rows[0].conversation_id,
              senderId: msgRes.rows[0].sender_id,
              content: msgRes.rows[0].content,
              createdAt: new Date(msgRes.rows[0].created_at).toISOString(),
            }
          : null;
        results.push({
          id: c.id,
          recruiterId: c.recruiter_id,
          candidateId: c.candidate_id,
          jobId: c.job_id,
          jobTitle: c.job_title,
          otherUser: toPublicUser(other),
          lastMessage: lm,
          updatedAt: new Date(c.updated_at).toISOString(),
        });
      }
      return results;
    }

    const store = this.getLocalStore();
    return store.conversations
      .filter((c) => c.recruiterId === userId || c.candidateId === userId)
      .map((c) => {
        const otherId = c.recruiterId === userId ? c.candidateId : c.recruiterId;
        const other = store.users.find((u) => u.id === otherId);
        const job = c.jobId ? store.jobs.find((j) => j.id === c.jobId) : null;
        const convMsgs = store.messages
          .filter((m) => m.conversationId === c.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
          id: c.id,
          recruiterId: c.recruiterId,
          candidateId: c.candidateId,
          jobId: c.jobId,
          jobTitle: job?.title ?? null,
          otherUser: other
            ? toPublicUser(other)
            : {
                id: otherId,
                email: '',
                role: 'candidate' as UserRole,
                fullName: 'Utilisateur',
                companyName: null,
                avatarUrl: null,
              },
          lastMessage: convMsgs[0] ?? null,
          updatedAt: c.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findOrCreateConversation(input: {
    recruiterId: string;
    candidateId: string;
    jobId?: string | null;
  }): Promise<ConversationRecord> {
    const jobId = input.jobId ?? null;
    const now = new Date().toISOString();

    if (this.pool) {
      const pool = await this.ensurePgReady();
      const existing = await pool.query(
        `SELECT * FROM conversations WHERE recruiter_id = $1 AND candidate_id = $2 LIMIT 1`,
        [input.recruiterId, input.candidateId]
      );
      if (existing.rows[0]) {
        const r = existing.rows[0];
        return {
          id: r.id,
          recruiterId: r.recruiter_id,
          candidateId: r.candidate_id,
          jobId: r.job_id,
          createdAt: new Date(r.created_at).toISOString(),
          updatedAt: new Date(r.updated_at).toISOString(),
        };
      }
      const id = `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      await pool.query(
        `INSERT INTO conversations (id, recruiter_id, candidate_id, job_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, input.recruiterId, input.candidateId, jobId, now, now]
      );
      return {
        id,
        recruiterId: input.recruiterId,
        candidateId: input.candidateId,
        jobId,
        createdAt: now,
        updatedAt: now,
      };
    }

    const store = this.getLocalStore();
    const existing = store.conversations.find(
      (c) => c.recruiterId === input.recruiterId && c.candidateId === input.candidateId
    );
    if (existing) return existing;
    const conv: ConversationRecord = {
      id: `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      recruiterId: input.recruiterId,
      candidateId: input.candidateId,
      jobId,
      createdAt: now,
      updatedAt: now,
    };
    store.conversations.unshift(conv);
    this.saveLocalStore();
    return conv;
  }

  async getConversationById(conversationId: string): Promise<ConversationRecord | null> {
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query('SELECT * FROM conversations WHERE id = $1 LIMIT 1', [conversationId]);
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        id: r.id,
        recruiterId: r.recruiter_id,
        candidateId: r.candidate_id,
        jobId: r.job_id,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
      };
    }
    const store = this.getLocalStore();
    return store.conversations.find((c) => c.id === conversationId) ?? null;
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    if (this.pool) {
      const pool = await this.ensurePgReady();
      const { rows } = await pool.query(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
        [conversationId]
      );
      return rows.map((r) => ({
        id: r.id,
        conversationId: r.conversation_id,
        senderId: r.sender_id,
        content: r.content,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    }
    const store = this.getLocalStore();
    return store.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createMessage(conversationId: string, senderId: string, content: string): Promise<MessageRecord> {
    const cleanContent = content.trim();
    if (!cleanContent) {
      throw new Error('Le message ne peut pas être vide');
    }
    const conv = await this.getConversationById(conversationId);
    if (!conv) throw new Error('Conversation introuvable');
    if (conv.recruiterId !== senderId && conv.candidateId !== senderId) {
      throw new Error('Accès refusé à cette conversation');
    }

    const now = new Date().toISOString();
    const msg: MessageRecord = {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      senderId,
      content: cleanContent,
      createdAt: now,
    };

    if (this.pool) {
      const pool = await this.ensurePgReady();
      await pool.query(
        `INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [msg.id, msg.conversationId, msg.senderId, msg.content, msg.createdAt]
      );
      await pool.query('UPDATE conversations SET updated_at = $1 WHERE id = $2', [now, conversationId]);
      return msg;
    }

    const store = this.getLocalStore();
    store.messages.push(msg);
    const target = store.conversations.find((c) => c.id === conversationId);
    if (target) target.updatedAt = now;
    this.saveLocalStore();
    return msg;
  }
}

export const repository = new TalentMatchRepository();
