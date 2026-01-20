const redisClient = require('../config/redis');
const logger = require('../config/logger');

const rateLimiter = async (req, res, next) => {
  try {
    const WINDOW_SIZE_IN_HOURS = 15; // 15 minutes
    const MAX_WINDOW_REQUEST_COUNT = 100; // Max requests per window
    const WINDOW_LOG_INTERVAL_IN_HOURS = 1; // Log interval

    // Get IP address
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Create key for this IP
    const key = `rate_limit_${ipAddress}`;
    
    // Get current time
    const currentTime = new Date().getTime();
    
    // Get stored record from Redis
    let record = await redisClient.client.get(key);
    
    if (!record) {
      // Create new record
      const newRecord = {
        count: 1,
        startTime: currentTime
      };
      await redisClient.client.setex(key, WINDOW_SIZE_IN_HOURS * 60, JSON.stringify(newRecord));
      next();
    } else {
      // Parse existing record
      record = JSON.parse(record);
      
      // Check if window has expired
      if (currentTime - record.startTime > WINDOW_SIZE_IN_HOURS * 60 * 1000) {
        // Reset window
        const newRecord = {
          count: 1,
          startTime: currentTime
        };
        await redisClient.client.setex(key, WINDOW_SIZE_IN_HOURS * 60, JSON.stringify(newRecord));
        next();
      } else {
        // Increment count
        record.count++;
        
        // Check if limit exceeded
        if (record.count > MAX_WINDOW_REQUEST_COUNT) {
          logger.warn(`Rate limit exceeded for IP: ${ipAddress}`);
          return res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later'
          });
        }
        
        // Update record
        await redisClient.client.setex(key, WINDOW_SIZE_IN_HOURS * 60, JSON.stringify(record));
        next();
      }
    }
  } catch (error) {
    logger.error('Rate limiter error:', error);
    // Fail open - allow request if Redis is down
    next();
  }
};

module.exports = rateLimiter;