const express = require('express');
const monitoringService = require('../services/MonitoringService');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /monitoring/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                     redis:
 *                       type: object
 *                     disk:
 *                       type: object
 *                     memory:
 *                       type: object
 *                     cpu:
 *                       type: object
 */
router.get('/health', async (req, res, next) => {
  try {
    const health = await monitoringService.getSystemHealth();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /monitoring/metrics:
 *   get:
 *     summary: Get detailed application metrics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 database:
 *                   type: object
 *                 cache:
 *                   type: object
 *                 system:
 *                   type: object
 *                 application:
 *                   type: object
 */
router.get('/metrics', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const metrics = await monitoringService.getApplicationMetrics();
    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /monitoring/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Get various system stats
    const [health, metrics] = await Promise.all([
      monitoringService.getSystemHealth(),
      monitoringService.getApplicationMetrics()
    ]);

    res.status(200).json({
      success: true,
      data: {
        health: health.status,
        uptime: health.uptime,
        memory: {
          used: metrics.system.totalMemory - metrics.system.freeMemory,
          total: metrics.system.totalMemory,
          percent: ((metrics.system.totalMemory - metrics.system.freeMemory) / metrics.system.totalMemory * 100).toFixed(2)
        },
        cpu: {
          load: metrics.system.loadAverage[0],
          cores: metrics.system.cpus
        },
        database: {
          connections: metrics.database.activeConnections,
          tables: metrics.database.topTables?.length || 0
        },
        cache: {
          clients: metrics.cache.connectedClients,
          hitRate: metrics.cache.hitRate
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;