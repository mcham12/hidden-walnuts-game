
import accessoryOffsetsData from './accessoryOffsets.json';

export interface AccessoryOffset {
    scale: number;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

export interface AccessoryDefinition {
    id: string;
    name: string;
    type: 'hat' | 'glasses' | 'mask' | 'backpack';
    icon: string; // Emoji or path
}

export const ACCESSORIES: AccessoryDefinition[] = [
    // None option
    { id: 'none', name: 'None', type: 'hat', icon: '🚫' },

    // Hats (46 items)
    { id: 'hat_antenna_91', name: 'Antenna', type: 'hat', icon: '📡' },
    { id: 'hat_anti_cog_control_83', name: 'Anti-Cog Control', type: 'hat', icon: '🎮' },
    { id: 'hat_archer_76', name: 'Archer', type: 'hat', icon: '🏹' },
    { id: 'hat_baseball_113', name: 'Baseball Cap', type: 'hat', icon: '🧢' },
    { id: 'hat_bird_112', name: 'Bird Hat', type: 'hat', icon: '🐦' },
    { id: 'hat_boby_89', name: 'Bobby', type: 'hat', icon: '👮' },
    { id: 'hat_bow_97', name: 'Bow', type: 'hat', icon: '🎀' },
    { id: 'hat_bowler_88', name: 'Bowler', type: 'hat', icon: '🎩' },
    { id: 'hat_chef_87', name: 'Chef', type: 'hat', icon: '👨‍🍳' },
    { id: 'hat_conquistador_helmet_86', name: 'Conquistador', type: 'hat', icon: '⚔️' },
    { id: 'hat_cop_100', name: 'Cop', type: 'hat', icon: '👮' },
    { id: 'hat_cowboy_111', name: 'Cowboy', type: 'hat', icon: '🤠' },
    { id: 'hat_crown_110', name: 'Crown', type: 'hat', icon: '👑' },
    { id: 'hat_detective_85', name: 'Detective', type: 'hat', icon: '🕵️' },
    { id: 'hat_feather_headband_78', name: 'Feather Headband', type: 'hat', icon: '🪶' },
    { id: 'hat_fedora_84', name: 'Fedora', type: 'hat', icon: '🎩' },
    { id: 'hat_fez_108', name: 'Fez', type: 'hat', icon: '🧢' },
    { id: 'hat_firefighter_helmet_107', name: 'Firefighter', type: 'hat', icon: '🧑‍🚒' },
    { id: 'hat_fishing_106', name: 'Fishing Hat', type: 'hat', icon: '🎣' },
    { id: 'hat_golf_105', name: 'Golf Cap', type: 'hat', icon: '⛳' },
    { id: 'hat_heart_104', name: 'Heart Hat', type: 'hat', icon: '❤️' },
    { id: 'hat_jamboree_90', name: 'Jamboree', type: 'hat', icon: '🎪' },
    { id: 'hat_jester_82', name: 'Jester', type: 'hat', icon: '🃏' },
    { id: 'hat_mickeys_band_81', name: "Mickey's Band", type: 'hat', icon: '🎵' },
    { id: 'hat_miner_80', name: 'Miner', type: 'hat', icon: '⛏️' },
    { id: 'hat_napoleon_79', name: 'Napoleon', type: 'hat', icon: '🎖️' },
    { id: 'hat_party_103', name: 'Party Hat', type: 'hat', icon: '🎉' },
    { id: 'hat_pilot_102', name: 'Pilot', type: 'hat', icon: '✈️' },
    { id: 'hat_pirate_101', name: 'Pirate', type: 'hat', icon: '🏴‍☠️' },
    { id: 'hat_princess_99', name: 'Princess', type: 'hat', icon: '👸' },
    { id: 'hat_propeller_98', name: 'Propeller', type: 'hat', icon: '🚁' },
    { id: 'hat_rainbow_afro_77', name: 'Rainbow Afro', type: 'hat', icon: '🌈' },
    { id: 'hat_roman_helmet_96', name: 'Roman Helmet', type: 'hat', icon: '🏛️' },
    { id: 'hat_safari_beige_95', name: 'Safari', type: 'hat', icon: '🦁' },
    { id: 'hat_sailor_75', name: 'Sailor', type: 'hat', icon: '⚓' },
    { id: 'hat_samba_94', name: 'Samba', type: 'hat', icon: '💃' },
    { id: 'hat_sombrero_74', name: 'Sombrero', type: 'hat', icon: '🪇' },
    { id: 'hat_straw_73', name: 'Straw Hat', type: 'hat', icon: '👒' },
    { id: 'hat_sun_72', name: 'Sun Hat', type: 'hat', icon: '☀️' },
    { id: 'hat_tiara_93', name: 'Tiara', type: 'hat', icon: '👑' },
    { id: 'hat_toonosaur_109', name: 'Toonosaur', type: 'hat', icon: '🦕' },
    { id: 'hat_top_92', name: 'Top Hat', type: 'hat', icon: '🎩' },
    { id: 'hat_viking_71', name: 'Viking', type: 'hat', icon: '🛡️' },
    { id: 'hat_winter_68', name: 'Winter', type: 'hat', icon: '❄️' },
    { id: 'hat_witch_70', name: 'Witch', type: 'hat', icon: '🧙‍♀️' },
    { id: 'hat_wizard_69', name: 'Wizard', type: 'hat', icon: '🧙' },

    // Glasses (18 items)
    { id: 'glasses_alien_eyes_67', name: 'Alien Eyes', type: 'glasses', icon: '👽' },
    { id: 'glasses_aviator_58', name: 'Aviator', type: 'glasses', icon: '🕶️' },
    { id: 'glasses_bug_eye_53', name: 'Bug Eye', type: 'glasses', icon: '🐛' },
    { id: 'glasses_cat_eye_57', name: 'Cat Eye', type: 'glasses', icon: '🐱' },
    { id: 'glasses_celebrity_62', name: 'Celebrity', type: 'glasses', icon: '⭐' },
    { id: 'glasses_gem_eyepatch_64', name: 'Gem Eyepatch', type: 'glasses', icon: '💎' },
    { id: 'glasses_goggles_56', name: 'Goggles', type: 'glasses', icon: '🥽' },
    { id: 'glasses_groucho_55', name: 'Groucho', type: 'glasses', icon: '🥸' },
    { id: 'glasses_heart_54', name: 'Heart Glasses', type: 'glasses', icon: '❤️' },
    { id: 'glasses_monocle_51', name: 'Monocle', type: 'glasses', icon: '🧐' },
    { id: 'glasses_movie_66', name: 'Movie Glasses', type: 'glasses', icon: '🎬' },
    { id: 'glasses_nerd_63', name: 'Nerd', type: 'glasses', icon: '🤓' },
    { id: 'glasses_scuba_mask_60', name: 'Scuba Mask', type: 'glasses', icon: '🤿' },
    { id: 'glasses_secret_id_52', name: 'Secret ID', type: 'glasses', icon: '🕵️' },
    { id: 'glasses_skull_eyepatch_65', name: 'Skull Eyepatch', type: 'glasses', icon: '💀' },
    { id: 'glasses_square_frame_59', name: 'Square Frame', type: 'glasses', icon: '👓' },
    { id: 'glasses_white_mini_blinds_61', name: 'Mini Blinds', type: 'glasses', icon: '😎' },
    { id: 'glasses_yellow_star_50', name: 'Yellow Star', type: 'glasses', icon: '⭐' },

    // Backpacks (25 items)
    { id: 'backpack_airplane_wings_28', name: 'Airplane Wings', type: 'backpack', icon: '✈️' },
    { id: 'backpack_angel_wings_14', name: 'Angel Wings', type: 'backpack', icon: '😇' },
    { id: 'backpack_bat_wings_21', name: 'Bat Wings', type: 'backpack', icon: '🦇' },
    { id: 'backpack_bee_wings_20', name: 'Bee Wings', type: 'backpack', icon: '🐝' },
    { id: 'backpack_bird_wings_13', name: 'Bird Wings', type: 'backpack', icon: '🐦' },
    { id: 'backpack_blue_27', name: 'Blue Backpack', type: 'backpack', icon: '🎒' },
    { id: 'backpack_butterfly_wings_12', name: 'Butterfly Wings', type: 'backpack', icon: '🦋' },
    { id: 'backpack_cog_pack_18', name: 'Cog Pack', type: 'backpack', icon: '⚙️' },
    { id: 'backpack_dragon_wings_11', name: 'Dragon Wings', type: 'backpack', icon: '🐉' },
    { id: 'backpack_gag_attack_pack_17', name: 'Gag Attack Pack', type: 'backpack', icon: '🎭' },
    { id: 'backpack_jamboree_pack_22', name: 'Jamboree Pack', type: 'backpack', icon: '🎪' },
    { id: 'backpack_jetpack_10', name: 'Jetpack', type: 'backpack', icon: '🚀' },
    { id: 'backpack_orange_26', name: 'Orange Backpack', type: 'backpack', icon: '🎒' },
    { id: 'backpack_pirate_sword_4', name: 'Pirate Sword', type: 'backpack', icon: '🗡️' },
    { id: 'backpack_plush_bear_pack_8', name: 'Plush Bear', type: 'backpack', icon: '🧸' },
    { id: 'backpack_plush_cat_pack_7', name: 'Plush Cat', type: 'backpack', icon: '🐱' },
    { id: 'backpack_plush_dog_pack_6', name: 'Plush Dog', type: 'backpack', icon: '🐶' },
    { id: 'backpack_purple_25', name: 'Purple Backpack', type: 'backpack', icon: '🎒' },
    { id: 'backpack_red_polka_dot_24', name: 'Red Polka Dot', type: 'backpack', icon: '🔴' },
    { id: 'backpack_scuba_tank_9', name: 'Scuba Tank', type: 'backpack', icon: '🤿' },
    { id: 'backpack_shark_fin_16', name: 'Shark Fin', type: 'backpack', icon: '🦈' },
    { id: 'backpack_supertoon_cape_15', name: 'Supertoon Cape', type: 'backpack', icon: '🦸' },
    { id: 'backpack_toonosaur_tail_19', name: 'Toonosaur Tail', type: 'backpack', icon: '🦕' },
    { id: 'backpack_vampire_cape_5', name: 'Vampire Cape', type: 'backpack', icon: '🧛' },
    { id: 'backpack_yellow_polka_dot_23', name: 'Yellow Polka Dot', type: 'backpack', icon: '🟡' },
];

export const DEFAULT_OFFSET: AccessoryOffset = {
    scale: 1.0,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
};

// Generated via /tweaker tool - loaded from accessoryOffsets.json
export const ACCESSORY_OFFSETS: Record<string, Record<string, AccessoryOffset>> = accessoryOffsetsData as Record<string, Record<string, AccessoryOffset>>;

export class AccessoryRegistry {
    private static RECENT_KEY = 'wardrobe_recent';
    private static MAX_RECENT = 3;

    static getAccessory(id: string): AccessoryDefinition | undefined {
        return ACCESSORIES.find(a => a.id === id);
    }

    static getAll(): AccessoryDefinition[] {
        return ACCESSORIES;
    }

    static getOffset(characterId: string, accessoryId: string): AccessoryOffset {
        // Check local storage for dev overrides
        try {
            const stored = localStorage.getItem('accessory_offsets');
            if (stored) {
                const overrides = JSON.parse(stored);
                if (overrides[characterId] && overrides[characterId][accessoryId]) {
                    return overrides[characterId][accessoryId];
                }
            }
        } catch (e) {
            // Ignore json parse errors
        }

        const charOffsets = ACCESSORY_OFFSETS[characterId];
        if (charOffsets && charOffsets[accessoryId]) {
            return charOffsets[accessoryId];
        }
        return DEFAULT_OFFSET;
    }

    static getAvailableForCharacter(characterId: string): AccessoryDefinition[] {
        const offsets = ACCESSORY_OFFSETS[characterId];
        // Always include 'none' (assuming it's first in list)
        // If offsets exist, include matching IDs
        if (!offsets) {
            // Only 'none' is available if no config
            return [ACCESSORIES[0]];
        }

        const offsetIds = Object.keys(offsets);
        return ACCESSORIES.filter(acc => acc.id === 'none' || offsetIds.includes(acc.id));
    }

    /**
     * Get curated "daily picks" for a category: recently used + random selection
     * Returns { picks: AccessoryDefinition[], hasMore: boolean }
     */
    static getDailyPicks(characterId: string, category: 'hat' | 'glasses' | 'backpack'): { picks: AccessoryDefinition[], hasMore: boolean } {
        const allAvailable = this.getAvailableForCharacter(characterId);
        const categoryItems = allAvailable.filter(a => a.type === category && a.id !== 'none');

        if (categoryItems.length <= 10) {
            // If 10 or fewer, just return all with "None" first
            const noneItem = ACCESSORIES.find(a => a.id === 'none' && a.type === category) || ACCESSORIES[0];
            return { picks: [noneItem, ...categoryItems], hasMore: false };
        }

        // Get recently used for this category
        const recent = this.getRecentlyUsed(category);
        const recentItems = recent
            .map(id => categoryItems.find(a => a.id === id))
            .filter((a): a is AccessoryDefinition => a !== undefined)
            .slice(0, this.MAX_RECENT);

        // Calculate how many random items to show (10 total minus None minus recent)
        const targetTotal = 10;
        const randomCount = targetTotal - 1 - recentItems.length; // -1 for 'none'

        // Get daily random picks (seeded by date)
        const recentIds = new Set(recentItems.map(a => a.id));
        const remainingItems = categoryItems.filter(a => !recentIds.has(a.id));
        const dailyRandom = this.seededShuffle(remainingItems, this.getTodaySeed())
            .slice(0, randomCount);

        // Combine: None + Recent + Random
        const noneItem = ACCESSORIES.find(a => a.id === 'none') || ACCESSORIES[0];
        const picks = [noneItem, ...recentItems, ...dailyRandom];

        return {
            picks,
            hasMore: categoryItems.length > picks.length - 1 // -1 for 'none'
        };
    }

    /**
     * Record that an accessory was used (for "recently used" tracking)
     */
    static recordAccessoryUsage(accessoryId: string, category: 'hat' | 'glasses' | 'backpack'): void {
        if (accessoryId === 'none') return;

        try {
            const stored = localStorage.getItem(this.RECENT_KEY);
            const data: Record<string, string[]> = stored ? JSON.parse(stored) : {};

            if (!data[category]) data[category] = [];

            // Remove if already exists, then add to front
            data[category] = data[category].filter(id => id !== accessoryId);
            data[category].unshift(accessoryId);

            // Keep only MAX_RECENT * 2 (some buffer for items that might get removed)
            data[category] = data[category].slice(0, this.MAX_RECENT * 2);

            localStorage.setItem(this.RECENT_KEY, JSON.stringify(data));
        } catch (e) {
            // Ignore storage errors
        }
    }

    /**
     * Get recently used accessory IDs for a category
     */
    static getRecentlyUsed(category: string): string[] {
        try {
            const stored = localStorage.getItem(this.RECENT_KEY);
            if (!stored) return [];
            const data = JSON.parse(stored);
            return data[category] || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Get a seed based on today's date (consistent throughout the day)
     */
    private static getTodaySeed(): number {
        const today = new Date();
        return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    }

    /**
     * Seeded shuffle using a simple LCG random number generator
     */
    private static seededShuffle<T>(array: T[], seed: number): T[] {
        const result = [...array];
        let s = seed;

        // Simple LCG: next = (a * current + c) mod m
        const random = () => {
            s = (1103515245 * s + 12345) % 2147483648;
            return s / 2147483648;
        };

        // Fisher-Yates shuffle with seeded random
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }

        return result;
    }
}
