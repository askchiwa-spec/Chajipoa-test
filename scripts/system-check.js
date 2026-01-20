#!/usr/bin/env node

const { postgresPool } = require('./src/config/database');
const redisClient = require('./src/config/redis');
const logger = require('./src/config/logger');

async function checkSystemStatus() {
  console.log('🔍 ChajiPoa System Status Check');
  console.log('================================\n');

  let allHealthy = true;

  // Check Node.js
  console.log('🟢 Node.js Environment');
  console.log(`   Version: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Architecture: ${process.arch}`);
  console.log(`   PID: ${process.pid}\n`);

  // Check PostgreSQL
  console.log('🔵 PostgreSQL Connection');
  try {
    const client = await postgresPool.connect();
    const result = await client.query('SELECT version(), current_database()');
    console.log(`   ✅ Connected successfully`);
    console.log(`   📊 Database: ${result.rows[0].current_database}`);
    console.log(`   🔧 Version: ${result.rows[0].version.split('on')[0].trim()}`);
    client.release();
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
    allHealthy = false;
  }
  console.log();

  // Check Redis
  console.log('🟡 Redis Connection');
  try {
    const result = await redisClient.client.ping();
    if (result === 'PONG') {
      console.log('   ✅ Connected successfully');
      const info = await redisClient.client.info();
      const lines = info.split('\n');
      const versionLine = lines.find(line => line.startsWith('redis_version:'));
      if (versionLine) {
        console.log(`   🔧 Version: ${versionLine.split(':')[1]}`);
      }
    } else {
      console.log('   ❌ Unexpected response');
      allHealthy = false;
    }
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
    allHealthy = false;
  }
  console.log();

  // Check MongoDB
  console.log('🟢 MongoDB Connection');
  try {
    const mongoose = require('./src/config/database').mongoose;
    if (mongoose.connection.readyState === 1) {
      console.log('   ✅ Connected successfully');
      console.log(`   📊 Database: ${mongoose.connection.name}`);
    } else {
      console.log('   ❌ Not connected');
      allHealthy = false;
    }
  } catch (error) {
    console.log(`   ❌ Connection check failed: ${error.message}`);
    allHealthy = false;
  }
  console.log();

  // Check Environment Variables
  console.log('🔐 Environment Configuration');
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'POSTGRES_HOST',
    'MONGODB_URI',
    'REDIS_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length === 0) {
    console.log('   ✅ All required environment variables present');
  } else {
    console.log(`   ❌ Missing environment variables: ${missingVars.join(', ')}`);
    allHealthy = false;
  }
  console.log();

  // Check Dependencies
  console.log('📦 Dependencies');
  try {
    const fs = require('fs');
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const deps = Object.keys(packageJson.dependencies || {}).length;
    const devDeps = Object.keys(packageJson.devDependencies || {}).length;
    console.log(`   ✅ ${deps} production dependencies`);
    console.log(`   ✅ ${devDeps} development dependencies`);
  } catch (error) {
    console.log(`   ❌ Could not read package.json: ${error.message}`);
    allHealthy = false;
  }
  console.log();

  // Final Status
  console.log('📋 Final Status');
  if (allHealthy) {
    console.log('   🎉 All systems operational!');
    console.log('   🚀 Ready for production deployment');
    process.exit(0);
  } else {
    console.log('   ⚠️  Some systems require attention');
    console.log('   🔧 Please check the errors above');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Status check interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Status check terminated');
  process.exit(0);
});

// Run the check
checkSystemStatus().catch(error => {
  console.error('💥 System check failed with error:', error);
  process.exit(1);
});