import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { computeDetailedMatch, repository } from './db/repository.ts';
import { AuthRequest, optionalAuth, requireAuth, signAuthToken } from './middleware/auth.ts';
import { auditCVQuality, enhanceCVWithAI, parseResumeIntelligently } from './services/cvParser.ts';
import {
  generatePortfolioFromCV,
  PortfolioFramework,
  PortfolioStyle,
} from './services/portfolioGenerator.ts';
import { UserRole } from './types.ts';
import { broadcastToUsers } from './ws/chatServer.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export function createApiApp() {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use(
    cors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'TalentMatch API',
      database: repository.isPostgresEnabled() ? 'postgresql' : 'local-store',
      timestamp: new Date().toISOString(),
    });
  });

  // --- Auth ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, fullName, role, companyName } = req.body as {
        email?: string;
        password?: string;
        fullName?: string;
        role?: UserRole;
        companyName?: string;
      };
      if (!email || !password || !fullName || (role !== 'candidate' && role !== 'recruiter')) {
        return res.status(400).json({ error: 'Champs requis manquants (email, mot de passe, nom, rôle).' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
      }
      const existing = await repository.findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await repository.createUser({
        email,
        passwordHash,
        role,
        fullName,
        companyName: role === 'recruiter' ? companyName || 'Entreprise' : null,
      });
      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      });
      res.status(201).json({ token, user });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Erreur lors de la création du compte.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis.' });
      }
      const user = await repository.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides.' });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Identifiants invalides.' });
      }
      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      });
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          companyName: user.companyName,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Erreur de connexion.' });
    }
  });

  app.post('/api/auth/demo', async (req, res) => {
    try {
      const { role } = req.body as { role?: UserRole };
      const email =
        role === 'recruiter'
          ? 'claire.moreau@novapulse.fr'
          : 'camille.laurent@designmail.fr';
      const user = await repository.findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'Compte démo introuvable.' });
      }
      const token = signAuthToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      });
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          companyName: user.companyName,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      console.error('Demo login error:', error);
      res.status(500).json({ error: 'Impossible de charger la session démo.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await repository.findUserById(req.authUser!.userId);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          companyName: user.companyName,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      console.error('Auth me error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // --- Jobs ---
  app.get('/api/jobs', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const jobs = await repository.listJobs();
      let candidateProfile = null;
      if (req.authUser?.role === 'candidate') {
        candidateProfile = await repository.getCandidateProfileByUserId(req.authUser.userId);
      }
      const enriched = jobs.map((j) => {
        if (!candidateProfile) {
          return { ...j, matchScore: null, matchedSkills: [], missingSkills: [], matchReason: null };
        }
        const match = computeDetailedMatch(
          {
            skills: candidateProfile.skills,
            headline: candidateProfile.headline,
            experienceYears: candidateProfile.experienceYears,
            location: candidateProfile.location,
          },
          {
            title: j.title,
            requirements: j.requirements,
            location: j.location,
            workMode: j.workMode,
          }
        );
        return {
          ...j,
          matchScore: match.score,
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          matchReason: match.summaryReason,
        };
      });
      res.json({ jobs: enriched });
    } catch (error) {
      console.error('List jobs error:', error);
      res.status(500).json({ error: 'Impossible de charger les offres.' });
    }
  });

  app.post('/api/jobs', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.authUser!.role !== 'recruiter') {
        return res.status(403).json({ error: 'Seuls les recruteurs peuvent publier une offre.' });
      }
      const { title, company, location, workMode, contractType, salaryRange, description, requirements } = req.body;
      if (!title || !company || !location || !description) {
        return res.status(400).json({ error: 'Veuillez renseigner le titre, l’entreprise, la localisation et la description.' });
      }
      const reqList = Array.isArray(requirements)
        ? requirements.map((r: unknown) => String(r).trim()).filter(Boolean)
        : String(requirements || '')
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean);

      const job = await repository.createJob(req.authUser!.userId, {
        title,
        company,
        location,
        workMode: workMode || 'Hybride',
        contractType: contractType || 'CDI',
        salaryRange: salaryRange || 'Selon profil',
        description,
        requirements: reqList,
      });
      res.status(201).json({ job });
    } catch (error) {
      console.error('Create job error:', error);
      res.status(500).json({ error: 'Impossible de publier l’offre.' });
    }
  });

  app.post('/api/jobs/:id/apply', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.authUser!.role !== 'candidate') {
        return res.status(403).json({ error: 'Connectez-vous en tant que candidat pour postuler.' });
      }
      const coverNote = String(req.body?.coverNote || '');
      const application = await repository.applyToJob(req.params.id, req.authUser!.userId, coverNote);
      res.status(201).json({ application });
    } catch (error) {
      console.error('Apply error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Erreur de candidature.' });
    }
  });

  app.get('/api/applications/mine', requireAuth, async (req: AuthRequest, res) => {
    try {
      const applications = await repository.listApplicationsForUser(req.authUser!.userId, req.authUser!.role);
      res.json({ applications });
    } catch (error) {
      console.error('List applications error:', error);
      res.status(500).json({ error: 'Erreur lors du chargement des candidatures.' });
    }
  });

  app.patch('/api/applications/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.authUser!.role !== 'recruiter') {
        return res.status(403).json({ error: 'Réservé aux recruteurs.' });
      }
      const status = req.body?.status;
      if (!['pending', 'shortlisted', 'interview', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Statut de candidature invalide.' });
      }
      const application = await repository.updateApplicationStatus(req.params.id, req.authUser!.userId, status);
      res.json({ application });
    } catch (error) {
      console.error('Update application status error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Erreur de mise à jour.' });
    }
  });

  // --- Candidates & Profiles ---
  app.get('/api/candidates', optionalAuth, async (_req, res) => {
    try {
      const candidates = await repository.listCandidates();
      res.json({ candidates });
    } catch (error) {
      console.error('List candidates error:', error);
      res.status(500).json({ error: 'Impossible de charger les talents.' });
    }
  });

  app.get('/api/profile/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await repository.getCandidateProfileByUserId(req.authUser!.userId);
      const audit = profile ? auditCVQuality(profile) : null;
      res.json({ profile, audit });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Impossible de charger votre profil.' });
    }
  });

  app.put('/api/profile/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await repository.upsertCandidateProfile(req.authUser!.userId, req.body);
      const audit = auditCVQuality(profile);
      res.json({ profile, audit });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Impossible de sauvegarder votre profil CV.' });
    }
  });

  // --- Intelligent CV Parsing & Auto-Load ---
  app.post('/api/cv/parse', optionalAuth, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
      const autoApply = req.body?.autoApply === 'true' || req.body?.autoApply === true;
      const file = req.file;

      if (!file && !rawText.trim()) {
        return res.status(400).json({ error: 'Veuillez importer un fichier CV (PDF, image, TXT) ou coller le texte du CV.' });
      }

      const parsed = await parseResumeIntelligently({
        rawText,
        fileBuffer: file?.buffer,
        mimeType: file?.mimetype,
        fileName: file?.originalname,
      });

      let savedProfile = null;
      if (autoApply && req.authUser && req.authUser.role === 'candidate') {
        savedProfile = await repository.upsertCandidateProfile(req.authUser.userId, {
          fullName: parsed.fullName || undefined,
          headline: parsed.headline,
          summary: parsed.summary,
          location: parsed.location,
          phone: parsed.phone,
          website: parsed.website,
          experienceYears: parsed.experienceYears,
          skills: parsed.skills,
          experiences: parsed.experiences,
          education: parsed.education,
          languages: parsed.languages,
          rawCvText: parsed.rawText || rawText,
        });
      }

      res.json({ parsed, savedProfile });
    } catch (error) {
      console.error('CV Parse error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Erreur lors de l’analyse intelligente du CV.',
      });
    }
  });

  // --- CV Quality Optimization ---
  app.post('/api/cv/improve', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { profile, targetRole } = req.body;
      if (!profile || !profile.fullName) {
        return res.status(400).json({ error: 'Données CV requises pour l’optimisation.' });
      }
      const improved = await enhanceCVWithAI({
        fullName: String(profile.fullName || ''),
        headline: String(profile.headline || ''),
        summary: String(profile.summary || ''),
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        experiences: Array.isArray(profile.experiences) ? profile.experiences : [],
        targetRole: typeof targetRole === 'string' ? targetRole : undefined,
      });
      res.json(improved);
    } catch (error) {
      console.error('CV Improve error:', error);
      res.status(500).json({ error: 'Impossible d’optimiser le CV pour le moment.' });
    }
  });

  // --- Portfolio Generator from CV (HTML + Tailwind/Bootstrap + JS) ---
  app.post('/api/portfolio/generate', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { profile, framework, style, targetObjective } = req.body as {
        profile?: any;
        framework?: PortfolioFramework;
        style?: PortfolioStyle;
        targetObjective?: string;
      };

      if (!profile || !profile.fullName) {
        return res.status(400).json({
          error: 'Veuillez d’abord charger ou renseigner un CV dans le studio.',
        });
      }

      const fw: PortfolioFramework = framework === 'bootstrap' ? 'bootstrap' : 'tailwind';
      const st: PortfolioStyle =
        style === 'dark-tech' || style === 'corporate' ? style : 'editorial';

      const result = await generatePortfolioFromCV({
        profile: {
          fullName: String(profile.fullName || 'Candidat'),
          headline: String(profile.headline || ''),
          email: String(profile.email || ''),
          phone: String(profile.phone || ''),
          location: String(profile.location || ''),
          website: String(profile.website || ''),
          availability: String(profile.availability || ''),
          experienceYears: Number(profile.experienceYears || 0),
          summary: String(profile.summary || ''),
          skills: Array.isArray(profile.skills) ? profile.skills : [],
          experiences: Array.isArray(profile.experiences) ? profile.experiences : [],
          education: Array.isArray(profile.education) ? profile.education : [],
          languages: Array.isArray(profile.languages) ? profile.languages : [],
          targetObjective: typeof targetObjective === 'string' ? targetObjective : undefined,
        },
        framework: fw,
        style: st,
      });

      res.json(result);
    } catch (error) {
      console.error('Portfolio generate error:', error);
      res.status(500).json({
        error: 'Impossible de générer le portfolio à partir de ce CV.',
      });
    }
  });

  // --- Secure Messaging ---
  app.get('/api/conversations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const conversations = await repository.listConversationsForUser(req.authUser!.userId);
      res.json({ conversations });
    } catch (error) {
      console.error('List conversations error:', error);
      res.status(500).json({ error: 'Impossible de charger les conversations.' });
    }
  });

  app.post('/api/conversations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { targetUserId, jobId } = req.body as { targetUserId?: string; jobId?: string };
      if (!targetUserId) {
        return res.status(400).json({ error: 'Destinataire requis.' });
      }
      const targetUser = await repository.findUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Utilisateur cible introuvable.' });
      }

      const me = req.authUser!;
      const recruiterId = me.role === 'recruiter' ? me.userId : targetUser.id;
      const candidateId = me.role === 'candidate' ? me.userId : targetUser.id;

      const conversation = await repository.findOrCreateConversation({
        recruiterId,
        candidateId,
        jobId: jobId || null,
      });

      res.status(201).json({ conversation });
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({ error: 'Impossible de démarrer la conversation.' });
    }
  });

  app.get('/api/conversations/:id/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const conv = await repository.getConversationById(req.params.id);
      if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
      if (conv.recruiterId !== req.authUser!.userId && conv.candidateId !== req.authUser!.userId) {
        return res.status(403).json({ error: 'Accès non autorisé.' });
      }
      const messages = await repository.listMessages(conv.id);
      res.json({ messages });
    } catch (error) {
      console.error('List messages error:', error);
      res.status(500).json({ error: 'Impossible de charger les messages.' });
    }
  });

  app.post('/api/conversations/:id/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const conv = await repository.getConversationById(req.params.id);
      if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
      if (conv.recruiterId !== req.authUser!.userId && conv.candidateId !== req.authUser!.userId) {
        return res.status(403).json({ error: 'Accès non autorisé.' });
      }
      const content = String(req.body?.content || '');
      const message = await repository.createMessage(conv.id, req.authUser!.userId, content);
      broadcastToUsers([conv.recruiterId, conv.candidateId], {
        type: 'message:new',
        message,
      });
      res.status(201).json({ message });
    } catch (error) {
      console.error('Create message error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Erreur d’envoi.' });
    }
  });

  return app;
}
