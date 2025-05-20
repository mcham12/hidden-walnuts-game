import { DurableObject, DurableObjectState, WebSocketPair } from '@cloudflare/workers-types';

export class SquirrelSession implements DurableObject {
  private socket: WebSocket | null;

  constructor(state: DurableObjectState) {
    this.socket = null;
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle ping messages
        if (data.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // ... existing message handling code ...
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  }
} 