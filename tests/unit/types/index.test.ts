/**
 * @fileoverview Unit tests for Type definitions and schemas
 * @lastmodified 2025-07-28T06:35:00Z
 * 
 * Features: Zod schema validation, type inference, branded types, enum validation
 * Main APIs: Schema validation, type safety, error handling
 * Constraints: Jest framework, Zod validation, comprehensive type coverage
 * Patterns: Schema testing, type assertion, validation error handling
 */

import {
  // Types
  AgentConfig,
  HealthStatus,
  AgentState,
  Severity,
  Category,
  ErrorRecord,
  AgentInfo,
  HealthCheck,
  // Schemas
  AgentConfigSchema,
  ErrorRecordSchema,
  HealthStatus as HealthStatusEnum,
  AgentState as AgentStateEnum,
  Severity as SeverityEnum,
  Category as CategoryEnum,
  // Branded types
  AgentId,
  CorrelationId,
  EmbeddingVector
} from "../../../src/types";

describe("Type Definitions", () => {
  describe("Zod Enums", () => {
    describe("HealthStatus", () => {
      it("should validate correct health status values", () => {
        const validStatuses = ["healthy", "unhealthy", "degraded", "unknown"];
        
        validStatuses.forEach(status => {
          const result = HealthStatusEnum.safeParse(status);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(status);
          }
        });
      });

      it("should reject invalid health status values", () => {
        const invalidStatuses = ["good", "bad", "ok", "error", ""];
        
        invalidStatuses.forEach(status => {
          const result = HealthStatusEnum.safeParse(status);
          expect(result.success).toBe(false);
        });
      });

      it("should provide type inference", () => {
        const status: HealthStatus = "healthy";
        const result = HealthStatusEnum.parse(status);
        
        expect(result).toBe("healthy");
        expect(typeof result).toBe("string");
      });
    });

    describe("AgentState", () => {
      it("should validate correct agent state values", () => {
        const validStates = ["starting", "running", "stopping", "stopped", "error"];
        
        validStates.forEach(state => {
          const result = AgentStateEnum.safeParse(state);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(state);
          }
        });
      });

      it("should reject invalid agent state values", () => {
        const invalidStates = ["active", "inactive", "paused", ""];
        
        invalidStates.forEach(state => {
          const result = AgentStateEnum.safeParse(state);
          expect(result.success).toBe(false);
        });
      });
    });

    describe("Severity", () => {
      it("should validate correct severity values", () => {
        const validSeverities = ["P1", "P2", "P3", "P4", "P5"];
        
        validSeverities.forEach(severity => {
          const result = SeverityEnum.safeParse(severity);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(severity);
          }
        });
      });

      it("should reject invalid severity values", () => {
        const invalidSeverities = ["High", "Medium", "Low", "Critical", "p1", ""];
        
        invalidSeverities.forEach(severity => {
          const result = SeverityEnum.safeParse(severity);
          expect(result.success).toBe(false);
        });
      });
    });

    describe("Category", () => {
      it("should validate correct category values", () => {
        const validCategories = ["Infrastructure", "Application", "Security", "Database", "Integration"];
        
        validCategories.forEach(category => {
          const result = CategoryEnum.safeParse(category);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(category);
          }
        });
      });

      it("should reject invalid category values", () => {
        const invalidCategories = ["Network", "UI", "Backend", "infrastructure", ""];
        
        invalidCategories.forEach(category => {
          const result = CategoryEnum.safeParse(category);
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe("AgentConfigSchema", () => {
    const validAgentConfig = {
      id: "test-agent-001",
      name: "Test Agent",
      version: "1.0.0",
      enabled: true,
      dependencies: ["dep1", "dep2"],
      healthCheckInterval: 5000,
      maxRetries: 3,
      timeout: 10000
    };

    it("should validate a correct agent configuration", () => {
      const result = AgentConfigSchema.safeParse(validAgentConfig);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAgentConfig);
      }
    });

    it("should validate minimal agent configuration", () => {
      const minimalConfig = {
        id: "minimal",
        name: "Minimal Agent",
        version: "1.0.0",
        enabled: false,
        dependencies: [],
        healthCheckInterval: 1000,
        maxRetries: 0,
        timeout: 1000
      };

      const result = AgentConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
    });

    describe("field validation", () => {
      it("should reject empty id", () => {
        const config = { ...validAgentConfig, id: "" };
        const result = AgentConfigSchema.safeParse(config);
        
        expect(result.success).toBe(false);
      });

      it("should reject empty name", () => {
        const config = { ...validAgentConfig, name: "" };
        const result = AgentConfigSchema.safeParse(config);
        
        expect(result.success).toBe(false);
      });

      it("should validate version format", () => {
        const validVersions = ["1.0.0", "2.1.3", "10.20.30"];
        const invalidVersions = ["1.0", "v1.0.0", "1.0.0-beta", "invalid"];

        validVersions.forEach(version => {
          const config = { ...validAgentConfig, version };
          const result = AgentConfigSchema.safeParse(config);
          expect(result.success).toBe(true);
        });

        invalidVersions.forEach(version => {
          const config = { ...validAgentConfig, version };
          const result = AgentConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        });
      });

      it("should validate positive healthCheckInterval", () => {
        const config = { ...validAgentConfig, healthCheckInterval: 0 };
        const result = AgentConfigSchema.safeParse(config);
        
        expect(result.success).toBe(false);
      });

      it("should validate non-negative maxRetries", () => {
        const config = { ...validAgentConfig, maxRetries: -1 };
        const result = AgentConfigSchema.safeParse(config);
        
        expect(result.success).toBe(false);
      });

      it("should validate positive timeout", () => {
        const config = { ...validAgentConfig, timeout: 0 };
        const result = AgentConfigSchema.safeParse(config);
        
        expect(result.success).toBe(false);
      });

      it("should validate dependencies array", () => {
        const validDeps = [[], ["dep1"], ["dep1", "dep2", "dep3"]];
        const invalidDeps = ["not-array", null, undefined];

        validDeps.forEach(dependencies => {
          const config = { ...validAgentConfig, dependencies };
          const result = AgentConfigSchema.safeParse(config);
          expect(result.success).toBe(true);
        });

        invalidDeps.forEach(dependencies => {
          const config = { ...validAgentConfig, dependencies };
          const result = AgentConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        });
      });
    });

    it("should reject missing required fields", () => {
      const requiredFields = ["id", "name", "version", "enabled", "dependencies", "healthCheckInterval", "maxRetries", "timeout"];
      
      requiredFields.forEach(field => {
        const config = { ...validAgentConfig };
        delete (config as any)[field];
        
        const result = AgentConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });
    });

    it("should reject additional fields", () => {
      const configWithExtra = {
        ...validAgentConfig,
        extraField: "should not be allowed"
      };

      const result = AgentConfigSchema.safeParse(configWithExtra);
      expect(result.success).toBe(false);
    });
  });

  describe("ErrorRecordSchema", () => {
    const validErrorRecord = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      timestamp: new Date("2023-07-28T10:00:00Z"),
      service: "test-service",
      environment: "production",
      severity: "P1" as const,
      category: ["Application", "Database"] as const,
      message: "Database connection failed",
      stackTrace: "Error at line 1...",
      contextData: { requestId: "req-123", userId: "user-456" },
      embedding: [0.1, 0.2, 0.3],
      clusterId: "cluster-123",
      metadata: {
        source: "api-gateway",
        ingestionTime: new Date("2023-07-28T10:00:01Z"),
        processingTime: 150,
        correlationId: "456e7890-e89b-12d3-a456-426614174001"
      }
    };

    it("should validate a complete error record", () => {
      const result = ErrorRecordSchema.safeParse(validErrorRecord);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validErrorRecord.id);
        expect(result.data.severity).toBe("P1");
        expect(result.data.category).toEqual(["Application", "Database"]);
      }
    });

    it("should validate minimal error record", () => {
      const minimalRecord = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        timestamp: new Date(),
        service: "test",
        environment: "dev",
        severity: "P5" as const,
        category: ["Infrastructure"] as const,
        message: "Test error",
        contextData: {},
        metadata: {
          source: "test",
          ingestionTime: new Date(),
          processingTime: 0,
          correlationId: "456e7890-e89b-12d3-a456-426614174001"
        }
      };

      const result = ErrorRecordSchema.safeParse(minimalRecord);
      expect(result.success).toBe(true);
    });

    describe("field validation", () => {
      it("should validate UUID format for id", () => {
        const invalidIds = ["not-uuid", "123", "", "123e4567-e89b-12d3-a456-42661417400"]; // too short
        
        invalidIds.forEach(id => {
          const record = { ...validErrorRecord, id };
          const result = ErrorRecordSchema.safeParse(record);
          expect(result.success).toBe(false);
        });
      });

      it("should validate date objects", () => {
        const record = { ...validErrorRecord, timestamp: "2023-07-28T10:00:00Z" };
        const result = ErrorRecordSchema.safeParse(record);
        
        expect(result.success).toBe(false);
      });

      it("should validate non-empty strings", () => {
        const stringFields = ["service", "environment", "message"];
        
        stringFields.forEach(field => {
          const record = { ...validErrorRecord, [field]: "" };
          const result = ErrorRecordSchema.safeParse(record);
          expect(result.success).toBe(false);
        });
      });

      it("should validate severity enum", () => {
        const record = { ...validErrorRecord, severity: "Invalid" as any };
        const result = ErrorRecordSchema.safeParse(record);
        
        expect(result.success).toBe(false);
      });

      it("should validate category array", () => {
        const validCategories = [["Infrastructure"], ["Application", "Security"]];
        const invalidCategories = [[], ["Invalid"], "not-array"];

        validCategories.forEach(category => {
          const record = { ...validErrorRecord, category };
          const result = ErrorRecordSchema.safeParse(record);
          expect(result.success).toBe(true);
        });

        invalidCategories.forEach(category => {
          const record = { ...validErrorRecord, category };
          const result = ErrorRecordSchema.safeParse(record);
          expect(result.success).toBe(false);
        });
      });

      it("should validate optional fields", () => {
        const recordWithoutOptionals = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          timestamp: new Date(),
          service: "test",
          environment: "dev",
          severity: "P1" as const,
          category: ["Application"] as const,
          message: "Test error",
          contextData: {},
          metadata: {
            source: "test",
            ingestionTime: new Date(),
            processingTime: 0,
            correlationId: "456e7890-e89b-12d3-a456-426614174001"
          }
        };

        const result = ErrorRecordSchema.safeParse(recordWithoutOptionals);
        expect(result.success).toBe(true);
      });

      it("should validate metadata structure", () => {
        const invalidMetadata = {
          source: "",
          ingestionTime: "invalid-date",
          processingTime: -1,
          correlationId: "invalid-uuid"
        };

        const record = { ...validErrorRecord, metadata: invalidMetadata };
        const result = ErrorRecordSchema.safeParse(record);
        
        expect(result.success).toBe(false);
      });

      it("should validate embedding array", () => {
        const validEmbeddings = [[0.1, 0.2], [1.0, -1.0, 0.0], []];
        const invalidEmbeddings = ["not-array", [1, "invalid"], null];

        validEmbeddings.forEach(embedding => {
          const record = { ...validErrorRecord, embedding };
          const result = ErrorRecordSchema.safeParse(record);
          expect(result.success).toBe(true);
        });

        invalidEmbeddings.forEach(embedding => {
          const record = { ...validErrorRecord, embedding };
          const result = ErrorRecordSchema.safeParse(record);
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe("Branded Types", () => {
    it("should create AgentId branded type", () => {
      const id: AgentId = "agent-123" as AgentId;
      
      expect(typeof id).toBe("string");
      expect(id).toBe("agent-123");
    });

    it("should create CorrelationId branded type", () => {
      const correlationId: CorrelationId = "corr-456" as CorrelationId;
      
      expect(typeof correlationId).toBe("string");
      expect(correlationId).toBe("corr-456");
    });

    it("should create EmbeddingVector branded type", () => {
      const vector: EmbeddingVector = [0.1, 0.2, 0.3] as EmbeddingVector;
      
      expect(Array.isArray(vector)).toBe(true);
      expect(vector).toEqual([0.1, 0.2, 0.3]);
    });

    it("should maintain type safety with branded types", () => {
      const agentId: AgentId = "agent-1" as AgentId;
      const correlationId: CorrelationId = "corr-1" as CorrelationId;
      
      // TypeScript should prevent direct assignment between branded types
      // This is compile-time type safety, so we just verify the values
      expect(agentId).toBe("agent-1");
      expect(correlationId).toBe("corr-1");
    });
  });

  describe("Interface Completeness", () => {
    it("should define complete AgentConfig interface", () => {
      const config: AgentConfig = {
        id: "test",
        name: "Test Agent",
        version: "1.0.0",
        enabled: true,
        dependencies: [],
        healthCheckInterval: 1000,
        maxRetries: 3,
        timeout: 5000
      };

      expect(config.id).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.version).toBeDefined();
      expect(typeof config.enabled).toBe("boolean");
      expect(Array.isArray(config.dependencies)).toBe(true);
      expect(typeof config.healthCheckInterval).toBe("number");
      expect(typeof config.maxRetries).toBe("number");
      expect(typeof config.timeout).toBe("number");
    });

    it("should define complete HealthCheck interface", () => {
      const healthCheck: HealthCheck = {
        status: "healthy",
        timestamp: new Date(),
        message: "All good",
        details: { cpu: 50, memory: 80 }
      };

      expect(healthCheck.status).toBeDefined();
      expect(healthCheck.timestamp).toBeInstanceOf(Date);
      expect(healthCheck.message).toBeDefined();
      expect(healthCheck.details).toBeDefined();
    });

    it("should define complete AgentInfo interface", () => {
      const agentInfo: AgentInfo = {
        id: "agent-1",
        name: "Test Agent",
        state: "running",
        health: {
          status: "healthy",
          timestamp: new Date()
        },
        startedAt: new Date(),
        lastSeen: new Date(),
        metadata: {
          version: "1.0.0",
          uptime: 1000
        }
      };

      expect(agentInfo.id).toBeDefined();
      expect(agentInfo.name).toBeDefined();
      expect(agentInfo.state).toBeDefined();
      expect(agentInfo.health).toBeDefined();
      expect(agentInfo.startedAt).toBeDefined();
      expect(agentInfo.lastSeen).toBeDefined();
      expect(agentInfo.metadata).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should provide detailed validation errors", () => {
      const invalidConfig = {
        id: "",
        name: "Test",
        version: "invalid-version",
        enabled: "not-boolean",
        maxRetries: -1
      };

      const result = AgentConfigSchema.safeParse(invalidConfig);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        
        const errorMessages = result.error.issues.map(issue => issue.message);
        expect(errorMessages.some(msg => msg.includes("String must contain at least 1 character"))).toBe(true);
      }
    });

    it("should handle type coercion appropriately", () => {
      const configWithStringNumbers = {
        id: "test",
        name: "Test",
        version: "1.0.0",
        enabled: true,
        dependencies: [],
        healthCheckInterval: "5000", // String instead of number
        maxRetries: "3",
        timeout: "10000"
      };

      const result = AgentConfigSchema.safeParse(configWithStringNumbers);
      expect(result.success).toBe(false); // Should require proper types
    });
  });
});