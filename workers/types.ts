// Shared types across Durable Objects

export type WalnutOrigin = "game" | "player";
export type HidingMethod = "buried" | "bush";

export interface Walnut {
  id: string;
  ownerId: string;
  origin: WalnutOrigin;
  hiddenIn: HidingMethod;
  location: { x: number; y: number; z: number };
  found: boolean;
  foundBy?: string;
  timestamp: number;
}

export interface Squirrel {
  id: string;
  joinedAt: number;
  lastSeen: number;
  participationSeconds: number;
  multiplier: number;
  powerUps: Record<string, boolean>;
  hiddenWalnuts: string[];
  foundWalnuts: string[];
  score: number;
  firstFinderAchieved: boolean;
}
