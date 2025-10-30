/**
 * MVP 12: Player Ranking System
 *
 * Shared utility for calculating player titles/ranks based on score.
 * Used by both client and server for consistent rank calculation.
 *
 * Design Philosophy:
 * - Friendly "Title" terminology (not "Rank" - less competitive)
 * - Score-based progression (earned through gameplay)
 * - NPCs friendlier to beginners (Rookie/Apprentice)
 * - Predators ignore beginners (Dabbler+ only)
 * - Gradual difficulty scaling at higher titles
 *
 * Player-Facing Messaging:
 * - First join: "Welcome to the forest! Your level is Rookie."
 * - Rank up: "You've achieved Maestro Status!"
 * - HUD/Profile: "Ninja Squirrel" (title + character name)
 */
/**
 * All player titles in ascending order
 * Score ranges are designed for gradual progression:
 * - Fast early progress (Rookie→Apprentice: 20 points)
 * - Medium mid-game (Apprentice→Slick: ~100 points each)
 * - Long-term mastery (Legend: 1000+)
 */
export const PLAYER_TITLES = [
    {
        id: 'rookie',
        name: 'Rookie',
        minScore: 0,
        maxScore: 20,
        description: 'Just starting your walnut adventure!',
        npcAggressionMultiplier: 0.0, // NPCs are friendly
        predatorTargetingWeight: 0.0, // Predators ignore rookies
    },
    {
        id: 'apprentice',
        name: 'Apprentice',
        minScore: 21,
        maxScore: 100,
        description: 'Learning the ways of the forest...',
        npcAggressionMultiplier: 0.0, // NPCs still friendly
        predatorTargetingWeight: 0.0, // Predators still ignore
    },
    {
        id: 'dabbler',
        name: 'Dabbler',
        minScore: 101,
        maxScore: 200,
        description: 'Finding your groove!',
        npcAggressionMultiplier: 0.0, // NPCs still friendly
        predatorTargetingWeight: 0.5, // Predators START targeting (50% normal)
    },
    {
        id: 'slick',
        name: 'Slick',
        minScore: 201,
        maxScore: 300,
        description: 'Getting pretty good at this!',
        npcAggressionMultiplier: 1.0, // NPCs use BASELINE aggression (current settings)
        predatorTargetingWeight: 1.0, // Predators normal targeting
    },
    {
        id: 'maestro',
        name: 'Maestro',
        minScore: 301,
        maxScore: 500,
        description: 'A master of walnut warfare!',
        npcAggressionMultiplier: 1.15, // NPCs slightly more aggressive
        predatorTargetingWeight: 1.3, // Predators prefer Maestros
    },
    {
        id: 'ninja',
        name: 'Ninja',
        minScore: 501,
        maxScore: 1000,
        description: 'Stealthy, skilled, unstoppable!',
        npcAggressionMultiplier: 1.25, // NPCs more aggressive
        predatorTargetingWeight: 1.6, // Predators highly prefer Ninjas
    },
    {
        id: 'legend',
        name: 'Legend',
        minScore: 1001,
        maxScore: Infinity,
        description: 'The stuff of walnut folklore!',
        npcAggressionMultiplier: 1.35, // NPCs most aggressive (but not overwhelming - we have predators)
        predatorTargetingWeight: 2.0, // Predators prioritize Legends
    },
];
/**
 * Get player title based on current score
 */
export function getPlayerTitle(score) {
    // Find the highest title the player qualifies for
    for (let i = PLAYER_TITLES.length - 1; i >= 0; i--) {
        const title = PLAYER_TITLES[i];
        if (score >= title.minScore) {
            return title;
        }
    }
    // Fallback to Rookie (should never happen)
    return PLAYER_TITLES[0];
}
/**
 * Get previous title (for detecting rank-ups)
 * Returns null if already at lowest title
 */
export function getPreviousTitle(currentTitle) {
    const currentIndex = PLAYER_TITLES.findIndex(t => t.id === currentTitle.id);
    if (currentIndex <= 0)
        return null;
    return PLAYER_TITLES[currentIndex - 1];
}
/**
 * Get next title (for UI progress indicators)
 * Returns null if already at highest title
 */
export function getNextTitle(currentTitle) {
    const currentIndex = PLAYER_TITLES.findIndex(t => t.id === currentTitle.id);
    if (currentIndex === -1 || currentIndex >= PLAYER_TITLES.length - 1)
        return null;
    return PLAYER_TITLES[currentIndex + 1];
}
/**
 * Calculate progress to next title (0.0 to 1.0)
 * Returns 1.0 if at max title (Legend)
 */
export function getProgressToNextTitle(score) {
    const currentTitle = getPlayerTitle(score);
    const nextTitle = getNextTitle(currentTitle);
    if (!nextTitle)
        return 1.0; // Already at Legend
    const scoreInCurrentTier = score - currentTitle.minScore;
    const tierRange = currentTitle.maxScore - currentTitle.minScore + 1;
    return Math.min(1.0, scoreInCurrentTier / tierRange);
}
/**
 * Check if score change represents a title rank-up
 * Returns the new title if ranked up, null otherwise
 */
export function checkForRankUp(oldScore, newScore) {
    const oldTitle = getPlayerTitle(oldScore);
    const newTitle = getPlayerTitle(newScore);
    if (oldTitle.id !== newTitle.id) {
        return newTitle;
    }
    return null;
}
/**
 * Get NPC aggression multiplier for a given score
 * This scales the baseline NPC aggression settings
 */
export function getNPCAggressionMultiplier(score) {
    const title = getPlayerTitle(score);
    return title.npcAggressionMultiplier;
}
/**
 * Get predator targeting weight for a given score
 * Higher weight = predators prefer this target over lower-weight targets
 */
export function getPredatorTargetingWeight(score) {
    const title = getPlayerTitle(score);
    return title.predatorTargetingWeight;
}
/**
 * Check if player should be targeted by predators
 * Predators ignore Rookie and Apprentice players
 */
export function shouldPredatorsTargetPlayer(score) {
    const weight = getPredatorTargetingWeight(score);
    return weight > 0;
}
/**
 * Check if NPCs should be aggressive toward player
 * NPCs are friendly to Rookie, Apprentice, and Dabbler
 */
export function shouldNPCsBeAggressive(score) {
    const multiplier = getNPCAggressionMultiplier(score);
    return multiplier > 0;
}
