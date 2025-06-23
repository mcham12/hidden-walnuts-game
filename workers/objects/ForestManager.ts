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

export class ForestManager implements DurableObject {
  private state: DurableObjectState;
  private env: EnvWithBindings;
  private terrainSeed: number;
  private sessions = new Map<string, WebSocket>();
  private socketToPlayer = new Map<WebSocket, string>();
  players: Map<string, PlayerData> = new Map();
  walnuts: Map<string, any> = new Map();

  constructor(state: DurableObjectState, env: EnvWithBindings) {
    this.state = state;
    this.env = env;
    this.terrainSeed = Math.random() * 1000; // Initialize seed on creation
  }

  async fetch(request: CfRequest): Promise<CfResponse> {
    const url = new URL(request.url);
    console.log(`[Log] ForestManager fetch called for path: ${url.pathname}`);

    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        console.error('[Error] Missing Upgrade header for WebSocket');
        return new Response('Expected Upgrade: websocket', { status: 426 }) as unknown as CfResponse;
      }

      const squirrelId = url.searchParams.get('squirrelId');
      const token = url.searchParams.get('token');
      if (!squirrelId || !token) {
        console.error('[Error] Missing squirrelId or token');
        return new Response('Missing squirrelId or token', { status: 400 }) as unknown as CfResponse;
      }

      console.log(`[Log] Upgrading to WebSocket for squirrelId: ${squirrelId}`);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      await this.handleSocket(server, squirrelId, token);
      return new Response(null, { status: 101, webSocket: client }) as unknown as CfResponse;
    }

    if (url.pathname === "/terrain-seed") {
      const seed = this.terrainSeed;
      return new Response(JSON.stringify({ seed }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }) as unknown as CfResponse;
    }

    if (url.pathname === '/forest-objects') {
      const forestObjects = await this.getForestObjects();
      return new Response(JSON.stringify(forestObjects), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    if (url.pathname === '/map-state') {
      const mapState = await this.getMapState();
      return new Response(JSON.stringify(mapState), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    return new Response('Not Found', { status: 404 }) as unknown as CfResponse;
  }

  async handleSocket(socket: WebSocket, squirrelId: string, token: string) {
    socket.accept();
    this.sessions.set(squirrelId, socket);
    this.socketToPlayer.set(socket, squirrelId);

    // Send initial map state
    const mapState = await this.getMapState();
    socket.send(JSON.stringify({ type: 'init', mapState }));

    socket.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'player_update') {
        this.players.set(squirrelId, {
          squirrelId,
          position: data.position,
          rotationY: data.position.rotationY || 0,
          lastUpdate: Date.now()
        });
        this.broadcastExcept(squirrelId, {
          type: 'player_update',
          squirrelId,
          position: data.position
        });
      }
    });

    socket.addEventListener('close', () => {
      this.handlePlayerLeave(squirrelId);
      this.broadcast({ type: 'player_leave', squirrelId });
    });
  }

  private async processMessage(squirrelId: string, data: any): Promise<void> {
    switch (data.type) {
      case 'ping':
        console.log(`[Log] Ping received from ${squirrelId}`);
        break;
      default:
        console.log(`[Log] Unknown message type from ${squirrelId}: ${data.type}`);
    }
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

  private broadcastExcept(excludeSquirrelId: string, message: any): void {
    const serializedMessage = JSON.stringify(message);
    let broadcastCount = 0;
    
    for (const [squirrelId, socket] of this.sessions.entries()) {
      if (squirrelId !== excludeSquirrelId && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(serializedMessage);
          broadcastCount++;
        } catch (error) {
          console.error(`[Error] Failed to send message to ${squirrelId}:`, error);
          this.sessions.delete(squirrelId); // Clean up dead connections
        }
      }
    }
    
    console.log(`[Log] Broadcasted message to ${broadcastCount} players (excluding ${excludeSquirrelId})`);
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

  private async getTerrainSeed(): Promise<number> {
    // Get or generate terrain seed for the current day
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let terrainSeed = await this.state.storage.get<number>(`terrain-seed-${today}`);
    
    if (!terrainSeed) {
      terrainSeed = Math.random() * 1000;
      await this.state.storage.put(`terrain-seed-${today}`, terrainSeed);
    }
    
    return terrainSeed;
  }

  private async getForestObjects(): Promise<any[]> {
    // Get or generate forest objects for the current day
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let forestObjects = await this.state.storage.get<any[]>(`forest-objects-${today}`);
    
    if (!forestObjects) {
      // Generate forest objects (trees, bushes, etc.)
      forestObjects = this.generateForestObjects();
      await this.state.storage.put(`forest-objects-${today}`, forestObjects);
    }
    
    return forestObjects;
  }

  private async getMapState(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    let mapState = await this.state.storage.get<any[]>(`map-state-${today}`);
    if (!mapState) {
      mapState = this.generateGameWalnuts();
      await this.state.storage.put(`map-state-${today}`, mapState);
      console.log(`[Log] Generated and stored ${mapState.length} walnuts for ${today}`);
    } else {
      console.log(`[Log] Retrieved ${mapState.length} walnuts for ${today}`);
    }
    return mapState;
  }

  private generateGameWalnuts(): any[] {
    const walnuts = [];
    const terrainSize = 200;
    for (let i = 0; i < 100; i++) {
      walnuts.push({
        id: `game-walnut-${i}`,
        ownerId: 'system',
        origin: 'game',
        hiddenIn: Math.random() > 0.5 ? 'buried' : 'bush',
        location: {
          x: (Math.random() - 0.5) * terrainSize,
          y: 0,
          z: (Math.random() - 0.5) * terrainSize
        },
        found: false,
        timestamp: Date.now()
      });
    }
    
    return walnuts;
  }

  private generateForestObjects(): any[] {
    // Generate trees and bushes for the forest
    const objects = [];
    const terrainSize = 200;
    
    // Generate trees
    for (let i = 0; i < TREE_COUNT; i++) {
      objects.push({
        type: 'tree',
        id: `tree-${i}`,
        x: (Math.random() - 0.5) * terrainSize,
        y: 0,
        z: (Math.random() - 0.5) * terrainSize,
        scale: 1
      });
    }
    
    // Generate shrubs (not 'bush' - client expects 'shrub')
    for (let i = 0; i < SHRUB_COUNT; i++) {
      objects.push({
        type: 'shrub',
        id: `shrub-${i}`,
        x: (Math.random() - 0.5) * terrainSize,
        y: 0,
        z: (Math.random() - 0.5) * terrainSize,
        scale: 1
      });
    }
    
    return objects;
  }
}