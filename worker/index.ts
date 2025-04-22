/// <reference types="@cloudflare/workers-types" />

interface Env {
  GAME_STATE: DurableObjectNamespace;
  DB: D1Database;
}

interface Walnut {
  id: string;
  location: string;
  hiddenBy: string | null;
  foundBy: string | null;
  createdAt: string;
  updatedAt: string;
  foundAt: string | null;
}

interface GameCycle {
  id: string;
  walnuts: Walnut[];
  players: string[];
  startTime: string;
  endTime: string;
  status: 'active' | 'completed';
  getState(): Promise<GameCycle>;
  startCycle(): Promise<void>;
  endCycle(): Promise<void>;
  collectWalnut(walnutId: string, playerId: string): Promise<void>;
}

interface CycleRequestBody {
  action: 'start' | 'end';
}

interface WalnutRequestBody {
  walnutId: string;
  playerId: string;
  position?: string;
}

class GameCycleImpl implements GameCycle {
  id: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'completed';
  walnuts: Walnut[];
  players: string[];

  constructor() {
    this.id = crypto.randomUUID();
    this.startTime = new Date().toISOString();
    this.endTime = '';
    this.status = 'active';
    this.walnuts = [];
    this.players = [];
  }

  async startCycle(): Promise<void> {
    if (this.status !== 'active') {
      this.status = 'active';
      this.startTime = new Date().toISOString();
      this.endTime = '';
    } else {
      throw new Error('Game cycle already active');
    }
  }

  async endCycle(): Promise<void> {
    if (this.status === 'active') {
      this.status = 'completed';
      this.endTime = new Date().toISOString();
    } else {
      throw new Error('Game cycle not active');
    }
  }

  async collectWalnut(walnutId: string, playerId: string): Promise<void> {
    if (this.status !== 'active') {
      throw new Error('Game cycle not active');
    }

    const walnut = this.walnuts.find(w => w.id === walnutId);
    if (!walnut) {
      throw new Error('Walnut not found');
    }
    if (walnut.foundBy !== null) {
      throw new Error('Walnut already collected');
    }

    if (!this.players.includes(playerId)) {
      this.players.push(playerId);
    }

    walnut.foundBy = playerId;
    walnut.foundAt = new Date().toISOString();
    walnut.updatedAt = new Date().toISOString();
  }

  async getState(): Promise<GameCycle> {
    return {
      id: this.id,
      walnuts: [...this.walnuts],
      players: [...this.players],
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
      getState: this.getState.bind(this),
      startCycle: this.startCycle.bind(this),
      endCycle: this.endCycle.bind(this),
      collectWalnut: this.collectWalnut.bind(this)
    };
  }
}

export class GameState {
  private state: DurableObjectState;
  private env: Env;
  private cycle: GameCycle | null = null;
  private storage: DurableObjectStorage;
  private corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...this.corsHeaders,
      },
    });
  }

  private errorResponse(message: string, status = 500): Response {
    return new Response(message, {
      status,
      headers: this.corsHeaders,
    });
  }

  async initialize() {
    this.cycle = new GameCycleImpl();
    this.cycle.walnuts = this.generateSystemWalnuts();
    await this.storage.put('currentCycle', this.cycle);
  }

  private generateSystemWalnuts(): Walnut[] {
    const walnuts: Walnut[] = [];
    // Generate 100 system walnuts with random positions
    for (let i = 0; i < 100; i++) {
      walnuts.push({
        id: crypto.randomUUID(),
        location: JSON.stringify({
          x: (Math.random() - 0.5) * 100, // -50 to 50
          y: 0,
          z: (Math.random() - 0.5) * 100
        }),
        hiddenBy: null, // System hidden
        foundBy: null,
        createdAt: Date.now().toString(),
        updatedAt: Date.now().toString(),
        foundAt: null
      });
    }
    return walnuts;
  }

  async fetch(request: Request) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: this.corsHeaders,
      });
    }

    if (!this.cycle) {
      await this.initialize();
    }

    // Ensure cycle is initialized after the initialize() call
    if (!this.cycle) {
      return this.errorResponse('Failed to initialize game cycle', 500);
    }

    try {
      const url = new URL(request.url);

      switch (url.pathname) {
        case '/api/cycle':
          if (request.method === 'GET') {
            return this.handleGetCycle(request);
          }
          const rawData = await request.json();
          if (!this.isCycleRequestBody(rawData)) {
            return this.errorResponse('Invalid request body', 400);
          }
          return rawData.action === 'start' 
            ? this.initializeGameCycle(request)
            : this.endGameCycle();

        case '/api/walnut':
          if (request.method === 'POST') {
            return this.handleHideWalnut(request);
          } else if (request.method === 'PUT') {
            return this.handleFindWalnut(request);
          }
          return this.errorResponse('Method not allowed', 405);

        case '/api/state':
          if (request.method !== 'GET') {
            return this.errorResponse('Method not allowed', 405);
          }
          return this.jsonResponse(await this.cycle.getState());

        default:
          return this.errorResponse('Not found', 404);
      }
    } catch (error) {
      console.error('Error in fetch:', error);
      return this.errorResponse('Internal server error');
    }
  }

  private isGameCycle(cycle: Partial<GameCycle>): cycle is GameCycle {
    return (
      typeof cycle.id === 'string' &&
      typeof cycle.startTime === 'string' &&
      typeof cycle.endTime === 'string' &&
      typeof cycle.status === 'string' &&
      (cycle.status === 'active' || cycle.status === 'completed') &&
      Array.isArray(cycle.walnuts) &&
      cycle.walnuts.every(walnut => this.isWalnut(walnut)) &&
      Array.isArray(cycle.players) &&
      cycle.players.every(player => typeof player === 'string')
    );
  }

  private isWalnut(data: unknown): data is Walnut {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const walnut = data as Partial<Walnut>;
    return (
      typeof walnut.id === 'string' &&
      typeof walnut.location === 'string' &&
      (walnut.hiddenBy === null || typeof walnut.hiddenBy === 'string') &&
      (walnut.foundBy === null || typeof walnut.foundBy === 'string') &&
      typeof walnut.createdAt === 'string' &&
      typeof walnut.updatedAt === 'string' &&
      (walnut.foundAt === null || typeof walnut.foundAt === 'string')
    );
  }

  private isCycleRequestBody(data: unknown): data is CycleRequestBody {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    const validActions = ['start', 'end'] as const;
    const cycleRequest = data as Partial<CycleRequestBody>;
    return (
      typeof cycleRequest.action === 'string' &&
      validActions.includes(cycleRequest.action as 'start' | 'end')
    );
  }

  private isWalnutRequestBody(data: unknown): data is WalnutRequestBody {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const walnutRequest = data as Partial<WalnutRequestBody>;
    return (
      typeof walnutRequest.walnutId === 'string' &&
      typeof walnutRequest.playerId === 'string' &&
      (walnutRequest.position === undefined || typeof walnutRequest.position === 'string')
    );
  }

  private async handleGetCycle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const cycleId = url.searchParams.get('cycleId');
      
      if (!cycleId) {
        return this.errorResponse('Missing cycleId parameter', 400);
      }

      const cycle = await this.storage.get<GameCycle>(cycleId);
      
      if (!cycle || !this.isGameCycle(cycle)) {
        return this.errorResponse('Cycle not found', 404);
      }

      return this.jsonResponse(cycle);
    } catch (error) {
      console.error('Error in handleGetCycle:', error);
      return this.errorResponse('Internal server error');
    }
  }

  private async handleHideWalnut(request: Request): Promise<Response> {
    try {
      const requestData = await request.json();
      
      if (!this.isWalnutRequestBody(requestData) || !requestData.position) {
        return this.errorResponse('Invalid request body', 400);
      }

      if (!this.cycle) {
        return this.errorResponse('Game cycle not initialized', 500);
      }

      if (this.cycle.status !== 'active') {
        return this.errorResponse('Game cycle not active', 400);
      }

      const walnut = {
        id: crypto.randomUUID(),
        location: requestData.position,
        hiddenBy: requestData.playerId,
        foundBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        foundAt: null
      };

      this.cycle.walnuts.push(walnut);
      await this.storage.put('currentCycle', this.cycle);

      return this.jsonResponse(walnut);
    } catch (error) {
      console.error('Error in handleHideWalnut:', error);
      return this.errorResponse('Internal server error');
    }
  }

  private async handleFindWalnut(request: Request): Promise<Response> {
    try {
      const requestData = await request.json();
      
      if (!this.isWalnutRequestBody(requestData) || !requestData.walnutId) {
        return this.errorResponse('Invalid request body', 400);
      }

      if (!this.cycle) {
        return this.errorResponse('Game cycle not initialized', 500);
      }

      if (this.cycle.status !== 'active') {
        return this.errorResponse('Game cycle not active', 400);
      }

      const walnut = this.cycle.walnuts.find(w => w.id === requestData.walnutId);
      
      if (!walnut) {
        return this.errorResponse('Walnut not found', 404);
      }

      if (walnut.foundBy !== null) {
        return this.errorResponse('Walnut already collected', 400);
      }

      walnut.foundBy = requestData.playerId;
      walnut.foundAt = new Date().toISOString();
      walnut.updatedAt = new Date().toISOString();
      
      if (!this.cycle.players.includes(requestData.playerId)) {
        this.cycle.players.push(requestData.playerId);
      }

      await this.storage.put('currentCycle', this.cycle);

      return this.jsonResponse(walnut);
    } catch (error) {
      console.error('Error in handleFindWalnut:', error);
      return this.errorResponse('Internal server error');
    }
  }

  private async initializeGameCycle(request: Request): Promise<Response> {
    await this.initialize();
    return this.handleGetCycle(request);
  }

  private async endGameCycle(): Promise<Response> {
    this.cycle = null;
    await this.storage.delete('currentCycle');
    return new Response('Game cycle ended', { status: 200 });
  }

  private async handleWalnutRequest(walnutId: string, playerId: string): Promise<Response> {
    if (!this.cycle) {
      await this.initialize();
      if (!this.cycle) {
        return new Response('Failed to initialize game cycle', { status: 500 });
      }
    }

    const walnut = this.cycle.walnuts.find(w => w.id === walnutId);

    if (!walnut || walnut.foundBy) {
      return new Response('Walnut not found or already collected', { status: 404 });
    }

    walnut.foundBy = playerId;
    walnut.updatedAt = Date.now().toString();
    await this.storage.put('currentCycle', this.cycle);

    return new Response(JSON.stringify(walnut), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleCollectWalnut(request: Request): Promise<Response> {
    try {
      const requestData = await request.json();
      
      if (!this.isWalnutRequestBody(requestData) || !requestData.walnutId || !requestData.playerId) {
        return this.errorResponse('Invalid request body', 400);
      }

      if (!this.cycle) {
        return this.errorResponse('Game cycle not initialized', 500);
      }

      await this.cycle.collectWalnut(requestData.walnutId, requestData.playerId);
      await this.storage.put('currentCycle', this.cycle);

      return this.jsonResponse(await this.cycle.getState());
    } catch (error) {
      console.error('Error in handleCollectWalnut:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      const status = message.includes('not found') ? 404 :
                    message.includes('already collected') ? 400 :
                    message.includes('not active') ? 400 : 500;
      return this.errorResponse(message, status);
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const id = env.GAME_STATE.idFromName('current');
    const gameState = env.GAME_STATE.get(id);
    return gameState.fetch(request);
  }
}; 