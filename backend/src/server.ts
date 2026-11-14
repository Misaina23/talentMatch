import http from 'node:http';
import dotenv from 'dotenv';
import { createApiApp } from './app.ts';
import { attachWebSocketServer } from './ws/chatServer.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const app = createApiApp();
const server = http.createServer(app);

attachWebSocketServer(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TalentMatch backend listening on port ${PORT}`);
});
