// src/api/AnalyticsAPI.js
// Analytics API Integration Class for Real Data Sources

class AnalyticsAPI {
    constructor(baseUrl, authToken) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
        this.cache = new Map();
        this.cacheDuration = 300000; // 5 minutes
        this.requestQueue = new Map(); // Prevent duplicate requests
    }
    
    // Set authentication token
    setAuthToken(token) {
        this.authToken = token;
    }
    
    // Generic fetch wrapper with error handling
    async fetchAPI(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
            }
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }
    
    // Get overview metrics with caching
    async getOverviewMetrics(timeRange = 'today', forceRefresh = false) {
        const cacheKey = `overview_${timeRange}`;
        
        // Check cache first
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheDuration) {
                return cached.data;
            }
        }
        
        // Prevent duplicate requests
        if (this.requestQueue.has(cacheKey)) {
            return await this.requestQueue.get(cacheKey);
        }
        
        const requestPromise = this.fetchOverviewMetrics(timeRange)
            .then(data => {
                // Cache the result
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                return data;
            })
            .finally(() => {
                this.requestQueue.delete(cacheKey);
            });
        
        this.requestQueue.set(cacheKey, requestPromise);
        return await requestPromise;
    }
    
    async fetchOverviewMetrics(timeRange) {
        try {
            return await this.fetchAPI('/api/v1/analytics/overview', {
                method: 'POST',
                body: JSON.stringify({ 
                    timeRange,
                    metrics: [
                        'total_revenue',
                        'active_users',
                        'completed_transactions',
                        'device_utilization',
                        'average_rental_duration',
                        'customer_satisfaction'
                    ]
                })
            });
        } catch (error) {
            console.error('Failed to fetch overview metrics:', error);
            return this.getFallbackData('overview');
        }
    }
    
    // Get detailed station performance
    async getStationPerformance(stationIds = [], period = 'day', metrics = []) {
        const requestBody = {
            stationIds: stationIds.length > 0 ? stationIds : undefined,
            period,
            metrics: metrics.length > 0 ? metrics : [
                'utilization_rate',
                'revenue_per_device',
                'average_rental_duration',
                'peak_hours',
                'device_health',
                'maintenance_frequency'
            ]
        };
        
        try {
            return await this.fetchAPI('/api/v1/analytics/stations/performance', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
        } catch (error) {
            console.error('Failed to fetch station performance:', error);
            throw error;
        }
    }
    
    // Get user behavior analytics
    async getUserBehavior(segment = 'all', dateRange, include = []) {
        const requestBody = {
            segment,
            dateRange: dateRange || {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
                end: new Date().toISOString()
            },
            include: include.length > 0 ? include : [
                'rental_patterns',
                'payment_methods',
                'preferred_stations',
                'lifetime_value',
                'retention_rate',
                'usage_frequency'
            ]
        };
        
        try {
            return await this.fetchAPI('/api/v1/analytics/user-behavior', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
        } catch (error) {
            console.error('Failed to fetch user behavior:', error);
            throw error;
        }
    }
    
    // Get revenue analytics
    async getRevenueAnalytics(period = 'month', groupBy = 'day') {
        try {
            return await this.fetchAPI('/api/v1/analytics/revenue', {
                method: 'POST',
                body: JSON.stringify({
                    period,
                    groupBy,
                    metrics: [
                        'total_revenue',
                        'transaction_count',
                        'average_transaction_value',
                        'revenue_by_payment_method',
                        'revenue_growth'
                    ]
                })
            });
        } catch (error) {
            console.error('Failed to fetch revenue analytics:', error);
            throw error;
        }
    }
    
    // Get device analytics
    async getDeviceAnalytics(filters = {}) {
        try {
            return await this.fetchAPI('/api/v1/analytics/devices', {
                method: 'POST',
                body: JSON.stringify({
                    ...filters,
                    metrics: [
                        'utilization_rate',
                        'maintenance_frequency',
                        'battery_health',
                        'failure_rate',
                        'average_charging_cycles'
                    ]
                })
            });
        } catch (error) {
            console.error('Failed to fetch device analytics:', error);
            throw error;
        }
    }
    
    // Get predictive analytics
    async getPredictiveAnalytics(horizon = 'week') {
        try {
            return await this.fetchAPI('/api/v1/analytics/predictive', {
                method: 'POST',
                body: JSON.stringify({
                    horizon,
                    predictions: [
                        'demand_forecast',
                        'revenue_projection',
                        'device_failure_probability',
                        'maintenance_needs'
                    ]
                })
            });
        } catch (error) {
            console.error('Failed to fetch predictive analytics:', error);
            throw error;
        }
    }
    
    // Search analytics data
    async searchAnalytics(query, filters = {}) {
        try {
            return await this.fetchAPI('/api/v1/analytics/search', {
                method: 'POST',
                body: JSON.stringify({
                    query,
                    ...filters
                })
            });
        } catch (error) {
            console.error('Failed to search analytics:', error);
            throw error;
        }
    }
    
    // Export analytics data
    async exportAnalytics(format = 'csv', reportType = 'overview', filters = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/analytics/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    format,
                    reportType,
                    filters,
                    includeMetadata: true
                })
            });
            
            if (format === 'csv' || format === 'xlsx') {
                return await response.blob();
            } else {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to export analytics:', error);
            throw error;
        }
    }
    
    // Clear cache for specific keys or all
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }
    
    // Get fallback data for offline scenarios
    getFallbackData(type) {
        const fallbacks = {
            overview: {
                totalRevenue: 0,
                activeUsers: 0,
                completedTransactions: 0,
                deviceUtilization: 0,
                averageRentalDuration: 0,
                customerSatisfaction: 0,
                timestamp: new Date().toISOString()
            },
            stationPerformance: {
                stations: [],
                averages: {},
                timestamp: new Date().toISOString()
            }
        };
        
        return fallbacks[type] || {};
    }
    
    // Batch request multiple analytics endpoints
    async batchAnalyticsRequests(requests) {
        const promises = requests.map(request => {
            const { endpoint, params } = request;
            return this.fetchAPI(endpoint, {
                method: 'POST',
                body: JSON.stringify(params)
            }).catch(error => ({ error: error.message, endpoint }));
        });
        
        return await Promise.all(promises);
    }
}

// Transactions API Class
class TransactionsAPI {
    constructor(baseUrl, authToken) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }
    
    setAuthToken(token) {
        this.authToken = token;
    }
    
    async getRecentTransactions(limit = 50, offset = 0, filters = {}) {
        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            ...Object.fromEntries(
                Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null)
            )
        });
        
        try {
            const response = await fetch(
                `${this.baseUrl}/api/v1/transactions?${queryParams}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                }
            );
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
            throw error;
        }
    }
    
    async searchTransactions(filters) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/transactions/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(filters)
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to search transactions:', error);
            throw error;
        }
    }
    
    async getTransactionDetails(transactionId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/v1/transactions/${transactionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                }
            );
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch transaction details:', error);
            throw error;
        }
    }
    
    async exportTransactions(format = 'csv', filters = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/transactions/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    format,
                    filters,
                    includeColumns: [
                        'transaction_id',
                        'user_id',
                        'amount',
                        'payment_method',
                        'status',
                        'created_at',
                        'device_id',
                        'station_id',
                        'rental_duration',
                        'location'
                    ]
                })
            });
            
            if (format === 'csv' || format === 'xlsx') {
                return await response.blob();
            } else {
                return await response.json();
            }
            
        } catch (error) {
            console.error('Failed to export transactions:', error);
            throw error;
        }
    }
    
    async getTransactionStatistics(dateRange, groupBy = 'day') {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/transactions/statistics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    dateRange,
                    groupBy,
                    metrics: [
                        'transaction_count',
                        'total_amount',
                        'average_amount',
                        'success_rate',
                        'payment_method_distribution'
                    ]
                })
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch transaction statistics:', error);
            throw error;
        }
    }
}

// Devices API Class
class DevicesAPI {
    constructor(baseUrl, authToken) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }
    
    async getDevices(filters = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(filters)
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch devices:', error);
            throw error;
        }
    }
    
    async getDeviceStatus(deviceId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/devices/${deviceId}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch device status:', error);
            throw error;
        }
    }
    
    async getDeviceHistory(deviceId, dateRange) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/devices/${deviceId}/history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ dateRange })
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch device history:', error);
            throw error;
        }
    }
}

// Stations API Class
class StationsAPI {
    constructor(baseUrl, authToken) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }
    
    async getStations(filters = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/stations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(filters)
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch stations:', error);
            throw error;
        }
    }
    
    async getStationDetails(stationId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/stations/${stationId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch station details:', error);
            throw error;
        }
    }
    
    async getStationAnalytics(stationId, period = 'week') {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/stations/${stationId}/analytics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ period })
            });
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to fetch station analytics:', error);
            throw error;
        }
    }
}

module.exports = {
    AnalyticsAPI,
    TransactionsAPI,
    DevicesAPI,
    StationsAPI
};