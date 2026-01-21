# Deployment Scripts

This directory contains scripts for deploying Teamly to various cloud platforms.

## Available Scripts

### Azure Deployment

**For Linux/Mac/Git Bash:**
```bash
chmod +x deploy-azure.sh
./deploy-azure.sh
```

**For Windows:**
```cmd
deploy-azure.bat
```

## What the Azure Script Does

1. **Prerequisites Check**
   - Verifies Azure CLI is installed
   - Verifies Docker is installed
   - Checks Azure login status

2. **Configuration**
   - Prompts for resource group name
   - Prompts for Azure location
   - Prompts for database password
   - Generates unique names for resources
   - Generates JWT secret automatically

3. **Resource Creation** (~15-20 minutes)
   - Creates Azure Resource Group
   - Creates Azure Container Registry
   - Creates PostgreSQL Flexible Server
   - Creates Redis Cache
   - Creates App Service Plan

4. **Build & Deploy** (~5-10 minutes)
   - Builds backend Docker image
   - Builds frontend Docker image
   - Pushes images to Azure Container Registry
   - Deploys backend to App Service
   - Deploys frontend to App Service

5. **Configuration**
   - Sets environment variables
   - Configures database connection
   - Configures Redis connection
   - Sets up CORS

6. **Migrations**
   - Runs database migrations
   - Seeds initial data

7. **Completion**
   - Displays deployment URLs
   - Shows useful commands
   - Provides next steps

## Configuration Options

When running the script, you'll be asked for:

1. **Resource Group Name** (default: teamly-rg)
   - The container for all Azure resources
   - Can be any name following Azure naming rules

2. **Azure Location** (default: eastus)
   - Where resources will be deployed
   - Common options: eastus, westus2, westeurope, eastasia

3. **Database Password**
   - Must be at least 8 characters
   - Must include uppercase, lowercase, and numbers
   - Keep it secure!

## Manual Deployment

If the automated script doesn't work, follow the manual steps in:
- [docs/AZURE_DEPLOYMENT.md](../../docs/AZURE_DEPLOYMENT.md)

## Troubleshooting

### "Azure CLI not found"
Install from: https://docs.microsoft.com/cli/azure/install-azure-cli

### "Docker not found"
Install Docker Desktop: https://docs.docker.com/get-docker/

### "Not logged in to Azure"
Run: `az login`

### "Resource names must be unique"
The script generates unique names using timestamps. If you see this error:
1. Wait a moment and try again
2. Or manually specify unique names in the script

### Script fails during resource creation
Check Azure portal for partial resources and either:
1. Delete the resource group and try again
2. Resume from the failed step

## Cost Estimate

Running the Azure deployment script creates:
- App Service Plan B1: ~$13/month
- PostgreSQL Flexible Server B1ms: ~$12/month
- Redis Cache Basic C0: ~$16/month (optional, can be skipped)
- Container Registry Basic: $5/month

**Total: ~$46/month (or ~$30/month without Redis)**

You can reduce costs by:
- Skipping Redis (app has fallback)
- Using smaller database SKU
- Using free tier for testing (limited hours)

## Cleanup

To delete all resources and stop charges:

```bash
az group delete --name teamly-rg --yes --no-wait
```

## Support

For questions or issues:
1. Check [docs/AZURE_DEPLOYMENT.md](../../docs/AZURE_DEPLOYMENT.md)
2. Check [AZURE_QUICKSTART.md](../../AZURE_QUICKSTART.md)
3. Open an issue on GitHub
