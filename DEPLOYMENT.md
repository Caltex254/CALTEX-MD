# Deployment Guide - CALTEX MD WhatsApp Bot

Complete deployment instructions for all supported platforms.

---

## Table of Contents

1. [Docker (Quick Start)](#1-docker-quick-start)
2. [Docker Compose (Production)](#2-docker-compose-production)
3. [Ubuntu VPS](#3-ubuntu-vps)
4. [Debian VPS](#4-debian-vps)
5. [Oracle Cloud Free Tier](#5-oracle-cloud-free-tier)
6. [DigitalOcean Droplet](#6-digitalocean-droplet)
7. [AWS EC2](#7-aws-ec2)
8. [Google Cloud VM](#8-google-cloud-vm)
9. [Microsoft Azure VM](#9-microsoft-azure-vm)
10. [Render](#10-render)
11. [Railway](#11-railway)
12. [Heroku](#12-heroku)
13. [Pterodactyl Panel](#13-pterodactyl-panel)
14. [PM2](#14-pm2)
15. [Backup Procedures](#15-backup-procedures)
16. [Updating the Bot](#16-updating-the-bot)

---

## 1. Docker (Quick Start)

### Prerequisites

- Docker Engine >= 20.10
- Docker Compose >= 2.0
- 2GB RAM minimum (4GB recommended)
- 10GB disk space minimum

### Installation Steps

```bash
# Clone the repository
git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md

# Create required directories
mkdir -p data sessions media logs nginx/ssl

# Create environment file
cp .env.example .env
nano .env  # Edit with your configuration

# Generate secure secrets
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "PASSWORD_SALT=$(openssl rand -hex 16)" >> .env

# Start all services
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

### Verify Deployment

```bash
# Check dashboard
curl http://localhost:3000/api/health

# Check bot service
curl http://localhost:3031/health

# Check WebSocket
curl http://localhost:3003/health
```

### Environment Setup

Edit the `.env` file:

```env
NODE_ENV=production
DATABASE_URL=file:./data/caltex.db
BOT_API_URL=http://bot:3031
WS_URL=http://ws:3003
NEXTAUTH_SECRET=<your-secret>
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=<your-jwt-secret>
ADMIN_USER=admin
ADMIN_PASS=<strong-password>
PASSWORD_SALT=<your-salt>
```

### Troubleshooting

```bash
# View container logs
docker compose logs -f bot
docker compose logs -f app

# Restart a service
docker compose restart bot

# Rebuild after code changes
docker compose up -d --build

# Check resource usage
docker stats

# Access container shell
docker compose exec bot sh
docker compose exec app sh
```

---

## 2. Docker Compose (Production)

### Prerequisites

- Docker Engine >= 20.10
- Docker Compose >= 2.0
- Domain name pointing to your server
- 4GB RAM minimum

### Installation Steps

```bash
# Clone the repository
git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md

# Create required directories
mkdir -p data sessions media logs nginx/ssl

# Set up environment
cp .env.example .env
nano .env

# Generate secrets
./scripts/generate-secrets.sh  # Or manually:
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "PASSWORD_SALT=$(openssl rand -hex 16)" >> .env
```

### SSL Configuration

```bash
# Install certbot
sudo apt-get update
sudo apt-get install -y certbot

# Obtain SSL certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem
```

### Nginx Configuration

Edit `nginx/nginx.conf` for your domain:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream dashboard {
        server app:3000;
    }

    upstream bot_api {
        server bot:3031;
    }

    upstream websocket {
        server ws:3003;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$host$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Dashboard
        location / {
            proxy_pass http://dashboard;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Bot API (internal only - block external access)
        location /bot-api/ {
            deny all;
            return 403;
        }

        # WebSocket
        location /ws {
            proxy_pass http://websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

### Start Production Stack

```bash
# Start with production compose file
docker compose -f docker-compose.prod.yml up -d

# Verify all services
docker compose -f docker-compose.prod.yml ps
curl https://yourdomain.com/api/health
```

### Automatic Restart

Docker Compose uses `restart: unless-stopped`, which automatically restarts containers unless explicitly stopped.

---

## 3. Ubuntu VPS

### Prerequisites

- Ubuntu 22.04 LTS or 24.04 LTS
- 2GB RAM minimum (4GB recommended)
- Root or sudo access
- Domain name (optional, for SSL)

### Installation Steps

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx

# Install certbot for SSL
sudo apt-get install -y certbot python3-certbot-nginx

# Clone the repository
cd /var/www
sudo git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md

# Install dependencies
npm install

# Set up environment
cp .env.example .env
nano .env
```

### Database Setup

```bash
# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# Build the Next.js dashboard
npm run build
```

### Environment Setup

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:./data/caltex.db
BOT_API_URL=http://localhost:3031
WS_URL=http://localhost:3003
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=https://yourdomain.com
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USER=admin
ADMIN_PASS=<strong-password>
PASSWORD_SALT=$(openssl rand -hex 16)
```

### PM2 Configuration

The project includes `ecosystem.config.js`. Start all services:

```bash
# Start all services with PM2
pm2 start ecosystem.config.js

# Save the PM2 process list
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the command PM2 outputs to complete setup
```

### Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/caltex-md
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Dashboard
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Block direct access to bot API
    location :3031 {
        deny all;
        return 403;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/caltex-md /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSL Configuration

```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up by certbot, verify:
sudo certbot renew --dry-run
```

### Systemd Service (Alternative to PM2)

Create a systemd service for the dashboard:

```bash
sudo nano /etc/systemd/system/caltex-dashboard.service
```

```ini
[Unit]
Description=CALTEX MD Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/caltex-md
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Create a systemd service for the bot:

```bash
sudo nano /etc/systemd/system/caltex-bot.service
```

```ini
[Unit]
Description=CALTEX MD WhatsApp Bot
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/caltex-md
ExecStart=/root/.bun/bin/bun run mini-services/caltex-bot/index.ts
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=BOT_PORT=3031

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable caltex-dashboard caltex-bot
sudo systemctl start caltex-dashboard caltex-bot

# Check status
sudo systemctl status caltex-dashboard
sudo systemctl status caltex-bot
```

### Updating the Bot

```bash
cd /var/www/caltex-md

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Rebuild
npm run build
npx prisma generate
npx prisma db push

# Restart services
pm2 restart all
# or with systemd:
# sudo systemctl restart caltex-dashboard caltex-bot
```

---

## 4. Debian VPS

### Prerequisites

- Debian 12 (Bookworm)
- 2GB RAM minimum
- Root or sudo access

### Installation Steps

The Debian installation is nearly identical to Ubuntu. Key differences:

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y curl git build-essential

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install Nginx
sudo apt-get install -y nginx

# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Install PM2
sudo npm install -g pm2

# Clone and set up (same as Ubuntu)
cd /opt
sudo git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md
npm install
cp .env.example .env
nano .env

# Build
npx prisma generate
npx prisma db push
npm run build

# Create data directories
mkdir -p data sessions media logs
chmod -R 755 data sessions media logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx and SSL

Follow the same Nginx and SSL configuration steps as the [Ubuntu VPS](#3-ubuntu-vps) guide.

---

## 5. Oracle Cloud Free Tier

### Prerequisites

- Oracle Cloud account with Always Free tier
- ARM Ampere A1 instance (up to 4 OCPU, 24GB RAM free)
- Or AMD x64 instance (1 OCPU, 1GB RAM)

### Create Instance

1. Go to **Oracle Cloud Console** > **Compute** > **Instances**
2. Click **Create Instance**
3. Select **Oracle Linux** or **Ubuntu 22.04** image
4. Choose **Ampere A1** shape (ARM) with 2-4 OCPU and 12-24GB RAM
5. Configure **SSH key** (recommended: upload your public key)
6. Click **Create**

### Network Configuration

```bash
# In Oracle Cloud Console:
# 1. Go to Networking > Virtual Cloud Networks
# 2. Select your VCN > Security Lists > Default Security List
# 3. Add Ingress Rules:
#    - Port 80 (HTTP) - Source: 0.0.0.0/0
#    - Port 443 (HTTPS) - Source: 0.0.0.0/0
#    - Port 22 (SSH) - Source: Your IP only
```

### Connect and Install

```bash
# SSH into your instance
ssh -i ~/.ssh/oracle_key opc@<your-instance-public-ip>

# For Ubuntu, update and install prerequisites
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2 and Nginx
sudo npm install -g pm2
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Clone and set up
cd /opt
sudo git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md
sudo chown -R $USER:$USER .
npm install

# Configure environment
cp .env.example .env
nano .env

# Build
npx prisma generate
npx prisma db push
npm run build

# Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Firewall Configuration

```bash
# Oracle Linux uses firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Ubuntu uses ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### SSL Setup

Follow the same Nginx and SSL steps as the [Ubuntu VPS](#3-ubuntu-vps) guide.

---

## 6. DigitalOcean Droplet

### Prerequisites

- DigitalOcean account
- Domain name pointing to your droplet

### Create Droplet

1. Go to **DigitalOcean Console** > **Droplets** > **Create Droplet**
2. Choose **Ubuntu 22.04 LTS**
3. Select **Basic** plan with at least **2GB RAM** ($12/month)
4. Choose a datacenter region close to your users
5. Add your **SSH key**
6. Click **Create Droplet**

### Installation

```bash
# SSH into the droplet
ssh root@<droplet-ip>

# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2
npm install -g pm2

# Clone and set up
cd /var/www
git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md
npm install
cp .env.example .env
nano .env

# Build
npx prisma generate
npx prisma db push
npm run build

# Start
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx and SSL

Follow the [Ubuntu VPS](#3-ubuntu-vps) guide for Nginx configuration and SSL setup.

---

## 7. AWS EC2

### Prerequisites

- AWS account
- EC2 instance running Ubuntu 22.04 LTS
- Security group configured for ports 22, 80, 443

### Launch Instance

1. Go to **AWS Console** > **EC2** > **Launch Instance**
2. Select **Ubuntu 22.04 LTS** AMI
3. Choose **t3.medium** (2 vCPU, 4GB RAM) or larger
4. Configure **Security Group**:
   - Inbound: SSH (22) from your IP, HTTP (80) from anywhere, HTTPS (443) from anywhere
5. Create or select an **SSH key pair**
6. Launch the instance

### Installation

```bash
# SSH into the instance
ssh -i ~/.ssh/aws-key.pem ubuntu@<ec2-public-ip>

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2
sudo npm install -g pm2

# Clone and set up
cd /opt
sudo git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md
sudo chown -R $USER:$USER .
npm install
cp .env.example .env
nano .env

# Build and start
npx prisma generate
npx prisma db push
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Elastic IP

Assign an **Elastic IP** to your instance so the public IP doesn't change on reboot:

1. Go to **EC2** > **Elastic IPs** > **Allocate Elastic IP**
2. Associate it with your running instance
3. Update your DNS records to point to this IP

---

## 8. Google Cloud VM

### Prerequisites

- Google Cloud account
- Project with billing enabled
- Domain name

### Create VM

```bash
# Using gcloud CLI
gcloud compute instances create caltex-md \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --machine-type=e2-medium \
  --boot-disk-size=30GB \
  --tags=http-server,https-server \
  --zone=us-central1-a
```

Or through the Console:
1. Go to **Compute Engine** > **VM Instances** > **Create Instance**
2. Select **e2-medium** (2 vCPU, 4GB RAM)
3. Choose **Ubuntu 22.04 LTS**
4. Under **Firewall**, check "Allow HTTP" and "Allow HTTPS"
5. Click **Create**

### Firewall Rules

```bash
# Create firewall rules
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 --target-tags http-server

gcloud compute firewall-rules create allow-https \
  --allow tcp:443 --target-tags https-server
```

### Installation

```bash
# SSH into the VM
gcloud compute ssh caltex-md --zone=us-central1-a

# Follow the Ubuntu VPS installation steps
sudo apt-get update && sudo apt-get upgrade -y
# ... (same as Ubuntu VPS guide)
```

---

## 9. Microsoft Azure VM

### Prerequisites

- Azure account
- Resource group created
- Domain name

### Create VM

```bash
# Using Azure CLI
az vm create \
  --resource-group caltex-rg \
  --name caltex-md \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --open-ports 22 80 443
```

Or through the Portal:
1. Go to **Virtual Machines** > **Create**
2. Select **Ubuntu Server 22.04 LTS**
3. Choose **Standard_B2s** (2 vCPU, 4GB RAM)
4. Configure **Inbound port rules**: Allow SSH (22), HTTP (80), HTTPS (443)
5. Click **Review + Create**

### Installation

```bash
# SSH into the VM
ssh azureuser@<vm-public-ip>

# Follow the Ubuntu VPS installation steps
sudo apt-get update && sudo apt-get upgrade -y
# ... (same as Ubuntu VPS guide)
```

### Network Security Group

Ensure your NSG allows inbound traffic on ports 22, 80, and 443:

```bash
# Add NSG rules if not already created
az network nsg rule create \
  --resource-group caltex-rg \
  --nsg-name caltex-md-nsg \
  --name allow-http \
  --priority 1001 \
  --destination-port-ranges 80 \
  --access Allow \
  --protocol Tcp

az network nsg rule create \
  --resource-group caltex-rg \
  --nsg-name caltex-md-nsg \
  --name allow-https \
  --priority 1002 \
  --destination-port-ranges 443 \
  --access Allow \
  --protocol Tcp
```

---

## 10. Render

### Prerequisites

- Render account (https://render.com)
- GitHub repository connected

### Deploy Dashboard (Web Service)

1. Go to **Render Dashboard** > **New** > **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `caltex-md-dashboard`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npx prisma db push && npm run build`
   - **Start Command**: `NODE_ENV=production node .next/standalone/server.js`
   - **Plan**: Starter ($7/month) or higher
4. Add **Environment Variables**:
   - `NODE_ENV=production`
   - `DATABASE_URL=file:./data/caltex.db`
   - `NEXTAUTH_SECRET=<your-secret>`
   - `NEXTAUTH_URL=https://caltex-md-dashboard.onrender.com`
   - `JWT_SECRET=<your-jwt-secret>`
   - `ADMIN_USER=admin`
   - `ADMIN_PASS=<strong-password>`
   - `BOT_API_URL=https://caltex-md-bot.onrender.com`
5. Click **Create Web Service**

### Deploy Bot Service (Background Worker)

1. Go to **Render Dashboard** > **New** > **Background Worker**
2. Connect the same repository
3. Configure:
   - **Name**: `caltex-md-bot`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `bun run mini-services/caltex-bot/index.ts`
4. Add **Environment Variables**:
   - `NODE_ENV=production`
   - `BOT_PORT=3031`
   - `DASHBOARD_API_URL=https://caltex-md-dashboard.onrender.com`
5. Click **Create Background Worker**

### Persistent Disk

Add a persistent disk for session data:
1. Go to your bot service > **Disks**
2. Add disk: **Name**: `sessions`, **Mount Path**: `/opt/render/project/src/sessions`, **Size**: 1GB

---

## 11. Railway

### Prerequisites

- Railway account (https://railway.app)
- GitHub repository connected

### Deploy

1. Go to **Railway Dashboard** > **New Project** > **Deploy from GitHub repo**
2. Select your repository
3. Railway auto-detects the Dockerfile

### Configure Environment

1. Go to your project > **Variables** tab
2. Add all environment variables from `.env.example`
3. Railway automatically assigns a `PORT` variable

### Custom Start Command

If Railway doesn't auto-detect, set a custom start command:

**Dashboard service:**
```
npm run build && npx prisma generate && npx prisma db push && NODE_ENV=production node .next/standalone/server.js
```

**Bot service** (deploy as a separate service from the same repo):
```
bun run mini-services/caltex-bot/index.ts
```

### Volume for Session Data

1. Go to your service > **Volumes** tab
2. Add a volume: **Mount Path**: `/app/sessions`, **Size**: 1GB

---

## 12. Heroku

### Prerequisites

- Heroku account
- Heroku CLI installed

### Installation

```bash
# Install Heroku CLI (if not installed)
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create a Heroku app
heroku create caltex-md-bot

# Add buildpacks
heroku buildpacks:set heroku/nodejs

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set NEXTAUTH_SECRET=$(openssl rand -hex 32)
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set ADMIN_USER=admin
heroku config:set ADMIN_PASS=<strong-password>
heroku config:set DATABASE_URL=file:./data/caltex.db

# Deploy
git push heroku main

# Scale dynos
heroku ps:scale web=1 bot=1
```

### Procfile

The project includes a `Procfile`:

```
web: npm start
bot: npm run bot:start
ws: npm run ws:start
```

### Session Data

Heroku's ephemeral filesystem means session data is lost on restart. Use an add-on or external storage:

```bash
# Add PostgreSQL for session storage (alternative to SQLite)
heroku addons:create heroku-postgresql:mini

# Or use a persistent storage add-on
```

---

## 13. Pterodactyl Panel

### Prerequisites

- Pterodactyl Panel installed
- Server allocation with at least 2GB RAM

### Create Server

1. Go to **Admin Panel** > **Servers** > **Create New**
2. Set **Name**: `CALTEX MD Bot`
3. Select a **Node** with available resources
4. Set **Allocation**: at least 2GB RAM, 10GB disk
5. Select **Docker Image**: `ghcr.io/parkervcp/yolks:node_20` (Node.js 20 egg)
6. Set **Startup Command**: `bun run mini-services/caltex-bot/index.ts`

### Environment Variables

Add in the server's **Startup** tab:

```
NODE_ENV=production
BOT_PORT=3031
DASHBOARD_API_URL=http://your-dashboard-url
WS_URL=http://your-ws-url
```

### Install Steps

1. Upload the project files via **SFTP** or **Git**
2. Run installation commands in the server console:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run build
   ```
3. Start the server

### Running Dashboard Separately

The Pterodactyl egg is best suited for the bot service. Run the dashboard on a separate server or use a separate Pterodactyl server with the Node.js egg for the Next.js dashboard.

---

## 14. PM2

### Prerequisites

- Node.js >= 20
- Bun >= 1.0
- PM2 installed globally

### Installation

```bash
# Install PM2
npm install -g pm2

# Clone and build
git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md
npm install
cp .env.example .env
nano .env

npx prisma generate
npx prisma db push
npm run build
```

### Start with PM2

```bash
# Start all services using the ecosystem config
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs

# View logs for a specific service
pm2 logs caltex-bot
pm2 logs caltex-app

# Restart a service
pm2 restart caltex-bot

# Stop all
pm2 stop all

# Delete all
pm2 delete all
```

### Auto-start on Boot

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# The startup command will output a command to run as root.
# Run that command to complete the setup.
```

### Monitoring

```bash
# Real-time monitoring
pm2 monit

# Memory and CPU usage
pm2 status

# Detailed process info
pm2 describe caltex-bot

# Reset restart counters
pm2 reset all
```

### Log Management

```bash
# Flush logs
pm2 flush

# Reload logs (for log rotation)
pm2 reloadLogs

# Install log rotation module
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
```

---

## 15. Backup Procedures

### What to Back Up

| Data | Path | Frequency | Priority |
|---|---|---|---|
| Database | `data/caltex.db` | Daily | Critical |
| Sessions | `sessions/` or `auth_info_baileys/` | Daily | Critical |
| Configuration | `.env`, `bot-config.json`, `ai-config.json` | On change | High |
| Media | `media/` | Weekly | Medium |
| Logs | `logs/` | Optional | Low |

### Manual Backup

```bash
# Create a backup directory
BACKUP_DIR="./backups/$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
cp data/caltex.db "$BACKUP_DIR/"

# Backup sessions
cp -r sessions/ "$BACKUP_DIR/sessions/"

# Backup configuration
cp .env bot-config.json ai-config.json "$BACKUP_DIR/"

# Create compressed archive
tar -czf "caltex-backup-$(date +%Y%m%d-%H%M%S).tar.gz" "$BACKUP_DIR"

# Remove temporary directory
rm -rf "$BACKUP_DIR"
```

### Automated Backup (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /var/www/caltex-md && ./scripts/backup.sh >> /var/log/caltex-backup.log 2>&1
```

Create `scripts/backup.sh`:

```bash
#!/bin/bash
set -e

PROJECT_DIR="/var/www/caltex-md"
BACKUP_DIR="/var/backups/caltex-md"
DATE=$(date +%Y-%m-%d_%H%M%S)
MAX_BACKUPS=30

mkdir -p "$BACKUP_DIR"

# Create backup
tar -czf "$BACKUP_DIR/caltex-backup-$DATE.tar.gz" \
  -C "$PROJECT_DIR" \
  data/caltex.db \
  sessions/ \
  .env \
  bot-config.json \
  ai-config.json

# Clean old backups
ls -t "$BACKUP_DIR"/caltex-backup-*.tar.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

echo "Backup created: caltex-backup-$DATE.tar.gz"
```

```bash
chmod +x scripts/backup.sh
```

### Restore from Backup

```bash
# Stop services
pm2 stop all

# Extract backup
tar -xzf caltex-backup-YYYY-MM-DD_HHMMSS.tar.gz -C /tmp/

# Restore files
cp /tmp/data/caltex.db data/
cp -r /tmp/sessions/ sessions/
cp /tmp/.env .env
cp /tmp/bot-config.json .
cp /tmp/ai-config.json .

# Restart services
pm2 restart all
```

---

## 16. Updating the Bot

### Standard Update

```bash
cd /path/to/caltex-md

# Pull latest changes
git pull origin main

# Install/update dependencies
npm install

# Regenerate Prisma client
npx prisma generate

# Apply database migrations
npx prisma db push

# Rebuild dashboard
npm run build

# Restart services
pm2 restart all

# Verify
curl http://localhost:3031/health
curl http://localhost:3000/api/health
```

### Docker Update

```bash
cd /path/to/caltex-md

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose up -d --build

# Verify
docker compose ps
curl http://localhost:3031/health
```

### Zero-Downtime Update (PM2)

```bash
# For the dashboard (cluster mode supports zero-downtime reload)
pm2 reload caltex-app

# For the bot (single instance, brief downtime)
pm2 restart caltex-bot
```

---

## Troubleshooting Deployment Issues

### Common Issues

| Issue | Solution |
|---|---|
| Port already in use | `lsof -i :3000` then `kill -9 <PID>` |
| Permission denied | `sudo chown -R $USER:$USER /path/to/caltex-md` |
| Out of memory | Increase swap: `sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Build fails | Clear cache: `rm -rf .next && npm run build` |
| QR code not showing | Check bot logs: `pm2 logs caltex-bot` |
| Database locked | Stop all services, backup db, restart |
| Nginx 502 Bad Gateway | Verify PM2 services are running: `pm2 status` |

For more troubleshooting help, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
