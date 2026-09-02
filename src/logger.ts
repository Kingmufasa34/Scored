/** Tiny leveled logger — no dependency, honours DEBUG from the environment. */

const debugEnabled = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

function ts(): string {
  return new Date().toISOString();
}

export const log = {
  debug(...args: unknown[]): void {
    if (debugEnabled) console.error(`[${ts()}] debug`, ...args);
  },
  info(...args: unknown[]): void {
    console.error(`[${ts()}] info `, ...args);
  },
  warn(...args: unknown[]): void {
    console.error(`[${ts()}] warn `, ...args);
  },
  error(...args: unknown[]): void {
    console.error(`[${ts()}] error`, ...args);
  },
};
