const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import configurations
const logger = require('./config/logger');
const database = require('./config/database');
const redisClient = require('./config/redis');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const securityMiddleware = require('./middleware/security.middleware');

// Import routes
const userRoutes = require('./routes/user.routes');
const rentalRoutes = require('./routes/rental.routes');
const paymentRoutes = require('./routes/payment.routes');
const deviceRoutes = require('./routes/device.routes');
const qrRoutes = require('./routes/qr.routes');
const authRoutes = require('./routes/auth.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
const securityRoutes = require('./routes/security.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const azampayRoutes = require('./routes/azampay.routes');

// Import Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Import services
const monitoringService = require('./services/MonitoringService');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced Security middleware
app.use(helmet());
app.use(securityMiddleware.securityHeaders());
app.use(cors(require('./config/security.config').cors));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { stream: logger.stream }));

// Enhanced Rate limiting with security middleware
app.use('/api/', securityMiddleware.rateLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000
}));

// Stricter rate limiting for authentication endpoints
app.use('/api/v1/auth/', securityMiddleware.rateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rentals', rentalRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/azampay', azampayRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, async () => {
  try {
    // Connect to databases
    await database.connectPostgres();
    await database.connectMongo();
    await redisClient.connect();
    
    // Start monitoring services
    monitoringService.startPerformanceMonitoring();
    
    logger.info(`🚀 ChajiPoa Server running on port ${PORT}`);
    logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
    logger.info(`📚 API Docs available at http://localhost:${PORT}/api-docs`);
    logger.info(`📊 Monitoring endpoints available at http://localhost:${PORT}/api/v1/monitoring`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

module.exports = app;