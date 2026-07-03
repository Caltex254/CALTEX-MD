# Security Policy

## Supported Versions

| Version | Supported | End of Life |
|---|---|---|
| 1.0.x | :white_check_mark: Active | - |
| < 1.0.0 | :x: Not supported | Expired |

We provide security updates for the latest stable release only. Users are encouraged to always run the most recent version.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### Reporting Process

1. **Email** your findings to **security@caltex-md.dev**
2. **Encrypt** sensitive information using our PGP key (available at `https://caltex-md.dev/.well-known/pgp-key.txt`)
3. Include the following in your report:
   - Type of vulnerability (e.g., injection, XSS, authentication bypass)
   - Full path or URL where the vulnerability was discovered
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if available)
   - Potential impact of the vulnerability
   - Your suggested fix (if you have one)

### Response Timeline

| Step | Timeframe |
|---|---|
| Acknowledgment of report | Within 24 hours |
| Initial assessment | Within 72 hours |
| Status update | Within 7 days |
| Fix development | Depends on severity |
| Security advisory published | After fix is released |

### Severity Classification

| Severity | Description | Response Time |
|---|---|---|
| **Critical** | Remote code execution, data breach, authentication bypass | < 24 hours |
| **High** | Privilege escalation, significant data exposure | < 72 hours |
| **Medium** | Limited information disclosure, DoS | < 7 days |
| **Low** | Minor information leak, non-security bug | Next release |

### Disclosure Policy

- We follow **responsible disclosure**
- We ask that you give us **90 days** to address the issue before public disclosure
- We will credit you in the security advisory (unless you prefer to remain anonymous)
- We do not pursue legal action against good-faith security researchers

---

## Security Features Overview

### Authentication

- **JWT Authentication**: All dashboard and API endpoints require JWT Bearer tokens
- **HS256 Signing**: Tokens are signed using HMAC-SHA256 via the `jose` library
- **Token Expiration**: JWT tokens expire after 24 hours by default
- **Password Hashing**: Admin passwords are hashed with SHA-256 plus a configurable salt
- **Configurable Credentials**: Admin username and password are set via environment variables

### API Security

- **Authorization Header**: All protected endpoints require `Authorization: Bearer <token>`
- **API Key Masking**: AI provider API keys are masked (first 8 characters shown) in API responses
- **CORS Headers**: Configurable Cross-Origin Resource Sharing headers
- **Input Validation**: Request body validation on all POST/PUT endpoints
- **Error Handling**: Generic error messages in production to avoid information leakage

### Session Security

- **Session Data Encryption**: WhatsApp session credentials stored in the filesystem
- **Session Isolation**: Each session operates independently with its own credentials
- **Session Export/Import**: Encrypted session data for backup and transfer
- **Graceful Disconnect**: Proper session cleanup on shutdown to prevent credential leakage

---

## Best Practices for Deployment

### 1. Environment Variables

**Never commit `.env` files to version control.**

```bash
# .gitignore should include:
.env
.env.local
.env.production
```

**Required security variables:**
```env
# Use strong, unique secrets in production
NEXTAUTH_SECRET=<64-character-random-string>
JWT_SECRET=<64-character-random-string>
PASSWORD_SALT=<32-character-random-string>

# Use strong admin credentials
ADMIN_USER=<non-default-username>
ADMIN_PASS=<strong-password-16+-characters>
```

**Generating secure secrets:**
```bash
# Generate a random secret
openssl rand -hex 32

# Or with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Network Security

- **Do not expose internal ports** (3031, 3003) directly to the internet
- Use a **reverse proxy** (Nginx, Caddy, or Cloudflare Tunnel) in front of the dashboard
- Enable **HTTPS/TLS** with valid certificates (Let's Encrypt recommended)
- Restrict access to the dashboard via **IP allowlisting** or **VPN** if possible
- Use **firewall rules** to limit access to the server:
  ```bash
  # Allow only necessary ports
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 22/tcp
  sudo ufw deny 3031/tcp
  sudo ufw deny 3003/tcp
  sudo ufw enable
  ```

### 3. Docker Security

- Run containers as **non-root user** (already configured in Dockerfiles)
- Use **read-only mounts** for configuration files
- Set **resource limits** to prevent DoS:
  ```yaml
  deploy:
    resources:
      limits:
        cpus: "1.0"
        memory: 1024M
  ```
- Keep Docker images **updated** regularly
- Use **Docker secrets** instead of environment variables for sensitive data in production
- Scan images for vulnerabilities: `docker scout cve caltex-md`

### 4. Database Security

- Store the SQLite database **outside the container** using volumes
- Set appropriate **file permissions**: `chmod 600 data/caltex.db`
- **Back up** the database regularly to a secure location
- Consider encrypting the database file at rest using filesystem encryption (eCryptfs, LUKS)

### 5. Session Data Encryption

WhatsApp session files contain authentication credentials. Protect them:

- Store session files on **encrypted volumes**
- Set restrictive **file permissions**: `chmod -R 700 sessions/`
- Never share session files over **unencrypted channels**
- **Delete** old sessions that are no longer needed
- Use the backup/export feature with caution — backup files contain credentials

### 6. Rate Limiting

While CALTEX MD does not include built-in rate limiting, we recommend configuring it at the reverse proxy level:

**Nginx rate limiting:**
```nginx
# In nginx.conf
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

**Cloudflare rate limiting** (if using Cloudflare):
- Enable rate limiting rules in the Cloudflare dashboard
- Set a threshold of 100 requests per minute per IP
- Block or challenge requests exceeding the limit

### 7. Audit Logging

CALTEX MD includes audit logging for administrative actions:

- All admin logins are recorded
- Bot configuration changes are logged
- User ban/unban actions are tracked
- Session creation and deletion events are recorded
- Plugin installation and removal events are logged

Audit logs are stored in the database and can be viewed from the dashboard Logs panel. For production:

- Configure **log rotation** to prevent disk exhaustion
- Forward logs to a **centralized logging service** (e.g., Loki, ELK)
- Set up **alerting** for suspicious activities (multiple failed logins, unusual API usage)
- Retain audit logs for at least **90 days**

### 8. Keeping Dependencies Updated

```bash
# Check for outdated dependencies
npm audit

# Fix automatically fixable vulnerabilities
npm audit fix

# Check for known vulnerabilities
npx npm-check-updates -u
npm install
```

Set up automated dependency scanning in your CI/CD pipeline using:
- GitHub Dependabot
- Snyk
- Trivy (for Docker images)

---

## Security Checklist for Production

Use this checklist before deploying CALTEX MD to production:

- [ ] Changed default `ADMIN_USER` and `ADMIN_PASS` from `admin`/`admin123`
- [ ] Generated strong, unique values for `NEXTAUTH_SECRET`, `JWT_SECRET`, and `PASSWORD_SALT`
- [ ] `.env` file is not committed to version control
- [ ] Internal ports (3031, 3003) are not exposed to the internet
- [ ] HTTPS/TLS is configured with valid certificates
- [ ] Reverse proxy (Nginx/Caddy) is set up in front of the dashboard
- [ ] Firewall rules block unnecessary ports
- [ ] Docker containers run as non-root users
- [ ] Resource limits are set for Docker containers
- [ ] Session files have restrictive permissions (700)
- [ ] Database file has restrictive permissions (600)
- [ ] Log rotation is configured
- [ ] Rate limiting is configured at the proxy level
- [ ] Dependencies are audited with `npm audit`
- [ ] Server SSH is configured with key-based authentication only
- [ ] Automatic security updates are enabled on the server
- [ ] Backup procedures are in place for sessions and database
- [ ] Monitoring and alerting are configured for suspicious activity

---

## Known Security Considerations

1. **WhatsApp Session Credentials**: The Baileys library stores WhatsApp authentication data in the `auth_info_baileys/` directory. Anyone with access to these files can impersonate the linked WhatsApp account. Protect these files carefully.

2. **SQLite Database**: The SQLite database contains user data, session information, and audit logs. It should be stored on an encrypted volume in high-security environments.

3. **API Keys**: AI provider API keys (OpenAI, Gemini, Claude) are stored in the `ai-config.json` file. While they are masked in API responses, the raw file is accessible on the server. Use file permissions to restrict access.

4. **WebSocket Connections**: The WebSocket service on port 3003 does not require authentication by default. In production, ensure it is only accessible from the dashboard and bot services (not from the internet).

5. **Bot Commands**: Some owner commands (`!restart`, `!shutdown`) can affect service availability. Ensure only trusted users have owner JIDs configured.

---

## Contact

For security-related questions or concerns:
- **Email**: security@caltex-md.dev
- **PGP Key**: https://caltex-md.dev/.well-known/pgp-key.txt

For general questions:
- **GitHub Issues**: https://github.com/caltex-md/caltex-md/issues
- **Discussions**: https://github.com/caltex-md/caltex-md/discussions
