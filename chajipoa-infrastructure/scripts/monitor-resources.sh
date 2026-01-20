#!/bin/bash

# ChajiPoa Resource Monitoring Script
# Monitors system resources and provides insights

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

check_system_resources() {
    print_header "System Resource Monitoring"
    
    echo "CPU Usage:"
    top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | xargs -I {} sh -c 'if [ {} -gt 80 ]; then echo -e "${RED}{}% - HIGH${NC}"; elif [ {} -gt 60 ]; then echo -e "${YELLOW}{}% - MODERATE${NC}"; else echo -e "${GREEN}{}% - NORMAL${NC}"; fi'
    
    echo ""
    echo "Memory Usage:"
    free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}' | xargs -I {} sh -c 'if [ $(echo "{} > 80" | bc -l) -eq 1 ]; then echo -e "${RED}{} - HIGH${NC}"; elif [ $(echo "{} > 60" | bc -l) -eq 1 ]; then echo -e "${YELLOW}{} - MODERATE${NC}"; else echo -e "${GREEN}{} - NORMAL${NC}"; fi'
    
    echo ""
    echo "Disk Usage:"
    df -h / | awk 'NR==2 {print $5}' | xargs -I {} sh -c 'if [ $(echo "{} > 80" | bc -l) -eq 1 ]; then echo -e "${RED}{} - CRITICAL${NC}"; elif [ $(echo "{} > 60" | bc -l) -eq 1 ]; then echo -e "${YELLOW}{} - WARNING${NC}"; else echo -e "${GREEN}{} - HEALTHY${NC}"; fi'
    
    echo ""
    echo "Load Average:"
    uptime | awk -F'load average:' '{ print $2 }'
}

check_docker_resources() {
    print_header "Docker Container Resources"
    
    if command -v docker >/dev/null 2>&1; then
        if docker ps -q | grep -q .; then
            echo "Container Resource Usage:"
            docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
        else
            echo "No running containers found"
        fi
    else
        echo "Docker is not installed or not in PATH"
    fi
}

check_kubernetes_resources() {
    print_header "Kubernetes Cluster Resources"
    
    if command -v kubectl >/dev/null 2>&1; then
        echo "Cluster Info:"
        kubectl cluster-info 2>/dev/null | head -2
        
        echo ""
        echo "Node Status:"
        kubectl get nodes -o wide 2>/dev/null || echo "Cannot connect to Kubernetes cluster"
        
        echo ""
        echo "Pod Status:"
        kubectl get pods -A 2>/dev/null | head -10
        
        echo ""
        echo "Resource Usage:"
        kubectl top nodes 2>/dev/null || echo "Cannot get resource metrics (metrics-server may not be installed)"
    else
        echo "kubectl is not installed or not in PATH"
    fi
}

check_database_performance() {
    print_header "Database Performance Metrics"
    
    echo "PostgreSQL Connection Count:"
    if docker ps | grep -q chajipoa-postgres; then
        conn_count=$(docker exec chajipoa-postgres psql -U chajipoa_user -d chajipoa_dev -c "SELECT count(*) FROM pg_stat_activity;" -t 2>/dev/null | xargs)
        if [ -n "$conn_count" ]; then
            echo "Active connections: $conn_count"
        else
            echo "Cannot connect to PostgreSQL"
        fi
    else
        echo "PostgreSQL container not running"
    fi
    
    echo ""
    echo "MongoDB Connection Count:"
    if docker ps | grep -q chajipoa-mongodb; then
        conn_info=$(docker exec chajipoa-mongodb mongosh --eval "db.serverStatus().connections" 2>/dev/null | tail -1)
        if [ -n "$conn_info" ]; then
            echo "Connection info: $conn_info"
        else
            echo "Cannot connect to MongoDB"
        fi
    else
        echo "MongoDB container not running"
    fi
    
    echo ""
    echo "Redis Memory Usage:"
    if docker ps | grep -q chajipoa-redis; then
        redis_info=$(docker exec chajipoa-redis redis-cli info memory 2>/dev/null | grep -E "^used_memory_human|^mem_fragmentation_ratio")
        if [ -n "$redis_info" ]; then
            echo "$redis_info"
        else
            echo "Cannot connect to Redis"
        fi
    else
        echo "Redis container not running"
    fi
}

check_network_performance() {
    print_header "Network Performance"
    
    echo "Network Interface Statistics:"
    netstat -i | head -10
    
    echo ""
    echo "Active Connections:"
    netstat -an | grep ESTABLISHED | wc -l | xargs -I {} echo "Established connections: {}"
    
    echo ""
    echo "API Response Times (Local):"
    if curl -s -o /dev/null -w "API: %{time_total}s\n" -m 10 http://localhost:3000/health 2>/dev/null; then
        :
    else
        echo "API not responding"
    fi
}

generate_insights() {
    print_header "System Insights & Recommendations"
    
    # Get current metrics
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | sed 's/,/./')
    mem_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    echo "Current Metrics:"
    echo "  CPU Usage: ${cpu_usage}%"
    echo "  Memory Usage: ${mem_usage}%"
    echo "  Disk Usage: ${disk_usage}%"
    
    echo ""
    echo "Recommendations:"
    
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        echo "  ⚠ High CPU usage detected - consider scaling up resources"
    fi
    
    if [ $mem_usage -gt 80 ]; then
        echo "  ⚠ High memory usage detected - consider increasing RAM or optimizing processes"
    fi
    
    if [ $disk_usage -gt 80 ]; then
        echo "  ⚠ High disk usage detected - consider cleaning up or expanding storage"
    fi
    
    if [ $mem_usage -lt 30 ] && [ $cpu_usage -lt 30 ]; then
        echo "  ✓ Resources are underutilized - consider downsizing for cost optimization"
    fi
    
    echo "  ✓ Regular monitoring is crucial for system health"
    echo "  ✓ Set up alerts for critical thresholds"
    echo "  ✓ Review logs for performance bottlenecks"
}

log_metrics() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="/var/log/chajipoa-monitoring.log"
    
    # Get metrics
    cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    mem=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    disk=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    # Log to file
    echo "$timestamp,CPU:$cpu%,MEM:$mem%,DISK:$disk%" >> $log_file
}

case "$1" in
    "system")
        check_system_resources
        ;;
    "docker")
        check_docker_resources
        ;;
    "k8s")
        check_kubernetes_resources
        ;;
    "db")
        check_database_performance
        ;;
    "network")
        check_network_performance
        ;;
    "insights")
        generate_insights
        ;;
    "all")
        check_system_resources
        echo ""
        check_docker_resources
        echo ""
        check_kubernetes_resources
        echo ""
        check_database_performance
        echo ""
        check_network_performance
        echo ""
        generate_insights
        ;;
    *)
        check_system_resources
        echo ""
        check_docker_resources
        echo ""
        check_database_performance
        echo ""
        generate_insights
        ;;
esac

# Log metrics for trending
log_metrics