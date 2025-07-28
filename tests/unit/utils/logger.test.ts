/**
 * @fileoverview Unit tests for Logger infrastructure
 * @lastmodified 2025-07-28T06:25:00Z
 * 
 * Features: Structured logging, context enrichment, correlation tracking, Winston integration
 * Main APIs: Logger class, createLogger, log methods, context management
 * Constraints: Jest framework, Winston mocking, comprehensive coverage
 * Patterns: Test isolation, mock verification, realistic logging scenarios
 */

import { Logger, createLogger } from "../../../src/utils/logger";
import winston from "winston";

// Mock getEnvVar to control environment variables in tests
jest.mock("../../../src/utils/env-validator", () => ({
  getEnvVar: jest.fn()
}));

// Mock winston to avoid actual log output during tests
jest.mock("winston", () => {
  const mockWinstonLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  };

  return {
    createLogger: jest.fn(() => mockWinstonLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
      printf: jest.fn()
    },
    transports: {
      Console: jest.fn()
    }
  };
});

import { getEnvVar } from "../../../src/utils/env-validator";

describe("Logger", () => {
  let mockWinstonLogger: any;
  const mockGetEnvVar = getEnvVar as jest.MockedFunction<typeof getEnvVar>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockGetEnvVar.mockImplementation((name: string, defaultValue: string) => {
      const mockValues: Record<string, string> = {
        NODE_ENV: "test",
        npm_package_version: "1.0.0",
        HOSTNAME: "test-host",
        LOG_LEVEL: "info"
      };
      return mockValues[name] || defaultValue;
    });

    mockWinstonLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn()
    };

    (winston.createLogger as jest.Mock).mockReturnValue(mockWinstonLogger);
  });

  describe("Logger constructor", () => {
    it("should create logger with service name", () => {
      const logger = new Logger({ service: "test-service" });

      expect(winston.createLogger).toHaveBeenCalled();
      expect(logger).toBeInstanceOf(Logger);
    });

    it("should create logger with agent ID", () => {
      const logger = new Logger({ 
        service: "test-service", 
        agentId: "test-agent-123" as any
      });

      expect(winston.createLogger).toHaveBeenCalled();
      expect(logger).toBeInstanceOf(Logger);
    });

    it("should create logger with custom log level", () => {
      const logger = new Logger({ 
        service: "test-service", 
        level: "debug" 
      });

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it("should use environment log level when not specified", () => {
      mockGetEnvVar.mockImplementation((name: string, defaultValue: string) => {
        if (name === "LOG_LEVEL") return "warn";
        return defaultValue;
      });

      const logger = new Logger({ service: "test-service" });

      expect(mockGetEnvVar).toHaveBeenCalledWith(
        "LOG_LEVEL", 
        "info", 
        expect.any(Function)
      );
    });
  });

  describe("createLogger factory", () => {
    it("should create logger with configuration", () => {
      const logger = createLogger({ service: "factory-test" });

      expect(logger).toBeInstanceOf(Logger);
    });

    it("should create logger with all options", () => {
      const logger = createLogger({ 
        service: "factory-test",
        agentId: "agent-123" as any,
        level: "debug"
      });

      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("logging methods", () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ service: "test-service" });
    });

    it("should log error messages", () => {
      const message = "Error occurred";
      const context = { errorCode: "E001" };

      logger.error(message, context);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, 
        expect.objectContaining({
          ...context,
          service: "test-service",
          environment: "test",
          version: "1.0.0",
          hostname: "test-host",
          processId: process.pid
        })
      );
    });

    it("should log warning messages", () => {
      const message = "Warning message";
      const context = { warningType: "deprecation" };

      logger.warn(message, context);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message,
        expect.objectContaining({
          ...context,
          service: "test-service"
        })
      );
    });

    it("should log info messages", () => {
      const message = "Info message";
      const context = { userId: "user-123" };

      logger.info(message, context);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message,
        expect.objectContaining({
          ...context,
          service: "test-service"
        })
      );
    });

    it("should log debug messages", () => {
      const message = "Debug message";
      const context = { debugInfo: "detailed-info" };

      logger.debug(message, context);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(message,
        expect.objectContaining({
          ...context,
          service: "test-service"
        })
      );
    });

    it("should handle logging without context", () => {
      const message = "Simple message";

      logger.info(message);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message,
        expect.objectContaining({
          service: "test-service",
          environment: "test"
        })
      );
    });

    it("should include agent ID in context when provided", () => {
      const loggerWithAgent = new Logger({ 
        service: "test-service", 
        agentId: "agent-456" as any 
      });

      loggerWithAgent.info("Test message", { data: "test" });

      expect(mockWinstonLogger.info).toHaveBeenCalledWith("Test message",
        expect.objectContaining({
          service: "test-service",
          agentId: "agent-456",
          data: "test"
        })
      );
    });
  });

  describe("context enrichment", () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ service: "context-test" });
    });

    it("should enrich context with environment information", () => {
      logger.info("Test message", { userData: "test" });

      expect(mockWinstonLogger.info).toHaveBeenCalledWith("Test message",
        expect.objectContaining({
          userData: "test",
          environment: "test",
          version: "1.0.0",
          hostname: "test-host",
          processId: process.pid
        })
      );
    });

    it("should preserve original context properties", () => {
      const originalContext = {
        requestId: "req-123",
        userId: "user-456",
        customField: "custom-value"
      };

      logger.info("Test message", originalContext);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith("Test message",
        expect.objectContaining(originalContext)
      );
    });

    it("should handle empty context", () => {
      logger.info("Test message", {});

      expect(mockWinstonLogger.info).toHaveBeenCalledWith("Test message",
        expect.objectContaining({
          service: "context-test",
          environment: "test"
        })
      );
    });

    it("should use environment variables for context", () => {
      mockGetEnvVar.mockImplementation((name: string, defaultValue: string) => {
        const mockValues: Record<string, string> = {
          NODE_ENV: "production",
          npm_package_version: "2.1.0",
          HOSTNAME: "prod-server"
        };
        return mockValues[name] || defaultValue;
      });

      const prodLogger = new Logger({ service: "prod-service" });
      prodLogger.info("Production message");

      expect(mockWinstonLogger.info).toHaveBeenCalledWith("Production message",
        expect.objectContaining({
          environment: "production",
          version: "2.1.0",
          hostname: "prod-server"
        })
      );
    });
  });

  describe("Winston configuration", () => {
    it("should configure Winston with correct log level", () => {
      mockGetEnvVar.mockImplementation((name: string, defaultValue: string) => {
        if (name === "LOG_LEVEL") return "debug";
        return defaultValue;
      });

      new Logger({ service: "config-test" });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug"
        })
      );
    });

    it("should use instance log level over environment", () => {
      mockGetEnvVar.mockImplementation((name: string, defaultValue: string) => {
        if (name === "LOG_LEVEL") return "warn";
        return defaultValue;
      });

      new Logger({ service: "config-test", level: "error" });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "error"
        })
      );
    });

    it("should configure Winston format", () => {
      new Logger({ service: "format-test" });

      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.json).toHaveBeenCalled();
    });

    it("should configure console transport", () => {
      new Logger({ service: "transport-test" });

      expect(winston.transports.Console).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ service: "error-test" });
    });

    it("should handle Winston errors gracefully", () => {
      mockWinstonLogger.error.mockImplementation(() => {
        throw new Error("Winston error");
      });

      // Should not throw
      expect(() => {
        logger.error("Test message");
      }).not.toThrow();
    });

    it("should handle context serialization errors", () => {
      const circularRef: any = {};
      circularRef.self = circularRef;

      // Should not throw even with circular references
      expect(() => {
        logger.info("Test with circular ref", { circular: circularRef });
      }).not.toThrow();
    });

    it("should handle undefined context gracefully", () => {
      expect(() => {
        logger.info("Test message", undefined as any);
      }).not.toThrow();
    });

    it("should handle null context gracefully", () => {
      expect(() => {
        logger.info("Test message", null as any);
      }).not.toThrow();
    });
  });

  describe("environment variable validation", () => {
    it("should validate LOG_LEVEL values", () => {
      new Logger({ service: "validation-test" });

      expect(mockGetEnvVar).toHaveBeenCalledWith(
        "LOG_LEVEL",
        "info",
        expect.any(Function)
      );

      // Test the validator function
      const calls = mockGetEnvVar.mock.calls;
      const logLevelCall = calls.find(call => call[0] === "LOG_LEVEL");
      const validator = logLevelCall?.[2];

      expect(validator).toBeDefined();
      if (validator) {
        expect(validator("error")).toBe(true);
        expect(validator("warn")).toBe(true);
        expect(validator("info")).toBe(true);
        expect(validator("debug")).toBe(true);
        expect(validator("invalid")).toBe(false);
      }
    });

    it("should validate NODE_ENV values", () => {
      new Logger({ service: "env-validation-test" });

      expect(mockGetEnvVar).toHaveBeenCalledWith(
        "NODE_ENV",
        "development",
        expect.any(Function)
      );

      // Test the validator function
      const calls = mockGetEnvVar.mock.calls;
      const nodeEnvCall = calls.find(call => call[0] === "NODE_ENV");
      const validator = nodeEnvCall?.[2];

      expect(validator).toBeDefined();
      if (validator) {
        expect(validator("development")).toBe(true);
        expect(validator("production")).toBe(true);
        expect(validator("test")).toBe(true);
        expect(validator("invalid")).toBe(false);
      }
    });
  });
});