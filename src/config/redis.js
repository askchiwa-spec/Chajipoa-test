const redis = require('redis');
const logger = require('./logger');

// Create Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Event handlers
redisClient.on('connect', () => {
  logger.info('✅ Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('✅ Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis client error:', err);
});

redisClient.on('end', () => {
  logger.warn('Redis client disconnected');
});

// Connect to Redis
const connect = async () => {
  try {
    await redisClient.connect();
    // Test connection
    await redisClient.ping();
    logger.info('✅ Redis connection established');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
const disconnect = async () => {
  try {
    await redisClient.quit();
    logger.info('Redis client disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }
};

module.exports = {
  client: redisClient,
  connect,
  disconnect
};