import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './backend/src/app.ts';
import { attachWebSocketServer } from './backend/src/ws/chatServer.ts';

dotenv.config();

async function bootstrap() {
  const PORT = Number(process.env.PORT || 3000);
  const app = createApiApp();
  const httpServer = http.createServer(app);

  attachWebSocketServer(httpServer);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TalentMatch full-stack server running on http://localhost:${PORT}`);
  });
}

bootstrap();
