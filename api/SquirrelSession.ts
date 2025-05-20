import { DurableObject, DurableObjectState, Request as CfRequest, Response as CfResponse, WebSocketPair } from '@cloudflare/workers-types';

export class SquirrelSession implements DurableObject {
  private socket: WebSocket | null = null;

  constructor(private state: DurableObjectState) {}

  async fetch(request: CfRequest): Promise<CfResponse> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new CfResponse('Expected Upgrade: websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as unknown as [WebSocket, WebSocket];

    (server as any).accept?.();

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

    return new CfResponse(null, {
      status: 101,
      webSocket: client,
    } as any);
  }
} 