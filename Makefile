.PHONY: help install dev build start docker-build docker-up docker-down docker-logs docker-clean clean lint test

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

## help: Display this help message
help:
	@echo "$(BLUE)Mission Control - Available Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make install        - Install dependencies"
	@echo "  make dev            - Start development server"
	@echo "  make build          - Build for production"
	@echo "  make start          - Start production server"
	@echo ""
	@echo "$(GREEN)Docker:$(NC)"
	@echo "  make docker-build   - Build Docker image"
	@echo "  make docker-up      - Start with docker-compose"
	@echo "  make docker-down    - Stop docker containers"
	@echo "  make docker-logs    - View container logs"
	@echo "  make docker-clean   - Remove containers and images"
	@echo ""
	@echo "$(GREEN)Utilities:$(NC)"
	@echo "  make clean          - Clean build artifacts and logs"
	@echo "  make lint           - Run linter"
	@echo "  make test           - Run tests"
	@echo ""

## install: Install dependencies
install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)Dependencies installed!$(NC)"

## dev: Start development server
dev:
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

## build: Build for production
build:
	@echo "$(BLUE)Building for production...$(NC)"
	npm run build
	@echo "$(GREEN)Build complete!$(NC)"

## start: Start production server
start:
	@echo "$(BLUE)Starting production server...$(NC)"
	npm start

## docker-build: Build Docker image
docker-build:
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t mission-control:latest .
	@echo "$(GREEN)Docker image built successfully!$(NC)"

## docker-up: Start with docker-compose
docker-up:
	@echo "$(BLUE)Starting Mission Control with docker-compose...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Mission Control is running!$(NC)"
	@echo "$(YELLOW)Access at: http://localhost:3000$(NC)"
	@echo "View logs with: make docker-logs"

## docker-down: Stop docker containers
docker-down:
	@echo "$(BLUE)Stopping docker containers...$(NC)"
	docker-compose down
	@echo "$(GREEN)Containers stopped!$(NC)"

## docker-logs: View container logs
docker-logs:
	@echo "$(BLUE)Viewing container logs (Ctrl+C to exit)...$(NC)"
	docker-compose logs -f mission-control

## docker-clean: Remove containers and images
docker-clean:
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker-compose down -v
	docker rmi mission-control:latest || true
	@echo "$(GREEN)Docker cleanup complete!$(NC)"

## clean: Clean build artifacts and logs
clean:
	@echo "$(BLUE)Cleaning build artifacts and logs...$(NC)"
	rm -rf .next
	rm -rf out
	rm -rf build
	rm -rf node_modules/.cache
	rm -f *.log
	rm -f server-*.log
	@echo "$(GREEN)Cleanup complete!$(NC)"

## lint: Run linter
lint:
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

## test: Run tests (if applicable)
test:
	@echo "$(YELLOW)No tests configured yet$(NC)"
	@echo "Add test scripts to package.json to enable testing"
