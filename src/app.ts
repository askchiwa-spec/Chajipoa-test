import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Import routes
import userRoutes from './routes/userRoutes';
import healthRoutes from './routes/healthRoutes';
import rentalRoutes from './routes/rentalRoutes';

// Import middleware
import { apiLimiter } from './middleware/auth';
import logger from './config/logger';
import { query } from './config/database';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Apply rate limiting to all routes
if (process.env['NODE_ENV'] === 'production') {
  app.use('/api/', apiLimiter);
}

// Static files (for dashboard preview)
app.use('/preview', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rentals', rentalRoutes); // Add this line
app.use('/api/v1/health', healthRoutes);

// Welcome route
app.get('/', (_, res) => {
  res.json({
    message: 'Welcome to CHAJIPOA API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      users: '/api/v1/users',
      rentals: '/api/v1/rentals', // Add this
      health: '/api/v1/health'
    }
  });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env['NODE_ENV'] === 'development' ? err.message : 'Internal server error',
    ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await query('SELECT NOW()');
    logger.info('✅ Database connection established');

    app.listen(PORT, () => {
      logger.info(`🚀 CHAJIPOA API server running on http://localhost:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/api/v1/health`);
      logger.info(`👤 User API: http://localhost:${PORT}/api/v1/users`);
      logger.info(`📦 Rental API: http://localhost:${PORT}/api/v1/rentals`);
      
      console.log(`
      ██████╗██╗  ██╗ █████╗      ██╗██████╗  ██████╗  █████╗ 
     ██╔════╝██║  ██║██╔══██╗     ██║██╔══██╗██╔═══██╗██╔══██╗
     ██║     ███████║███████║     ██║██████╔╝██║   ██║███████║
     ██║     ██╔══██║██╔══██║██   ██║██╔═══╝ ██║   ██║██╔══██║
     ╚██████╗██║  ██║██║  ██║╚█████╔╝██║     ╚██████╔╝██║  ██║
      ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚════╝ ╚═╝      ╚═════╝ ╚═╝  ╚═╝
      
      CHAJIPOA Power Bank Rental System
      =================================
      Server started successfully!
      `);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;