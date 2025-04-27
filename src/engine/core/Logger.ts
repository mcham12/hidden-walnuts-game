export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export interface LoggerConfig {
    level: LogLevel;
    enableTimestamp: boolean;
    enableColors: boolean;
}

export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private static level: LogLevel = LogLevel.INFO;
    private static prefix: string = '[Game Engine]';

    private constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            level: config.level ?? LogLevel.INFO,
            enableTimestamp: config.enableTimestamp ?? true,
            enableColors: config.enableColors ?? true
        };
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    configure(config: Partial<LoggerConfig>): void {
        Object.assign(this.config, config);
    }

    private getColor(level: LogLevel): string {
        if (!this.config.enableColors) return '';
        switch (level) {
            case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
            case LogLevel.INFO: return '\x1b[32m';  // Green
            case LogLevel.WARN: return '\x1b[33m';  // Yellow
            case LogLevel.ERROR: return '\x1b[31m'; // Red
            default: return '';
        }
    }

    private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
        const reset = this.config.enableColors ? '\x1b[0m' : '';
        const color = this.getColor(level);
        const timestamp = this.config.enableTimestamp ? `[${new Date().toISOString()}] ` : '';
        const levelStr = `[${LogLevel[level]}] `;
        
        // Format message with arguments
        const formattedMessage = args.length > 0 ? 
            message.replace(/{(\d+)}/g, (match, num) => args[num]?.toString() ?? match) :
            message;

        return `${color}${timestamp}${levelStr}${formattedMessage}${reset}`;
    }

    static setLevel(level: LogLevel): void {
        Logger.level = level;
    }

    static setPrefix(prefix: string): void {
        Logger.prefix = prefix;
    }

    static debug(message: string, ...args: any[]): void {
        if (Logger.level <= LogLevel.DEBUG) {
            console.debug(`${Logger.prefix} ${message}`, ...args);
        }
    }

    static info(message: string, ...args: any[]): void {
        if (Logger.level <= LogLevel.INFO) {
            console.info(`${Logger.prefix} ${message}`, ...args);
        }
    }

    static warn(message: string, ...args: any[]): void {
        if (Logger.level <= LogLevel.WARN) {
            console.warn(`${Logger.prefix} ${message}`, ...args);
        }
    }

    static error(message: string, ...args: any[]): void {
        if (Logger.level <= LogLevel.ERROR) {
            console.error(`${Logger.prefix} ${message}`, ...args);
        }
    }

    group(label: string): void {
        console.group(this.formatMessage(LogLevel.INFO, label));
    }

    groupEnd(): void {
        console.groupEnd();
    }

    // Performance logging
    time(label: string): void {
        console.time(label);
    }

    timeEnd(label: string): void {
        console.timeEnd(label);
    }
} 