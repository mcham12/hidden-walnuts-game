// Server-side logging system for Cloudflare Workers
// Matches the client-side Logger pattern for consistency

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
  AUTH = 'Auth',
  WEBSOCKET = 'WebSocket',
  PLAYER = 'Player',
  FOREST = 'Forest',
  SESSION = 'Session',
  WALNUT = 'Walnut',
  MAP = 'Map'
}

interface LogConfig {
  level: LogLevel;
  enabledCategories: Set<LogCategory>;
  environment: 'development' | 'production' | 'preview';
}

class WorkerLogger {
  private config: LogConfig;
  private startTime: number = Date.now();
  
  constructor(environment?: string) {
    const env = environment || 'development';
    
    this.config = {
      level: this.getLogLevel(env),
      enabledCategories: this.getEnabledCategories(env),
      environment: env as 'development' | 'production' | 'preview'
    };
  }

  // Method to initialize/update the logger with environment context
  public initializeEnvironment(environment: string): void {
    this.config = {
      level: this.getLogLevel(environment),
      enabledCategories: this.getEnabledCategories(environment),
      environment: environment as 'development' | 'production' | 'preview'
    };
  }

  private getLogLevel(environment: string): LogLevel {
    switch (environment) {
      case 'development':
      case 'dev':
        return LogLevel.DEBUG;
      case 'preview':
        return LogLevel.INFO; // Preview should have INFO level logging
      case 'production':
        return LogLevel.ERROR;
      default:
        return LogLevel.DEBUG;
    }
  }

  private getEnabledCategories(environment: string): Set<LogCategory> {
    switch (environment) {
      case 'development':
      case 'dev':
        return new Set(Object.values(LogCategory)); // All categories
      case 'preview':
        return new Set([
          LogCategory.CORE, 
          LogCategory.AUTH, 
          LogCategory.PLAYER, 
          LogCategory.WEBSOCKET
        ]); // Essential categories for preview
      case 'production':
        return new Set([LogCategory.CORE, LogCategory.AUTH]); // Critical only
      default:
        return new Set([LogCategory.CORE, LogCategory.AUTH]);
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

  private log(level: LogLevel, category: LogCategory, message: string, ...args: any[]): void {
    // Early return for disabled logging
    if (level < this.config.level || !this.config.enabledCategories.has(category)) {
      return;
    }

    // Only true production builds suppress most console calls
    if (this.config.environment === 'production' && level < LogLevel.ERROR) {
      return;
    }

    const timestamp = Date.now() - this.startTime;
    const levelEmoji = this.getLevelEmoji(level);
    const categoryTag = `[${category}]`;
    const timeTag = `+${timestamp}ms`;
    const envTag = this.getEnvironmentTag();
    
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

  private getEnvironmentTag(): string {
    switch (this.config.environment) {
      case 'production':
        return '[PROD]';
      case 'preview':
        return '[PREVIEW]';
      case 'development':
      default:
        return '[DEV]';
    }
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE: return '🔍';
      case LogLevel.DEBUG: return '🐛';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      default: return '📝';
    }
  }

  // Getter for current environment (useful for debugging)
  public getCurrentEnvironment(): string {
    return this.config.environment;
  }
}

// Create singleton instance
export const Logger = new WorkerLogger(); 

// Helper function to initialize logger with environment from worker context
export function initializeLogger(environment?: string): void {
  if (environment) {
    Logger.initializeEnvironment(environment);
  }
} 