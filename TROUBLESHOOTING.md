# Troubleshooting Guide - CALTEX MD WhatsApp Bot

This guide covers common issues, their solutions, and debugging techniques for CALTEX MD.

---

## Table of Contents

1. [Common Issues and Solutions](#common-issues-and-solutions)
2. [Connection Issues](#connection-issues)
3. [QR Code Issues](#qr-code-issues)
4. [Session Issues](#session-issues)
5. [Database Issues](#database-issues)
6. [API Issues](#api-issues)
7. [Docker Issues](#docker-issues)
8. [Performance Issues](#performance-issues)
9. [Debug Mode](#debug-mode)
10. [Log Analysis Guide](#log-analysis-guide)
11. [FAQ](#faq)

---

## Common Issues and Solutions

### 1. Bot fails to start

**Symptoms**: Process exits immediately after starting.

**Solutions**:
```bash
# Check for port conflicts
lsof -i :3031
lsof -i :3000
lsof -i :3003

# Kill conflicting processes
kill -9 <PID>

# Check Node.js version
node --version  # Must be >= 20

# Check if .env file exists
ls -la .env

# Check if dependencies are installed
ls node_modules/.package-lock.json

# Reinstall if needed
rm -rf node_modules
npm install
```

### 2. Commands not responding

**Symptoms**: Bot is connected but doesn't respond to commands.

**Solutions**:
```bash
# Verify command prefix
cat bot-config.json | grep prefix

# Check if the command is registered
curl http://localhost:3031/api/commands

# Check if sender is in blocked JIDs
cat bot-config.json | grep -A5 blockedJids

# Check if the message is being received
pm2 logs caltex-bot --lines 50
```

### 3. Dashboard shows "Connection refused"

**Symptoms**: Dashboard cannot connect to the bot service.

**Solutions**:
```bash
# Check if bot service is running
curl http://localhost:3031/health

# Check environment variables
echo $BOT_API_URL

# Verify network connectivity
curl -v http://localhost:3031/health

# Check Docker networking (if using Docker)
docker compose exec app ping bot
docker compose exec app curl http://bot:3031/health
```

### 4. AI commands return errors

**Symptoms**: `!ai` command returns "AI request failed."

**Solutions**:
```bash
# Check AI configuration
curl http://localhost:3031/api/config/ai

# Verify API key is set
cat ai-config.json | grep apiKey

# Test API key directly
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Check if the provider is accessible
curl -v https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 5. Sticker command not working

**Symptoms**: `!sticker` command fails or sends no response.

**Solutions**:
```bash
# Check if sharp is installed
node -e "require('sharp'); console.log('sharp OK')"

# Verify the image was downloaded
pm2 logs caltex-bot --lines 20

# Check media directory permissions
ls -la media/

# Fix permissions
chmod -R 755 media/
```

### 6. Scheduled messages not sending

**Symptoms**: Messages scheduled but never delivered.

**Solutions**:
```bash
# Check scheduler status
curl http://localhost:3031/health | jq .scheduler

# List pending messages
curl http://localhost:3031/api/scheduler/messages

# Check if the session is connected
curl http://localhost:3031/api/status

# Verify the JID format is correct
# Correct: 6281234567890@s.whatsapp.net
# Correct: 6281234567890-1234567890@g.us
# Wrong: 6281234567890
```

### 7. Welcome/goodbye messages not working

**Symptoms**: New members join but don't receive welcome messages.

**Solutions**:
```bash
# Check bot configuration
curl http://localhost:3031/api/config/bot

# Verify welcome is enabled
# In bot-config.json, welcome.enabled should be true

# Check if bot is admin in the group
# The bot must be a group admin to send welcome messages reliably

# Check logs for errors
pm2 logs caltex-bot | grep -i welcome
```

### 8. Anti-features not enforcing

**Symptoms**: Links, spam, or bad words are not being deleted.

**Solutions**:
```bash
# Check anti-feature configuration
curl http://localhost:3031/api/config/anti

# Verify the bot is a group admin
# Anti-features require the bot to be a group admin to delete messages

# Check if the feature is enabled for the specific group
# Anti-features can be toggled per group via !antilink, !antibadword, etc.

# Check logs for enforcement attempts
pm2 logs caltex-bot | grep -i "anti"
```

### 9. Auto-read/auto-typing not working

**Symptoms**: Messages not being marked as read, typing indicator not showing.

**Solutions**:
```bash
# Check bot configuration
curl http://localhost:3031/api/config/bot | jq .

# Verify autoRead, autoTyping, autoRecording are true
# Update via API
curl -X PUT http://localhost:3031/api/config/bot \
  -H "Content-Type: application/json" \
  -d '{"autoRead": true, "autoTyping": true}'
```

### 10. Broadcast fails to send

**Symptoms**: Broadcast command accepted but messages not delivered.

**Solutions**:
```bash
# Check broadcast endpoint
curl -X POST http://localhost:3000/api/broadcast \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test broadcast", "targetType": "all"}'

# Verify the bot has active chats to broadcast to
curl http://localhost:3031/api/sessions

# Check rate limiting by WhatsApp
# WhatsApp limits bulk messaging; space out broadcasts
```

### 11. High memory usage

**Symptoms**: Bot process consuming excessive RAM.

**Solutions**:
```bash
# Check memory usage
pm2 monit
# or
docker stats

# Restart the bot to clear memory leaks
pm2 restart caltex-bot

# Reduce conversation memory length
curl -X PUT http://localhost:3031/api/config/ai \
  -H "Content-Type: application/json" \
  -d '{"maxConversationLength": 10}'

# Set memory limit in PM2
pm2 start ecosystem.config.js --update-env
```

### 12. Database file locked

**Symptoms**: "database is locked" errors in logs.

**Solutions**:
```bash
# Stop all services
pm2 stop all

# Check for lock files
ls -la data/*.db-journal
ls -la data/*.db-wal

# Backup the database
cp data/caltex.db data/caltex.db.bak

# Remove lock files
rm -f data/*.db-journal data/*.db-wal

# Restart services
pm2 restart all
```

### 13. CORS errors in browser

**Symptoms**: Browser console shows CORS-related errors.

**Solutions**:
```bash
# Verify CORS headers in bot service
curl -I -X OPTIONS http://localhost:3031/health

# Check the Access-Control-Allow-Origin header
# The bot service sets this to '*' by default

# For the dashboard API, check Next.js configuration
# In next.config.ts, ensure proper headers are set

# If using Nginx, add CORS headers:
# add_header Access-Control-Allow-Origin *;
```

### 14. Plugin not loading

**Symptoms**: Custom plugin commands not available.

**Solutions**:
```bash
# Check plugin list
curl http://localhost:3000/api/plugins

# Verify the plugin file exists and is properly formatted
ls src/lib/commands/my-plugin.ts

# Check for import errors in logs
pm2 logs caltex-app --lines 100 | grep -i plugin

# Restart the dashboard to reload plugins
pm2 restart caltex-app
```

### 15. WebSocket connection failing

**Symptoms**: Dashboard not receiving real-time updates.

**Solutions**:
```bash
# Check if WebSocket service is running
curl http://localhost:3003/health

# Verify WS_URL environment variable
echo $WS_URL

# Test WebSocket connection
wscat -c ws://localhost:3003

# Check Docker networking
docker compose logs ws
```

### 16. Login authentication fails

**Symptoms**: Dashboard login returns "Invalid credentials."

**Solutions**:
```bash
# Check environment variables
echo $ADMIN_USER
echo $ADMIN_PASS

# Reset admin password in .env
# ADMIN_PASS=new-strong-password

# Restart the dashboard
pm2 restart caltex-app

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"new-strong-password"}'
```

### 17. Rate limited by AI provider

**Symptoms**: AI commands intermittently fail with rate limit errors.

**Solutions**:
```bash
# Check AI config for rate limit settings
curl http://localhost:3031/api/config/ai

# Reduce maxTokens to lower per-request cost
curl -X PUT http://localhost:3031/api/config/ai \
  -H "Content-Type: application/json" \
  -d '{"openai": {"maxTokens": 1024}}'

# Add command cooldowns to reduce request frequency
# Increase cooldown in plugin configuration

# Consider using a different provider with higher rate limits
```

### 18. WhatsApp multi-device sync issues

**Symptoms**: Messages not syncing across devices, old chats not appearing.

**Solutions**:
```bash
# Enable full history sync in connection config
# Set syncFullHistory: true in the connection options

# Restart the bot to trigger a fresh sync
pm2 restart caltex-bot

# Clear session and re-link if persistent
rm -rf sessions/caltex-md/
pm2 restart caltex-bot
# Re-scan QR code
```

### 19. Media download failures

**Symptoms**: Download commands return errors or empty responses.

**Solutions**:
```bash
# Check if yt-dlp or download tools are installed
which yt-dlp

# Verify the URL is accessible from the server
curl -I "https://www.youtube.com/watch?v=..."

# Check media directory permissions and space
df -h media/
ls -la media/

# Check for network restrictions (some VPS providers block certain domains)
curl -v https://www.youtube.com
```

### 20. Docker container keeps restarting

**Symptoms**: `docker compose ps` shows restarting status.

**Solutions**:
```bash
# Check container logs
docker compose logs --tail=100 bot

# Common causes:
# 1. Missing .env file
# 2. Invalid environment variables
# 3. Port conflicts
# 4. Insufficient memory

# Check container resource usage
docker stats

# Increase memory limits in docker-compose.yml
# deploy:
#   resources:
#     limits:
#       memory: 1536M
```

### 21. Nginx 502 Bad Gateway

**Symptoms**: Accessing the domain returns 502 error.

**Solutions**:
```bash
# Check if PM2 services are running
pm2 status

# Restart PM2 services
pm2 restart all

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify Nginx configuration
sudo nginx -t

# Check if the upstream port is correct
curl http://127.0.0.1:3000/api/health
```

### 22. SSL certificate errors

**Symptoms**: Browser shows "Your connection is not private."

**Solutions**:
```bash
# Renew the certificate
sudo certbot renew

# Check certificate expiry
sudo certbot certificates

# Force renew
sudo certbot renew --force-renewal

# Check Nginx SSL configuration
sudo nginx -t

# Verify certificate files exist
ls -la /etc/letsencrypt/live/yourdomain.com/
```

---

## Connection Issues

### WhatsApp Connection Drops Frequently

**Possible causes**:
- Unstable internet connection on the server
- WhatsApp server maintenance
- Session data corruption
- Server resource exhaustion

**Solutions**:

1. **Check server connectivity**:
   ```bash
   ping -c 10 web.whatsapp.com
   curl -I https://web.whatsapp.com
   ```

2. **Review reconnect configuration**:
   ```bash
   # Check current reconnect settings in the bot logs
   pm2 logs caltex-bot | grep -i reconnect
   ```

3. **Verify auto-reconnect is enabled**:
   The bot defaults to `autoReconnect: true` with `maxReconnectAttempts: 10` and `reconnectBaseDelay: 2000ms`.

4. **Check server resources**:
   ```bash
   free -h
   df -h
   top
   ```

5. **Clear and re-link** if session data is corrupted:
   ```bash
   pm2 stop caltex-bot
   rm -rf sessions/caltex-md/
   pm2 start caltex-bot
   # Re-scan QR code
   ```

### Bot Shows "Connecting" But Never Connects

**Solutions**:
```bash
# Check for firewall issues
sudo ufw status
sudo iptables -L

# Verify DNS resolution
nslookup web.whatsapp.com
nslookup w1.web.whatsapp.com

# Check if WebSocket connections are blocked
curl -v -H "Upgrade: websocket" -H "Connection: Upgrade" \
  https://web.whatsapp.com/ws/chat

# Try with a different DNS
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

---

## QR Code Issues

### QR Code Not Displayed

**Solutions**:
```bash
# Check if the bot service is running
curl http://localhost:3031/health

# View QR code in logs
pm2 logs caltex-bot --lines 50

# If using Docker, check container logs
docker compose logs bot --tail=50

# QR code is also available via the API
curl http://localhost:3031/api/qr

# Access QR code from the dashboard
# Open http://localhost:3000 and navigate to QR panel
```

### QR Code Expired

QR codes expire after about 60 seconds. If you see "QR code expired":

1. The bot automatically regenerates QR codes
2. Check the latest logs for a new QR code
3. Restart the bot to force a new QR generation:
   ```bash
   pm2 restart caltex-bot
   ```

### QR Code Scanning Fails

**Solutions**:
1. Ensure you're scanning with the **correct WhatsApp account**
2. Go to **WhatsApp** > **Settings** > **Linked Devices** > **Link a Device**
3. Make sure the QR code is fully visible and not cropped
4. Try a different phone if the camera is having trouble
5. Check your phone's internet connection
6. Ensure your WhatsApp is updated to the latest version

---

## Session Issues

### Session Data Lost After Restart

**Solutions**:
```bash
# Verify session directory exists and has data
ls -la sessions/caltex-md/

# Check if volumes are properly mounted (Docker)
docker compose exec bot ls -la /app/sessions/

# Verify the session directory is not inside the container
# Use Docker volumes for persistence:
# volumes:
#   - caltex-sessions:/app/sessions

# For non-Docker, ensure sessions/ directory is writable
chmod -R 755 sessions/
```

### Multiple Sessions Conflict

**Solutions**:
```bash
# List all sessions
curl http://localhost:3031/api/sessions

# Delete conflicting sessions
curl -X POST http://localhost:3031/api/sessions/delete \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "old-session-id"}'

# Create a fresh session
curl -X POST http://localhost:3031/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "caltex-md"}'
```

### Session Banned by WhatsApp

**Symptoms**: Connection immediately disconnects with status code 403 or 515.

**Solutions**:
- This happens when WhatsApp detects automated or spam behavior
- Reduce message sending frequency
- Avoid sending identical messages to many contacts
- Wait 24-48 hours before trying again
- Use a different phone number if the ban persists
- Follow WhatsApp's Terms of Service strictly

---

## Database Issues

### SQLite Database Is Locked

```bash
# Stop all services
pm2 stop all

# Check for active connections
fuser data/caltex.db

# Kill any processes using the database
fuser -k data/caltex.db

# Remove journal files
rm -f data/caltex.db-journal data/caltex.db-wal data/caltex.db-shm

# Verify database integrity
sqlite3 data/caltex.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
cp data/caltex.db.bak data/caltex.db

# Restart services
pm2 restart all
```

### Database Growing Too Large

```bash
# Check database size
du -sh data/caltex.db

# Vacuum the database to reclaim space
sqlite3 data/caltex.db "VACUUM;"

# Clear old logs (older than 30 days)
sqlite3 data/caltex.db "DELETE FROM Log WHERE createdAt < datetime('now', '-30 days');"

# Clear old stats
sqlite3 data/caltex.db "DELETE FROM Stat WHERE date < date('now', '-90 days');"

# Vacuum again
sqlite3 data/caltex.db "VACUUM;"
```

### Prisma Client Errors

```bash
# Regenerate Prisma client
npx prisma generate

# Reset the database (WARNING: deletes all data)
npx prisma migrate reset

# Push schema changes
npx prisma db push

# Check schema for errors
npx prisma validate
```

---

## API Issues

### 401 Unauthorized

**Solutions**:
```bash
# Get a new token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r '.data.token')

echo $TOKEN

# Use the token
curl http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer $TOKEN"
```

### 500 Internal Server Error

**Solutions**:
```bash
# Check dashboard logs
pm2 logs caltex-app --lines 50

# Check bot logs
pm2 logs caltex-bot --lines 50

# Verify database connectivity
npx prisma db push --dry-run

# Check environment variables
node -e "console.log(process.env.DATABASE_URL)"
```

### API Response Too Slow

**Solutions**:
```bash
# Check server resources
top
free -h

# Optimize database queries
sqlite3 data/caltex.db "EXPLAIN QUERY PLAN SELECT * FROM Log WHERE level='error';"

# Add database indexes (if missing)
npx prisma db push

# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=2048"
pm2 restart caltex-app
```

---

## Docker Issues

### Container Won't Start

```bash
# View container logs
docker compose logs --tail=100 app

# Check if ports are already in use
ss -tulpn | grep -E '3000|3031|3003'

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Volume Mount Issues

```bash
# Check volume mounts
docker compose exec app ls -la /app/data/
docker compose exec bot ls -la /app/sessions/

# Verify volume configuration
docker compose config | grep -A5 volumes

# Fix permissions
sudo chown -R 1001:1001 data/ sessions/ media/ logs/
```

### Container OOM (Out of Memory)

```bash
# Check memory limits
docker stats

# Increase memory limits in docker-compose.yml
# deploy:
#   resources:
#     limits:
#       memory: 2048M

# Or add swap space on the host
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Networking Between Containers

```bash
# Check if containers can communicate
docker compose exec app ping bot
docker compose exec app curl http://bot:3031/health
docker compose exec bot ping app

# Inspect the network
docker network inspect caltex-network

# Recreate the network
docker compose down
docker compose up -d
```

---

## Performance Issues

### Slow Message Processing

**Diagnosis**:
```bash
# Check message processing rate
curl http://localhost:3031/health | jq .messages

# Monitor real-time performance
pm2 monit

# Check event loop lag
node -e "
const { monitorEventLoopDelay } = require('perf_hooks');
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setTimeout(() => {
  console.log('Min:', h.min);
  console.log('Max:', h.max);
  console.log('Mean:', h.mean);
  console.log('99th percentile:', h.percentile(99));
  h.disable();
}, 10000);
"
```

**Solutions**:
- Reduce `maxConversationLength` for AI conversations
- Disable unused auto-features (autoTyping, autoRecording)
- Increase the bot's memory limit
- Use a server with more CPU cores

### High CPU Usage

**Diagnosis**:
```bash
# Profile the Node.js process
kill -SIGUSR1 <pid>  # Enables the inspector
# Then connect with Chrome DevTools or node --inspect

# Check which function is consuming CPU
node --prof index.ts
node --prof-process isolate-*.log
```

**Solutions**:
- Check for infinite loops in custom plugins
- Reduce image processing quality in media handler
- Disable auto-react if emoji selection is slow
- Ensure database queries are not doing full table scans

### Memory Leaks

**Diagnosis**:
```bash
# Track memory over time
while true; do
  echo "$(date): $(curl -s http://localhost:3031/health | jq '.uptime')"
  sleep 60
done

# Take heap snapshots
kill -SIGUSR2 <pid>  # Generates heap snapshot
```

**Solutions**:
- Restart the bot periodically using PM2's `max_memory_restart`:
  ```javascript
  // In ecosystem.config.js
  max_memory_restart: "768M"
  ```
- Clear AI conversation memory periodically
- Check custom plugins for closure leaks
- Update dependencies to latest versions

---

## Debug Mode

### Enable Verbose Logging

```bash
# Set log level to debug for the bot
export LOG_LEVEL=debug

# Or modify in the source code
# In mini-services/caltex-bot/src/connection.ts, set:
# level: 'debug'

# Restart the bot
pm2 restart caltex-bot

# View debug logs
pm2 logs caltex-bot --lines 200
```

### Enable Next.js Debug Mode

```bash
# Set debug environment variable
export NEXT_DEBUG=true

# Start with debug logging
DEBUG=* npm run dev
```

### Node.js Inspector

```bash
# Start the bot with inspector enabled
node --inspect=0.0.0.0:9229 .next/standalone/server.js

# Or for the bot service
node --inspect=0.0.0.0:9229 mini-services/caltex-bot/index.ts

# Connect from Chrome:
# chrome://inspect > Configure... > <server-ip>:9229
```

### Network Debugging

```bash
# Monitor all HTTP traffic
tcpdump -i any port 3031 -A

# Check DNS resolution
dig web.whatsapp.com
dig w1.web.whatsapp.com

# Trace network path
traceroute web.whatsapp.com

# Monitor WebSocket traffic
# Install wscat: npm install -g wscat
wscat -c ws://localhost:3003
```

---

## Log Analysis Guide

### Understanding Log Levels

| Level | Description | When to Check |
|---|---|---|
| `fatal` | Application cannot continue | Always investigate immediately |
| `error` | Operation failed | Check for patterns |
| `warn` | Unexpected but handled | Monitor for increasing frequency |
| `info` | Normal operation | Helpful for debugging flow |
| `debug` | Detailed diagnostic info | Enable when troubleshooting |

### Common Log Patterns

**Connection issues**:
```
WARN: WhatsApp connection closed (statusCode=428, reason="Connection replaced")
```
→ Another session is using the same number. Check for duplicate sessions.

**Rate limiting**:
```
ERROR: OpenAI API error: 429 - Rate limit exceeded
```
→ Reduce request frequency or upgrade your API plan.

**Session corruption**:
```
ERROR: Failed to load session: Unexpected token < in JSON
```
→ Session data is corrupted. Delete and re-link.

**Database lock**:
```
ERROR: SQLITE_BUSY: database is locked
```
→ Multiple processes accessing the DB. Stop all services and restart.

### Log Locations

| Service | Log File | Command |
|---|---|---|
| Dashboard | `logs/app-out.log`, `logs/app-error.log` | `pm2 logs caltex-app` |
| Bot | `logs/bot-out.log`, `logs/bot-error.log`, `bot.log` | `pm2 logs caltex-bot` |
| WebSocket | `logs/ws-out.log`, `logs/ws-error.log` | `pm2 logs caltex-ws` |
| Nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` | `sudo tail -f /var/log/nginx/error.log` |
| Docker | `docker compose logs -f` | Per container |

### Searching Logs

```bash
# Search for errors in bot logs
pm2 logs caltex-bot --lines 1000 | grep -i "error"

# Search for specific user activity
pm2 logs caltex-bot --lines 5000 | grep "6281234567890"

# Count errors by type
pm2 logs caltex-bot --nostream --lines 10000 | grep "ERROR" | awk '{print $NF}' | sort | uniq -c | sort -rn

# Monitor connection events in real-time
pm2 logs caltex-bot --lines 0 | grep -i "connection"
```

---

## FAQ

### 1. Can I run multiple WhatsApp accounts on one bot?

Yes, CALTEX MD supports multi-session management. Each session connects to a different WhatsApp account. Use the session management API or dashboard to create additional sessions.

### 2. Does the bot work without the dashboard?

Yes, the bot service runs independently on port 3031. The dashboard is optional but recommended for easy management.

### 3. Can I use the bot on a phone?

The bot must run on a server (VPS, cloud, etc.). The WhatsApp account linked to the bot can still be used on a phone simultaneously via WhatsApp's multi-device feature.

### 4. How do I change the command prefix?

Use the `!setprefix` command (owner only) or update via the API:
```bash
curl -X PUT http://localhost:3031/api/config/bot \
  -H "Content-Type: application/json" \
  -d '{"prefix": "#"}'
```

### 5. Is it free to use?

Yes, CALTEX MD is open-source and free under the MIT License. However, AI features require API keys from providers (OpenAI, Google, Anthropic) which may have associated costs.

### 6. Can I self-host this for free?

Yes, using Oracle Cloud Free Tier (ARM instance with 24GB RAM) or any free-tier VPS. You can also run it on a Raspberry Pi.

### 7. How do I add custom commands?

Create a plugin file in `src/lib/commands/` following the plugin structure documented in README.md. The plugin loader will automatically discover it.

### 8. What happens if my server restarts?

If you're using PM2 with `pm2 startup` and `pm2 save`, all services will automatically restart. Docker Compose with `restart: unless-stopped` also handles this.

### 9. Can I use this bot in a country where WhatsApp is blocked?

You'll need a VPN or proxy on the server. Configure the proxy settings in the Baileys connection options if needed.

### 10. How many groups can the bot handle?

The bot can handle hundreds of groups depending on server resources. For high-volume deployments, use a server with at least 4GB RAM and 2 CPU cores.

### 11. Does the bot support WhatsApp Business API?

No, CALTEX MD uses the WhatsApp Web protocol via Baileys, not the Business API. It works with regular WhatsApp accounts using the multi-device feature.

### 12. How do I back up my bot data?

See the Backup Procedures section in [DEPLOYMENT.md](./DEPLOYMENT.md#15-backup-procedures). Key data includes the SQLite database, session files, and configuration files.

### 13. Can I run the bot on Windows?

While possible with WSL2 (Windows Subsystem for Linux), we recommend Linux for production. Docker Desktop on Windows is also supported for development.

### 14. Why does the bot go offline sometimes?

Common reasons: server resource exhaustion, network issues, WhatsApp server maintenance, or session expiration. Check the logs for specific error messages and refer to the Connection Issues section.

### 15. How do I enable AI features?

1. Obtain an API key from your chosen provider (OpenAI, Google AI, Anthropic)
2. Configure via the dashboard's AI panel
3. Or update via the API:
   ```bash
   curl -X PUT http://localhost:3031/api/config/ai \
     -H "Content-Type: application/json" \
     -d '{
       "defaultProvider": "openai",
       "openai": {
         "apiKey": "sk-...",
         "model": "gpt-4",
         "baseUrl": "https://api.openai.com/v1"
       }
     }'
   ```
4. Test with: `!ai hello`
