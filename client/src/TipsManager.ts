/**
 * MVP 14: Gameplay Tips System
 *
 * Manages gameplay tips with categories, localStorage tracking, and random selection.
 * Tips educate players about game mechanics across desktop, mobile, and tablet.
 */

export interface GameTip {
  id: string;
  category: 'combat' | 'trees' | 'strategy' | 'basics';
  text: string;
  emoji?: string;
}

export class TipsManager {
  private tips: GameTip[] = [];
  private seenTips: Set<string> = new Set();
  private readonly STORAGE_KEY = 'hiddenWalnuts_seenTips';

  constructor() {
    this.initializeTips();
    this.loadSeenTips();
  }

  /**
   * Initialize all gameplay tips
   */
  private initializeTips(): void {
    this.tips = [
      // Combat & Survival (6 tips)
      {
        id: 'combat_aggression',
        category: 'combat',
        text: 'NPCs and predators get more aggressive as your score increases - stay alert!',
        emoji: '⚔️'
      },
      {
        id: 'combat_bird_distract',
        category: 'combat',
        text: 'Throw a walnut at a bird predator to distract it and avoid an attack',
        emoji: '🦅'
      },
      {
        id: 'combat_wildebeest',
        category: 'combat',
        text: 'Hit a Wildebeest with 4 walnuts to annoy it and make it flee',
        emoji: '🦌'
      },
      {
        id: 'combat_healing',
        category: 'combat',
        text: 'Eat walnuts to restore health (+25 HP per walnut)',
        emoji: '❤️'
      },
      {
        id: 'combat_inventory',
        category: 'combat',
        text: 'You can carry up to 10 walnuts - use them wisely for combat and healing',
        emoji: '🎒'
      },
      {
        id: 'combat_death',
        category: 'combat',
        text: 'If you die, you drop all your walnuts - respawn is instant but costly!',
        emoji: '💀'
      },

      // Tree Growing System (5 tips)
      {
        id: 'trees_basics',
        category: 'trees',
        text: 'Hide a walnut and protect it for 1 minute - it will grow into a tree for bonus points!',
        emoji: '🌱'
      },
      {
        id: 'trees_efficiency',
        category: 'trees',
        text: 'Growing trees is efficient: earn points AND the tree drops walnuts immediately',
        emoji: '🌳'
      },
      {
        id: 'trees_minimap',
        category: 'trees',
        text: 'Check the minimap after growing a tree - a tree icon appears for 30 seconds',
        emoji: '🗺️'
      },
      {
        id: 'trees_bonus',
        category: 'trees',
        text: 'Grow 20 trees total to earn a special tree growing bonus!',
        emoji: '🏆'
      },
      {
        id: 'trees_stealing',
        category: 'trees',
        text: 'Other players can steal your hidden walnuts before they grow - choose hiding spots wisely!',
        emoji: '👀'
      },

      // Strategy & Resources (6 tips)
      {
        id: 'strategy_buried',
        category: 'strategy',
        text: 'Buried walnuts are worth 3 points, regular walnuts are worth 1 point',
        emoji: '⭐'
      },
      {
        id: 'strategy_golden',
        category: 'strategy',
        text: 'Golden walnuts are rare bonuses worth 5 points - grab them quickly!',
        emoji: '✨'
      },
      {
        id: 'strategy_tree_drops',
        category: 'strategy',
        text: 'Trees drop walnuts periodically - watch for falling walnuts in the forest',
        emoji: '🍂'
      },
      {
        id: 'strategy_npcs',
        category: 'strategy',
        text: 'NPCs collect and hide walnuts too - compete to find them first!',
        emoji: '🐿️'
      },
      {
        id: 'strategy_leaderboard',
        category: 'strategy',
        text: 'Check the leaderboard to see how you rank - it resets weekly!',
        emoji: '📊'
      },
      {
        id: 'strategy_ranks',
        category: 'strategy',
        text: 'Earn higher ranks by scoring points: Rookie → Apprentice → Dabbler → Slick → Maestro → Ninja → Legend',
        emoji: '🎖️'
      },

      // Basics (4 tips)
      {
        id: 'basics_movement',
        category: 'basics',
        text: 'Use WASD or arrow keys to move (desktop), or drag to move (mobile/tablet)',
        emoji: '🎮'
      },
      {
        id: 'basics_controls',
        category: 'basics',
        text: 'Press ? to view all controls and gameplay mechanics',
        emoji: '❓'
      },
      {
        id: 'basics_settings',
        category: 'basics',
        text: 'Adjust volume, graphics, and controls in the settings menu (gear icon)',
        emoji: '⚙️'
      },
      {
        id: 'basics_chat',
        category: 'basics',
        text: 'Use quick chat to communicate with other players - tap the chat bubble icon',
        emoji: '💬'
      }
    ];
  }

  /**
   * Load seen tips from localStorage
   */
  private loadSeenTips(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.seenTips = new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load seen tips:', error);
      this.seenTips = new Set();
    }
  }

  /**
   * Save seen tips to localStorage
   */
  private saveSeenTips(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(this.seenTips)));
    } catch (error) {
      console.warn('Failed to save seen tips:', error);
    }
  }

  /**
   * Get a random tip, prioritizing unseen tips
   */
  getRandomTip(): GameTip | null {
    if (this.tips.length === 0) return null;

    // Prefer unseen tips
    const unseenTips = this.tips.filter(tip => !this.seenTips.has(tip.id));

    if (unseenTips.length > 0) {
      return unseenTips[Math.floor(Math.random() * unseenTips.length)];
    }

    // If all tips seen, return any random tip
    return this.tips[Math.floor(Math.random() * this.tips.length)];
  }

  /**
   * Get a random tip from a specific category
   */
  getRandomTipByCategory(category: GameTip['category']): GameTip | null {
    const categoryTips = this.tips.filter(tip => tip.category === category);
    if (categoryTips.length === 0) return null;

    // Prefer unseen tips in category
    const unseenCategoryTips = categoryTips.filter(tip => !this.seenTips.has(tip.id));

    if (unseenCategoryTips.length > 0) {
      return unseenCategoryTips[Math.floor(Math.random() * unseenCategoryTips.length)];
    }

    return categoryTips[Math.floor(Math.random() * categoryTips.length)];
  }

  /**
   * Get all tips by category
   */
  getTipsByCategory(category: GameTip['category']): GameTip[] {
    return this.tips.filter(tip => tip.category === category);
  }

  /**
   * Get all tips
   */
  getAllTips(): GameTip[] {
    return [...this.tips];
  }

  /**
   * Mark a tip as seen
   */
  markTipAsSeen(tipId: string): void {
    this.seenTips.add(tipId);
    this.saveSeenTips();
  }

  /**
   * Check if a tip has been seen
   */
  hasSeen(tipId: string): boolean {
    return this.seenTips.has(tipId);
  }

  /**
   * Reset all seen tips
   */
  resetSeenTips(): void {
    this.seenTips.clear();
    this.saveSeenTips();
  }

  /**
   * Get tip count by category
   */
  getTipCount(category?: GameTip['category']): number {
    if (category) {
      return this.tips.filter(tip => tip.category === category).length;
    }
    return this.tips.length;
  }

  /**
   * Get unseen tip count
   */
  getUnseenCount(): number {
    return this.tips.filter(tip => !this.seenTips.has(tip.id)).length;
  }
}
