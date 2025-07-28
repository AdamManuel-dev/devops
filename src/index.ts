/**
 * @fileoverview Main entry point for IntelliOps AI Agent application
 * @lastmodified 2025-07-28T02:50:00Z
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
import { Logger, createLogger } from "@/utils/logger";
import { createCorrelationId } from "@/utils/correlation";

// Application configuration
interface AppConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly logLevel: string;
}

function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
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

    // Security middleware
    app.use(helmet());
    app.use(cors());
    app.use(compression());

    // Body parsing middleware
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    app.use((req, res, next) => {
      const correlationId = createCorrelationId();
      req.headers["x-correlation-id"] = correlationId;

      this.logger.info("HTTP Request", {
        method: req.method,
        path: req.path,
        correlationId,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
      });

      next();
    });

    // Health check endpoint
    app.get("/health", (req, res) => {
      const agents = this.agentRegistry.getAll();
      const healthyAgents = agents.filter(
        (agent) => agent.health.status === "healthy",
      );

      const health = {
        status: healthyAgents.length === agents.length ? "healthy" : "degraded",
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

      res.status(health.status === "healthy" ? 200 : 503).json(health);
    });

    // Agent status endpoint
    app.get("/agents", (req, res) => {
      const agents = this.agentRegistry.getAll();
      res.json({
        agents,
        timestamp: new Date().toISOString(),
        correlationId: req.headers["x-correlation-id"],
      });
    });

    // Ready check endpoint
    app.get("/ready", (req, res) => {
      const agents = this.agentRegistry.getAll();
      const runningAgents = agents.filter((agent) => agent.state === "running");

      if (runningAgents.length === agents.length && agents.length > 0) {
        res.status(200).json({
          status: "ready",
          timestamp: new Date().toISOString(),
          correlationId: req.headers["x-correlation-id"],
        });
      } else {
        res.status(503).json({
          status: "not-ready",
          message: "Not all agents are running",
          timestamp: new Date().toISOString(),
          correlationId: req.headers["x-correlation-id"],
        });
      }
    });

    // Error handling middleware
    app.use(
      (
        error: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        this.logger.error("HTTP Error", {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
          correlationId: req.headers["x-correlation-id"],
        });

        res.status(500).json({
          error: "Internal Server Error",
          correlationId: req.headers["x-correlation-id"],
          timestamp: new Date().toISOString(),
        });
      },
    );

    return app;
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
  console.error("Failed to start application:", error);
  process.exit(1);
});
