import bcrypt from 'bcryptjs';
import {
  ApplicationRecord,
  CandidateProfileRecord,
  ConversationRecord,
  JobRecord,
  MessageRecord,
  UserRecord,
} from '../types.ts';

export interface StoreSnapshot {
  users: UserRecord[];
  profiles: CandidateProfileRecord[];
  jobs: JobRecord[];
  applications: ApplicationRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
}

export function createInitialSeed(): StoreSnapshot {
  const demoPasswordHash = bcrypt.hashSync('TalentMatch2026!', 10);
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  const users: UserRecord[] = [
    {
      id: 'usr_recruiter_claire',
      email: 'claire.moreau@novapulse.fr',
      passwordHash: demoPasswordHash,
      role: 'recruiter',
      fullName: 'Claire Moreau',
      companyName: 'NovaPulse Technologies',
      avatarUrl: '/images/avatar_recruiter_claire.jpg',
      createdAt: hoursAgo(240),
    },
    {
      id: 'usr_recruiter_marc',
      email: 'marc.delacroix@ateliercloud.io',
      passwordHash: demoPasswordHash,
      role: 'recruiter',
      fullName: 'Marc Delacroix',
      companyName: 'Atelier Cloud Europe',
      avatarUrl: null,
      createdAt: hoursAgo(200),
    },
    {
      id: 'usr_candidate_camille',
      email: 'camille.laurent@designmail.fr',
      passwordHash: demoPasswordHash,
      role: 'candidate',
      fullName: 'Camille Laurent',
      companyName: null,
      avatarUrl: '/images/avatar_candidate_camille.jpg',
      createdAt: hoursAgo(180),
    },
    {
      id: 'usr_candidate_karim',
      email: 'karim.bennani@devcraft.io',
      passwordHash: demoPasswordHash,
      role: 'candidate',
      fullName: 'Karim Bennani',
      companyName: null,
      avatarUrl: '/images/avatar_candidate_karim.jpg',
      createdAt: hoursAgo(160),
    },
    {
      id: 'usr_candidate_sophie',
      email: 'sophie.mercier@dataops.fr',
      passwordHash: demoPasswordHash,
      role: 'candidate',
      fullName: 'Sophie Mercier',
      companyName: null,
      avatarUrl: null,
      createdAt: hoursAgo(120),
    },
  ];

  const profiles: CandidateProfileRecord[] = [
    {
      id: 'prof_camille',
      userId: 'usr_candidate_camille',
      headline: 'Lead Product Designer — Design Systems & SaaS B2B',
      summary:
        'Designer produit senior avec 7 ans d’expérience sur des plateformes SaaS européennes. Spécialisée en architecture d’information, accessibilité WCAG AA et systèmes de design multi-marques.',
      location: 'Paris, France',
      phone: '+33 6 42 88 19 30',
      website: 'https://camillelaurent.design',
      availability: 'Sous 1 mois',
      experienceYears: 7,
      salaryExpectation: '65k – 75k € / an',
      skills: [
        'Figma',
        'Design Systems',
        'React',
        'UX Research',
        'Prototypage',
        'Accessibilité WCAG',
        'Tailwind CSS',
        'Product Strategy',
      ],
      experiences: [
        {
          id: 'exp_c1',
          role: 'Lead Product Designer',
          company: 'Qonto Studio Partner',
          location: 'Paris',
          period: '2023 – Présent',
          description:
            'Refonte complète du portail de gestion financière B2B et pilotage d’un design system utilisé par 4 squads produit.',
        },
        {
          id: 'exp_c2',
          role: 'Senior UX/UI Designer',
          company: 'Doctolib Care Lab',
          location: 'Paris / Hybride',
          period: '2020 – 2023',
          description:
            'Conception des parcours de prise de rendez-vous et réduction de 28% du taux d’abandon sur mobile.',
        },
      ],
      education: [
        {
          id: 'edu_c1',
          degree: 'Master Design Numérique & Ergonomie',
          school: 'Gobelins Paris',
          year: '2019',
        },
      ],
      languages: [
        { name: 'Français', level: 'Natif' },
        { name: 'Anglais', level: 'Courant (C1)' },
      ],
      cvTemplate: 'editorial',
      rawCvText: '',
      updatedAt: hoursAgo(12),
    },
    {
      id: 'prof_karim',
      userId: 'usr_candidate_karim',
      headline: 'Architecte Full-Stack TypeScript · React & PostgreSQL',
      summary:
        'Ingénieur logiciel orienté performance et scalabilité. Conception d’API Node.js résilientes, modélisation PostgreSQL avancée et interfaces React temps réel.',
      location: 'Lyon, France',
      phone: '+33 6 71 04 55 12',
      website: 'https://github.com/karimbennani',
      availability: 'Immédiate',
      experienceYears: 8,
      salaryExpectation: '70k – 82k € / an',
      skills: [
        'TypeScript',
        'React',
        'Node.js',
        'PostgreSQL',
        'Docker',
        'WebSockets',
        'GraphQL',
        'AWS',
      ],
      experiences: [
        {
          id: 'exp_k1',
          role: 'Staff Software Engineer',
          company: 'PayFit Core Platform',
          location: 'Lyon / Remote',
          period: '2022 – Présent',
          description:
            'Architecture du moteur de paie temps réel sur PostgreSQL et Node.js traitant plus de 400 000 bulletins mensuels.',
        },
        {
          id: 'exp_k2',
          role: 'Senior Full-Stack Developer',
          company: 'Alan Health',
          location: 'Paris',
          period: '2019 – 2022',
          description:
            'Développement des modules de remboursement instantané et messagerie sécurisée patient-praticien.',
        },
      ],
      education: [
        {
          id: 'edu_k1',
          degree: 'Diplôme d’Ingénieur Informatique',
          school: 'INSA Lyon',
          year: '2018',
        },
      ],
      languages: [
        { name: 'Français', level: 'Natif' },
        { name: 'Anglais', level: 'Bilingue (C2)' },
        { name: 'Arabe', level: 'Courant' },
      ],
      cvTemplate: 'executive',
      rawCvText: '',
      updatedAt: hoursAgo(6),
    },
    {
      id: 'prof_sophie',
      userId: 'usr_candidate_sophie',
      headline: 'Data & AI Engineer — NLP, Extraction Documentaire & Python',
      summary:
        'Spécialiste en traitement automatique du langage et pipelines de données cloud. Expérience solide en parsing de documents structurés et recherche sémantique.',
      location: 'Bordeaux, France',
      phone: '+33 6 19 33 80 41',
      website: '',
      availability: 'Sous 2 semaines',
      experienceYears: 5,
      salaryExpectation: '58k – 68k € / an',
      skills: [
        'Python',
        'PostgreSQL',
        'NLP',
        'TypeScript',
        'Docker',
        'FastAPI',
        'LLM Evaluation',
        'SQL',
      ],
      experiences: [
        {
          id: 'exp_s1',
          role: 'Senior Data Engineer',
          company: 'ManoMano Insights',
          location: 'Bordeaux',
          period: '2022 – Présent',
          description:
            'Mise en place d’un moteur de normalisation catalogue et d’indexation sémantique multilingue.',
        },
      ],
      education: [
        {
          id: 'edu_s1',
          degree: 'Master Intelligence Artificielle & Données',
          school: 'Université de Bordeaux',
          year: '2021',
        },
      ],
      languages: [
        { name: 'Français', level: 'Natif' },
        { name: 'Anglais', level: 'Courant (C1)' },
      ],
      cvTemplate: 'minimal',
      rawCvText: '',
      updatedAt: hoursAgo(18),
    },
  ];

  const jobs: JobRecord[] = [
    {
      id: 'job_fullstack_ts',
      recruiterId: 'usr_recruiter_claire',
      title: 'Lead Full-Stack Engineer (React / Node.js / PostgreSQL)',
      company: 'NovaPulse Technologies',
      location: 'Paris, France',
      workMode: 'Hybride',
      contractType: 'CDI',
      salaryRange: '68k – 82k €',
      description:
        'Rejoignez notre équipe cœur pour concevoir la prochaine génération de notre plateforme SaaS RH européenne. Vous piloterez l’architecture TypeScript de bout en bout, la modélisation PostgreSQL et les flux temps réel WebSocket.',
      requirements: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'WebSockets'],
      status: 'open',
      createdAt: hoursAgo(36),
    },
    {
      id: 'job_product_designer',
      recruiterId: 'usr_recruiter_claire',
      title: 'Senior Product Designer — Design System',
      company: 'NovaPulse Technologies',
      location: 'Paris / Télétravail',
      workMode: 'Hybride',
      contractType: 'CDI',
      salaryRange: '60k – 74k €',
      description:
        'Façonnez une expérience fluide pour des milliers de recruteurs et candidats. Vous dirigerez notre système de design sous Figma, la recherche utilisateur et l’accessibilité WCAG AA.',
      requirements: ['Figma', 'Design Systems', 'UX Research', 'Accessibilité WCAG', 'Prototypage'],
      status: 'open',
      createdAt: hoursAgo(28),
    },
    {
      id: 'job_data_nlp',
      recruiterId: 'usr_recruiter_marc',
      title: 'Ingénieur IA & Parsing Documentaire',
      company: 'Atelier Cloud Europe',
      location: 'Lyon ou Remote',
      workMode: 'Télétravail',
      contractType: 'CDI',
      salaryRange: '58k – 72k €',
      description:
        'Développez nos moteurs d’extraction structurée de documents, scoring de compatibilité et indexation PostgreSQL pour grands comptes industriels.',
      requirements: ['Python', 'PostgreSQL', 'NLP', 'Docker', 'SQL', 'TypeScript'],
      status: 'open',
      createdAt: hoursAgo(16),
    },
    {
      id: 'job_frontend_freelance',
      recruiterId: 'usr_recruiter_marc',
      title: 'Développeur Frontend React Senior (Mission 6 mois)',
      company: 'Atelier Cloud Europe',
      location: 'Bordeaux / Remote',
      workMode: 'Télétravail',
      contractType: 'Freelance',
      salaryRange: '580 – 680 € / jour',
      description:
        'Accompagnement de notre équipe produit sur la refonte de tableaux de bord analytiques haute densité en React 19, TypeScript et Tailwind CSS.',
      requirements: ['React', 'TypeScript', 'Tailwind CSS', 'Figma'],
      status: 'open',
      createdAt: hoursAgo(9),
    },
  ];

  const applications: ApplicationRecord[] = [
    {
      id: 'app_1',
      jobId: 'job_product_designer',
      candidateId: 'usr_candidate_camille',
      coverNote:
        'Bonjour Claire, mon expérience sur les design systems B2B chez Qonto correspond directement à vos enjeux sur ce poste.',
      matchScore: 95,
      status: 'interview',
      createdAt: hoursAgo(20),
    },
    {
      id: 'app_2',
      jobId: 'job_fullstack_ts',
      candidateId: 'usr_candidate_karim',
      coverNote:
        'Très intéressé par le volet PostgreSQL et messagerie WebSocket temps réel chez NovaPulse.',
      matchScore: 92,
      status: 'shortlisted',
      createdAt: hoursAgo(14),
    },
  ];

  const conversations: ConversationRecord[] = [
    {
      id: 'conv_claire_camille',
      recruiterId: 'usr_recruiter_claire',
      candidateId: 'usr_candidate_camille',
      jobId: 'job_product_designer',
      createdAt: hoursAgo(19),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'conv_claire_karim',
      recruiterId: 'usr_recruiter_claire',
      candidateId: 'usr_candidate_karim',
      jobId: 'job_fullstack_ts',
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(4),
    },
  ];

  const messages: MessageRecord[] = [
    {
      id: 'msg_1',
      conversationId: 'conv_claire_camille',
      senderId: 'usr_recruiter_claire',
      content:
        'Bonjour Camille, votre profil et votre travail sur le design system chez Qonto ont retenu toute notre attention pour le poste de Senior Product Designer.',
      createdAt: hoursAgo(18),
    },
    {
      id: 'msg_2',
      conversationId: 'conv_claire_camille',
      senderId: 'usr_candidate_camille',
      content:
        'Bonjour Claire ! Merci pour votre message. Je suis disponible cette semaine pour un échange de 30 minutes afin de découvrir votre roadmap produit.',
      createdAt: hoursAgo(15),
    },
    {
      id: 'msg_3',
      conversationId: 'conv_claire_camille',
      senderId: 'usr_recruiter_claire',
      content:
        'Parfait, je vous propose jeudi à 14h30 en visio. Est-ce que ce créneau vous convient ?',
      createdAt: hoursAgo(2),
    },
    {
      id: 'msg_4',
      conversationId: 'conv_claire_karim',
      senderId: 'usr_recruiter_claire',
      content:
        'Bonjour Karim, votre architecture PostgreSQL et votre expérience temps réel correspondent à 92% à notre besoin Lead Full-Stack.',
      createdAt: hoursAgo(4),
    },
  ];

  return {
    users,
    profiles,
    jobs,
    applications,
    conversations,
    messages,
  };
}
