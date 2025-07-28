/**
 * @fileoverview Unit tests for Environment Validator utilities
 * @lastmodified 2025-07-28T06:20:00Z
 * 
 * Features: Environment validation, sanitization, security checks, type coercion
 * Main APIs: validateEnvironment, sanitizeEnvValue, validatePort, getEnvVar
 * Constraints: Jest framework, comprehensive coverage, security validation
 * Patterns: Test isolation, realistic data, edge case coverage, security testing
 */

import { 
  validateEnvironment, 
  sanitizeEnvValue, 
  validatePort, 
  getEnvVar 
} from "../../../src/utils/env-validator";

describe("Environment Validator", () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment variables for each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("validateEnvironment", () => {
    it("should validate with all required environment variables", () => {
      process.env.NODE_ENV = "production";
      process.env.PORT = "8080";
      process.env.LOG_LEVEL = "info";

      const result = validateEnvironment();

      expect(result).toEqual({
        NODE_ENV: "production",
        PORT: 8080,
        LOG_LEVEL: "info"
      });
    });

    it("should use default values for missing required variables", () => {
      // Clear all environment variables
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;

      // Mock console.warn to capture warnings
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = validateEnvironment();

      expect(result).toEqual({
        NODE_ENV: "development",
        PORT: 3000,
        LOG_LEVEL: "info"
      });

      expect(consoleSpy).toHaveBeenCalledWith("Environment validation warnings:");
      expect(consoleSpy).toHaveBeenCalledWith("  - Using default value for NODE_ENV: development");
      
      consoleSpy.mockRestore();
    });

    it("should sanitize environment variable values", () => {
      process.env.NODE_ENV = "  PRODUCTION  ";
      process.env.PORT = " 8080 ";
      process.env.LOG_LEVEL = " INFO ";

      const result = validateEnvironment();

      expect(result.NODE_ENV).toBe("production");
      expect(result.PORT).toBe(8080);
      expect(result.LOG_LEVEL).toBe("info");
    });

    it("should validate NODE_ENV values", () => {
      process.env.NODE_ENV = "invalid";
      process.env.PORT = "3000";
      process.env.LOG_LEVEL = "info";

      expect(() => validateEnvironment()).toThrow(
        "Environment validation failed:"
      );
      expect(() => validateEnvironment()).toThrow(
        "Invalid value for NODE_ENV"
      );
    });

    it("should validate PORT values", () => {
      process.env.NODE_ENV = "development";
      process.env.PORT = "invalid";
      process.env.LOG_LEVEL = "info";

      expect(() => validateEnvironment()).toThrow(
        "Invalid value for PORT"
      );
    });

    it("should validate PORT range", () => {
      process.env.NODE_ENV = "development";
      process.env.LOG_LEVEL = "info";

      // Test invalid port values
      process.env.PORT = "0";
      expect(() => validateEnvironment()).toThrow("Invalid value for PORT");

      process.env.PORT = "65536";
      expect(() => validateEnvironment()).toThrow("Invalid value for PORT");

      process.env.PORT = "-1";
      expect(() => validateEnvironment()).toThrow("Invalid value for PORT");
    });

    it("should validate LOG_LEVEL values", () => {
      process.env.NODE_ENV = "development";
      process.env.PORT = "3000";
      process.env.LOG_LEVEL = "invalid";

      expect(() => validateEnvironment()).toThrow(
        "Invalid value for LOG_LEVEL"
      );
    });

    it("should handle optional ALLOWED_ORIGINS", () => {
      process.env.NODE_ENV = "development";
      process.env.PORT = "3000";
      process.env.LOG_LEVEL = "info";
      process.env.ALLOWED_ORIGINS = "http://localhost:3000,https://example.com";

      const result = validateEnvironment();

      expect(result.ALLOWED_ORIGINS).toBe("http://localhost:3000,https://example.com");
    });

    it("should validate ALLOWED_ORIGINS format", () => {
      process.env.NODE_ENV = "development";
      process.env.PORT = "3000";
      process.env.LOG_LEVEL = "info";
      process.env.ALLOWED_ORIGINS = "invalid-url,another-invalid";

      expect(() => validateEnvironment()).toThrow(
        "Invalid value for ALLOWED_ORIGINS"
      );
    });

    it("should sanitize ALLOWED_ORIGINS", () => {
      process.env.NODE_ENV = "development";
      process.env.PORT = "3000";
      process.env.LOG_LEVEL = "info";
      process.env.ALLOWED_ORIGINS = " http://localhost:3000 , https://example.com ";

      const result = validateEnvironment();

      expect(result.ALLOWED_ORIGINS).toBe("http://localhost:3000,https://example.com");
    });

    describe("security validation", () => {
      it("should detect weak JWT_SECRET", () => {
        process.env.NODE_ENV = "development";
        process.env.PORT = "3000";
        process.env.LOG_LEVEL = "info";
        process.env.JWT_SECRET = "weak";

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        validateEnvironment();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("JWT_SECRET appears to be weak")
        );

        consoleSpy.mockRestore();
      });

      it("should reject placeholder values for secrets", () => {
        process.env.NODE_ENV = "development";
        process.env.PORT = "3000";
        process.env.LOG_LEVEL = "info";
        process.env.JWT_SECRET = "your_jwt_secret";

        expect(() => validateEnvironment()).toThrow(
          "JWT_SECRET contains placeholder value"
        );
      });

      it("should validate minimum length for secrets", () => {
        process.env.NODE_ENV = "development";
        process.env.PORT = "3000";
        process.env.LOG_LEVEL = "info";
        process.env.JWT_SECRET = "short";

        expect(() => validateEnvironment()).toThrow(
          "Invalid value for JWT_SECRET"
        );
      });

      it("should validate API_KEY security", () => {
        process.env.NODE_ENV = "development";
        process.env.PORT = "3000";
        process.env.LOG_LEVEL = "info";
        process.env.API_KEY = "short";

        expect(() => validateEnvironment()).toThrow(
          "Invalid value for API_KEY"
        );
      });
    });

    it("should accumulate multiple validation errors", () => {
      process.env.NODE_ENV = "invalid";
      process.env.PORT = "invalid";
      process.env.LOG_LEVEL = "invalid";

      expect(() => validateEnvironment()).toThrow("Environment validation failed:");
      
      try {
        validateEnvironment();
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("Invalid value for NODE_ENV");
        expect(errorMessage).toContain("Invalid value for PORT");
        expect(errorMessage).toContain("Invalid value for LOG_LEVEL");
      }
    });
  });

  describe("sanitizeEnvValue", () => {
    it("should trim whitespace", () => {
      expect(sanitizeEnvValue("  test  ")).toBe("test");
    });

    it("should remove dangerous characters", () => {
      expect(sanitizeEnvValue("test<script>")).toBe("testscript");
      expect(sanitizeEnvValue("test'quote")).toBe("testquote");
      expect(sanitizeEnvValue('test"quote')).toBe("testquote");
      expect(sanitizeEnvValue("test&amp;")).toBe("testamp;");
    });

    it("should limit string length", () => {
      const longString = "a".repeat(2000);
      const result = sanitizeEnvValue(longString);
      
      expect(result).toHaveLength(1000);
    });

    it("should handle empty strings", () => {
      expect(sanitizeEnvValue("")).toBe("");
      expect(sanitizeEnvValue("   ")).toBe("");
    });

    it("should preserve valid characters", () => {
      expect(sanitizeEnvValue("valid-string_123")).toBe("valid-string_123");
    });
  });

  describe("validatePort", () => {
    it("should validate valid port numbers", () => {
      expect(validatePort(80)).toBe(true);
      expect(validatePort(443)).toBe(true);
      expect(validatePort(3000)).toBe(true);
      expect(validatePort(8080)).toBe(true);
      expect(validatePort(65535)).toBe(true);
    });

    it("should reject invalid port numbers", () => {
      expect(validatePort(0)).toBe(false);
      expect(validatePort(-1)).toBe(false);
      expect(validatePort(65536)).toBe(false);
      expect(validatePort(1.5)).toBe(false);
    });

    it("should reject non-numeric values", () => {
      expect(validatePort(NaN)).toBe(false);
      expect(validatePort(Infinity)).toBe(false);
      expect(validatePort(-Infinity)).toBe(false);
    });
  });

  describe("getEnvVar", () => {
    it("should return environment variable when set", () => {
      process.env.TEST_VAR = "test-value";

      const result = getEnvVar("TEST_VAR", "default");

      expect(result).toBe("test-value");
    });

    it("should return default when environment variable not set", () => {
      delete process.env.TEST_VAR;

      const result = getEnvVar("TEST_VAR", "default");

      expect(result).toBe("default");
    });

    it("should sanitize environment variable values", () => {
      process.env.TEST_VAR = "  value<script>  ";

      const result = getEnvVar("TEST_VAR", "default");

      expect(result).toBe("valuescript");
    });

    it("should validate with custom validator", () => {
      process.env.TEST_VAR = "invalid";

      const validator = (value: string) => value === "valid";

      expect(() => getEnvVar("TEST_VAR", "default", validator)).toThrow(
        "Invalid environment variable TEST_VAR"
      );
    });

    it("should pass validation with valid value", () => {
      process.env.TEST_VAR = "valid";

      const validator = (value: string) => value === "valid";
      const result = getEnvVar("TEST_VAR", "default", validator);

      expect(result).toBe("valid");
    });

    it("should validate default value when env var not set", () => {
      delete process.env.TEST_VAR;

      const validator = (value: string) => value !== "invalid-default";

      expect(() => getEnvVar("TEST_VAR", "invalid-default", validator)).toThrow(
        "Invalid environment variable TEST_VAR"
      );
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle undefined environment variables", () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = validateEnvironment();

      expect(result).toBeDefined();
      expect(typeof result.PORT).toBe("number");

      consoleSpy.mockRestore();
    });

    it("should handle empty string environment variables", () => {
      process.env.NODE_ENV = "";
      process.env.PORT = "";
      process.env.LOG_LEVEL = "";

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = validateEnvironment();

      expect(result.NODE_ENV).toBe("development");
      expect(result.PORT).toBe(3000);
      expect(result.LOG_LEVEL).toBe("info");

      consoleSpy.mockRestore();
    });

    it("should handle whitespace-only environment variables", () => {
      process.env.NODE_ENV = "   ";
      process.env.PORT = "   ";
      process.env.LOG_LEVEL = "   ";

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = validateEnvironment();

      expect(result.NODE_ENV).toBe("development");
      expect(result.PORT).toBe(3000);
      expect(result.LOG_LEVEL).toBe("info");

      consoleSpy.mockRestore();
    });
  });
});