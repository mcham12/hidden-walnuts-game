// CHEN'S FIX: Production-ready logging system
// Inspired by Unreal Engine's logging categories and levels

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  NONE = 5
}

export enum LogCategory {
  CORE = 'Core',
  NETWORK = 'Network', 
  ECS = 'ECS',
  RENDER = 'Render',
  INPUT = 'Input',
  TERRAIN = 'Terrain',
  PLAYER = 'Player',
  COMPRESSION = 'Compression',
  PHYSICS = 'Physics',
  SPATIAL = 'Spatial'
}

interface LogConfig {
  level: LogLevel;
  enabledCategories: Set<LogCategory>;
  enablePerformanceMetrics: boolean;
  enableInProduction: boolean;
  environment: 'development' | 'preview' | 'production';
}

class GameLogger {
  private config: LogConfig;
  private startTime = performance.now();
  
  constructor() {
    // CHEN'S FIX: Smart environment detection for Cloudflare preview
    const environment = this.detectEnvironment();
    
    // Configure logging based on environment
    this.config = {
      level: this.getLogLevel(environment),
      enabledCategories: this.getEnabledCategories(environment),
      enablePerformanceMetrics: environment !== 'production',
      enableInProduction: false,
      environment
    };

    // Log environment detection for debugging
    if (environment !== 'production') {
      console.info(`🎯 Logger initialized for ${environment} environment`);
    }
  }

  private detectEnvironment(): 'development' | 'preview' | 'production' {
    // Local development (vite dev server)
    if (import.meta.env.DEV) {
      return 'development';
    }
    
    // Cloudflare preview (built but not production domain)
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      // Common Cloudflare preview patterns
      if (hostname.includes('workers.dev') || 
          hostname.includes('preview') ||
          hostname.includes('staging') ||
          hostname.includes('dev-') ||
          hostname.includes('-dev') ||
          hostname.includes('test') ||
          hostname.includes('localhost') ||
          hostname === '127.0.0.1') {
        return 'preview';
      }
    }
    
    // True production
    return 'production';
  }

  private getLogLevel(environment: string): LogLevel {
    switch (environment) {
      case 'development':
        return LogLevel.DEBUG;
      case 'preview':
        return LogLevel.DEBUG; // Temporarily increase to debug multiplayer issues
      case 'production':
        return LogLevel.ERROR;
      default:
        return LogLevel.DEBUG; // More verbose for debugging
    }
  }

  private getEnabledCategories(environment: string): Set<LogCategory> {
    switch (environment) {
      case 'development':
        return new Set(Object.values(LogCategory)); // All categories
      case 'preview':
        return new Set(Object.values(LogCategory)); // All categories for testing
      case 'production':
        return new Set([LogCategory.CORE, LogCategory.NETWORK]); // Critical only
      default:
        return new Set([LogCategory.CORE, LogCategory.NETWORK]);
    }
  }

  trace(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.TRACE, category, message, ...args);
  }

  debug(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, category, message, ...args);
  }

  info(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, category, message, ...args);
  }

  warn(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, category, message, ...args);
  }

  error(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, category, message, ...args);
  }

  // Performance logging with automatic timing
  perfStart(category: LogCategory, operation: string): string {
    if (!this.config.enablePerformanceMetrics) return '';
    
    const id = `${category}_${operation}_${Date.now()}`;
    (performance as any).mark(`${id}_start`);
    return id;
  }

  perfEnd(category: LogCategory, id: string): void {
    if (!this.config.enablePerformanceMetrics || !id) return;
    
    try {
      (performance as any).mark(`${id}_end`);
      (performance as any).measure(id, `${id}_start`, `${id}_end`);
      
      const measure = performance.getEntriesByName(id, 'measure')[0];
      if (measure.duration > 1) { // Only log if > 1ms
        this.debug(category, `⏱️ ${id.split('_')[1]}: ${measure.duration.toFixed(2)}ms`);
      }
    } catch (e) {
      // Ignore performance API errors
    }
  }

  // CHEN'S FIX: Environment-aware logging with Cloudflare preview support
  private log(level: LogLevel, category: LogCategory, message: string, ...args: any[]): void {
    // Early return for disabled logging - ZERO performance cost
    if (level < this.config.level || !this.config.enabledCategories.has(category)) {
      return;
    }

    // Only true production builds suppress console calls
    if (this.config.environment === 'production') {
      if (level >= LogLevel.ERROR && this.config.enableInProduction) {
        // Only send errors to external error reporting (Sentry, etc.)
        this.reportError(message, args);
      }
      return; // NO console calls in production!
    }

    // Development and PREVIEW - full console logging enabled
    const timestamp = Math.round(performance.now() - this.startTime);
    const levelEmoji = this.getLevelEmoji(level);
    const categoryTag = `[${category}]`;
    const timeTag = `+${timestamp}ms`;
    const envTag = this.config.environment === 'preview' ? '[PREVIEW]' : '[DEV]';
    
    const logMessage = `${levelEmoji} ${timeTag} ${envTag} ${categoryTag} ${message}`;
    
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(logMessage, ...args);
        break;
      case LogLevel.INFO:
        console.info(logMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, ...args);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, ...args);
        break;
    }
  }

  private reportError(message: string, args: any[]): void {
    // CHEN'S FIX: Send errors to external service instead of console
    // In real production, this would send to Sentry, LogRocket, etc.
    try {
      // For now, store in memory for retrieval by monitoring systems
      if (!(window as any).__gameErrors) {
        (window as any).__gameErrors = [];
      }
      (window as any).__gameErrors.push({
        timestamp: Date.now(),
        message,
        args,
        userAgent: navigator.userAgent,
        url: window.location.href,
        environment: this.config.environment
      });
      
      // Keep only last 50 errors to prevent memory bloat
      if ((window as any).__gameErrors.length > 50) {
        (window as any).__gameErrors = (window as any).__gameErrors.slice(-50);
      }
    } catch (e) {
      // Ignore errors in error reporting to prevent loops
    }
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE: return '🔍';
      case LogLevel.DEBUG: return '🐛';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '🚨';
      default: return '📝';
    }
  }

  // Conditional logging for expensive operations
  debugExpensive(category: LogCategory, messageFactory: () => string): void {
    if (this.shouldLog(LogLevel.DEBUG, category)) {
      this.debug(category, messageFactory());
    }
  }

  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    return level >= this.config.level && this.config.enabledCategories.has(category);
  }

  // Utility method to check current environment
  getEnvironment(): string {
    return this.config.environment;
  }
}

// Singleton instance
export const Logger = new GameLogger();

// Convenience functions for common categories
export const CoreLog = {
  trace: (msg: string, ...args: any[]) => Logger.trace(LogCategory.CORE, msg, ...args),
  debug: (msg: string, ...args: any[]) => Logger.debug(LogCategory.CORE, msg, ...args),
  info: (msg: string, ...args: any[]) => Logger.info(LogCategory.CORE, msg, ...args),
  warn: (msg: string, ...args: any[]) => Logger.warn(LogCategory.CORE, msg, ...args),
  error: (msg: string, ...args: any[]) => Logger.error(LogCategory.CORE, msg, ...args),
};

export const NetworkLog = {
  trace: (msg: string, ...args: any[]) => Logger.trace(LogCategory.NETWORK, msg, ...args),
  debug: (msg: string, ...args: any[]) => Logger.debug(LogCategory.NETWORK, msg, ...args),
  info: (msg: string, ...args: any[]) => Logger.info(LogCategory.NETWORK, msg, ...args),
  warn: (msg: string, ...args: any[]) => Logger.warn(LogCategory.NETWORK, msg, ...args),
  error: (msg: string, ...args: any[]) => Logger.error(LogCategory.NETWORK, msg, ...args),
};

export const RenderLog = {
  trace: (msg: string, ...args: any[]) => Logger.trace(LogCategory.RENDER, msg, ...args),
  debug: (msg: string, ...args: any[]) => Logger.debug(LogCategory.RENDER, msg, ...args),
  info: (msg: string, ...args: any[]) => Logger.info(LogCategory.RENDER, msg, ...args),
  warn: (msg: string, ...args: any[]) => Logger.warn(LogCategory.RENDER, msg, ...args),
  error: (msg: string, ...args: any[]) => Logger.error(LogCategory.RENDER, msg, ...args),
}; 