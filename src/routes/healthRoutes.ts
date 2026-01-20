import { Router } from 'express';
import { query } from '../config/database';
import redis from '../config/redis';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    // Check database connection
    await query('SELECT NOW() as time');
    
    // Check Redis connection
    await redis.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        api: 'running'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service dependencies unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;