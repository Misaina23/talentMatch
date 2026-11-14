import { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyAuthToken } from '../middleware/auth.ts';
import { repository } from '../db/repository.ts';

interface AuthedSocket extends WebSocket {
  userId?: string;
}

const userSockets = new Map<string, Set<AuthedSocket>>();

function addSocket(userId: string, ws: AuthedSocket) {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(ws);
}

function removeSocket(userId: string, ws: AuthedSocket) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

export function broadcastToUsers(userIds: string[], payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const uid of userIds) {
    const set = userSockets.get(uid);
    if (!set) continue;
    for (const sock of set) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(raw);
      }
    }
  }
}

export function attachWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: AuthedSocket, req) => {
    try {
      const url = new URL(req.url || '/ws', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) {
        ws.close(4001, 'Missing auth token');
        return;
      }
      const payload = verifyAuthToken(token);
      ws.userId = payload.userId;
      addSocket(payload.userId, ws);

      ws.send(JSON.stringify({ type: 'connection:ready', userId: payload.userId }));

      ws.on('message', async (rawData) => {
        if (!ws.userId) return;
        try {
          const event = JSON.parse(rawData.toString());
          if (event.type === 'message:send' && typeof event.conversationId === 'string' && typeof event.content === 'string') {
            const conv = await repository.getConversationById(event.conversationId);
            if (!conv) return;
            const message = await repository.createMessage(event.conversationId, ws.userId, event.content);
            broadcastToUsers([conv.recruiterId, conv.candidateId], {
              type: 'message:new',
              message,
            });
          } else if (event.type === 'typing' && typeof event.conversationId === 'string') {
            const conv = await repository.getConversationById(event.conversationId);
            if (!conv) return;
            const recipientId = conv.recruiterId === ws.userId ? conv.candidateId : conv.recruiterId;
            broadcastToUsers([recipientId], {
              type: 'typing',
              conversationId: conv.id,
              userId: ws.userId,
            });
          }
        } catch (err) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: err instanceof Error ? err.message : 'Erreur WebSocket',
            })
          );
        }
      });

      ws.on('close', () => {
        if (ws.userId) removeSocket(ws.userId, ws);
      });
    } catch {
      ws.close(4002, 'Invalid auth token');
    }
  });

  return wss;
}
