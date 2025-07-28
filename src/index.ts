/**
 * @fileoverview Main entry point for IntelliOps AI Agent application
 * @lastmodified 2025-07-28T05:58:47Z
 *
 * Features: Application bootstrap, graceful shutdown, agent lifecycle management
 * Main APIs: Application startup, configuration loading, health check server
 * Constraints: Environment-based configuration, comprehensive error handling
 * Patterns: Graceful shutdown, dependency injection, health monitoring
 */

import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { AgentRegistry } from "@/core/agent";
import { AgentInfo } from "@/types";
import { Logger, createLogger } from "@/utils/logger";
import { createCorrelationId } from "@/utils/correlation";
import { validateEnvironment } from "@/utils/env-validator";

// Application configuration
interface AppConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly logLevel: string;
}

// Application configuration constants
const DEFAULT_PORT = 3000;
const DEFAULT_NODE_ENV = "development";
const DEFAULT_LOG_LEVEL = "info";

function loadConfig(): AppConfig {
  // Validate environment variables at startup
  const validatedEnv = validateEnvironment();
  
  return {
    port: validatedEnv.PORT,
    nodeEnv: validatedEnv.NODE_ENV,
    logLevel: validatedEnv.LOG_LEVEL,
  };
}

class Application {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly agentRegistry: AgentRegistry;
  private readonly app: express.Application;
  private server?: import("http").Server;

  constructor() {
    this.config = loadConfig();
    this.logger = createLogger({
      service: "intelliops-main",
      level: this.config.logLevel,
    });
    this.agentRegistry = new AgentRegistry();
    this.app = this.createExpressApp();

    this.setupGracefulShutdown();
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    try {
      this.logger.info("Starting IntelliOps AI Agent", {
        version: process.env.npm_package_version || "1.0.0",
        nodeEnv: this.config.nodeEnv,
        port: this.config.port,
        correlationId: createCorrelationId(),
      });

      // Start HTTP server
      await this.startHttpServer();

      // Initialize and start agents
      await this.initializeAgents();
      await this.agentRegistry.startAll();

      this.logger.info("IntelliOps AI Agent started successfully", {
        port: this.config.port,
      });
    } catch (error) {
      this.logger.error("Failed to start application", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.logger.info("Shutting down IntelliOps AI Agent");

    try {
      // Stop all agents first
      await this.agentRegistry.stopAll();

      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => resolve());
        });
      }

      this.logger.info("IntelliOps AI Agent shutdown completed");
    } catch (error) {
      this.logger.error("Error during shutdown", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private createExpressApp(): express.Application {
    const app = express();

    this.setupSecurityMiddleware(app);
    this.setupBodyParsingMiddleware(app);
    this.setupRequestLoggingMiddleware(app);
    this.setupHealthEndpoints(app);
    this.setupErrorHandling(app);

    return app;
  }

  private setupSecurityMiddleware(app: express.Application): void {
    // Content Security Policy configuration
    const cspDirectives = {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    };

    // HTTP Strict Transport Security configuration
    const hstsConfig = {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true
    };

    app.use(helmet({
      contentSecurityPolicy: { directives: cspDirectives },
      hsts: hstsConfig
    }));

    // CORS configuration
    const validatedEnv = validateEnvironment();
    const allowedOrigins = validatedEnv.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    app.use(cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
    }));

    app.use(compression());
  }

  private setupBodyParsingMiddleware(app: express.Application): void {
    const JSON_SIZE_LIMIT = "10mb";
    
    app.use(express.json({ limit: JSON_SIZE_LIMIT }));
    app.use(express.urlencoded({ extended: true }));

  }

  private setupRequestLoggingMiddleware(app: express.Application): void {
    app.use((req, res, next) => {
      const correlationId = createCorrelationId();
      req.headers["x-correlation-id"] = correlationId;

      this.logger.info("HTTP Request received", {
        method: req.method,
        path: req.path,
        correlationId,
        userAgent: req.get("User-Agent"),
        clientIp: req.ip,
      });

      next();
    });

  }

  private setupHealthEndpoints(app: express.Application): void {
    app.get("/health", this.handleHealthCheck.bind(this));
    app.get("/agents", this.handleAgentStatus.bind(this));
    app.get("/ready", this.handleReadinessCheck.bind(this));
  }

  private handleHealthCheck(req: express.Request, res: express.Response): void {
    const agents = this.agentRegistry.getAll();
    const healthyAgents = this.filterHealthyAgents(agents);
    const isSystemHealthy = this.isSystemHealthy(agents, healthyAgents);

    const healthResponse = {
      status: isSystemHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      agents: {
        total: agents.length,
        healthy: healthyAgents.length,
        unhealthy: agents.length - healthyAgents.length,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      correlationId: req.headers["x-correlation-id"],
    };

    const statusCode = isSystemHealthy ? 200 : 503;
    res.status(statusCode).json(healthResponse);
  }

  private handleAgentStatus(req: express.Request, res: express.Response): void {
    const agents = this.agentRegistry.getAll();
    
    res.json({
      agents,
      timestamp: new Date().toISOString(),
      correlationId: req.headers["x-correlation-id"],
    });
  }

  private handleReadinessCheck(req: express.Request, res: express.Response): void {
    const agents = this.agentRegistry.getAll();
    const runningAgents = this.filterRunningAgents(agents);
    const isSystemReady = this.isSystemReady(agents, runningAgents);

    const baseResponse = {
      timestamp: new Date().toISOString(),
      correlationId: req.headers["x-correlation-id"],
    };

    if (isSystemReady) {
      res.status(200).json({
        ...baseResponse,
        status: "ready",
      });
    } else {
      res.status(503).json({
        ...baseResponse,
        status: "not-ready",
        message: "Not all agents are running",
      });
    }
  }

  // Helper methods for health checks
  private filterHealthyAgents(agents: AgentInfo[]) {
    return agents.filter((agent) => agent.health.status === "healthy");
  }

  private filterRunningAgents(agents: AgentInfo[]) {
    return agents.filter((agent) => agent.state === "running");
  }

  private isSystemHealthy(allAgents: AgentInfo[], healthyAgents: AgentInfo[]): boolean {
    return healthyAgents.length === allAgents.length;
  }

  private isSystemReady(allAgents: AgentInfo[], runningAgents: AgentInfo[]): boolean {
    return runningAgents.length === allAgents.length && allAgents.length > 0;
  }

  private setupErrorHandling(app: express.Application): void {
    app.use(this.handleApplicationError.bind(this));
  }

  private handleApplicationError(
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    this.logger.error("HTTP Error occurred", {
      errorMessage: error.message,
      stackTrace: error.stack,
      requestPath: req.path,
      httpMethod: req.method,
      correlationId: req.headers["x-correlation-id"],
    });

    const errorResponse = {
      error: "Internal Server Error",
      correlationId: req.headers["x-correlation-id"],
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(errorResponse);
  }

  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          this.logger.info("HTTP server started", { port: this.config.port });
          resolve();
        }
      });
    });
  }

  private async initializeAgents(): Promise<void> {
    // TODO: Initialize specific agents based on configuration
    // For now, this is a placeholder for agent initialization
    this.logger.info(
      "Agent initialization placeholder - agents will be added in future phases",
    );

    // Example agent registration would look like:
    // const logProcessorAgent = new LogProcessorAgent(logProcessorConfig);
    // this.agentRegistry.register(logProcessorAgent);
  }

  private setupGracefulShutdown(): void {
    const shutdownSignals = ["SIGTERM", "SIGINT", "SIGQUIT"] as const;

    shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, initiating graceful shutdown`);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught Exception", {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error("Unhandled Promise Rejection", {
        reason: String(reason),
        promise: String(promise),
      });
      process.exit(1);
    });
  }
}

// Start the application
const app = new Application();
app.start().catch((error) => {
  // Use proper error handling instead of console.error
  const logger = createLogger({ service: "intelliops-startup", level: "error" });
  logger.error("Failed to start application", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
