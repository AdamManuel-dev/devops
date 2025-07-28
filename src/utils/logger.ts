/**
 * @fileoverview Structured logging utility with correlation tracking
 * @lastmodified 2025-07-28T02:45:00Z
 *
 * Features: Structured logging, correlation IDs, multiple transports, log levels
 * Main APIs: Logger class, log formatting, context enrichment
 * Constraints: Winston-based, JSON format, correlation tracking
 * Patterns: Singleton per service, context injection, performance optimized
 */

import winston from "winston";
import { AgentId, CorrelationId, LogEvent } from "@/types";

export interface LoggerConfig {
  readonly service: string;
  readonly agentId?: AgentId;
  readonly level?: string;
  readonly correlationId?: CorrelationId;
}

export interface LogContext {
  readonly correlationId?: CorrelationId;
  readonly agentId?: AgentId;
  readonly userId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly duration?: number;
  readonly [key: string]: unknown;
}

export class Logger {
  private readonly winston: winston.Logger;
  private readonly config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.winston = this.createWinstonLogger();
  }

  /**
   * Log debug level message
   */
  public debug(message: string, context: LogContext = {}): void {
    this.log("debug", message, context);
  }

  /**
   * Log info level message
   */
  public info(message: string, context: LogContext = {}): void {
    this.log("info", message, context);
  }

  /**
   * Log warning level message
   */
  public warn(message: string, context: LogContext = {}): void {
    this.log("warn", message, context);
  }

  /**
   * Log error level message
   */
  public error(message: string, context: LogContext = {}): void {
    this.log("error", message, context);
  }

  /**
   * Create child logger with additional context
   */
  public child(additionalContext: Partial<LoggerConfig>): Logger {
    return new Logger({
      ...this.config,
      ...additionalContext,
    });
  }

  /**
   * Log structured event
   */
  public logEvent(event: LogEvent): void {
    this.winston.log(event.level, event.message, {
      timestamp: event.timestamp.toISOString(),
      correlationId: event.correlationId,
      context: event.context,
      service: this.config.service,
      agentId: this.config.agentId,
    });
  }

  private log(level: string, message: string, context: LogContext): void {
    const enrichedContext = this.enrichContext(context);

    this.winston.log(level, message, {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      agentId: this.config.agentId,
      correlationId: this.config.correlationId || context.correlationId,
      ...enrichedContext,
    });
  }

  private enrichContext(context: LogContext): LogContext {
    return {
      ...context,
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "1.0.0",
      hostname: process.env.HOSTNAME || "localhost",
      processId: process.pid,
    };
  }

  private createWinstonLogger(): winston.Logger {
    const logLevel = this.config.level || process.env.LOG_LEVEL || "info";

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatLogMessage.bind(this)),
      ),
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),

        // File transport for persistent logging
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),

        new winston.transports.File({
          filename: "logs/combined.log",
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        }),
      ],

      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({ filename: "logs/exceptions.log" }),
      ],

      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({ filename: "logs/rejections.log" }),
      ],
    });
  }

  private formatLogMessage(info: winston.Logform.TransformableInfo): string {
    const {
      timestamp,
      level,
      message,
      service,
      agentId,
      correlationId,
      ...meta
    } = info;

    const logEntry = {
      timestamp,
      level,
      message,
      service,
      agentId,
      correlationId,
      ...meta,
    };

    return JSON.stringify(logEntry);
  }
}

/**
 * Create a singleton logger instance for a service
 */
const loggerInstances = new Map<string, Logger>();

export function createLogger(config: LoggerConfig): Logger {
  const key = `${config.service}-${config.agentId || "default"}`;

  if (!loggerInstances.has(key)) {
    loggerInstances.set(key, new Logger(config));
  }

  return loggerInstances.get(key)!;
}

/**
 * Performance measurement utility
 */
export class PerformanceLogger {
  private readonly logger: Logger;
  private readonly startTime: number;
  private readonly operation: string;
  private readonly context: LogContext;

  constructor(logger: Logger, operation: string, context: LogContext = {}) {
    this.logger = logger;
    this.startTime = performance.now();
    this.operation = operation;
    this.context = context;

    this.logger.debug(`Starting operation: ${operation}`, context);
  }

  /**
   * Complete the operation and log duration
   */
  public complete(additionalContext: LogContext = {}): void {
    const duration = performance.now() - this.startTime;

    this.logger.info(`Completed operation: ${this.operation}`, {
      ...this.context,
      ...additionalContext,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
    });
  }

  /**
   * Mark operation as failed and log error
   */
  public fail(error: Error, additionalContext: LogContext = {}): void {
    const duration = performance.now() - this.startTime;

    this.logger.error(`Failed operation: ${this.operation}`, {
      ...this.context,
      ...additionalContext,
      duration: Math.round(duration * 100) / 100,
      error: error.message,
      stack: error.stack,
    });
  }
}
