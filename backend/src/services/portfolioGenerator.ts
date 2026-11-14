import { GoogleGenAI, Type } from '@google/genai';
import { EducationItem, ExperienceItem, LanguageItem } from '../types.ts';

export type PortfolioFramework = 'tailwind' | 'bootstrap';
export type PortfolioStyle = 'editorial' | 'dark-tech' | 'corporate';

export interface PortfolioInputProfile {
  fullName: string;
  headline: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  availability?: string;
  experienceYears?: number;
  summary?: string;
  skills: string[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  languages: LanguageItem[];
}

interface PortfolioCopy {
  heroTagline: string;
  aboutLead: string;
  projects: Array<{
    title: string;
    context: string;
    summary: string;
    tags: string[];
    impact: string;
  }>;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildFallbackCopy(profile: PortfolioInputProfile): PortfolioCopy {
  const topSkills = profile.skills.slice(0, 6);
  const projects =
    profile.experiences.length > 0
      ? profile.experiences.map((exp, idx) => ({
          title: exp.role || `Projet ${idx + 1}`,
          context: [exp.company, exp.period].filter(Boolean).join(' · '),
          summary:
            exp.description ||
            `Contribution clé en tant que ${exp.role} chez ${exp.company || 'organisation partenaire'}.`,
          tags: topSkills.slice(idx % Math.max(1, topSkills.length), (idx % Math.max(1, topSkills.length)) + 3).length
            ? topSkills.slice(0, 3)
            : ['Architecture', 'Livraison'],
          impact: exp.location ? `Basé à ${exp.location}` : 'Mise en production',
        }))
      : [
          {
            title: profile.headline || 'Réalisation Principale',
            context: profile.location || 'Portfolio Professionnel',
            summary:
              profile.summary ||
              'Conception et livraison de solutions orientées qualité, performance et expérience utilisateur.',
            tags: topSkills.slice(0, 4),
            impact: `${profile.experienceYears || 2}+ ans d’expérience`,
          },
        ];

  return {
    heroTagline:
      profile.headline || 'Professionnel orienté impact, conception et exécution',
    aboutLead:
      profile.summary ||
      `${profile.fullName} accompagne les équipes et entreprises grâce à une maîtrise approfondie de ${topSkills.join(', ') || 'son domaine'}.`,
    projects,
  };
}

async function enrichPortfolioCopyWithGemini(
  profile: PortfolioInputProfile
): Promise<{ copy: PortfolioCopy; generatedBy: 'gemini' | 'template' }> {
  const ai = getGeminiClient();
  if (!ai) {
    return { copy: buildFallbackCopy(profile), generatedBy: 'template' };
  }

  try {
    const prompt = `Tu es un directeur artistique et rédacteur de portfolios professionnels.
À partir uniquement des données du CV ci-dessous (ne jamais inventer de fausses entreprises ou diplômes), rédige :
1. heroTagline : une phrase d'accroche courte et percutante (max 16 mots) pour le hero du portfolio.
2. aboutLead : un paragraphe fluide à la 1ère ou 3ème personne présentant le profil (max 55 mots).
3. projects : entre 2 et 4 cartes "Réalisations / Projets" directement basées sur les expériences et compétences du CV (title, context, summary, tags, impact).

CV JSON :
${JSON.stringify(profile)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            heroTagline: { type: Type.STRING },
            aboutLead: { type: Type.STRING },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  context: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  impact: { type: Type.STRING },
                },
                required: ['title', 'context', 'summary', 'tags', 'impact'],
              },
            },
          },
          required: ['heroTagline', 'aboutLead', 'projects'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<PortfolioCopy>;
    if (parsed.heroTagline && parsed.aboutLead && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
      return {
        copy: {
          heroTagline: parsed.heroTagline,
          aboutLead: parsed.aboutLead,
          projects: parsed.projects.slice(0, 6),
        },
        generatedBy: 'gemini',
      };
    }
  } catch (err) {
    console.warn('Gemini portfolio copy generation fallback:', err);
  }

  return { copy: buildFallbackCopy(profile), generatedBy: 'template' };
}

function renderTailwindPortfolio(
  profile: PortfolioInputProfile,
  copy: PortfolioCopy,
  style: PortfolioStyle
): string {
  const isDark = style === 'dark-tech';
  const accentBg = style === 'corporate' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-blue-700 hover:bg-blue-800';
  const accentText = isDark ? 'text-blue-400' : style === 'corporate' ? 'text-slate-800' : 'text-blue-700';
  const bodyClass = isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const cardClass = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';
  const headerClass = isDark
    ? 'bg-slate-950/90 border-slate-800'
    : 'bg-white/95 border-slate-200';

  const uniqueFilterTags = Array.from(
    new Set(copy.projects.flatMap((p) => p.tags).slice(0, 6))
  );

  const projectCardsHtml = copy.projects
    .map((proj, idx) => {
      const tagsAttr = escapeHtml(proj.tags.join(',').toLowerCase());
      return `
      <article class="project-card border ${cardClass} rounded-xl p-6 flex flex-col justify-between gap-4 transition-transform duration-200 hover:-translate-y-0.5" data-tags="${tagsAttr}">
        <div class="space-y-2">
          <p class="text-xs font-mono ${mutedText}">${escapeHtml(proj.context)}</p>
          <h3 class="text-lg font-bold tracking-tight">${escapeHtml(proj.title)}</h3>
          <p class="text-sm ${mutedText} leading-relaxed">${escapeHtml(proj.summary)}</p>
        </div>
        <div class="pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} flex items-center justify-between gap-2 text-xs">
          <span class="${mutedText} truncate">${escapeHtml(proj.tags.join(' · '))}</span>
          <button type="button" onclick="openProjectModal(${idx})" class="font-semibold ${accentText} hover:underline shrink-0 cursor-pointer">Détails</button>
        </div>
      </article>`;
    })
    .join('\n');

  const experienceRowsHtml = profile.experiences
    .map(
      (exp) => `
      <div class="border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-5 last:border-b-0 last:pb-0">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-base font-semibold">${escapeHtml(exp.role)} — <span class="${mutedText} font-normal">${escapeHtml(exp.company)}</span></h3>
          <span class="font-mono text-xs ${mutedText}">${escapeHtml(exp.period)}</span>
        </div>
        <p class="text-xs ${mutedText} mt-0.5">${escapeHtml(exp.location)}</p>
        ${exp.description ? `<p class="text-sm ${mutedText} mt-2 leading-relaxed">${escapeHtml(exp.description)}</p>` : ''}
      </div>`
    )
    .join('\n');

  const educationHtml = profile.education
    .map(
      (edu) => `
      <div class="border ${cardClass} rounded-xl p-5">
        <p class="font-mono text-xs ${accentText} font-semibold">${escapeHtml(edu.year)}</p>
        <h3 class="text-sm font-bold mt-1">${escapeHtml(edu.degree)}</h3>
        <p class="text-xs ${mutedText} mt-0.5">${escapeHtml(edu.school)}</p>
      </div>`
    )
    .join('\n');

  const projectsJson = JSON.stringify(copy.projects).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="fr" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(profile.fullName)} — Portfolio Professionnel</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'DM Sans', system-ui, sans-serif; }
    h1, h2, h3 { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  </style>
</head>
<body class="${bodyClass} antialiased transition-colors duration-200">
  <header class="sticky top-0 z-40 backdrop-blur border-b ${headerClass}">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
      <a href="#top" class="text-lg font-bold tracking-tight whitespace-nowrap">${escapeHtml(profile.fullName)}</a>
      <nav class="hidden md:flex items-center gap-7 text-sm font-medium ${mutedText}">
        <a href="#apropos" class="hover:opacity-80">À propos</a>
        <a href="#projets" class="hover:opacity-80">Réalisations</a>
        <a href="#parcours" class="hover:opacity-80">Parcours</a>
        <a href="#contact" class="hover:opacity-80">Contact</a>
      </nav>
      <div class="flex items-center gap-3">
        <button id="theme-toggle" type="button" class="px-3 py-1.5 text-xs font-medium border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'} rounded-lg cursor-pointer">
          Thème
        </button>
        <a href="#contact" class="hidden sm:inline-block px-4 py-2 text-xs font-semibold text-white ${accentBg} rounded-lg whitespace-nowrap">
          Me contacter
        </a>
        <button id="mobile-menu-btn" type="button" class="md:hidden px-2.5 py-1.5 border ${isDark ? 'border-slate-700' : 'border-slate-300'} rounded-lg text-xs">
          Menu
        </button>
      </div>
    </div>
    <div id="mobile-menu" class="hidden md:hidden px-6 pb-4 space-y-2 text-sm">
      <a href="#apropos" class="block py-1">À propos</a>
      <a href="#projets" class="block py-1">Réalisations</a>
      <a href="#parcours" class="block py-1">Parcours</a>
      <a href="#contact" class="block py-1">Contact</a>
    </div>
  </header>

  <main id="top" class="max-w-6xl mx-auto px-6 py-14 space-y-20">
    <!-- Hero -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <div class="lg:col-span-8 space-y-5">
        <p class="text-xs font-semibold uppercase tracking-wider ${accentText}">
          ${escapeHtml([profile.location, profile.availability ? `Disponibilité : ${profile.availability}` : ''].filter(Boolean).join(' · '))}
        </p>
        <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
          ${escapeHtml(copy.heroTagline)}
        </h1>
        <p class="text-base sm:text-lg ${mutedText} max-w-2xl leading-relaxed">
          ${escapeHtml(copy.aboutLead)}
        </p>
        <div class="flex flex-wrap items-center gap-3 pt-2">
          <a href="#projets" class="px-5 py-2.5 text-sm font-semibold text-white ${accentBg} rounded-lg">
            Voir mes réalisations
          </a>
          <a href="#contact" class="px-5 py-2.5 text-sm font-semibold border ${isDark ? 'border-slate-700 hover:bg-slate-900' : 'border-slate-300 hover:bg-slate-100'} rounded-lg">
            Discuter d’un projet
          </a>
        </div>
      </div>
      <div class="lg:col-span-4 border ${cardClass} rounded-xl p-6 space-y-4">
        <p class="text-xs font-semibold uppercase tracking-wider ${mutedText}">En bref</p>
        <div class="space-y-3 text-sm">
          <div>
            <p class="text-xs ${mutedText}">Poste ciblé</p>
            <p class="font-semibold">${escapeHtml(profile.headline)}</p>
          </div>
          <div>
            <p class="text-xs ${mutedText}">Expérience</p>
            <p class="font-semibold font-mono">${escapeHtml(String(profile.experienceYears || 3))}+ ans</p>
          </div>
          ${profile.email ? `<div><p class="text-xs ${mutedText}">Email</p><p class="font-medium break-all">${escapeHtml(profile.email)}</p></div>` : ''}
          ${profile.website ? `<div><p class="text-xs ${mutedText}">Site / Lien</p><a href="${escapeHtml(profile.website)}" target="_blank" rel="noreferrer" class="${accentText} hover:underline break-all">${escapeHtml(profile.website)}</a></div>` : ''}
        </div>
      </div>
    </section>

    <!-- À propos & Compétences -->
    <section id="apropos" class="space-y-6 pt-8 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}">
      <div class="max-w-3xl space-y-2">
        <h2 class="text-2xl font-bold tracking-tight">Compétences &amp; Domaines d’expertise</h2>
        <p class="text-sm ${mutedText}">Stack technique et savoir-faire mobilisés sur mes projets.</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        ${profile.skills
          .map(
            (skill) =>
              `<div class="border ${cardClass} rounded-lg px-4 py-3 text-sm font-medium">${escapeHtml(skill)}</div>`
          )
          .join('\n')}
      </div>
    </section>

    <!-- Projets & Réalisations avec filtre JS -->
    <section id="projets" class="space-y-6 pt-8 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">Réalisations &amp; Projets clés</h2>
          <p class="text-sm ${mutedText} mt-1">Sélection d’expériences et livrables issus de mon parcours.</p>
        </div>
        <div class="flex flex-wrap gap-1.5" id="project-filters">
          <button type="button" data-filter="all" class="filter-btn px-3 py-1.5 text-xs font-semibold text-white ${accentBg} rounded-md cursor-pointer">Tous</button>
          ${uniqueFilterTags
            .map(
              (tag) =>
                `<button type="button" data-filter="${escapeHtml(tag.toLowerCase())}" class="filter-btn px-3 py-1.5 text-xs font-medium border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'} rounded-md cursor-pointer">${escapeHtml(tag)}</button>`
            )
            .join('\n')}
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${projectCardsHtml}
      </div>
    </section>

    <!-- Parcours & Formations -->
    <section id="parcours" class="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}">
      <div class="lg:col-span-7 space-y-5">
        <h2 class="text-2xl font-bold tracking-tight">Expériences professionnelles</h2>
        <div class="border ${cardClass} rounded-xl p-6 space-y-5">
          ${experienceRowsHtml || `<p class="text-sm ${mutedText}">Expériences disponibles sur demande.</p>`}
        </div>
      </div>
      <div class="lg:col-span-5 space-y-5">
        <h2 class="text-2xl font-bold tracking-tight">Formations &amp; Langues</h2>
        <div class="space-y-3">
          ${educationHtml}
        </div>
        ${
          profile.languages.length > 0
            ? `<div class="border ${cardClass} rounded-xl p-5 space-y-1">
                 <p class="text-xs font-semibold uppercase tracking-wider ${mutedText}">Langues</p>
                 <p class="text-sm font-medium">${escapeHtml(profile.languages.map((l) => `${l.name} (${l.level})`).join(' · '))}</p>
               </div>`
            : ''
        }
      </div>
    </section>

    <!-- Contact -->
    <section id="contact" class="border ${cardClass} rounded-xl p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div class="lg:col-span-5 space-y-3">
        <h2 class="text-2xl font-bold tracking-tight">Travaillons ensemble</h2>
        <p class="text-sm ${mutedText} leading-relaxed">
          Disponible pour échanger sur vos opportunités, missions ou projets techniques.
        </p>
        <div class="pt-2 space-y-1 text-sm">
          ${profile.email ? `<p><span class="${mutedText}">Email :</span> ${escapeHtml(profile.email)}</p>` : ''}
          ${profile.phone ? `<p><span class="${mutedText}">Téléphone :</span> ${escapeHtml(profile.phone)}</p>` : ''}
          ${profile.location ? `<p><span class="${mutedText}">Localisation :</span> ${escapeHtml(profile.location)}</p>` : ''}
        </div>
      </div>
      <form id="contact-form" class="lg:col-span-7 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input id="c-name" required type="text" placeholder="Votre nom" class="w-full px-3.5 py-2.5 text-sm bg-transparent border ${isDark ? 'border-slate-700' : 'border-slate-300'} rounded-lg" />
          <input id="c-email" required type="email" placeholder="Votre email" class="w-full px-3.5 py-2.5 text-sm bg-transparent border ${isDark ? 'border-slate-700' : 'border-slate-300'} rounded-lg" />
        </div>
        <textarea id="c-message" required rows="3" placeholder="Décrivez votre besoin ou proposition..." class="w-full px-3.5 py-2.5 text-sm bg-transparent border ${isDark ? 'border-slate-700' : 'border-slate-300'} rounded-lg"></textarea>
        <div class="flex items-center justify-between gap-4">
          <p id="contact-feedback" class="text-xs font-medium text-emerald-600 hidden">Message prêt ! Merci pour votre prise de contact.</p>
          <button type="submit" class="ml-auto px-5 py-2.5 text-xs font-semibold text-white ${accentBg} rounded-lg cursor-pointer">
            Envoyer le message
          </button>
        </div>
      </form>
    </section>
  </main>

  <footer class="border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} py-6 text-center text-xs ${mutedText}">
    © ${new Date().getFullYear()} ${escapeHtml(profile.fullName)} · Portfolio généré depuis CV via TalentMatch
  </footer>

  <!-- Project Details Modal -->
  <div id="project-modal" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="border ${cardClass} rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p id="modal-context" class="text-xs font-mono ${mutedText}"></p>
          <h3 id="modal-title" class="text-lg font-bold mt-1"></h3>
        </div>
        <button type="button" onclick="closeProjectModal()" class="text-sm font-semibold ${mutedText} cursor-pointer">Fermer</button>
      </div>
      <p id="modal-summary" class="text-sm ${mutedText} leading-relaxed"></p>
      <p id="modal-impact" class="text-xs font-semibold ${accentText}"></p>
      <p id="modal-tags" class="text-xs ${mutedText}"></p>
    </div>
  </div>

  <script>
    const PROJECTS = ${projectsJson};

    // Menu mobile
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // Bascule thème clair/sombre dynamique
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('bg-slate-950');
        document.body.classList.toggle('text-slate-100');
        document.body.classList.toggle('bg-slate-50');
        document.body.classList.toggle('text-slate-900');
      });
    }

    // Filtrage interactif des réalisations
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-filter') || 'all';
        filterButtons.forEach((b) => {
          b.classList.remove('bg-blue-700', 'bg-slate-900', 'text-white');
        });
        btn.classList.add('bg-blue-700', 'text-white');

        projectCards.forEach((card) => {
          const tags = card.getAttribute('data-tags') || '';
          const match = selected === 'all' || tags.includes(selected);
          card.classList.toggle('hidden', !match);
        });
      });
    });

    // Modale de détails projet
    function openProjectModal(index) {
      const p = PROJECTS[index];
      if (!p) return;
      document.getElementById('modal-context').textContent = p.context;
      document.getElementById('modal-title').textContent = p.title;
      document.getElementById('modal-summary').textContent = p.summary;
      document.getElementById('modal-impact').textContent = 'Impact : ' + p.impact;
      document.getElementById('modal-tags').textContent = 'Compétences : ' + p.tags.join(' · ');
      document.getElementById('project-modal').classList.remove('hidden');
    }
    function closeProjectModal() {
      document.getElementById('project-modal').classList.add('hidden');
    }

    // Formulaire de contact
    const contactForm = document.getElementById('contact-form');
    const contactFeedback = document.getElementById('contact-feedback');
    if (contactForm && contactFeedback) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        contactFeedback.classList.remove('hidden');
        contactForm.reset();
      });
    }
  </script>
</body>
</html>`;
}

function renderBootstrapPortfolio(
  profile: PortfolioInputProfile,
  copy: PortfolioCopy,
  style: PortfolioStyle
): string {
  const isDark = style === 'dark-tech';
  const bsTheme = isDark ? 'dark' : 'light';
  const btnClass = style === 'corporate' ? 'btn-dark' : 'btn-primary';
  const uniqueFilterTags = Array.from(
    new Set(copy.projects.flatMap((p) => p.tags).slice(0, 6))
  );
  const projectsJson = JSON.stringify(copy.projects).replace(/</g, '\\u003c');

  const projectCardsHtml = copy.projects
    .map((proj, idx) => {
      const tagsAttr = escapeHtml(proj.tags.join(',').toLowerCase());
      return `
      <div class="col-md-6 project-item" data-tags="${tagsAttr}">
        <div class="card h-100 shadow-sm border">
          <div class="card-body d-flex flex-column justify-content-between p-4">
            <div>
              <div class="text-body-secondary small font-monospace mb-1">${escapeHtml(proj.context)}</div>
              <h3 class="h5 fw-bold mb-2">${escapeHtml(proj.title)}</h3>
              <p class="text-body-secondary small mb-3">${escapeHtml(proj.summary)}</p>
            </div>
            <div class="pt-3 border-top d-flex align-items-center justify-content-between gap-2">
              <span class="small text-body-secondary text-truncate">${escapeHtml(proj.tags.join(' · '))}</span>
              <button type="button" class="btn btn-sm btn-link text-decoration-none fw-semibold p-0" onclick="openProjectModal(${idx})">
                Détails
              </button>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join('\n');

  const experienceHtml = profile.experiences
    .map(
      (exp) => `
      <div class="pb-3 mb-3 border-bottom">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
          <h3 class="h6 fw-bold mb-0">${escapeHtml(exp.role)} — <span class="fw-normal text-body-secondary">${escapeHtml(exp.company)}</span></h3>
          <span class="small font-monospace text-body-secondary">${escapeHtml(exp.period)}</span>
        </div>
        <div class="small text-body-secondary mb-1">${escapeHtml(exp.location)}</div>
        ${exp.description ? `<p class="small text-body-secondary mb-0">${escapeHtml(exp.description)}</p>` : ''}
      </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr" data-bs-theme="${bsTheme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(profile.fullName)} — Portfolio Professionnel</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'DM Sans', system-ui, sans-serif; }
    h1, h2, h3, .navbar-brand { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg border-bottom sticky-top bg-body">
    <div class="container py-1">
      <a class="navbar-brand fw-bold" href="#top">${escapeHtml(profile.fullName)}</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav mx-auto mb-2 mb-lg-0 gap-lg-3">
          <li class="nav-item"><a class="nav-link" href="#competences">Compétences</a></li>
          <li class="nav-item"><a class="nav-link" href="#projets">Réalisations</a></li>
          <li class="nav-item"><a class="nav-link" href="#parcours">Parcours</a></li>
          <li class="nav-item"><a class="nav-link" href="#contact">Contact</a></li>
        </ul>
        <div class="d-flex gap-2">
          <button id="bs-theme-toggle" type="button" class="btn btn-outline-secondary btn-sm">Thème</button>
          <a href="#contact" class="btn ${btnClass} btn-sm fw-semibold">Me contacter</a>
        </div>
      </div>
    </div>
  </nav>

  <main id="top" class="container py-5">
    <!-- Hero -->
    <section class="row align-items-center g-4 pb-5 border-bottom">
      <div class="col-lg-8">
        <p class="text-primary small fw-semibold text-uppercase mb-2">
          ${escapeHtml([profile.location, profile.availability ? `Disponibilité : ${profile.availability}` : ''].filter(Boolean).join(' · '))}
        </p>
        <h1 class="display-5 fw-bold mb-3">${escapeHtml(copy.heroTagline)}</h1>
        <p class="lead text-body-secondary mb-4">${escapeHtml(copy.aboutLead)}</p>
        <div class="d-flex flex-wrap gap-2">
          <a href="#projets" class="btn ${btnClass} px-4 fw-semibold">Voir mes réalisations</a>
          <a href="#contact" class="btn btn-outline-secondary px-4 fw-semibold">Discuter d’un projet</a>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card border shadow-sm">
          <div class="card-body p-4">
            <p class="text-uppercase small fw-semibold text-body-secondary mb-3">Synthèse profil</p>
            <div class="mb-3">
              <div class="small text-body-secondary">Poste</div>
              <div class="fw-semibold">${escapeHtml(profile.headline)}</div>
            </div>
            <div class="mb-3">
              <div class="small text-body-secondary">Expérience</div>
              <div class="fw-semibold font-monospace">${escapeHtml(String(profile.experienceYears || 3))}+ ans</div>
            </div>
            ${profile.email ? `<div class="mb-2"><div class="small text-body-secondary">Email</div><div class="small fw-medium">${escapeHtml(profile.email)}</div></div>` : ''}
            ${profile.website ? `<div><div class="small text-body-secondary">Lien</div><a href="${escapeHtml(profile.website)}" target="_blank" rel="noreferrer" class="small">${escapeHtml(profile.website)}</a></div>` : ''}
          </div>
        </div>
      </div>
    </section>

    <!-- Compétences -->
    <section id="competences" class="py-5 border-bottom">
      <h2 class="h3 fw-bold mb-4">Compétences clés</h2>
      <div class="row g-2">
        ${profile.skills
          .map(
            (s) =>
              `<div class="col-6 col-md-3"><div class="p-3 border rounded bg-body-tertiary fw-medium small">${escapeHtml(s)}</div></div>`
          )
          .join('\n')}
      </div>
    </section>

    <!-- Projets -->
    <section id="projets" class="py-5 border-bottom">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h2 class="h3 fw-bold mb-1">Réalisations &amp; Projets</h2>
          <p class="small text-body-secondary mb-0">Filtrer par compétence technique</p>
        </div>
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn ${btnClass} bs-filter-btn" data-filter="all">Tous</button>
          ${uniqueFilterTags
            .map(
              (tag) =>
                `<button type="button" class="btn btn-outline-secondary bs-filter-btn" data-filter="${escapeHtml(tag.toLowerCase())}">${escapeHtml(tag)}</button>`
            )
            .join('\n')}
        </div>
      </div>
      <div class="row g-4">
        ${projectCardsHtml}
      </div>
    </section>

    <!-- Parcours & Formation -->
    <section id="parcours" class="py-5 border-bottom">
      <div class="row g-5">
        <div class="col-lg-7">
          <h2 class="h3 fw-bold mb-4">Expériences professionnelles</h2>
          <div class="card border p-4">
            ${experienceHtml || '<p class="small text-body-secondary mb-0">Parcours disponible sur demande.</p>'}
          </div>
        </div>
        <div class="col-lg-5">
          <h2 class="h3 fw-bold mb-4">Formation &amp; Langues</h2>
          <div class="d-grid gap-3">
            ${profile.education
              .map(
                (edu) => `
                <div class="card border p-3">
                  <div class="small font-monospace text-primary fw-semibold">${escapeHtml(edu.year)}</div>
                  <div class="fw-bold small mt-1">${escapeHtml(edu.degree)}</div>
                  <div class="small text-body-secondary">${escapeHtml(edu.school)}</div>
                </div>`
              )
              .join('\n')}
            ${
              profile.languages.length > 0
                ? `<div class="card border p-3"><div class="small text-body-secondary fw-semibold mb-1">Langues</div><div class="small">${escapeHtml(profile.languages.map((l) => `${l.name} (${l.level})`).join(' · '))}</div></div>`
                : ''
            }
          </div>
        </div>
      </div>
    </section>

    <!-- Contact -->
    <section id="contact" class="py-5">
      <div class="card border p-4 p-md-5">
        <div class="row g-4">
          <div class="col-lg-5">
            <h2 class="h3 fw-bold mb-2">Contact direct</h2>
            <p class="small text-body-secondary">Écrivez-moi pour discuter d’un poste ou d’une collaboration.</p>
            ${profile.email ? `<p class="small mb-1"><strong>Email :</strong> ${escapeHtml(profile.email)}</p>` : ''}
            ${profile.phone ? `<p class="small mb-1"><strong>Téléphone :</strong> ${escapeHtml(profile.phone)}</p>` : ''}
            ${profile.location ? `<p class="small mb-0"><strong>Ville :</strong> ${escapeHtml(profile.location)}</p>` : ''}
          </div>
          <div class="col-lg-7">
            <form id="bs-contact-form" class="row g-3">
              <div class="col-sm-6">
                <input required type="text" class="form-control" placeholder="Votre nom" />
              </div>
              <div class="col-sm-6">
                <input required type="email" class="form-control" placeholder="Votre email" />
              </div>
              <div class="col-12">
                <textarea required rows="3" class="form-control" placeholder="Votre message..."></textarea>
              </div>
              <div class="col-12 d-flex justify-content-between align-items-center">
                <span id="bs-contact-ok" class="small text-success fw-semibold d-none">Message validé avec succès.</span>
                <button type="submit" class="btn ${btnClass} ms-auto fw-semibold px-4">Envoyer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="border-top py-4 text-center small text-body-secondary">
    © ${new Date().getFullYear()} ${escapeHtml(profile.fullName)} · Généré avec Bootstrap 5 &amp; TalentMatch
  </footer>

  <!-- Modal -->
  <div class="modal fade" id="bsProjectModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <div id="bs-modal-context" class="small font-monospace text-body-secondary"></div>
            <h5 class="modal-title fw-bold" id="bs-modal-title"></h5>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
        </div>
        <div class="modal-body">
          <p id="bs-modal-summary" class="small text-body-secondary"></p>
          <p id="bs-modal-impact" class="small fw-semibold text-primary mb-1"></p>
          <p id="bs-modal-tags" class="small text-body-secondary mb-0"></p>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    const PROJECTS = ${projectsJson};

    // Bascule thème Bootstrap 5.3
    const themeBtn = document.getElementById('bs-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const html = document.documentElement;
        html.setAttribute('data-bs-theme', html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
      });
    }

    // Filtrage JS
    document.querySelectorAll('.bs-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-filter') || 'all';
        document.querySelectorAll('.bs-filter-btn').forEach((b) => {
          b.classList.remove('btn-primary', 'btn-dark');
          b.classList.add('btn-outline-secondary');
        });
        btn.classList.remove('btn-outline-secondary');
        btn.classList.add('btn-primary');

        document.querySelectorAll('.project-item').forEach((card) => {
          const tags = card.getAttribute('data-tags') || '';
          card.classList.toggle('d-none', selected !== 'all' && !tags.includes(selected));
        });
      });
    });

    function openProjectModal(index) {
      const p = PROJECTS[index];
      if (!p) return;
      document.getElementById('bs-modal-context').textContent = p.context;
      document.getElementById('bs-modal-title').textContent = p.title;
      document.getElementById('bs-modal-summary').textContent = p.summary;
      document.getElementById('bs-modal-impact').textContent = 'Impact : ' + p.impact;
      document.getElementById('bs-modal-tags').textContent = 'Compétences : ' + p.tags.join(' · ');
      const modal = new bootstrap.Modal(document.getElementById('bsProjectModal'));
      modal.show();
    }

    const form = document.getElementById('bs-contact-form');
    const okMsg = document.getElementById('bs-contact-ok');
    if (form && okMsg) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        okMsg.classList.remove('d-none');
        form.reset();
      });
    }
  </script>
</body>
</html>`;
}

export async function generatePortfolioFromCV(input: {
  profile: PortfolioInputProfile;
  framework: PortfolioFramework;
  style: PortfolioStyle;
}): Promise<{
  html: string;
  framework: PortfolioFramework;
  style: PortfolioStyle;
  generatedBy: 'gemini' | 'template';
}> {
  const { copy, generatedBy } = await enrichPortfolioCopyWithGemini(input.profile);
  const html =
    input.framework === 'bootstrap'
      ? renderBootstrapPortfolio(input.profile, copy, input.style)
      : renderTailwindPortfolio(input.profile, copy, input.style);

  return {
    html,
    framework: input.framework,
    style: input.style,
    generatedBy,
  };
}
