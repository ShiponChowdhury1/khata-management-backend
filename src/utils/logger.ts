import { env } from '../config/env.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const formatLog = (level: LogLevel, message: string, meta?: unknown) => {
  const timestamp = new Date().toISOString();
  const formattedMeta = meta ? ` | Meta: ${JSON.stringify(meta, null, 2)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}${formattedMeta}`;
};

/**
 * অ্যাপ্লিকেশনের সেন্ট্রালাইজড লগার ইউটিলিটি
 */
export const logger = {
  info: (message: string, meta?: unknown): void => {
    console.log(`\x1b[32m${formatLog('info', message, meta)}\x1b[0m`);
  },

  warn: (message: string, meta?: unknown): void => {
    console.warn(`\x1b[33m${formatLog('warn', message, meta)}\x1b[0m`);
  },

  error: (message: string, error?: unknown): void => {
    console.error(`\x1b[31m${formatLog('error', message, error)}\x1b[0m`);
  },

  debug: (message: string, meta?: unknown): void => {
    if (env.isDevelopment) {
      console.debug(`\x1b[36m${formatLog('debug', message, meta)}\x1b[0m`);
    }
  },
};

export default logger;
