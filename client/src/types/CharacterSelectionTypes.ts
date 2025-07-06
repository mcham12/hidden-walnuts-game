import * as THREE from 'three';
import { CharacterConfig } from './CharacterTypes';
import { AnimatedModel } from './AnimationTypes';

/**
 * Character Selection UI Interface
 * Main interface for character selection system
 */
export interface ICharacterSelectionUI {
  showCharacterGallery(): void;
  hideCharacterGallery(): void;
  selectCharacter(characterType: string): Promise<boolean>;
  previewCharacter(characterType: string): Promise<void>;
  getSelectedCharacter(): string;
  isCharacterUnlocked(characterType: string): boolean;
  isVisible(): boolean;
  dispose(): void;
}

/**
 * Character Preview Data
 * Contains 3D model and animation data for character preview
 */
export interface CharacterPreview {
  characterType: string;
  model: THREE.Object3D;
  animatedModel: AnimatedModel;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  isPlaying: boolean;
  currentAnimation: string;
  isLoaded: boolean;
  lastUpdate: number;
}

/**
 * Character Card Data
 * Information displayed on character selection cards
 */
export interface CharacterCardData {
  config: CharacterConfig;
  isSelected: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  previewElement?: HTMLElement;
  cardElement?: HTMLElement;
}

/**
 * Character Selection Event
 * Event fired when character selection changes
 */
export interface CharacterSelectionEvent {
  previousCharacter: string | null;
  selectedCharacter: string;
  characterConfig: CharacterConfig;
  timestamp: number;
  source: 'user' | 'system' | 'storage';
}

/**
 * Character Preview Options
 * Configuration for character preview rendering
 */
export interface CharacterPreviewOptions {
  width: number;
  height: number;
  enableAnimations: boolean;
  enableRotation: boolean;
  backgroundType: 'transparent' | 'gradient' | 'color';
  backgroundColor?: string;
  cameraDistance: number;
  autoRotateSpeed: number;
  enableInteraction: boolean;
  animationCycle: string[]; // List of animations to cycle through
  animationDuration: number; // How long to show each animation
}

/**
 * Character Gallery Options
 * Configuration for the character gallery UI
 */
export interface CharacterGalleryOptions {
  containerElement: HTMLElement;
  showPreviews: boolean;
  previewSize: { width: number; height: number };
  layoutMode: 'grid' | 'carousel' | 'list';
  charactersPerRow: number;
  enableSearch: boolean;
  enableFilters: boolean;
  allowMultiSelect: boolean;
  theme: 'light' | 'dark' | 'auto';
}

/**
 * Character Selection State
 * Current state of the character selection system
 */
export interface CharacterSelectionState {
  selectedCharacter: string | null;
  hoveredCharacter: string | null;
  previewingCharacter: string | null;
  isGalleryVisible: boolean;
  isLoading: boolean;
  availableCharacters: string[];
  unlockedCharacters: string[];
  loadedPreviews: Map<string, CharacterPreview>;
}

/**
 * Character Unlock Criteria
 * Criteria for unlocking characters
 */
export interface CharacterUnlockCriteria {
  characterType: string;
  unlockType: 'default' | 'achievement' | 'purchase' | 'progress';
  isUnlocked: boolean;
  requirements?: {
    level?: number;
    achievements?: string[];
    playtime?: number; // minutes
    other?: any;
  };
  unlockMessage?: string;
}

/**
 * Character Statistics Display
 * Stats shown in character information
 */
export interface CharacterStatsDisplay {
  characterType: string;
  stats: {
    movementSpeed: number;
    jumpHeight: number;
    specialAbilities: string[];
    behaviorTypes: string[];
    habitat: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  };
  animations: {
    total: number;
    categories: { [category: string]: number };
  };
  blendshapes: {
    total: number;
    expressionTypes: string[];
  };
}

/**
 * Character Selection Validation Result
 */
export interface CharacterSelectionValidation {
  isValid: boolean;
  characterType: string;
  errors: string[];
  warnings: string[];
  isUnlocked: boolean;
  canSelect: boolean;
}

/**
 * Character Gallery Filter Options
 */
export interface CharacterGalleryFilters {
  category?: string; // mammal, bird, fish, etc.
  habitat?: string; // forest, water, air, etc.
  unlockStatus?: 'all' | 'unlocked' | 'locked';
  searchQuery?: string;
  sortBy?: 'name' | 'rarity' | 'unlock_order' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Character Selection Animation Config
 * Configuration for UI animations
 */
export interface CharacterSelectionAnimationConfig {
  cardHoverScale: number;
  cardSelectScale: number;
  transitionDuration: number; // ms
  staggerDelay: number; // ms between card animations
  previewFadeInDuration: number; // ms
  gallerySlideDirection: 'up' | 'down' | 'left' | 'right';
  enableParticleEffects: boolean;
  enableSoundEffects: boolean;
}

/**
 * Character Preview Interaction
 * Interaction events for character previews
 */
export interface CharacterPreviewInteraction {
  type: 'hover' | 'click' | 'drag' | 'wheel';
  characterType: string;
  position: { x: number; y: number };
  deltaX?: number;
  deltaY?: number;
  wheelDelta?: number;
  timestamp: number;
}

/**
 * Character Selection Storage Interface
 * Interface for character selection persistence
 */
export interface ICharacterSelectionStorage {
  getSelectedCharacter(): string | null;
  setSelectedCharacter(characterType: string): void;
  hasSelectedCharacter(): boolean;
  getCharacterHistory(): string[];
  addCharacterToHistory(characterType: string): void;
  getUnlockedCharacters(): string[];
  setCharacterUnlocked(characterType: string, unlocked: boolean): void;
  clearSelection(): void;
  clearHistory(): void;
  exportSelectionData(): any;
  importSelectionData(data: any): boolean;
}

/**
 * Character Selection Metrics
 * Performance and usage metrics
 */
export interface CharacterSelectionMetrics {
  totalSelections: number;
  characterPopularity: Map<string, number>;
  averageSelectionTime: number; // ms
  previewLoadTimes: Map<string, number>; // ms per character
  uiResponseTime: number; // ms
  memoryUsage: number; // bytes
  renderPerformance: {
    fps: number;
    frameTime: number;
    droppedFrames: number;
  };
}

/**
 * Character Selection Error Types
 */
export enum CharacterSelectionError {
  CHARACTER_NOT_FOUND = 'character_not_found',
  CHARACTER_LOCKED = 'character_locked',
  MODEL_LOAD_FAILED = 'model_load_failed',
  PREVIEW_RENDER_FAILED = 'preview_render_failed',
  STORAGE_ERROR = 'storage_error',
  VALIDATION_FAILED = 'validation_failed',
  NETWORK_ERROR = 'network_error'
}

/**
 * Character Selection Event Types
 */
export enum CharacterSelectionEventType {
  SELECTION_CHANGED = 'selection_changed',
  PREVIEW_STARTED = 'preview_started',
  PREVIEW_ENDED = 'preview_ended',
  GALLERY_OPENED = 'gallery_opened',
  GALLERY_CLOSED = 'gallery_closed',
  CHARACTER_HOVERED = 'character_hovered',
  CHARACTER_UNHOVERED = 'character_unhovered',
  MODEL_LOADED = 'model_loaded',
  MODEL_LOAD_FAILED = 'model_load_failed',
  ANIMATION_CHANGED = 'animation_changed'
}

/**
 * Character Selection Theme
 * UI theme configuration
 */
export interface CharacterSelectionTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    code: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  shadows: {
    card: string;
    preview: string;
    gallery: string;
  };
} 