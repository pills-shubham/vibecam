import type { LogLevel } from '@vibecam/types';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  level: LogLevel;
  /** Tag printed with every line, e.g. "server" or "RoomService". */
  scope?: string;
  enabled?: boolean;
}

/**
 * Centralized, isomorphic logger. Filters by configured level and prints a
 * consistent `[time] LEVEL (scope)` prefix. Child loggers inherit config but
 * narrow the scope, which keeps service logs greppable.
 */
export class Logger {
  private level: LogLevel;
  private readonly scope: string;
  private readonly enabled: boolean;

  constructor(opts: LoggerOptions) {
    this.level = opts.level;
    this.scope = opts.scope ?? 'app';
    this.enabled = opts.enabled ?? true;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  child(scope: string): Logger {
    return new Logger({ level: this.level, scope: `${this.scope}:${scope}`, enabled: this.enabled });
  }

  debug(msg: string, ...rest: unknown[]): void {
    this.write('debug', msg, rest);
  }
  info(msg: string, ...rest: unknown[]): void {
    this.write('info', msg, rest);
  }
  warn(msg: string, ...rest: unknown[]): void {
    this.write('warn', msg, rest);
  }
  error(msg: string, ...rest: unknown[]): void {
    this.write('error', msg, rest);
  }

  private write(level: LogLevel, msg: string, rest: unknown[]): void {
    if (!this.enabled) return;
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) return;
    const time = new Date().toISOString();
    const prefix = `${time} ${level.toUpperCase().padEnd(5)} (${this.scope})`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`${prefix} ${msg}`, ...rest);
  }
}

export function createLogger(opts: LoggerOptions): Logger {
  return new Logger(opts);
}
