const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Serve the index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 ChajiPoa Dashboard Preview Server running on http://localhost:${PORT}`);
    console.log(`📱 Client Dashboard: http://localhost:${PORT}/client-dashboard-preview.html`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin-dashboard-preview.html`);
    console.log(`\nClick on the links above to view the dashboards!`);
});