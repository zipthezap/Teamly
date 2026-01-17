# HTTPS Setup Guide

This guide explains how to enable HTTPS for the Teamly application, both for the backend API server and the frontend nginx server.

## Overview

Teamly now supports HTTPS for secure communication. This is essential when:
- Accessing the application from outside your local network
- Deploying to production
- Using OAuth authentication (required by most providers)
- Handling sensitive user data

## Prerequisites

Before enabling HTTPS, you need SSL/TLS certificates. You have several options:

### 1. Let's Encrypt (Recommended for Production)

Free, automated SSL certificates from [Let's Encrypt](https://letsencrypt.org/):

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com
```

Certificates will be saved to:
- Private key: `/etc/letsencrypt/live/yourdomain.com/privkey.pem`
- Certificate: `/etc/letsencrypt/live/yourdomain.com/fullchain.pem`

### 2. Self-Signed Certificate (Development/Testing)

For development or testing purposes, you can create a self-signed certificate:

```bash
# Create ssl directory
mkdir -p ssl

# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

**Note:** Self-signed certificates will show security warnings in browsers but are fine for development.

### 3. Commercial SSL Certificate

Purchase from a Certificate Authority (CA) like:
- DigiCert
- GlobalSign
- Comodo
- GoDaddy

## Backend HTTPS Configuration

### Step 1: Update Environment Variables

Edit your `.env` file (or create one from `.env.example`):

```bash
# Enable HTTPS
USE_HTTPS=true

# Path to SSL certificate files
SSL_KEY_PATH=/path/to/privkey.pem
SSL_CERT_PATH=/path/to/fullchain.pem

# Port (default is 3000, or use 443 for standard HTTPS)
PORT=3000

# Update OAuth callback URLs to use HTTPS
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/auth/facebook/callback

# Update frontend URL
FRONTEND_URL=https://yourdomain.com
```

### Step 2: Start the Server

The server will automatically use HTTPS when `USE_HTTPS=true`:

```bash
# Development
npm run dev

# Production
npm start
```

The server will log whether it's running on HTTP or HTTPS:
```
[INFO] Creating HTTPS server
[INFO] API available at https://localhost:3000
```

### Step 3: Test the HTTPS Connection

```bash
# Test HTTPS endpoint
curl https://localhost:3000/health

# If using self-signed certificate, use -k to skip verification
curl -k https://localhost:3000/health
```

## Frontend HTTPS Configuration (nginx)

### Step 1: Update nginx Configuration

Edit `nginx.conf` to enable the HTTPS section:

1. Uncomment the HTTPS server block (lines starting with `#` in the HTTPS section)
2. Update the certificate paths:
   ```nginx
   ssl_certificate /etc/nginx/ssl/fullchain.pem;
   ssl_certificate_key /etc/nginx/ssl/privkey.pem;
   ```
3. Optionally, enable the HTTP to HTTPS redirect:
   ```nginx
   return 301 https://$server_name$request_uri;
   ```

### Step 2: Mount SSL Certificates in Docker

Edit `docker-compose.yml` to mount your certificates:

```yaml
frontend:
  volumes:
    - ./ssl:/etc/nginx/ssl:ro  # Uncomment this line
```

### Step 3: Restart the Frontend

```bash
docker-compose up -d --build frontend
```

## Docker Compose Setup

For a complete HTTPS setup with Docker:

1. **Create SSL certificates** in the `ssl/` directory
2. **Update `.env` file**:
   ```bash
   USE_HTTPS=true
   SSL_KEY_PATH=/app/ssl/privkey.pem
   SSL_CERT_PATH=/app/ssl/fullchain.pem
   ```
3. **Edit `docker-compose.yml`** and uncomment the volume mounts for SSL certificates
4. **Edit `nginx.conf`** and uncomment the HTTPS server section
5. **Start all services**:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## Production Deployment

### Using a Reverse Proxy (Recommended)

For production, it's recommended to use a reverse proxy like nginx or Caddy in front of your application:

#### Option 1: nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Proxy to backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve frontend
    location / {
        root /var/www/teamly/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

#### Option 2: Caddy (Automatic HTTPS)

Caddy automatically obtains and renews SSL certificates:

Create a `Caddyfile`:
```caddy
yourdomain.com {
    # Proxy API requests to backend
    handle /api/* {
        reverse_proxy localhost:3000
    }

    # Serve frontend
    handle {
        root * /var/www/teamly/frontend/dist
        file_server
        try_files {path} /index.html
    }
}
```

Start Caddy:
```bash
caddy run
```

### Cloud Platform Considerations

#### AWS
- Use AWS Certificate Manager (ACM) for free SSL certificates
- Configure Application Load Balancer (ALB) with HTTPS listener
- Terminate SSL at the load balancer

#### Google Cloud Platform
- Use Google-managed SSL certificates
- Configure HTTPS load balancer
- Terminate SSL at the load balancer

#### Heroku
- SSL is automatic on custom domains
- Configure custom domain in Heroku dashboard

## Troubleshooting

### Certificate Not Found Error

```
[ERROR] SSL key file not found at: /path/to/privkey.pem
[WARN] Falling back to HTTP server
```

**Solution:** Verify the certificate paths in your `.env` file are correct and the files exist.

### Permission Denied

```
Error: EACCES: permission denied, open '/etc/letsencrypt/...'
```

**Solution:** Run the application with appropriate permissions or copy certificates to a readable location:
```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/*.pem ./ssl/
sudo chown $USER:$USER ./ssl/*.pem
```

### Self-Signed Certificate Warning

Browsers will show a security warning for self-signed certificates.

**Solution:** 
- For development: Click "Advanced" and proceed anyway
- For production: Use a proper certificate from Let's Encrypt or a commercial CA

### Mixed Content Warnings

If your HTTPS site loads HTTP resources, browsers will block them.

**Solution:** Update all URLs in your frontend to use HTTPS:
- API URLs: `https://yourdomain.com/api`
- External resources: Use HTTPS versions

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::443
```

**Solution:** 
- Stop other services using port 443
- Or use a different port in your `.env` file (e.g., PORT=3443)

## Security Best Practices

1. **Always use HTTPS in production**
2. **Enable HSTS** (already configured in helmet middleware)
3. **Use strong SSL protocols** (TLSv1.2 and TLSv1.3 only)
4. **Keep certificates up to date** (Let's Encrypt auto-renews)
5. **Set secure cookie flag** (already configured for production)
6. **Update OAuth callback URLs** to use HTTPS
7. **Use environment variables** for certificate paths, never hardcode
8. **Restrict certificate file permissions** (chmod 600)
9. **Regular security audits** using tools like SSL Labs

## Testing SSL Configuration

### Online Tools
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Comprehensive SSL/TLS test
- [Security Headers](https://securityheaders.com/) - Security headers check

### Command Line
```bash
# Test SSL connection
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check certificate expiry
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Verify certificate chain
openssl verify -CAfile fullchain.pem cert.pem
```

## Certificate Renewal

### Let's Encrypt Auto-Renewal

Let's Encrypt certificates expire after 90 days. Set up auto-renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e

# Add this line (runs twice daily)
0 0,12 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

### Manual Renewal

```bash
# Renew certificates
sudo certbot renew

# Restart your services
sudo systemctl restart nginx
docker-compose restart backend
```

## Summary

- **Development:** Use self-signed certificates with `USE_HTTPS=true`
- **Production:** Use Let's Encrypt or commercial certificates
- **Docker:** Mount SSL certificates as read-only volumes
- **Reverse Proxy:** Recommended for production (nginx or Caddy)
- **Testing:** Verify with `curl -k https://localhost:3000/health`

For more information, see:
- [DEPLOYMENT.md](DEPLOYMENT.md) - General deployment guide
- [SECURITY.md](SECURITY.md) - Security best practices
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
