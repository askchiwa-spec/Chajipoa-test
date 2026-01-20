#!/bin/bash

# ChajiPoa Development Environment Deployment Script
# Author: ChajiPoa Infrastructure Team
# Description: Sets up and manages the complete development environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE=".env.development"
COMPOSE_FILE="docker-compose.yml"

echo -e "${BLUE}🚀 ChajiPoa Development Environment Setup${NC}"
echo "========================================"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    print_status "All prerequisites satisfied"
}

# Load environment variables
load_env() {
    if [ -f "$ENV_FILE" ]; then
        echo "Loading environment variables from $ENV_FILE"
        export $(cat $ENV_FILE | grep -v '^#' | xargs)
    else
        print_warning "Environment file $ENV_FILE not found. Using defaults."
    fi
}

# Build and start services
start_services() {
    echo "Starting ChajiPoa development services..."
    
    # Pull latest images
    docker-compose -f $COMPOSE_FILE pull
    
    # Build services
    docker-compose -f $COMPOSE_FILE build
    
    # Start services
    docker-compose -f $COMPOSE_FILE up -d
    
    print_status "Services started successfully"
}

# Stop services
stop_services() {
    echo "Stopping ChajiPoa development services..."
    docker-compose -f $COMPOSE_FILE down
    print_status "Services stopped"
}

# Restart services
restart_services() {
    echo "Restarting ChajiPoa development services..."
    docker-compose -f $COMPOSE_FILE restart
    print_status "Services restarted"
}

# Show service status
show_status() {
    echo "ChajiPoa Development Environment Status:"
    echo "======================================="
    docker-compose -f $COMPOSE_FILE ps
}

# Show logs
show_logs() {
    if [ $# -eq 0 ]; then
        echo "Showing logs for all services..."
        docker-compose -f $COMPOSE_FILE logs -f
    else
        echo "Showing logs for service: $1"
        docker-compose -f $COMPOSE_FILE logs -f $1
    fi
}

# Run database migrations
run_migrations() {
    echo "Running database migrations..."
    docker-compose -f $COMPOSE_FILE exec api npm run migrate
    print_status "Database migrations completed"
}

# Run tests
run_tests() {
    echo "Running tests..."
    docker-compose -f $COMPOSE_FILE exec api npm test
}

# Seed database
seed_database() {
    echo "Seeding database with sample data..."
    docker-compose -f $COMPOSE_FILE exec api npm run seed
    print_status "Database seeding completed"
}

# Clean environment
clean_environment() {
    echo "Cleaning development environment..."
    docker-compose -f $COMPOSE_FILE down -v --remove-orphans
    docker system prune -f
    print_status "Environment cleaned"
}

# Show URLs
show_urls() {
    echo "ChajiPoa Development URLs:"
    echo "========================="
    echo "API: http://localhost:${API_PORT:-3000}"
    echo "Frontend: http://localhost:${FRONTEND_PORT:-8080}"
    echo "Grafana: http://localhost:3001 (admin/${GRAFANA_PASSWORD:-admin_password})"
    echo "Prometheus: http://localhost:9090"
    echo "PostgreSQL: localhost:${POSTGRES_PORT:-5432}"
    echo "MongoDB: localhost:${MONGO_PORT:-27017}"
    echo "Redis: localhost:${REDIS_PORT:-6379}"
}

# Main execution
case "$1" in
    "start")
        check_prerequisites
        load_env
        start_services
        show_urls
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        check_prerequisites
        load_env
        start_services
        show_urls
        ;;
    "status")
        show_status
        ;;
    "logs")
        shift
        show_logs "$@"
        ;;
    "migrate")
        run_migrations
        ;;
    "test")
        run_tests
        ;;
    "seed")
        seed_database
        ;;
    "clean")
        clean_environment
        ;;
    "urls")
        show_urls
        ;;
    *)
        echo "ChajiPoa Development Environment Manager"
        echo "Usage: $0 {start|stop|restart|status|logs|migrate|test|seed|clean|urls}"
        echo ""
        echo "Commands:"
        echo "  start    - Start all development services"
        echo "  stop     - Stop all development services"
        echo "  restart  - Restart all development services"
        echo "  status   - Show status of all services"
        echo "  logs     - Show logs (optionally specify service name)"
        echo "  migrate  - Run database migrations"
        echo "  test     - Run tests"
        echo "  seed     - Seed database with sample data"
        echo "  clean    - Clean environment (remove containers and volumes)"
        echo "  urls     - Show all service URLs"
        exit 1
        ;;
esac