
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
    { id: 'none', name: 'None', type: 'hat', icon: '🚫' },
    { id: 'hat_propeller_98', name: 'Propeller Hat', type: 'hat', icon: '🚁' },
    { id: 'hat_viking_71', name: 'Viking Helmet', type: 'hat', icon: '🛡️' },
    { id: 'backpack_jetpack_10', name: 'Jetpack', type: 'backpack', icon: '🚀' },
    { id: 'glasses_goggles_56', name: 'Goggles', type: 'glasses', icon: '🥽' }
];

export const DEFAULT_OFFSET: AccessoryOffset = {
    scale: 1.0,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
};

// Generated via /tweaker tool
export const ACCESSORY_OFFSETS: Record<string, Record<string, AccessoryOffset>> = {
    'squirrel': {
        'hat_propeller_98': { scale: 1.7, position: { x: 0.01, y: 0.06, z: 0.69 }, rotation: { x: 0.058, y: 0, z: 0 } },
        'hat_viking_71': { scale: 1.4, position: { x: 0, y: 0.08, z: 0.77 }, rotation: { x: 0, y: 0, z: 0 } },
        'glasses_goggles_56': { scale: 2.9, position: { x: 0, y: -0.2, z: 0.48 }, rotation: { x: 0, y: 0, z: 0 } },
        'backpack_jetpack_10': { scale: 3.8, position: { x: 0, y: 0.26, z: 0.32 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'moose': {
        'top_hat': { scale: 2.5, position: { x: 0, y: 0.8, z: -0.2 }, rotation: { x: 0, y: 0, z: 0 } },
        'hat_propeller_98': { scale: 2.9, position: { x: 0, y: 0.41, z: 1.24 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'lynx': {
        'hat_propeller_98': { scale: 2.9, position: { x: 0, y: 0.65, z: 0.92 }, rotation: { x: 0, y: 0, z: 0 } },
        'glasses_goggles_56': { scale: 3.4, position: { x: 0, y: 0.32, z: 0.65 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'goat': {
        'hat_propeller_98': { scale: 2.7, position: { x: 0, y: 0.8, z: 0.89 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'hare': {
        'hat_propeller_98': { scale: 2.1, position: { x: 0, y: 0.11, z: 0.68 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'bear': {
        'hat_propeller_98': { scale: 2.8, position: { x: 0, y: 0.4, z: 0.99 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'skunk': {
        'hat_propeller_98': { scale: 2.2, position: { x: 0, y: 0.25, z: 0.84 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'badger': {
        'hat_propeller_98': { scale: 2, position: { x: 0, y: 0.36, z: 0.69 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'chipmunk': {
        'hat_propeller_98': { scale: 1.5, position: { x: 0, y: 0.07, z: 0.79 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'turkey': {
        'hat_propeller_98': { scale: 1.7, position: { x: 0, y: 1.06, z: 0.27 }, rotation: { x: 0, y: 0, z: 0 } }
    },
    'mallard': {
        'hat_propeller_98': { scale: 1.7, position: { x: 0, y: 1.12, z: 0.29 }, rotation: { x: 0, y: 0, z: 0 } }
    }
};

export class AccessoryRegistry {
    static getAccessory(id: string): AccessoryDefinition | undefined {
        return ACCESSORIES.find(a => a.id === id);
    }

    static getAll(): AccessoryDefinition[] {
        return ACCESSORIES;
    }

    static getOffset(characterId: string, accessoryId: string): AccessoryOffset {
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
}
