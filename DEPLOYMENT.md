# Teamly Deployment Guide

## Local Development Setup

### Prerequisites
- Node.js v14+ installed
- PostgreSQL v12+ installed and running
- Git

### Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Teamly
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and update:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure random string for JWT signing

4. **Set up the database:**
   ```bash
   # Generate Prisma Client
   npm run prisma:generate
   
   # Run database migrations
   npm run prisma:migrate
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   The API will be available at `http://localhost:3000`

---

## Docker Deployment

The easiest way to deploy Teamly is using Docker Compose, which sets up both the application and PostgreSQL database.

### Prerequisites
- Docker installed
- Docker Compose installed

### Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Teamly
   ```

2. **Update environment variables (optional):**
   
   Edit `docker-compose.yml` to change default credentials and JWT secret.

3. **Build and start containers:**
   ```bash
   docker-compose up -d
   ```
   
   This will:
   - Start a PostgreSQL database
   - Build the Node.js application
   - Run database migrations
   - Start the API server

4. **Check logs:**
   ```bash
   docker-compose logs -f app
   ```

5. **Stop the application:**
   ```bash
   docker-compose down
   ```

6. **Stop and remove data:**
   ```bash
   docker-compose down -v
   ```

The API will be available at `http://localhost:3000`

---

## Production Deployment

### Environment Variables

Ensure these are set in production:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
PORT=3000
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
```

**Important:** Generate a strong random JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Setup

1. Create a PostgreSQL database
2. Set the `DATABASE_URL` environment variable
3. Run migrations:
   ```bash
   npm run prisma:migrate
   ```

### Running in Production

1. **Install production dependencies:**
   ```bash
   npm ci --only=production
   ```

2. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

### Using PM2 (Recommended)

PM2 is a production process manager for Node.js applications.

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Start the application:**
   ```bash
   pm2 start src/server.js --name teamly
   ```

3. **Configure PM2 to restart on reboot:**
   ```bash
   pm2 startup
   pm2 save
   ```

4. **View logs:**
   ```bash
   pm2 logs teamly
   ```

5. **Monitor:**
   ```bash
   pm2 monit
   ```

---

## Cloud Platform Deployment

### Heroku

1. **Create a new Heroku app:**
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL:**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set JWT_SECRET=your-secret-here
   heroku config:set NODE_ENV=production
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

5. **Run migrations:**
   ```bash
   heroku run npm run prisma:migrate
   ```

### Railway

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL database
3. Connect your GitHub repository
4. Set environment variables:
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - Railway will automatically set `DATABASE_URL`
5. Deploy

### Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Add a PostgreSQL database
4. Set environment variables:
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `DATABASE_URL` (from PostgreSQL connection string)
5. Add build command:
   ```bash
   npm install && npm run prisma:generate && npm run prisma:migrate
   ```
6. Add start command:
   ```bash
   npm start
   ```

---

## Health Checks

The application provides a health check endpoint:

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "message": "Teamly API is running"
}
```

Use this endpoint for load balancer health checks and monitoring.

---

## Database Migrations

### Create a new migration

When you change the Prisma schema:

```bash
npm run prisma:migrate
```

This will:
1. Create a new migration file
2. Apply the migration to your database
3. Regenerate Prisma Client

### View migration status

```bash
npx prisma migrate status
```

### Reset database (DANGER: Deletes all data)

```bash
npx prisma migrate reset
```

---

## Monitoring and Logs

### Application Logs

The application logs to stdout/stderr. In production:

- **PM2**: `pm2 logs teamly`
- **Docker**: `docker-compose logs -f app`
- **Systemd**: `journalctl -u teamly -f`

### Database Administration

Use Prisma Studio for a GUI to manage your database:

```bash
npm run prisma:studio
```

This opens a web interface at `http://localhost:5555`

---

## Security Considerations

1. **JWT Secret**: Use a strong, random secret in production
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Configure CORS appropriately for your frontend domain
4. **Rate Limiting**: Consider adding rate limiting (e.g., express-rate-limit)
5. **Input Validation**: Add additional validation as needed
6. **Database Backups**: Set up regular database backups
7. **Environment Variables**: Never commit `.env` to version control

---

## Troubleshooting

### Common Issues

**Database connection errors:**
- Check `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Verify network connectivity

**Prisma Client errors:**
- Run `npm run prisma:generate`
- Check Prisma schema is valid

**Port already in use:**
- Change `PORT` in `.env`
- Or kill the process using the port

**Migration errors:**
- Check database permissions
- Verify migration files are present
- Try `npx prisma migrate resolve --rolled-back <migration_name>`

### Getting Help

Check the logs first:
```bash
# PM2
pm2 logs teamly

# Docker
docker-compose logs app

# Development
# Check terminal output
```

---

## Scaling

### Horizontal Scaling

The application is stateless and can be scaled horizontally:

1. Deploy multiple instances
2. Use a load balancer (nginx, HAProxy, cloud load balancer)
3. Ensure all instances connect to the same PostgreSQL database

### Database Scaling

For high traffic:

1. Use connection pooling (built into Prisma)
2. Add read replicas for read-heavy workloads
3. Consider managed database services (AWS RDS, Google Cloud SQL, etc.)
4. Implement caching (Redis) for frequently accessed data

---

## Backup and Recovery

### Database Backups

**PostgreSQL backup:**
```bash
pg_dump -U postgres teamly > backup.sql
```

**Restore:**
```bash
psql -U postgres teamly < backup.sql
```

**Automated backups:**
- Use cloud provider backup solutions
- Set up cron jobs for regular backups
- Test restore procedures regularly
