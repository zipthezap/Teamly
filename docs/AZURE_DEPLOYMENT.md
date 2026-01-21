# Azure Deployment Guide for Teamly

This guide will walk you through deploying Teamly to Microsoft Azure, making it accessible to your friends 24/7.

## Why Azure?

Azure was chosen for this deployment because:
- **Simple Container Deployment**: Azure App Service supports Docker containers out of the box
- **Cost-Effective**: Free tier available, low-cost options for personal projects
- **Integrated Services**: Database, container registry, and app hosting in one platform
- **Easy CI/CD**: Built-in GitHub Actions integration
- **Reliable**: 99.95% SLA for production workloads
- **No PC Required**: Runs 24/7 in the cloud, no need to keep your computer on

## Architecture Overview

The deployment consists of:
1. **Azure Container Registry (ACR)**: Stores your Docker images
2. **Azure Database for PostgreSQL**: Managed PostgreSQL database
3. **Azure Cache for Redis**: Managed Redis cache
4. **Azure App Service**: Runs your backend container
5. **Azure Static Web Apps** or **App Service**: Serves your frontend
6. **GitHub Actions**: Automates deployment on code changes

## Prerequisites

Before starting, ensure you have:
- An [Azure account](https://azure.microsoft.com/free/) (free tier available)
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) installed
- Git and Docker installed locally
- This repository cloned and working locally

## Deployment Options

### Option 1: Quick Deploy (Recommended for Beginners)

This option uses Azure App Service with multi-container support.

### Option 2: Production Deploy

This option uses separate services for better scalability and performance.

---

## Option 1: Quick Deploy with Azure App Service

### Step 1: Install Azure CLI

**Windows:**
```powershell
# Download and run the MSI installer from:
# https://aka.ms/installazurecliwindows
```

**Mac:**
```bash
brew install azure-cli
```

**Linux:**
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Step 2: Login to Azure

```bash
az login
```

This will open a browser window for authentication.

### Step 3: Run the Deployment Script

We've created a script that automates the entire deployment:

```bash
# Make script executable (Mac/Linux)
chmod +x scripts/deploy-azure.sh

# Run deployment
./scripts/deploy-azure.sh
```

**Windows users**: Use Git Bash to run the script, or follow the manual steps below.

The script will:
1. Create a resource group
2. Set up Azure Container Registry
3. Create PostgreSQL database
4. Create Redis cache
5. Build and push Docker images
6. Deploy containers to App Service
7. Configure environment variables

### Step 4: Configure Your App

After deployment, you'll receive URLs for:
- **Backend API**: `https://teamly-backend-<random>.azurewebsites.net`
- **Frontend**: `https://teamly-frontend-<random>.azurewebsites.net`

### Step 5: Set Up OAuth (Optional)

If you want Google/Facebook login:

1. Update your OAuth app settings to include the new Azure URLs
2. Run:
```bash
az webapp config appsettings set \
  --resource-group teamly-rg \
  --name teamly-backend \
  --settings \
    GOOGLE_CLIENT_ID="your-client-id" \
    GOOGLE_CLIENT_SECRET="your-client-secret" \
    GOOGLE_CALLBACK_URL="https://your-backend-url.azurewebsites.net/api/auth/google/callback" \
    FRONTEND_URL="https://your-frontend-url.azurewebsites.net"
```

---

## Option 2: Manual Deployment (Step-by-Step)

### Step 1: Create Azure Resources

```bash
# Login to Azure
az login

# Set variables (customize these)
RESOURCE_GROUP="teamly-rg"
LOCATION="eastus"
ACR_NAME="teamlyregistry$(date +%s)"  # Must be globally unique
POSTGRES_SERVER="teamly-db-$(date +%s)"
REDIS_NAME="teamly-redis-$(date +%s)"
BACKEND_APP="teamly-backend"
FRONTEND_APP="teamly-frontend"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Create PostgreSQL database
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --location $LOCATION \
  --admin-user teamlyadmin \
  --admin-password "YourStrongPassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_SERVER \
  --database-name teamly

# Create Redis cache
az redis create \
  --resource-group $RESOURCE_GROUP \
  --name $REDIS_NAME \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0 \
  --enable-non-ssl-port true
```

### Step 2: Build and Push Docker Images

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push backend
docker build -f Dockerfile.backend -t $ACR_NAME.azurecr.io/teamly-backend:latest .
docker push $ACR_NAME.azurecr.io/teamly-backend:latest

# Build and push frontend
docker build -f Dockerfile.frontend \
  --build-arg VITE_API_URL=https://$BACKEND_APP.azurewebsites.net/api \
  -t $ACR_NAME.azurecr.io/teamly-frontend:latest .
docker push $ACR_NAME.azurecr.io/teamly-frontend:latest
```

### Step 3: Create App Services

```bash
# Create App Service Plan
az appservice plan create \
  --name teamly-plan \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Get database connection string
DB_HOST=$(az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $POSTGRES_SERVER --query fullyQualifiedDomainName -o tsv)
DATABASE_URL="postgresql://teamlyadmin:YourStrongPassword123!@$DB_HOST:5432/teamly?schema=public&sslmode=require"

# Get Redis connection string
REDIS_KEY=$(az redis list-keys --resource-group $RESOURCE_GROUP --name $REDIS_NAME --query primaryKey -o tsv)
REDIS_HOST=$(az redis show --resource-group $RESOURCE_GROUP --name $REDIS_NAME --query hostName -o tsv)
REDIS_URL="redis://:$REDIS_KEY@$REDIS_HOST:6379"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create backend app
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan teamly-plan \
  --name $BACKEND_APP \
  --deployment-container-image-name $ACR_NAME.azurecr.io/teamly-backend:latest

# Configure backend app
az webapp config container set \
  --name $BACKEND_APP \
  --resource-group $RESOURCE_GROUP \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD

# Set backend environment variables
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP \
  --settings \
    DATABASE_URL="$DATABASE_URL" \
    REDIS_URL="$REDIS_URL" \
    JWT_SECRET="$JWT_SECRET" \
    NODE_ENV="production" \
    PORT="8080" \
    FRONTEND_URL="https://$FRONTEND_APP.azurewebsites.net"

# Create frontend app
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan teamly-plan \
  --name $FRONTEND_APP \
  --deployment-container-image-name $ACR_NAME.azurecr.io/teamly-frontend:latest

# Configure frontend app
az webapp config container set \
  --name $FRONTEND_APP \
  --resource-group $RESOURCE_GROUP \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD
```

### Step 4: Configure Continuous Deployment

The backend will automatically redeploy when you push to the main branch (see GitHub Actions setup below).

---

## GitHub Actions CI/CD Setup

### Step 1: Create Azure Service Principal

```bash
az ad sp create-for-rbac \
  --name "teamly-github-actions" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/teamly-rg \
  --sdk-auth
```

This will output JSON credentials. Copy the entire JSON output.

### Step 2: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

- `AZURE_CREDENTIALS`: The full JSON output from the previous command
- `AZURE_REGISTRY_NAME`: Your ACR name (e.g., `teamlyregistry123456`)
- `AZURE_REGISTRY_USERNAME`: ACR username
- `AZURE_REGISTRY_PASSWORD`: ACR password
- `AZURE_BACKEND_WEBAPP_NAME`: Backend app name (e.g., `teamly-backend`)
- `AZURE_FRONTEND_WEBAPP_NAME`: Frontend app name (e.g., `teamly-frontend`)

### Step 3: Workflow is Ready

The GitHub Actions workflow (`.github/workflows/azure-deploy.yml`) is already configured and will:
1. Trigger on pushes to `main` branch
2. Build Docker images
3. Push to Azure Container Registry
4. Deploy to Azure App Services

---

## Post-Deployment Configuration

### 1. Run Database Migrations

```bash
# SSH into the backend container
az webapp ssh --resource-group teamly-rg --name teamly-backend

# Run migrations
npx prisma migrate deploy
npx prisma generate
node prisma/seed.js
exit
```

Or use the Azure Cloud Shell to run:
```bash
az webapp exec --resource-group teamly-rg --name teamly-backend --command "npx prisma migrate deploy && node prisma/seed.js"
```

### 2. Configure Custom Domain (Optional)

```bash
# Map custom domain
az webapp config hostname add \
  --resource-group teamly-rg \
  --webapp-name teamly-frontend \
  --hostname www.yourdomain.com

# Enable HTTPS (free SSL certificate)
az webapp config ssl create \
  --resource-group teamly-rg \
  --name teamly-frontend \
  --hostname www.yourdomain.com
```

### 3. Enable Monitoring and Logs

```bash
# Enable Application Insights
az monitor app-insights component create \
  --app teamly-insights \
  --location eastus \
  --resource-group teamly-rg

# Enable logging
az webapp log config \
  --name teamly-backend \
  --resource-group teamly-rg \
  --docker-container-logging filesystem

# View logs
az webapp log tail --name teamly-backend --resource-group teamly-rg
```

---

## Cost Optimization

### Free/Low-Cost Tier Configuration

For personal use with friends, you can minimize costs:

**Monthly Estimate: ~$15-30/month**

- **App Service Plan B1**: ~$13/month (can host both backend and frontend)
- **PostgreSQL Burstable B1ms**: ~$12/month
- **Redis Basic C0**: ~$16/month (can be optional, app works without it)
- **Container Registry**: $5/month (Basic tier)

**To reduce costs further:**
1. Skip Redis cache (app falls back to in-memory cache)
2. Use App Service Free tier for testing (limited hours/day)
3. Use PostgreSQL Single Server B_Gen5_1 (~$7/month)

### Free Tier Setup (For Testing)

```bash
# Use free App Service tier (limited to 60 minutes/day)
az appservice plan create \
  --name teamly-free-plan \
  --resource-group teamly-rg \
  --is-linux \
  --sku F1

# Skip Redis, set REDIS_URL to empty
# App will use in-memory caching instead
```

---

## Monitoring and Maintenance

### View Application Logs

```bash
# Backend logs
az webapp log tail --name teamly-backend --resource-group teamly-rg

# Frontend logs
az webapp log tail --name teamly-frontend --resource-group teamly-rg
```

### Restart Services

```bash
az webapp restart --name teamly-backend --resource-group teamly-rg
az webapp restart --name teamly-frontend --resource-group teamly-rg
```

### Scale Up/Down

```bash
# Scale up to B2 (more CPU/memory)
az appservice plan update \
  --name teamly-plan \
  --resource-group teamly-rg \
  --sku B2

# Scale to multiple instances
az appservice plan update \
  --name teamly-plan \
  --resource-group teamly-rg \
  --number-of-workers 2
```

### Database Backups

Azure PostgreSQL automatically backs up your database daily for 7 days (configurable up to 35 days).

To create a manual backup:
```bash
az postgres flexible-server backup create \
  --resource-group teamly-rg \
  --name teamly-db \
  --backup-name manual-backup-$(date +%Y%m%d)
```

---

## Troubleshooting

### Container Fails to Start

```bash
# Check logs
az webapp log tail --name teamly-backend --resource-group teamly-rg

# Common issues:
# - Database connection: Check DATABASE_URL is correct
# - Missing migrations: Run `npx prisma migrate deploy`
# - Port mismatch: App Service expects port 8080 or use PORT env var
```

### Cannot Connect to Database

```bash
# Check firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group teamly-rg \
  --name teamly-db

# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group teamly-rg \
  --name teamly-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Frontend Can't Connect to Backend

1. Check CORS configuration in backend
2. Verify FRONTEND_URL is set correctly in backend environment
3. Check VITE_API_URL in frontend build args

### High Costs

```bash
# Check resource costs
az consumption usage list --output table

# Downgrade to cheaper tiers
az appservice plan update --name teamly-plan --resource-group teamly-rg --sku B1
az postgres flexible-server update --resource-group teamly-rg --name teamly-db --sku-name Standard_B1ms
```

---

## Security Best Practices

1. **Rotate Secrets Regularly**: Update JWT_SECRET, database passwords
2. **Enable HTTPS Only**: 
   ```bash
   az webapp update --name teamly-backend --resource-group teamly-rg --https-only true
   ```
3. **Restrict Database Access**: Only allow connections from Azure services
4. **Enable Web Application Firewall**: Consider Azure Front Door for DDoS protection
5. **Regular Updates**: Keep dependencies updated (Dependabot is enabled)
6. **Monitor Logs**: Set up alerts for unusual activity

---

## Cleanup/Teardown

If you want to delete everything:

```bash
# This will delete ALL resources in the resource group
az group delete --name teamly-rg --yes --no-wait
```

---

## Getting Help

- **Azure Support**: https://azure.microsoft.com/support/
- **Azure Documentation**: https://docs.microsoft.com/azure/
- **Community**: https://stackoverflow.com/questions/tagged/azure

---

## Next Steps

1. ✅ Deploy to Azure
2. Share your app URL with friends
3. Configure custom domain (optional)
4. Set up monitoring and alerts
5. Configure regular backups
6. Plan for scaling as user base grows

**Your app is now accessible 24/7 at:**
- Frontend: `https://teamly-frontend.azurewebsites.net`
- Backend API: `https://teamly-backend.azurewebsites.net/api`

Enjoy your cloud-hosted Teamly app! 🎉
