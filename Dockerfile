# Dockerfile for IPTV Player
# Multi-stage build for minimal image size

# Stage 1: Build environment
FROM node:16-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build application (adjust based on actual build process)
RUN npm run build

# Stage 2: Runtime environment
FROM node:16-alpine

# Install runtime dependencies
RUN apk add --no-cache ffmpeg python3 bash curl

# Install .NET Runtime dependencies
RUN apk add --no-cache \
    icu-libs \
    krb5-libs \
    libgcc \
    libintl \
    libssl3 \
    libstdc++ \
    zlib

# Install .NET Runtime
RUN mkdir -p /usr/share/dotnet && \
    curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 6.0 --install-dir /usr/share/dotnet && \
    ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet && \
    dotnet --info

# Create app directories
RUN mkdir -p /app/data/playlists /app/data/recordings /app/tests

# Set working directory
WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/README.md ./

# Install production dependencies
RUN npm ci --only=production

# Volume for persistent data
VOLUME ["/app/data"]

# Expose application port (adjust as needed)
EXPOSE 8000

# Health check (adjust based on actual health check endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]