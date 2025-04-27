export function log(message: string, ...args: unknown[]) {
  console.log(`[Log] ${message}`, ...args);
}

export function logWarn(message: string, ...args: unknown[]) {
  console.warn(`[Warn] ${message}`, ...args);
}

export function logError(message: string, ...args: unknown[]) {
  console.error(`[Error] ${message}`, ...args);
} 