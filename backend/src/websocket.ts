import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface ClientSocket extends WebSocket {
  role?: string;
  organizationId?: string;
  isAlive?: boolean;
}

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: Server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: ClientSocket) => {
    ws.isAlive = true;
    console.log('[WebSocket] Client socket connected');

    ws.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        
        if (parsed.type === 'register') {
          ws.role = parsed.role; // 'superadmin' | 'admin'
          ws.organizationId = parsed.organizationId;
          ws.send(JSON.stringify({ type: 'registered', status: 'ok' }));
          console.log(`[WebSocket] Client registered: role=${ws.role}, orgId=${ws.organizationId}`);
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing client message:', err);
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client socket closed');
    });
  });

  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws: WebSocket) => {
      const client = ws as ClientSocket;
      if (client.isAlive === false) {
        console.log('[WebSocket] Terminating inactive client socket');
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

export function broadcast(event: string, data: any, roleFilter?: 'superadmin' | 'admin', orgIdFilter?: string) {
  if (!wss) return;

  const payload = JSON.stringify({ event, data });

  wss.clients.forEach((ws: WebSocket) => {
    const client = ws as ClientSocket;
    if (client.readyState === WebSocket.OPEN) {
      if (roleFilter && client.role !== roleFilter) return;
      if (orgIdFilter && client.organizationId !== orgIdFilter) return;

      client.send(payload);
    }
  });
}

export function broadcastDonationEvent(event: string, data: any, targetOrgId?: string) {
  if (!wss) return;

  const payload = JSON.stringify({ event, data });

  wss.clients.forEach((ws: WebSocket) => {
    const client = ws as ClientSocket;
    if (client.readyState === WebSocket.OPEN) {
      // Send to Superadmin OR to the specific NGO matching targetOrgId
      if (client.role === 'superadmin' || !targetOrgId || client.organizationId === targetOrgId) {
        client.send(payload);
      }
    }
  });
}
