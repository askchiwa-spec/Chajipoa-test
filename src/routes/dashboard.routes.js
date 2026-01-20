// src/routes/dashboard.routes.js
// Dashboard API Routes for Real-time Data and Export

const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth.middleware');
const securityMiddleware = require('../middleware/security.middleware');

// Apply security middleware
router.use(securityMiddleware.securityHeaders());

// Dashboard overview data
router.get('/overview', 
    authenticateJWT,
    securityMiddleware.rateLimiter({ max: 100 }),
    async (req, res, next) => {
        try {
            const { timeRange = 'today', userId } = req.query;
            
            // Fetch real-time dashboard data
            const overviewData = await getDashboardOverview(timeRange, userId);
            
            res.json({
                success: true,
                data: overviewData,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Real-time WebSocket upgrade endpoint
router.get('/websocket', 
    authenticateJWT,
    (req, res, next) => {
        // This would typically be handled by a WebSocket server
        // For REST API simulation, returning WebSocket connection info
        res.json({
            success: true,
            websocketUrl: process.env.WS_ENDPOINT || 'wss://ws.chajipoa.co.tz',
            supportedChannels: [
                'realtime_metrics',
                'station_updates', 
                'transaction_events',
                'device_status',
                'system_alerts'
            ]
        });
    }
);

// Analytics data endpoints
router.post('/analytics/metrics', 
    authenticateJWT,
    securityMiddleware.validateRequest(require('../schemas/analytics.schema')),
    async (req, res, next) => {
        try {
            const { timeRange, metrics, filters } = req.body;
            
            const analyticsData = await fetchAnalyticsMetrics(timeRange, metrics, filters);
            
            res.json({
                success: true,
                data: analyticsData
            });
            
        } catch (error) {
            next(error);
        }
    }
);

router.post('/analytics/stations/performance', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { stationIds, period, metrics } = req.body;
            
            const performanceData = await getStationPerformance(stationIds, period, metrics);
            
            res.json({
                success: true,
                data: performanceData
            });
            
        } catch (error) {
            next(error);
        }
    }
);

router.post('/analytics/user-behavior', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { segment, dateRange, include } = req.body;
            
            const behaviorData = await getUserBehaviorData(segment, dateRange, include);
            
            res.json({
                success: true,
                data: behaviorData
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Transaction data endpoints
router.get('/transactions', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { limit = 50, offset = 0, status, dateRange } = req.query;
            
            const transactions = await getTransactions({
                limit: parseInt(limit),
                offset: parseInt(offset),
                status,
                dateRange: dateRange ? JSON.parse(dateRange) : undefined
            });
            
            res.json({
                success: true,
                data: transactions,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: transactions.length
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
);

router.post('/transactions/search', 
    authenticateJWT,
    securityMiddleware.validateRequest(require('../schemas/transaction-search.schema')),
    async (req, res, next) => {
        try {
            const searchResults = await searchTransactions(req.body);
            
            res.json({
                success: true,
                data: searchResults
            });
            
        } catch (error) {
            next(error);
        }
    }
);

router.post('/transactions/export', 
    authenticateJWT,
    securityMiddleware.rateLimiter({ max: 10 }), // Lower rate limit for exports
    async (req, res, next) => {
        try {
            const { format = 'csv', filters, includeColumns } = req.body;
            
            const exportData = await exportTransactions(format, filters, includeColumns);
            
            // Set appropriate headers for file download
            const contentType = getContentType(format);
            const filename = `transactions-export-${Date.now()}.${format}`;
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            if (format === 'csv' || format === 'xlsx') {
                res.send(exportData);
            } else {
                res.json(exportData);
            }
            
        } catch (error) {
            next(error);
        }
    }
);

// Device monitoring endpoints
router.get('/devices/status', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { stationId, status } = req.query;
            
            const deviceStatus = await getDeviceStatus(stationId, status);
            
            res.json({
                success: true,
                data: deviceStatus
            });
            
        } catch (error) {
            next(error);
        }
    }
);

router.get('/devices/:deviceId/history', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { deviceId } = req.params;
            const { dateRange } = req.query;
            
            const history = await getDeviceHistory(deviceId, dateRange);
            
            res.json({
                success: true,
                data: history
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Station data endpoints
router.get('/stations', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { city, status } = req.query;
            
            const stations = await getStations(city, status);
            
            res.json({
                success: true,
                data: stations
            });
            
        } catch (error) {
            next(error);
        }
    }
);

router.get('/stations/:stationId/analytics', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { stationId } = req.params;
            const { period = 'week' } = req.query;
            
            const analytics = await getStationAnalytics(stationId, period);
            
            res.json({
                success: true,
                data: analytics
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Export endpoints
router.post('/export/view', 
    authenticateJWT,
    securityMiddleware.rateLimiter({ max: 5 }), // Very low rate limit for exports
    async (req, res, next) => {
        try {
            const { format = 'pdf', view, options } = req.body;
            
            const exportResult = await exportDashboardView(format, view, options);
            
            const filename = `dashboard-${view}-${Date.now()}.${format}`;
            const contentType = getContentType(format);
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            if (format === 'pdf' || format === 'xlsx') {
                res.send(exportResult);
            } else {
                res.json(exportResult);
            }
            
        } catch (error) {
            next(error);
        }
    }
);

router.post('/export/batch', 
    authenticateJWT,
    securityMiddleware.rateLimiter({ max: 3 }), // Extremely low rate limit
    async (req, res, next) => {
        try {
            const { exports } = req.body;
            
            const batchResults = await batchExport(exports);
            
            res.json({
                success: true,
                data: batchResults
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Real-time data streaming endpoints
router.get('/stream/metrics', 
    authenticateJWT,
    (req, res, next) => {
        // Set SSE headers for real-time streaming
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        // Send initial data
        sendRealTimeMetrics(res);
        
        // Set up periodic updates
        const interval = setInterval(() => {
            sendRealTimeMetrics(res);
        }, 30000); // Every 30 seconds
        
        // Clean up on client disconnect
        req.on('close', () => {
            clearInterval(interval);
        });
    }
);

// Helper functions (these would connect to actual services)
async function getDashboardOverview(timeRange, userId) {
    // Mock implementation - would connect to analytics service
    return {
        totalRevenue: 15420.50,
        activeUsers: 1247,
        completedTransactions: 892,
        deviceUtilization: 87.5,
        averageRentalDuration: 4.2,
        customerSatisfaction: 4.8,
        timeRange: timeRange
    };
}

async function fetchAnalyticsMetrics(timeRange, metrics, filters) {
    // Mock implementation
    return {
        metrics: metrics.reduce((acc, metric) => {
            acc[metric] = Math.random() * 1000;
            return acc;
        }, {}),
        timeRange: timeRange,
        filters: filters
    };
}

async function getStationPerformance(stationIds, period, metrics) {
    // Mock implementation
    return {
        stations: stationIds.map(id => ({
            id: id,
            utilization: Math.random() * 100,
            revenue: Math.random() * 5000,
            status: 'active'
        })),
        period: period
    };
}

async function getUserBehaviorData(segment, dateRange, include) {
    // Mock implementation
    return {
        segment: segment,
        dateRange: dateRange,
        behaviorPatterns: include.reduce((acc, item) => {
            acc[item] = Math.random();
            return acc;
        }, {})
    };
}

async function getTransactions(options) {
    // Mock implementation
    return Array.from({ length: options.limit }, (_, i) => ({
        id: `txn_${Date.now()}_${i}`,
        amount: Math.random() * 100,
        status: ['completed', 'pending', 'failed'][Math.floor(Math.random() * 3)],
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
    }));
}

async function searchTransactions(filters) {
    // Mock implementation
    return {
        results: [],
        totalCount: 0,
        filters: filters
    };
}

async function exportTransactions(format, filters, columns) {
    // Mock implementation - would generate actual export
    return `Mock ${format} export data for filters: ${JSON.stringify(filters)}`;
}

async function getDeviceStatus(stationId, status) {
    // Mock implementation
    return {
        devices: Array.from({ length: 10 }, (_, i) => ({
            id: `device_${i}`,
            status: status || ['online', 'offline', 'maintenance'][Math.floor(Math.random() * 3)],
            battery: Math.floor(Math.random() * 100),
            stationId: stationId
        }))
    };
}

async function getDeviceHistory(deviceId, dateRange) {
    // Mock implementation
    return {
        deviceId: deviceId,
        history: [],
        dateRange: dateRange
    };
}

async function getStations(city, status) {
    // Mock implementation
    return Array.from({ length: 25 }, (_, i) => ({
        id: `station_${i}`,
        name: `Station ${i}`,
        city: city || 'Dar es Salaam',
        status: status || 'active',
        location: {
            lat: -6.7924 + (Math.random() - 0.5) * 0.1,
            lng: 39.2083 + (Math.random() - 0.5) * 0.1
        }
    }));
}

async function getStationAnalytics(stationId, period) {
    // Mock implementation
    return {
        stationId: stationId,
        period: period,
        metrics: {
            utilization: Math.random() * 100,
            revenue: Math.random() * 10000,
            transactions: Math.floor(Math.random() * 1000)
        }
    };
}

async function exportDashboardView(format, view, options) {
    // Mock implementation
    return `Mock ${format} export for view: ${view}`;
}

async function batchExport(exports) {
    // Mock implementation
    return exports.map(exp => ({
        ...exp,
        success: true,
        result: `Exported ${exp.format} for ${exp.view}`
    }));
}

function sendRealTimeMetrics(res) {
    const data = {
        timestamp: new Date().toISOString(),
        metrics: {
            activeUsers: Math.floor(Math.random() * 2000),
            revenue: Math.random() * 1000,
            transactions: Math.floor(Math.random() * 100)
        }
    };
    
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getContentType(format) {
    const contentTypes = {
        'pdf': 'application/pdf',
        'csv': 'text/csv',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'json': 'application/json',
        'xml': 'application/xml'
    };
    
    return contentTypes[format] || 'application/octet-stream';
}

module.exports = router;