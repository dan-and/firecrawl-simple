import { configDotenv } from "dotenv";
import * as winston from "winston";
import * as crypto from "crypto";

configDotenv();

enum LogLevel {
  NONE = "NONE", // No logs will be output.
  ERROR = "ERROR", // For logging error messages that indicate a failure in a specific operation.
  WARN = "WARN", // For logging potentially harmful situations that are not necessarily errors.
  INFO = "INFO", // For logging informational messages that highlight the progress of the application.
  DEBUG = "DEBUG", // For logging detailed information on the flow through the system, primarily used for debugging.
  TRACE = "TRACE", // For logging more detailed information than the DEBUG level.
}

// Zero data retention filter - removes sensitive data from logs
const zeroDataRetentionFilter = winston.format((info) => {
  if (info.zeroDataRetention) {
    // Remove sensitive fields when zero data retention is enabled
    delete info.zeroDataRetention;
    delete info.apiKey;
    delete info.teamId;
    delete info.userId;
  }
  return info;
})();

// Custom log format for console output
const logFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  return log;
});

// Create winston logger instance
const winstonLogger = winston.createLogger({
  level: process.env.LOGGING_LEVEL?.toLowerCase() ?? "debug",
  format: winston.format.json({
    replacer(key, value) {
      if (value instanceof Error) {
        return {
          ...value,
          name: value.name,
          message: value.message,
          stack: value.stack,
          cause: value.cause,
        };
      } else {
        return value;
      }
    },
  }),
  transports: [
    ...(process.env.FIRECRAWL_LOG_TO_FILE
      ? [
          new winston.transports.File({
            filename:
              "firecrawl-" +
              (process.argv[1].includes("worker") ? "worker" : "app") +
              "-" +
              crypto.randomUUID() +
              ".log",
            format: winston.format.combine(
              zeroDataRetentionFilter,
              winston.format.json(),
            ),
          }),
        ]
      : []),
    new winston.transports.Console({
      format: winston.format.combine(
        zeroDataRetentionFilter,
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.metadata({
          fillExcept: ["message", "level", "timestamp"],
        }),
        ...((process.env.ENV === "production" &&
          process.env.SENTRY_ENVIRONMENT === "dev") ||
        process.env.ENV !== "production"
          ? [winston.format.colorize(), logFormat]
          : []),
      ),
    }),
  ],
});

export class Logger {
  static colors = {
    ERROR: "\x1b[31m%s\x1b[0m", // Red
    WARN: "\x1b[33m%s\x1b[0m", // Yellow
    INFO: "\x1b[34m%s\x1b[0m", // Blue
    DEBUG: "\x1b[36m%s\x1b[0m", // Cyan
    TRACE: "\x1b[35m%s\x1b[0m", // Magenta
  };

  static log(message: string, level: LogLevel, metadata?: Record<string, any>) {
    const logLevel: LogLevel =
      LogLevel[process.env.LOGGING_LEVEL as keyof typeof LogLevel] ||
      LogLevel.INFO;
    const levels = [
      LogLevel.NONE,
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.DEBUG,
      LogLevel.TRACE,
    ];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (currentLevelIndex >= messageLevelIndex) {
      // Use winston for structured logging
      winstonLogger.log(level.toLowerCase(), message, metadata || {});
    }
  }

  static error(message: string | any, metadata?: Record<string, any>) {
    Logger.log(message, LogLevel.ERROR, metadata);
  }

  static warn(message: string, metadata?: Record<string, any>) {
    Logger.log(message, LogLevel.WARN, metadata);
  }

  static info(message: string, metadata?: Record<string, any>) {
    Logger.log(message, LogLevel.INFO, metadata);
  }

  static debug(message: string, metadata?: Record<string, any>) {
    Logger.log(message, LogLevel.DEBUG, metadata);
  }

  static trace(message: string, metadata?: Record<string, any>) {
    Logger.log(message, LogLevel.TRACE, metadata);
  }

  // Create child logger with context
  static child(context: Record<string, any>) {
    return {
      error: (message: string | any, metadata?: Record<string, any>) => {
        Logger.error(message, { ...context, ...metadata });
      },
      warn: (message: string, metadata?: Record<string, any>) => {
        Logger.warn(message, { ...context, ...metadata });
      },
      info: (message: string, metadata?: Record<string, any>) => {
        Logger.info(message, { ...context, ...metadata });
      },
      debug: (message: string, metadata?: Record<string, any>) => {
        Logger.debug(message, { ...context, ...metadata });
      },
      trace: (message: string, metadata?: Record<string, any>) => {
        Logger.trace(message, { ...context, ...metadata });
      },
    };
  }
}

