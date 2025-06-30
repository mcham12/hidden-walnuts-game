// Centralized registry for Durable Object access

export type DOName = 'forest' | 'squirrel' | 'walnuts' | 'leaderboard';

export interface EnvWithBindings {
  // Durable Object bindings
  FOREST: DurableObjectNamespace;
  SQUIRREL: DurableObjectNamespace;
  WALNUTS: DurableObjectNamespace;
  LEADERBOARD: DurableObjectNamespace;
  
  // Environment variables from wrangler.toml
  ENVIRONMENT: string;
  CYCLE_DURATION_SECONDS: string;
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
