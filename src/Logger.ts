import pino, { Logger, LoggerOptions } from 'pino';
import chalk from 'chalk';
import dotenv from 'dotenv';
dotenv.config();

let loggerOptions: LoggerOptions = {
  enabled: true,
  timestamp: true,
  level: 'error',
};
let transport: any;

if (process.env.LLM_ORCHESTRATOR_ENV === 'development') {
  loggerOptions = {
    enabled: true,
    timestamp: true,
    level: 'trace',
  };

  transport = pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
      crlf: true,
      levelFirst: true,
      timestampKey: 'time',
      ignore: 'pid,hostname,path',
      messageFormat: `${chalk.magentaBright('[{path}]')} {msg}`,
    },
  });
}

const baseLogger = pino(loggerOptions, transport);

export function getLogger(name: string): Logger {
  return baseLogger.child({
    path: name,
  });
}
