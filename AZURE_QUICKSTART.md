# 🚀 Quick Start: Deploy Teamly to Azure

This is a quick reference for deploying Teamly to the cloud. For complete details, see [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md).

## Why Deploy to Azure?

- ✅ **24/7 Availability**: Your friends can access the app anytime
- ✅ **No PC Required**: Runs in the cloud, not on your computer
- ✅ **Low Cost**: ~$46/month (~$30 without Redis)
- ✅ **Easy Setup**: One script does everything
- ✅ **Auto Updates**: Push code, auto-deploys via GitHub Actions

## Prerequisites

1. **Azure Account** - [Sign up free](https://azure.microsoft.com/free/)
2. **Azure CLI** - [Install guide](https://docs.microsoft.com/cli/azure/install-azure-cli)
3. **Docker** - [Install Docker Desktop](https://docs.docker.com/get-docker/)

## Deployment Methods

### Method 1: Automated Script (Recommended)

**For Linux/Mac/Git Bash:**
```bash
# Make script executable
chmod +x scripts/deployment/deploy-azure.sh

# Run deployment
./scripts/deployment/deploy-azure.sh
```

**For Windows:**
```cmd
# Run the Windows helper
scripts\deployment\deploy-azure.bat
```

The script will:
1. Check prerequisites
2. Ask for configuration (resource group name, location, passwords)
3. Create all Azure resources
4. Build and push Docker images
5. Deploy containers
6. Run database migrations
7. Show you the URLs

**Time:** ~20-30 minutes

### Method 2: Manual Deployment

Follow the step-by-step guide in [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md#option-2-manual-deployment-step-by-step)

### Method 3: GitHub Actions (For Updates)

After initial deployment, set up GitHub Actions for automatic deployments:

1. Get Azure credentials:
```bash
az ad sp create-for-rbac \
  --name "teamly-github-actions" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/teamly-rg \
  --sdk-auth
```

2. Add these secrets to GitHub repository (Settings → Secrets):
   - `AZURE_CREDENTIALS` - Full JSON from above command
   - `AZURE_REGISTRY_NAME` - Your ACR name
   - `AZURE_REGISTRY_USERNAME` - ACR username
   - `AZURE_REGISTRY_PASSWORD` - ACR password
   - `AZURE_BACKEND_WEBAPP_NAME` - Backend app name
   - `AZURE_FRONTEND_WEBAPP_NAME` - Frontend app name
   - `AZURE_RESOURCE_GROUP` - Resource group name

3. Push to `main` branch → Auto-deploys! 🎉

## After Deployment

### Access Your App

After successful deployment, you'll get URLs like:
- **Frontend**: `https://teamly-frontend.azurewebsites.net`
- **Backend**: `https://teamly-backend.azurewebsites.net/api`

Share the frontend URL with your friends!

### Common Tasks

**View logs:**
```bash
# Backend logs
az webapp log tail --name teamly-backend --resource-group teamly-rg

# Frontend logs
az webapp log tail --name teamly-frontend --resource-group teamly-rg
```

**Restart services:**
```bash
az webapp restart --name teamly-backend --resource-group teamly-rg
az webapp restart --name teamly-frontend --resource-group teamly-rg
```

**Run migrations manually:**
```bash
# SSH into backend
az webapp ssh --resource-group teamly-rg --name teamly-backend

# Run migrations
npx prisma migrate deploy && npx prisma generate
```

**Check costs:**
```bash
az consumption usage list --output table
```

### Optional: Custom Domain

Want your own domain like `teamly.yourdomain.com`?

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name teamly-frontend \
  --resource-group teamly-rg \
  --hostname teamly.yourdomain.com

# Enable free SSL
az webapp config ssl create \
  --name teamly-frontend \
  --resource-group teamly-rg \
  --hostname teamly.yourdomain.com
```

## Cost Management

### Monthly Cost Estimate
- **With Redis (Full Stack)**: ~$46/month
  - App Service Plan B1: $13
  - PostgreSQL B1ms: $12
  - Redis Cache C0: $16
  - Container Registry: $5

- **Without Redis (Optimized)**: ~$30/month
  - App Service Plan B1: $13
  - PostgreSQL B1ms: $12
  - Container Registry: $5
  - (App uses in-memory cache fallback)

### Reduce Costs
```bash
# Option 1: Skip Redis (app has fallback)
# Don't create Redis cache, app will use in-memory caching

# Option 2: Use smaller database
az postgres flexible-server update \
  --name teamly-db \
  --resource-group teamly-rg \
  --sku-name Standard_B1s  # ~$8/month instead of $12
```

## Troubleshooting

### Container won't start?
```bash
# Check logs for errors
az webapp log tail --name teamly-backend --resource-group teamly-rg

# Common fixes:
# - Check DATABASE_URL is correct
# - Run migrations: az webapp ssh ...
# - Restart: az webapp restart ...
```

### Can't connect to database?
```bash
# Check firewall rules
az postgres flexible-server firewall-rule create \
  --resource-group teamly-rg \
  --name teamly-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Frontend can't reach backend?
1. Check CORS settings in backend
2. Verify FRONTEND_URL env var in backend
3. Verify VITE_API_URL in frontend build

## Cleanup

To delete everything and stop charges:

```bash
# WARNING: This deletes ALL resources
az group delete --name teamly-rg --yes
```

## Getting Help

- 📚 Full guide: [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)
- ⚖️ Azure vs AWS: [docs/AZURE_VS_AWS.md](docs/AZURE_VS_AWS.md)
- 🔒 Security: [docs/SECURITY.md](docs/SECURITY.md)
- 💬 Questions? Open an issue on GitHub

## Next Steps

1. ✅ Deploy to Azure
2. 📱 Share URL with friends
3. 🔐 Configure OAuth (optional) - see [docs/guides/SOCIAL_LOGIN_GUIDE.md](docs/guides/SOCIAL_LOGIN_GUIDE.md)
4. 🌐 Add custom domain (optional)
5. 📊 Set up monitoring
6. 🎉 Enjoy your 24/7 cloud-hosted app!

---

**Ready to deploy?** Run:
```bash
./scripts/deployment/deploy-azure.sh
```

Good luck! 🚀
