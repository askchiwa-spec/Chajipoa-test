// src/dashboard/CHAJIPOADashboard.js
// Enhanced Dashboard Framework with Real Data Integration

class CHAJIPOADashboard {
    constructor(config) {
        this.config = {
            apiBaseUrl: process.env.API_BASE_URL || 'https://api.chajipoa.co.tz',
            wsEndpoint: process.env.WS_ENDPOINT || 'wss://ws.chajipoa.co.tz',
            refreshInterval: 30000, // 30 seconds
            ...config
        };
        
        // Data sources
        this.dataSources = {
            realtime: new RealtimeDataSource(this.config.wsEndpoint),
            analytics: new AnalyticsAPI(this.config.apiBaseUrl),
            transactions: new TransactionsAPI(this.config.apiBaseUrl),
            devices: new DevicesAPI(this.config.apiBaseUrl),
            stations: new StationsAPI(this.config.apiBaseUrl)
        };
        
        // State management
        this.state = {
            activeView: 'overview',
            timeRange: 'today',
            filters: {},
            userPreferences: this.loadUserPreferences()
        };
        
        // WebSocket connections
        this.wsConnection = null;
        this.dataStreams = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Initialize dashboard
        this.initWebSocketConnections();
        this.setupAutoRefresh();
        this.bindEventListeners();
    }
    
    // Initialize real-time WebSocket connections
    initWebSocketConnections() {
        try {
            // Main WebSocket for real-time updates
            this.wsConnection = new WebSocket(this.config.wsEndpoint);
            
            this.wsConnection.onopen = () => {
                console.log('✅ Dashboard WebSocket connected');
                this.reconnectAttempts = 0;
                this.subscribeToChannels();
                this.updateConnectionStatus('connected');
            };
            
            this.wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleRealtimeData(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.wsConnection.onclose = (event) => {
                console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                this.updateConnectionStatus('disconnected');
                this.scheduleReconnection();
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };
            
            // Additional WebSocket connections for specific data streams
            this.initializeDataStreams();
            
        } catch (error) {
            console.error('Failed to initialize WebSocket connections:', error);
            this.updateConnectionStatus('error');
        }
    }
    
    // Initialize additional data streams
    initializeDataStreams() {
        const streams = ['transactions', 'devices', 'alerts', 'stations'];
        
        streams.forEach(stream => {
            try {
                const wsUrl = `${this.config.wsEndpoint}/${stream}`;
                this.dataStreams[stream] = new ReconnectingWebSocket(wsUrl, {
                    maxReconnectionDelay: 10000,
                    minReconnectionDelay: 1000,
                    reconnectionDelayGrowFactor: 1.3,
                    connectionTimeout: 5000,
                    maxRetries: Infinity
                });
                
                this.dataStreams[stream].onopen = () => {
                    console.log(`✅ ${stream} WebSocket connected`);
                };
                
                this.dataStreams[stream].onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleDataStreamMessage(stream, data);
                };
                
                this.dataStreams[stream].onclose = () => {
                    console.log(`🔌 ${stream} WebSocket disconnected`);
                };
                
            } catch (error) {
                console.error(`Failed to initialize ${stream} WebSocket:`, error);
            }
        });
    }
    
    // Schedule reconnection with exponential backoff
    scheduleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Maximum reconnection attempts reached');
            this.updateConnectionStatus('failed');
            return;
        }
        
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        
        console.log(`🔁 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.initWebSocketConnections();
        }, delay);
    }
    
    // Subscribe to specific data channels
    subscribeToChannels() {
        if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not ready for subscription');
            return;
        }
        
        const subscription = {
            type: 'subscribe',
            channels: [
                'realtime_metrics',
                'station_updates',
                'transaction_events',
                'device_status',
                'system_alerts',
                'user_activity'
            ],
            userId: this.state.userPreferences.userId,
            role: this.state.userPreferences.role,
            filters: this.state.filters,
            timestamp: Date.now()
        };
        
        try {
            this.wsConnection.send(JSON.stringify(subscription));
            console.log('📨 Subscribed to channels:', subscription.channels);
        } catch (error) {
            console.error('Failed to send subscription:', error);
        }
    }
    
    // Handle incoming real-time data
    handleRealtimeData(data) {
        const handlers = {
            'realtime_metrics': this.updateRealtimeMetrics.bind(this),
            'station_updates': this.updateStationMap.bind(this),
            'transaction_events': this.updateTransactionsTable.bind(this),
            'device_status': this.updateDeviceHealth.bind(this),
            'system_alerts': this.showAlertNotification.bind(this),
            'user_activity': this.updateUserActivity.bind(this),
            'performance_data': this.updatePerformanceCharts.bind(this)
        };
        
        const handler = handlers[data.channel];
        if (handler) {
            try {
                handler(data.payload);
            } catch (error) {
                console.error(`Error handling ${data.channel}:`, error);
            }
        } else {
            console.warn('Unknown channel:', data.channel);
        }
    }
    
    // Handle data stream messages
    handleDataStreamMessage(stream, data) {
        switch(stream) {
            case 'transactions':
                this.processTransactionStream(data);
                break;
            case 'devices':
                this.processDeviceStream(data);
                break;
            case 'alerts':
                this.processAlertStream(data);
                break;
            case 'stations':
                this.processStationStream(data);
                break;
        }
    }
    
    // Update methods for different data types
    updateRealtimeMetrics(metrics) {
        // Update dashboard metrics in real-time
        this.updateDOMElement('active-users', metrics.activeUsers);
        this.updateDOMElement('revenue-today', metrics.revenueToday);
        this.updateDOMElement('transactions-count', metrics.transactionCount);
        this.updateProgressBars(metrics.utilizationRates);
    }
    
    updateStationMap(stationUpdates) {
        // Update station locations and statuses on map
        stationUpdates.forEach(update => {
            this.updateStationMarker(update.stationId, update.location, update.status);
        });
    }
    
    updateTransactionsTable(transactionData) {
        // Add new transaction to table without full refresh
        this.prependToTable('transactions-table', transactionData);
        this.updateTransactionCount(transactionData.count);
    }
    
    updateDeviceHealth(deviceStatus) {
        // Update device health indicators
        deviceStatus.devices.forEach(device => {
            this.updateDeviceIndicator(device.id, device.status, device.battery);
        });
    }
    
    showAlertNotification(alertData) {
        // Show toast notification for alerts
        this.createToastNotification(alertData.message, alertData.severity);
    }
    
    updateUserActivity(activityData) {
        // Update user activity feed
        this.prependToFeed('activity-feed', activityData);
    }
    
    updatePerformanceCharts(chartData) {
        // Update chart visualizations
        this.updateChart('revenue-chart', chartData.revenue);
        this.updateChart('utilization-chart', chartData.utilization);
    }
    
    // Helper methods
    updateDOMElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
    
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.className = `connection-${status}`;
            statusElement.textContent = status.toUpperCase();
        }
    }
    
    loadUserPreferences() {
        try {
            const prefs = localStorage.getItem('dashboard-preferences');
            return prefs ? JSON.parse(prefs) : {
                userId: null,
                role: 'user',
                theme: 'light',
                defaultView: 'overview'
            };
        } catch (error) {
            console.error('Failed to load user preferences:', error);
            return {};
        }
    }
    
    setupAutoRefresh() {
        setInterval(() => {
            this.refreshCurrentView();
        }, this.config.refreshInterval);
    }
    
    bindEventListeners() {
        // Bind UI event listeners
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.refreshCurrentView();
            }
        });
    }
    
    refreshCurrentView() {
        // Refresh data based on current view
        switch(this.state.activeView) {
            case 'overview':
                this.fetchOverviewData();
                break;
            case 'analytics':
                this.fetchAnalyticsData();
                break;
            case 'transactions':
                this.fetchTransactionsData();
                break;
        }
    }
    
    // Cleanup method
    destroy() {
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        
        Object.values(this.dataStreams).forEach(stream => {
            if (stream && stream.close) {
                stream.close();
            }
        });
        
        // Clear intervals and timeouts
        clearInterval(this.refreshInterval);
    }
}

// Reconnecting WebSocket wrapper
class ReconnectingWebSocket {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            maxReconnectionDelay: 10000,
            minReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.3,
            connectionTimeout: 5000,
            maxRetries: Infinity,
            ...options
        };
        
        this.websocket = null;
        this.reconnectionDelay = this.options.minReconnectionDelay;
        this.reconnectionAttempts = 0;
        this.eventListeners = {};
        
        this.connect();
    }
    
    connect() {
        try {
            this.websocket = new WebSocket(this.url);
            
            this.websocket.onopen = (event) => {
                this.reconnectionDelay = this.options.minReconnectionDelay;
                this.reconnectionAttempts = 0;
                this.dispatchEvent('open', event);
            };
            
            this.websocket.onmessage = (event) => {
                this.dispatchEvent('message', event);
            };
            
            this.websocket.onclose = (event) => {
                this.dispatchEvent('close', event);
                this.handleDisconnection();
            };
            
            this.websocket.onerror = (event) => {
                this.dispatchEvent('error', event);
            };
            
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.handleDisconnection();
        }
    }
    
    handleDisconnection() {
        if (this.reconnectionAttempts >= this.options.maxRetries) {
            console.error('Max reconnection attempts reached');
            return;
        }
        
        this.reconnectionAttempts++;
        this.reconnectionDelay = Math.min(
            this.reconnectionDelay * this.options.reconnectionDelayGrowFactor,
            this.options.maxReconnectionDelay
        );
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectionDelay);
    }
    
    send(data) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(data);
        } else {
            console.warn('WebSocket not ready for sending data');
        }
    }
    
    close() {
        if (this.websocket) {
            this.websocket.close();
        }
    }
    
    addEventListener(event, handler) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(handler);
    }
    
    dispatchEvent(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(handler => handler(data));
        }
    }
    
    // Convenience methods for common events
    set onopen(handler) { this.addEventListener('open', handler); }
    set onmessage(handler) { this.addEventListener('message', handler); }
    set onclose(handler) { this.addEventListener('close', handler); }
    set onerror(handler) { this.addEventListener('error', handler); }
}

// Real-time Data Source
class RealtimeDataSource {
    constructor(wsEndpoint) {
        this.wsEndpoint = wsEndpoint;
        this.connection = null;
        this.subscribers = new Map();
    }
    
    connect() {
        this.connection = new ReconnectingWebSocket(this.wsEndpoint);
        
        this.connection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.notifySubscribers(data.channel, data.payload);
        };
    }
    
    subscribe(channel, callback) {
        if (!this.subscribers.has(channel)) {
            this.subscribers.set(channel, new Set());
        }
        this.subscribers.get(channel).add(callback);
        
        // Send subscription message
        if (this.connection) {
            this.connection.send(JSON.stringify({
                type: 'subscribe',
                channel: channel
            }));
        }
    }
    
    unsubscribe(channel, callback) {
        if (this.subscribers.has(channel)) {
            this.subscribers.get(channel).delete(callback);
        }
    }
    
    notifySubscribers(channel, data) {
        if (this.subscribers.has(channel)) {
            this.subscribers.get(channel).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Subscriber callback error:', error);
                }
            });
        }
    }
}

module.exports = {
    CHAJIPOADashboard,
    ReconnectingWebSocket,
    RealtimeDataSource
};