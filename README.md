# TalentMatch

Plateforme complète de recherche d’emploi et de recrutement avec Studio de création de CV moderne, importation & parsing intelligent de CV, et messagerie temps réel recruteur-candidat.

## Architecture du projet

- `frontend/` — Interface React + TypeScript + Tailwind CSS (prête pour **Vercel**)
- `backend/` — API Node.js + Express + PostgreSQL + WebSockets + Parsing CV Gemini (prête pour **Render** via `Dockerfile` et `render.yaml`)
- `server.ts` — Point d’entrée unifié pour l’exécution locale / conteneur sur le port `3000`
- `docker-compose.yml` — Stack locale complète (PostgreSQL 16 + Backend + Frontend)

## Démarrage local avec Docker

```bash
docker compose up --build
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:4000/api/health
- PostgreSQL : `localhost:5432`

## Déploiement

### 1. Backend + PostgreSQL sur Render
1. Poussez le dépôt sur GitHub.
2. Sur Render, créez un Blueprint depuis `render.yaml` (ou un service Docker pointant sur `backend/Dockerfile`).
3. Configurez les variables d’environnement :
   - `DATABASE_URL` (fournie automatiquement par Render PostgreSQL)
   - `JWT_SECRET`
   - `GEMINI_API_KEY`
   - `CORS_ORIGIN` (URL de votre frontend Vercel)

### 2. Frontend sur Vercel
1. Importez le dépôt sur Vercel.
2. Définissez **Root Directory** sur `frontend`.
3. Ajoutez la variable d’environnement `VITE_API_URL` pointant vers l’URL publique de votre backend Render.
4. Déployez.
