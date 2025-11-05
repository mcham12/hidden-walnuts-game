// Centralized registry for Durable Object access

export type DOName = 'forest' | 'squirrel' | 'walnuts' | 'leaderboard';

export interface EnvWithBindings {
  // Durable Object bindings
  FOREST: DurableObjectNamespace;
  SQUIRREL: DurableObjectNamespace;
  WALNUTS: DurableObjectNamespace;
  LEADERBOARD: DurableObjectNamespace;
  PLAYER_IDENTITY: DurableObjectNamespace; // MVP 6: Player identity management

  // KV Namespaces
  EMAIL_INDEX: KVNamespace; // MVP 16: Email uniqueness index for authentication

  // Environment variables from wrangler.toml
  ENVIRONMENT: string;
  CYCLE_DURATION_SECONDS: string;

  // MVP 13: Admin secret for secure endpoints
  ADMIN_SECRET: string;

  // MVP 16: Authentication secrets (added via wrangler secret put)
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  JWT_SECRET?: string;
}

// Get the Durable Object ID by name and key
export function getObjectId(
  env: EnvWithBindings,
  name: DOName,
  key: string
): DurableObjectId {
  switch (name) {
    case 'forest':
      return env.FOREST.idFromName(key);
    case 'squirrel':
      return env.SQUIRREL.idFromName(key);
    case 'walnuts':
      return env.WALNUTS.idFromName(key);
    case 'leaderboard':
      return env.LEADERBOARD.idFromName(key);
    default:
      throw new Error(`Unknown DO name: ${name}`);
  }
}

// Get a Durable Object stub instance
export function getObjectInstance(
  env: EnvWithBindings,
  name: DOName,
  key: string
): DurableObjectStub {
  const id = getObjectId(env, name, key);
  switch (name) {
    case 'forest':
      return env.FOREST.get(id);
    case 'squirrel':
      return env.SQUIRREL.get(id);
    case 'walnuts':
      return env.WALNUTS.get(id);
    case 'leaderboard':
      return env.LEADERBOARD.get(id);
    default:
      throw new Error(`Unknown DO name: ${name}`);
  }
}
