# Docker & Makefile Setup Guide

This guide explains how to use the Docker and Makefile setup for OpenClaw MC.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Makefile Commands](#makefile-commands)
- [Docker Setup](#docker-setup)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Using Makefile (Recommended)

```bash
# Install dependencies
make install

# Start development server
make dev

# Build for production
make build

# Start production server
make start
```

### Using Docker

```bash
# Production deployment
make docker-up

# Development with hot reload
make docker-dev

# View logs
make docker-logs

# Stop containers
make docker-down
```

## 📝 Makefile Commands

Run `make help` to see all available commands:

### Development Commands

- **`make install`** - Install all npm dependencies
- **`make dev`** - Start the development server with hot reload
- **`make build`** - Build the application for production
- **`make start`** - Start the production server

### Docker Commands

- **`make docker-build`** - Build the Docker image for production
- **`make docker-up`** - Start the application using docker-compose (production mode)
- **`make docker-dev`** - Start the application with hot reload (development mode)
- **`make docker-down`** - Stop all Docker containers
- **`make docker-logs`** - View container logs (works with both dev and prod)
- **`make docker-clean`** - Remove all containers, volumes, and images

### Utility Commands

- **`make clean`** - Remove build artifacts and logs
- **`make lint`** - Run the linter
- **`make test`** - Run tests (placeholder for future tests)
- **`make help`** - Display all available commands

## 🐳 Docker Setup

### File Structure

```
.
├── Dockerfile              # Production multi-stage build
├── Dockerfile.dev          # Development build
├── docker-compose.yml      # Production configuration
├── docker-compose.dev.yml  # Development configuration
└── .dockerignore           # Files to exclude from Docker build
```

### Production Docker (Dockerfile)

The production Dockerfile uses a multi-stage build:

1. **Stage 1 (deps)**: Installs production dependencies only
2. **Stage 2 (builder)**: Builds the Next.js application
3. **Stage 3 (runner)**: Creates minimal runtime image

Features:
- Optimized for size
- Non-root user (nextjs:nodejs)
- Health check built-in
- Proper permissions

### Development Docker (Dockerfile.dev)

The development Dockerfile:
- Installs all dependencies (including dev)
- Uses volume mounts for hot reload
- Runs `npm run dev` by default

### Docker Compose

#### Production (docker-compose.yml)

```bash
# Start
docker-compose up -d

# or
make docker-up
```

Features:
- Persistent configuration volume (`~/.oc-mission-control`)
- Data volume for activity logs
- Health checks
- Auto-restart

#### Development (docker-compose.dev.yml)

```bash
# Start
docker-compose -f docker-compose.dev.yml up

# or
make docker-dev
```

Features:
- Source code mounted as volume
- Hot reload enabled
- Development environment variables

## 💻 Development Workflow

### Local Development (Without Docker)

1. **First Time Setup**
   ```bash
   make install
   cp .env.local.example .env.local
   # Edit .env.local with your gateway details
   ```

2. **Start Development Server**
   ```bash
   make dev
   ```

3. **Build and Test**
   ```bash
   make build
   make start
   ```

### Docker Development

1. **Start Development Container**
   ```bash
   make docker-dev
   ```

2. **Make Changes**
   - Edit files locally
   - Changes automatically reload in container

3. **View Logs**
   ```bash
   make docker-logs
   ```

4. **Stop Development**
   ```bash
   make docker-down
   ```

## 🚀 Production Deployment

### Using Docker Compose

1. **Configure Environment**
   ```bash
   # Create .env file
   cat > .env << EOF
   OPENCLAW_GATEWAY_URL=http://your-gateway-host:18789
   OPENCLAW_GATEWAY_TOKEN=your_token_here
   EOF
   ```

2. **Deploy**
   ```bash
   make docker-build
   make docker-up
   ```

3. **Verify Health**
   ```bash
   curl http://localhost:3000/health
   ```

### Using Docker Directly

```bash
# Build
docker build -t mission-control:latest .

# Run
docker run -d \
  -p 3000:3000 \
  -v ~/.oc-mission-control:/root/.oc-mission-control \
  -e OPENCLAW_GATEWAY_URL=http://gateway:18789 \
  -e OPENCLAW_GATEWAY_TOKEN=your_token \
  --name mission-control \
  mission-control:latest
```

## 🔧 Troubleshooting

### Docker on Linux

**Problem**: Cannot connect to gateway using `host.docker.internal`

**Solution**: 
```bash
# Option 1: Use Docker bridge gateway IP
export OPENCLAW_GATEWAY_URL=http://172.17.0.1:18789

# Option 2: Use host network mode
docker run --network host ...
```

### Permission Issues

**Problem**: Permission denied when writing to config

**Solution**: Ensure the volume directory exists and has correct permissions
```bash
mkdir -p ~/.oc-mission-control
chmod 755 ~/.oc-mission-control
```

### Build Failures

**Problem**: npm install fails with peer dependency errors

**Solution**: Use `--legacy-peer-deps` flag (already included in Docker builds)
```bash
npm install --legacy-peer-deps
```

### Port Already in Use

**Problem**: Port 3000 is already in use

**Solution**: 
```bash
# Option 1: Stop other service on port 3000
lsof -ti:3000 | xargs kill

# Option 2: Use different port
PORT=3001 make dev
```

### Health Check Failing

**Problem**: Container health check fails

**Solution**: Check the health endpoint
```bash
# Inside container
curl http://localhost:3000/health

# From host (if published)
curl http://localhost:3000/health
```

### Hot Reload Not Working

**Problem**: Changes not reflecting in development mode

**Solution**: 
```bash
# Restart development container
make docker-down
make docker-dev
```

## 🔍 Health Checks

OpenClaw MC includes health check endpoints:

- **`/health`** - Main health endpoint
- **`/api/health`** - Reverse proxy compatible endpoint

Response format:
```json
{
  "status": "ok",
  "timestamp": "2026-02-15T19:51:44.325Z",
  "service": "mission-control",
  "version": "0.1.0",
  "gateway": {
    "connected": false
  }
}
```

Health checks are used by:
- Docker HEALTHCHECK directive
- Docker Compose health checks
- Monitoring systems
- Load balancers

## 📚 Additional Resources

- [Main README](../README.md) - Project overview and features
- [Streaming Guide](./STREAMING-GUIDE.md) - WebSocket implementation
- [WebSocket Protocol](./WEBSOCKET.md) - Message protocol details

## 🤝 Contributing

When making changes:
1. Test locally with `make dev`
2. Test Docker build with `make docker-build`
3. Verify health endpoint works
4. Update this guide if needed
