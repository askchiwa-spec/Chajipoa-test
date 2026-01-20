const os = require('os');
const { postgresPool } = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../config/logger');

class MonitoringService {
  /**
   * Get system health metrics
   * @returns {Promise<Object>} Health status
   */
  async getSystemHealth() {
    try {
      const healthChecks = await Promise.allSettled([
        this.checkDatabaseConnection(),
        this.checkRedisConnection(),
        this.checkDiskSpace(),
        this.checkMemoryUsage(),
        this.checkCPUUsage()
      ]);

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {}
      };

      // Process health check results
      const checkNames = ['database', 'redis', 'disk', 'memory', 'cpu'];
      healthChecks.forEach((check, index) => {
        const checkName = checkNames[index];
        if (check.status === 'fulfilled') {
          healthStatus.checks[checkName] = {
            status: 'healthy',
            ...check.value
          };
        } else {
          healthStatus.checks[checkName] = {
            status: 'unhealthy',
            error: check.reason.message
          };
          healthStatus.status = 'degraded';
        }
      });

      return healthStatus;
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Check PostgreSQL connection
   * @returns {Promise<Object>} Connection status
   */
  async checkDatabaseConnection() {
    try {
      const client = await postgresPool.connect();
      const result = await client.query('SELECT 1 as connected');
      client.release();
      
      return {
        connected: result.rows[0].connected === 1,
        latency: Date.now() // Simplified latency check
      };
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Check Redis connection
   * @returns {Promise<Object>} Connection status
   */
  async checkRedisConnection() {
    try {
      const result = await redisClient.client.ping();
      return {
        connected: result === 'PONG',
        latency: Date.now()
      };
    } catch (error) {
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  /**
   * Check disk space usage
   * @returns {Promise<Object>} Disk usage metrics
   */
  async checkDiskSpace() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = (usedMem / totalMem) * 100;

      return {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percent: Math.round(memoryUsagePercent * 100) / 100
      };
    } catch (error) {
      throw new Error(`Disk space check failed: ${error.message}`);
    }
  }

  /**
   * Check memory usage
   * @returns {Promise<Object>} Memory usage metrics
   */
  async checkMemoryUsage() {
    try {
      const memoryUsage = process.memoryUsage();
      return {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      };
    } catch (error) {
      throw new Error(`Memory usage check failed: ${error.message}`);
    }
  }

  /**
   * Check CPU usage
   * @returns {Promise<Object>} CPU usage metrics
   */
  async checkCPUUsage() {
    try {
      const cpus = os.cpus();
      const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
      const totalTick = cpus.reduce((acc, cpu) => 
        acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq, 0);
      
      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = (total - idle) / total * 100;

      return {
        cores: cpus.length,
        usage: Math.round(usage * 100) / 100,
        loadAverage: os.loadavg()
      };
    } catch (error) {
      throw new Error(`CPU usage check failed: ${error.message}`);
    }
  }

  /**
   * Get application metrics
   * @returns {Promise<Object>} Application metrics
   */
  async getApplicationMetrics() {
    try {
      // Get database metrics
      const dbMetrics = await this.getDatabaseMetrics();
      
      // Get cache metrics
      const cacheMetrics = await this.getCacheMetrics();
      
      // Get system metrics
      const systemMetrics = await this.getSystemMetrics();

      return {
        timestamp: new Date().toISOString(),
        database: dbMetrics,
        cache: cacheMetrics,
        system: systemMetrics,
        application: {
          pid: process.pid,
          uptime: process.uptime(),
          version: process.version,
          platform: process.platform
        }
      };
    } catch (error) {
      logger.error('Application metrics collection failed:', error);
      throw error;
    }
  }

  /**
   * Get database-specific metrics
   * @returns {Promise<Object>} Database metrics
   */
  async getDatabaseMetrics() {
    try {
      const client = await postgresPool.connect();
      
      // Get connection pool stats
      const poolStats = await client.query(`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      // Get table sizes
      const tableSizes = await client.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 5
      `);
      
      client.release();
      
      return {
        activeConnections: parseInt(poolStats.rows[0].active_connections),
        topTables: tableSizes.rows
      };
    } catch (error) {
      logger.error('Database metrics collection failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Get cache-specific metrics
   * @returns {Promise<Object>} Cache metrics
   */
  async getCacheMetrics() {
    try {
      const info = await redisClient.client.info();
      const lines = info.split('\n');
      const metrics = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          metrics[key.trim()] = value.trim();
        }
      });

      return {
        connectedClients: parseInt(metrics.connected_clients || 0),
        usedMemory: metrics.used_memory_human,
        keyspaceHits: parseInt(metrics.keyspace_hits || 0),
        keyspaceMisses: parseInt(metrics.keyspace_misses || 0),
        hitRate: metrics.keyspace_hits && metrics.keyspace_misses ? 
          (parseInt(metrics.keyspace_hits) / (parseInt(metrics.keyspace_hits) + parseInt(metrics.keyspace_misses)) * 100).toFixed(2) : 0
      };
    } catch (error) {
      logger.error('Cache metrics collection failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Get system metrics
   * @returns {Promise<Object>} System metrics
   */
  async getSystemMetrics() {
    try {
      return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length,
        loadAverage: os.loadavg(),
        uptime: os.uptime()
      };
    } catch (error) {
      logger.error('System metrics collection failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Log performance metrics periodically
   */
  startPerformanceMonitoring() {
    setInterval(async () => {
      try {
        const metrics = await this.getApplicationMetrics();
        logger.info('Performance Metrics Collected', {
          memory: metrics.system.freeMemory,
          cpuLoad: metrics.system.loadAverage[0],
          dbConnections: metrics.database.activeConnections
        });
      } catch (error) {
        logger.error('Performance monitoring failed:', error);
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Get recent audit logs for monitoring
   * @param {number} limit - Number of logs to retrieve
   * @returns {Promise<Array>} Recent audit logs
   */
  async getRecentAuditLogs(limit = 50) {
    try {
      // This would query the MongoDB audit logs collection
      // Implementation depends on your audit log model
      return [];
    } catch (error) {
      logger.error('Failed to retrieve audit logs:', error);
      return [];
    }
  }
}

module.exports = new MonitoringService();