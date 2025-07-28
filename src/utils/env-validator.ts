/**
 * @fileoverview Environment variable validation and security utilities
 * @lastmodified 2025-07-28T03:00:00Z
 * 
 * Features: Required env validation, sanitization, type coercion, security checks
 * Main APIs: validateEnvironment(), sanitizeEnvValue(), validatePort()
 * Constraints: Throws on missing required vars, logs security warnings
 * Patterns: Fail-fast startup validation, secure defaults, input sanitization
 */

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: string;
  ALLOWED_ORIGINS?: string;
  JWT_SECRET?: string;
  API_KEY?: string;
}

interface EnvValidationRule {
  name: string;
  required: boolean;
  validator?: (value: string) => boolean;
  sanitizer?: (value: string) => string;
  defaultValue?: string;
  description: string;
}

const ENV_VALIDATION_RULES: EnvValidationRule[] = [
  {
    name: 'NODE_ENV',
    required: true,
    validator: (value: string) => ['development', 'production', 'test'].includes(value),
    sanitizer: (value: string) => value.toLowerCase().trim(),
    defaultValue: 'development',
    description: 'Application environment'
  },
  {
    name: 'PORT',
    required: true,
    validator: (value: string) => {
      const port = parseInt(value, 10);
      return !isNaN(port) && port > 0 && port < 65536;
    },
    sanitizer: (value: string) => value.trim(),
    defaultValue: '3000',
    description: 'HTTP server port'
  },
  {
    name: 'LOG_LEVEL',
    required: true,
    validator: (value: string) => ['error', 'warn', 'info', 'debug'].includes(value),
    sanitizer: (value: string) => value.toLowerCase().trim(),
    defaultValue: 'info',
    description: 'Logging level'
  },
  {
    name: 'ALLOWED_ORIGINS',
    required: false,
    validator: (value: string) => {
      const origins = value.split(',');
      return origins.every(origin => {
        const trimmed = origin.trim();
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed === 'localhost';
      });
    },
    sanitizer: (value: string) => value.split(',').map(o => o.trim()).join(','),
    description: 'Allowed CORS origins (comma-separated)'
  },
  {
    name: 'JWT_SECRET',
    required: false,
    validator: (value: string) => value.length >= 32,
    sanitizer: (value: string) => value.trim(),
    description: 'JWT signing secret (minimum 32 characters)'
  },
  {
    name: 'API_KEY',
    required: false,
    validator: (value: string) => value.length >= 16,
    sanitizer: (value: string) => value.trim(),
    description: 'API authentication key (minimum 16 characters)'
  }
];

/**
 * Validates all environment variables according to defined rules
 * @throws Error if validation fails for required variables
 * @returns Validated and sanitized environment configuration
 */
export function validateEnvironment(): EnvConfig {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validated: Record<string, any> = {};

  for (const rule of ENV_VALIDATION_RULES) {
    const rawValue = process.env[rule.name];
    
    // Check if required variable is missing
    if (rule.required && (!rawValue || rawValue.trim() === '')) {
      if (rule.defaultValue) {
        warnings.push(`Using default value for ${rule.name}: ${rule.defaultValue}`);
        validated[rule.name] = rule.defaultValue;
      } else {
        errors.push(`Missing required environment variable: ${rule.name} (${rule.description})`);
        continue;
      }
    } else if (!rawValue) {
      // Optional variable not provided
      continue;
    } else {
      validated[rule.name] = rawValue;
    }

    const value = validated[rule.name];
    
    // Sanitize the value
    if (rule.sanitizer) {
      validated[rule.name] = rule.sanitizer(value);
    }

    // Validate the sanitized value
    if (rule.validator && !rule.validator(validated[rule.name])) {
      errors.push(`Invalid value for ${rule.name}: "${value}" (${rule.description})`);
    }

    // Security checks for sensitive variables
    if (rule.name.includes('SECRET') || rule.name.includes('KEY')) {
      if (value.length < 16) {
        warnings.push(`${rule.name} appears to be weak (less than 16 characters)`);
      }
      if (value === 'your_' + rule.name.toLowerCase() || value.includes('example')) {
        errors.push(`${rule.name} contains placeholder value - please set a real value`);
      }
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('Environment validation warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // Throw on errors
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  // Convert PORT to number
  if (validated.PORT) {
    validated.PORT = parseInt(validated.PORT, 10);
  }

  return validated as EnvConfig;
}

/**
 * Sanitizes an environment variable value
 * @param value Raw environment variable value
 * @returns Sanitized value
 */
export function sanitizeEnvValue(value: string): string {
  return value
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

/**
 * Validates a port number
 * @param port Port number to validate
 * @returns True if port is valid
 */
export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port < 65536;
}

/**
 * Gets environment variable with validation
 * @param name Variable name
 * @param defaultValue Default value if not set
 * @param validator Optional validation function
 * @returns Validated environment variable value
 */
export function getEnvVar(
  name: string,
  defaultValue: string,
  validator?: (value: string) => boolean
): string {
  const value = process.env[name] || defaultValue;
  const sanitized = sanitizeEnvValue(value);
  
  if (validator && !validator(sanitized)) {
    throw new Error(`Invalid environment variable ${name}: ${sanitized}`);
  }
  
  return sanitized;
}