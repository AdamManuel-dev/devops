# Multi-stage Dockerfile for IntelliOps AI Agent
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S intelliops -u 1001

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=intelliops:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=intelliops:nodejs /app/dist ./dist
COPY --from=builder --chown=intelliops:nodejs /app/package.json ./package.json

# Create logs directory
RUN mkdir -p logs && chown intelliops:nodejs logs

# Switch to non-root user
USER intelliops

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]