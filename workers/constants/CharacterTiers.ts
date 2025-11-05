/**
 * Character tier definitions for server-side validation
 * MVP 16: Character gating based on authentication status
 * Must match client-side CharacterRegistry
 */

export const NO_AUTH_CHARACTERS = ['squirrel'];

export const FREE_AUTH_CHARACTERS = [
  'squirrel',
  'hare',
  'goat',
  'chipmunk',
  'turkey',
  'mallard'
];

export const PREMIUM_CHARACTERS = [
  'lynx',
  'bear',
  'moose',
  'badger'
];

export const FUTURE_PREMIUM_CHARACTERS = [
  'skunk' // Seasonal/event character (MVP 17+)
];

export type CharacterTier = 'no-auth' | 'free' | 'premium' | 'future';

/**
 * Get character tier by ID
 */
export function getCharacterTier(characterId: string): CharacterTier {
  if (NO_AUTH_CHARACTERS.includes(characterId)) return 'no-auth';
  if (FREE_AUTH_CHARACTERS.includes(characterId)) return 'free';
  if (PREMIUM_CHARACTERS.includes(characterId)) return 'premium';
  if (FUTURE_PREMIUM_CHARACTERS.includes(characterId)) return 'future';
  throw new Error(`Unknown character ID: ${characterId}`);
}

/**
 * Check if character is available to user
 * @param characterId - Character to check
 * @param isAuthenticated - Is user authenticated?
 * @param unlockedCharacters - User's unlocked premium characters
 */
export function isCharacterAvailable(
  characterId: string,
  isAuthenticated: boolean,
  unlockedCharacters: string[] = []
): boolean {
  const tier = getCharacterTier(characterId);

  // No-auth users: only squirrel
  if (!isAuthenticated) {
    return tier === 'no-auth';
  }

  // Authenticated users: free characters + unlocked premium
  if (tier === 'free') return true;
  if (tier === 'premium' && unlockedCharacters.includes(characterId)) return true;

  return false;
}

/**
 * Get all available characters for user
 */
export function getAvailableCharacters(
  isAuthenticated: boolean,
  unlockedCharacters: string[] = []
): string[] {
  if (!isAuthenticated) {
    return [...NO_AUTH_CHARACTERS];
  }

  const available = [...FREE_AUTH_CHARACTERS];

  // Add unlocked premium characters
  unlockedCharacters.forEach(charId => {
    if (PREMIUM_CHARACTERS.includes(charId) && !available.includes(charId)) {
      available.push(charId);
    }
  });

  return available;
}

/**
 * Get character price (for premium characters)
 * Returns null for non-premium characters
 */
export function getCharacterPrice(characterId: string): number | null {
  const tier = getCharacterTier(characterId);

  if (tier === 'premium') {
    // Default price $1.99 for all premium characters
    // Can be customized per character in future
    return 1.99;
  }

  return null;
}
