// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions.

import { POINTS, CYCLE_DURATION_SECONDS, NUT_RUSH_INTERVAL_HOURS, NUT_RUSH_DURATION_MINUTES, TREE_COUNT, SHRUB_COUNT, TERRAIN_SIZE } from "../constants";
import type { Walnut, WalnutOrigin, HidingMethod, ForestObject } from "../types";
import { getObjectInstance, EnvWithBindings } from './registry';
import type { 
  DurableObject, 
  DurableObjectState, 
  DurableObjectStorage, 
  DurableObjectId,
  Request as CfRequest,
  Response as CfResponse,
  WebSocket as CfWebSocket
} from '@cloudflare/workers-types';
import { WebSocketPair } from '@cloudflare/workers-types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

interface PlayerData {
  squirrelId: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  lastUpdate: number;
}

export class ForestManagerDO implements DurableObject {
  private sessions = new Map<string, WebSocket>();
  private socketToPlayer = new Map<WebSocket, string>();
  private state: DurableObjectState;
  env: EnvWithBindings;
  players: Map<string, PlayerData> = new Map();
  walnuts: Map<string, any> = new Map();

  constructor(state: DurableObjectState, env: EnvWithBindings) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: CfRequest): Promise<CfResponse> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/join' && request.method === 'GET') {
      const squirrelId = url.searchParams.get('squirrelId');
      const token = url.searchParams.get('token');
      if (!squirrelId || !token) {
        return new Response('Missing squirrelId or token', { status: 400, headers: CORS_HEADERS }) as unknown as CfResponse;
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      await this.handleSocket(server, squirrelId, token);
      return new Response(null, { status: 101, webSocket: client }) as unknown as CfResponse;
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS }) as unknown as CfResponse;
  }

  async handleSocket(socket: WebSocket, squirrelId: string, token: string): Promise<void> {
    const isValid = await this.validateToken(squirrelId, token);
    if (!isValid) {
      socket.close(1008, "Invalid token");
      return;
    }
    this.sessions.set(squirrelId, socket);
    this.socketToPlayer.set(socket, squirrelId);
    socket.accept();

    // Broadcast new player to all other players
    this.broadcastExcept(squirrelId, {
      type: 'player_join',
      squirrelId,
      position: this.players.get(squirrelId)?.position || { x: 0, y: 0, z: 0 }
    });

    socket.addEventListener('message', async (event) => {
      const playerId = this.socketToPlayer.get(socket);
      if (!playerId) return;
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'heartbeat') {
          socket.send(JSON.stringify({ type: 'pong' }));
          await this.cleanupStalePlayers();
        } else if (data.type === 'player_update') {
          await this.handlePlayerUpdate(playerId, data.position, data.rotationY);
          // Broadcast position update to all other players
          this.broadcastExcept(playerId, {
            type: 'player_update',
            squirrelId: playerId,
            position: data.position
          });
        } else if (data.type === 'walnut_place') {
          await this.handleWalnutPlace(data.walnut);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    socket.addEventListener('close', () => this.handlePlayerLeave(squirrelId));
    socket.addEventListener('error', () => this.handlePlayerLeave(squirrelId));

    await this.handlePlayerJoin(squirrelId);
  }

  private async cleanupStalePlayers(): Promise<void> {
    const now = Date.now();
    const staleTimeout = 30000; // 30 seconds

    for (const [squirrelId, player] of this.players.entries()) {
      if (now - player.lastUpdate > staleTimeout) {
        await this.handlePlayerLeave(squirrelId);
      }
    }
  }

  private async handlePlayerJoin(squirrelId: string): Promise<void> {
    console.log(`Player joined: ${squirrelId}`);
    // Initialize player data if needed
  }

  private handlePlayerLeave(squirrelId: string): void {
    const socket = this.sessions.get(squirrelId);
    if (socket) {
      this.socketToPlayer.delete(socket);
    }
    this.sessions.delete(squirrelId);
  }

  private async handlePlayerUpdate(squirrelId: string, position: { x: number; y: number; z: number }, rotationY: number): Promise<void> {
    this.players.set(squirrelId, {
      squirrelId,
      position,
      rotationY,
      lastUpdate: Date.now()
    });
  }

  private async handleWalnutPlace(walnut: any): Promise<void> {
    // Handle walnut placement logic
    console.log('Walnut placed:', walnut);
  }

  private broadcast(message: any): void {
    const serializedMessage = JSON.stringify(message);
    for (const socket of this.sessions.values()) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(serializedMessage);
        }
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    }
  }

  private broadcastExcept(senderId: string, message: object): void {
    for (const [id, socket] of this.sessions) {
      if (id !== senderId) {
        socket.send(JSON.stringify(message));
      }
    }
  }

  async validateToken(squirrelId: string, token: string): Promise<boolean> {
    const squirrel = this.env.SQUIRREL.get(this.env.SQUIRREL.idFromName(squirrelId));
    const validationResponse = await squirrel.fetch(
      new Request("https://internal/validate", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
    );
    return validationResponse.status === 200;
  }
}