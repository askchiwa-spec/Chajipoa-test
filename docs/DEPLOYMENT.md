# Deployment Guide - ChajiPoa

## 🚀 Production Deployment Instructions

### Prerequisites
- Ubuntu 20.04 LTS or newer
- Node.js 18+
- PostgreSQL 13+
- MongoDB 5+
- Redis 6+
- Nginx
- PM2 (Process Manager)

### Server Setup

#### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### 2. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 3. Install Databases
```bash
# PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update
sudo apt install -y mongodb-org

# Redis
sudo apt install redis-server -y
```

#### 4. Configure PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE chajipoa_db;
CREATE USER chajipoa_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE chajipoa_db TO chajipoa_user;
ALTER USER chajipoa_user CREATEDB;
\q
```

#### 5. Configure MongoDB
```bash
# Enable MongoDB service
sudo systemctl enable mongod
sudo systemctl start mongod
```

#### 6. Configure Redis
```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Change bind address to localhost only
bind 127.0.0.1

# Restart Redis
sudo systemctl restart redis-server
```

### Application Deployment

#### 1. Clone Repository
```bash
git clone https://github.com/yourusername/chajipoa.git
cd chajipoa
```

#### 2. Install Dependencies
```bash
npm install --production
```

#### 3. Environment Configuration
```bash
cp .env.example .env.production
nano .env.production

# Key production settings:
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database connections
POSTGRES_HOST=localhost
POSTGRES_DB=chajipoa_db
POSTGRES_USER=chajipoa_user
POSTGRES_PASSWORD=secure_password

MONGODB_URI=mongodb://localhost:27017/chajipoa
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_production_jwt_secret_here
AZAMPAY_API_KEY=your_production_azampay_key
```

#### 4. Database Migration
```bash
# Run database schema
psql -U chajipoa_user -d chajipoa_db -f docs/database-schema.sql
```

#### 5. Install PM2
```bash
sudo npm install -g pm2
```

#### 6. PM2 Configuration
```bash
# Create ecosystem file
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'chajipoa-api',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

#### 7. Start Application
```bash
# Start in production mode
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup startup script
sudo pm2 startup systemd
```

### Nginx Configuration

#### 1. Install Nginx
```bash
sudo apt install nginx -y
```

#### 2. Create SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.chajipoa.com
```

#### 3. Nginx Config
```bash
sudo nano /etc/nginx/sites-available/chajipoa
```

```nginx
server {
    listen 80;
    server_name api.chajipoa.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.chajipoa.com;

    ssl_certificate /etc/letsencrypt/live/api.chajipoa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.chajipoa.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req zone=api burst=200 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:3000;
    }

    # API documentation
    location /api-docs {
        proxy_pass http://localhost:3000;
    }
}
```

#### 4. Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/chajipoa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Monitoring & Maintenance

#### 1. Log Rotation
```bash
sudo nano /etc/logrotate.d/chajipoa
```

```
/home/username/chajipoa/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 username username
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### 2. Backup Scripts
```bash
# Create backup directory
mkdir -p /home/username/backups

# Database backup script
nano /home/username/scripts/backup-db.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/username/backups"

# PostgreSQL backup
pg_dump -U chajipoa_user chajipoa_db > "$BACKUP_DIR/postgres_$DATE.sql"

# MongoDB backup
mongodump --db chajipoa --out "$BACKUP_DIR/mongo_$DATE"

# Compress backups
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" "$BACKUP_DIR/postgres_$DATE.sql" "$BACKUP_DIR/mongo_$DATE"

# Remove old backups (keep 7 days)
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

# Remove uncompressed files
rm -rf "$BACKUP_DIR/postgres_$DATE.sql" "$BACKUP_DIR/mongo_$DATE"
```

```bash
chmod +x /home/username/scripts/backup-db.sh

# Add to cron (daily at 2 AM)
crontab -e
0 2 * * * /home/username/scripts/backup-db.sh
```

#### 3. Monitoring Commands
```bash
# Check application status
pm2 status
pm2 logs chajipoa-api

# Check system resources
htop
df -h
free -m

# Check database status
sudo systemctl status postgresql
sudo systemctl status mongod
sudo systemctl status redis-server

# Check Nginx status
sudo systemctl status nginx
```

### Scaling Options

#### Horizontal Scaling
- Use load balancer (AWS ELB, Nginx Load Balancer)
- Deploy multiple instances across different servers
- Use Redis for session sharing

#### Vertical Scaling
- Increase server resources (CPU, RAM)
- Optimize database queries
- Implement caching strategies

### Security Hardening

#### 1. Firewall Setup
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw deny 3000  # Block direct access to Node.js
```

#### 2. Fail2Ban
```bash
sudo apt install fail2ban -y
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

#### 3. Regular Updates
```bash
# Auto-update security patches
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Troubleshooting

#### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL
   sudo systemctl status postgresql
   sudo -u postgres psql -c "SELECT version();"
   
   # Check MongoDB
   sudo systemctl status mongod
   mongo --eval "db.runCommand({connectionStatus: 1})"
   ```

2. **Application Not Starting**
   ```bash
   # Check PM2 logs
   pm2 logs chajipoa-api
   
   # Check environment variables
   printenv | grep CHAJIPOA
   ```

3. **Nginx 502 Bad Gateway**
   ```bash
   # Check if Node.js is running
   pm2 status
   
   # Check Nginx error logs
   sudo tail -f /var/log/nginx/error.log
   ```

4. **Performance Issues**
   ```bash
   # Monitor with PM2
   pm2 monit
   
   # Check slow queries
   # In PostgreSQL:
   # SHOW log_min_duration_statement;
   ```

### Rollback Procedure

```bash
# Stop current application
pm2 stop chajipoa-api

# Restore from backup
# PostgreSQL
psql -U chajipoa_user -d chajipoa_db < backup_file.sql

# MongoDB
mongorestore --db chajipoa backup_directory/

# Start application
pm2 start chajipoa-api
```

---

**Ready for Production!** 🚀

Your ChajiPoa platform is now deployed and ready to serve power bank rentals across Tanzania.