#!/bin/bash

# Teamly Azure Deployment Script
# This script automates the deployment of Teamly to Microsoft Azure

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  ${1}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Check if Azure CLI is installed
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed"
        echo "Please install it from: https://docs.microsoft.com/cli/azure/install-azure-cli"
        exit 1
    fi
    print_success "Azure CLI is installed"
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Please install it from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure"
        print_info "Running 'az login'..."
        az login
    fi
    print_success "Logged in to Azure"
}

# Get configuration from user
get_configuration() {
    print_header "Configuration"
    
    # Get subscription
    SUBSCRIPTION=$(az account show --query id -o tsv)
    print_info "Using subscription: $SUBSCRIPTION"
    
    # Resource group name
    read -p "Enter resource group name (default: teamly-rg): " RESOURCE_GROUP
    RESOURCE_GROUP=${RESOURCE_GROUP:-teamly-rg}
    
    # Location
    read -p "Enter Azure location (default: eastus): " LOCATION
    LOCATION=${LOCATION:-eastus}
    
    # Generate unique names
    TIMESTAMP=$(date +%s)
    ACR_NAME="teamlyregistry${TIMESTAMP}"
    POSTGRES_SERVER="teamly-db-${TIMESTAMP}"
    REDIS_NAME="teamly-redis-${TIMESTAMP}"
    BACKEND_APP="teamly-backend"
    FRONTEND_APP="teamly-frontend"
    
    # Database password with validation
    while true; do
        read -sp "Enter database admin password (min 8 chars, must include uppercase, lowercase, numbers): " DB_PASSWORD
        echo ""
        
        # Validate password length
        if [ ${#DB_PASSWORD} -lt 8 ]; then
            print_error "Password must be at least 8 characters"
            continue
        fi
        
        # Validate password complexity (has uppercase, lowercase, and number)
        if ! echo "$DB_PASSWORD" | grep -q '[A-Z]'; then
            print_error "Password must contain at least one uppercase letter"
            continue
        fi
        if ! echo "$DB_PASSWORD" | grep -q '[a-z]'; then
            print_error "Password must contain at least one lowercase letter"
            continue
        fi
        if ! echo "$DB_PASSWORD" | grep -q '[0-9]'; then
            print_error "Password must contain at least one number"
            continue
        fi
        
        break
    done
    
    # Generate JWT secret
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -base64 32)
    else
        # Fallback if openssl not available
        JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
        print_warning "OpenSSL not found, using alternative random generation"
    fi
    
    print_success "Configuration complete"
    echo ""
    echo "Configuration summary:"
    echo "  Resource Group: $RESOURCE_GROUP"
    echo "  Location: $LOCATION"
    echo "  Container Registry: $ACR_NAME"
    echo "  PostgreSQL Server: $POSTGRES_SERVER"
    echo "  Redis Cache: $REDIS_NAME"
    echo "  Backend App: $BACKEND_APP"
    echo "  Frontend App: $FRONTEND_APP"
    echo ""
    
    read -p "Proceed with deployment? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        print_info "Deployment cancelled"
        exit 0
    fi
}

# Create Azure resources
create_resources() {
    print_header "Creating Azure Resources"
    
    # Create resource group
    print_info "Creating resource group..."
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    print_success "Resource group created"
    
    # Create Container Registry
    print_info "Creating Container Registry (this may take a few minutes)..."
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$ACR_NAME" \
        --sku Basic \
        --admin-enabled true \
        --output none
    print_success "Container Registry created"
    
    # Create PostgreSQL database
    print_info "Creating PostgreSQL database (this may take 5-10 minutes)..."
    az postgres flexible-server create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$POSTGRES_SERVER" \
        --location "$LOCATION" \
        --admin-user teamlyadmin \
        --admin-password "$DB_PASSWORD" \
        --sku-name Standard_B1ms \
        --tier Burstable \
        --version 16 \
        --storage-size 32 \
        --public-access 0.0.0.0 \
        --yes \
        --output none
    print_success "PostgreSQL server created"
    
    print_info "Creating database 'teamly'..."
    az postgres flexible-server db create \
        --resource-group "$RESOURCE_GROUP" \
        --server-name "$POSTGRES_SERVER" \
        --database-name teamly \
        --output none
    print_success "Database created"
    
    # Create Redis cache
    print_info "Creating Redis cache (this may take 5-10 minutes)..."
    az redis create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REDIS_NAME" \
        --location "$LOCATION" \
        --sku Basic \
        --vm-size c0 \
        --enable-non-ssl-port true \
        --output none
    print_success "Redis cache created"
    
    # Create App Service Plan
    print_info "Creating App Service Plan..."
    az appservice plan create \
        --name teamly-plan \
        --resource-group "$RESOURCE_GROUP" \
        --is-linux \
        --sku B1 \
        --output none
    print_success "App Service Plan created"
}

# Build and push Docker images
build_and_push_images() {
    print_header "Building and Pushing Docker Images"
    
    # Login to ACR
    print_info "Logging in to Azure Container Registry..."
    az acr login --name "$ACR_NAME"
    print_success "Logged in to ACR"
    
    # Build backend
    print_info "Building backend image..."
    docker build -f Dockerfile.backend \
        -t "$ACR_NAME.azurecr.io/teamly-backend:latest" .
    print_success "Backend image built"
    
    # Push backend
    print_info "Pushing backend image..."
    docker push "$ACR_NAME.azurecr.io/teamly-backend:latest"
    print_success "Backend image pushed"
    
    # Build frontend
    print_info "Building frontend image..."
    docker build -f Dockerfile.frontend \
        --build-arg VITE_API_URL="https://$BACKEND_APP.azurewebsites.net/api" \
        -t "$ACR_NAME.azurecr.io/teamly-frontend:latest" .
    print_success "Frontend image built"
    
    # Push frontend
    print_info "Pushing frontend image..."
    docker push "$ACR_NAME.azurecr.io/teamly-frontend:latest"
    print_success "Frontend image pushed"
}

# Deploy containers
deploy_containers() {
    print_header "Deploying Containers to App Service"
    
    # Get ACR credentials
    print_info "Getting ACR credentials..."
    ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
    
    # Get database connection details
    print_info "Getting database connection string..."
    DB_HOST=$(az postgres flexible-server show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$POSTGRES_SERVER" \
        --query fullyQualifiedDomainName -o tsv)
    DATABASE_URL="postgresql://teamlyadmin:${DB_PASSWORD}@${DB_HOST}:5432/teamly?schema=public&sslmode=require"
    
    # Get Redis connection details
    print_info "Getting Redis connection string..."
    REDIS_KEY=$(az redis list-keys \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REDIS_NAME" \
        --query primaryKey -o tsv)
    REDIS_HOST=$(az redis show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REDIS_NAME" \
        --query hostName -o tsv)
    REDIS_URL="redis://:${REDIS_KEY}@${REDIS_HOST}:6379"
    
    # Create backend app
    print_info "Creating backend app service..."
    az webapp create \
        --resource-group "$RESOURCE_GROUP" \
        --plan teamly-plan \
        --name "$BACKEND_APP" \
        --deployment-container-image-name "$ACR_NAME.azurecr.io/teamly-backend:latest" \
        --output none
    print_success "Backend app created"
    
    # Configure backend container
    print_info "Configuring backend container..."
    az webapp config container set \
        --name "$BACKEND_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-registry-server-url "https://$ACR_NAME.azurecr.io" \
        --docker-registry-server-user "$ACR_USERNAME" \
        --docker-registry-server-password "$ACR_PASSWORD" \
        --output none
    
    # Set backend environment variables
    print_info "Setting backend environment variables..."
    az webapp config appsettings set \
        --resource-group "$RESOURCE_GROUP" \
        --name "$BACKEND_APP" \
        --settings \
            DATABASE_URL="$DATABASE_URL" \
            REDIS_URL="$REDIS_URL" \
            JWT_SECRET="$JWT_SECRET" \
            NODE_ENV="production" \
            PORT="8080" \
            FRONTEND_URL="https://$FRONTEND_APP.azurewebsites.net" \
        --output none
    print_success "Backend configured"
    
    # Create frontend app
    print_info "Creating frontend app service..."
    az webapp create \
        --resource-group "$RESOURCE_GROUP" \
        --plan teamly-plan \
        --name "$FRONTEND_APP" \
        --deployment-container-image-name "$ACR_NAME.azurecr.io/teamly-frontend:latest" \
        --output none
    print_success "Frontend app created"
    
    # Configure frontend container
    print_info "Configuring frontend container..."
    az webapp config container set \
        --name "$FRONTEND_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-registry-server-url "https://$ACR_NAME.azurecr.io" \
        --docker-registry-server-user "$ACR_USERNAME" \
        --docker-registry-server-password "$ACR_PASSWORD" \
        --output none
    print_success "Frontend configured"
}

# Run database migrations
run_migrations() {
    print_header "Running Database Migrations"
    
    print_info "Waiting for backend to start (30 seconds)..."
    sleep 30
    
    print_info "Running migrations..."
    # Note: This requires the app to be running
    if ! az webapp ssh \
        --resource-group "$RESOURCE_GROUP" \
        --name "$BACKEND_APP" \
        --command "cd /app && npx prisma migrate deploy && npx prisma generate && node prisma/seed.js"; then
        print_warning "Could not run migrations automatically."
        echo "You may need to run them manually after the app fully starts:"
        echo "  az webapp ssh --resource-group $RESOURCE_GROUP --name $BACKEND_APP"
        echo "  Then run: cd /app && npx prisma migrate deploy && node prisma/seed.js"
    fi
    
    print_success "Migration step completed"
}

# Display deployment information
show_deployment_info() {
    print_header "Deployment Complete!"
    
    BACKEND_URL="https://$BACKEND_APP.azurewebsites.net"
    FRONTEND_URL="https://$FRONTEND_APP.azurewebsites.net"
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  🎉 Deployment Successful!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Your Teamly app is now live on Azure!"
    echo ""
    echo "📱 Frontend URL: $FRONTEND_URL"
    echo "🔧 Backend API:  $BACKEND_URL/api"
    echo ""
    echo "Resource Group:  $RESOURCE_GROUP"
    echo "Location:        $LOCATION"
    echo ""
    echo -e "${YELLOW}Important: Save these credentials securely!${NC}"
    echo ""
    echo "Container Registry: $ACR_NAME"
    echo "Database Server:    $POSTGRES_SERVER"
    echo "Database Name:      teamly"
    echo "Database User:      teamlyadmin"
    echo "Redis Cache:        $REDIS_NAME"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Visit your frontend URL to test the app"
    echo "2. If migrations didn't run, SSH into the backend:"
    echo "   az webapp ssh --resource-group $RESOURCE_GROUP --name $BACKEND_APP"
    echo "   Then run: npx prisma migrate deploy && node prisma/seed.js"
    echo "3. Configure OAuth if needed (see docs/AZURE_DEPLOYMENT.md)"
    echo "4. Set up GitHub Actions for CI/CD (see docs/AZURE_DEPLOYMENT.md)"
    echo "5. Share your app URL with friends!"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "View backend logs:  az webapp log tail --name $BACKEND_APP --resource-group $RESOURCE_GROUP"
    echo "View frontend logs: az webapp log tail --name $FRONTEND_APP --resource-group $RESOURCE_GROUP"
    echo "Restart backend:    az webapp restart --name $BACKEND_APP --resource-group $RESOURCE_GROUP"
    echo ""
    echo -e "${YELLOW}Estimated monthly cost: ~$30-40 (Basic tier)${NC}"
    echo ""
    echo "Documentation: docs/AZURE_DEPLOYMENT.md"
    echo ""
}

# Main deployment flow
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║                                                      ║"
    echo "║        Teamly Azure Deployment Script               ║"
    echo "║                                                      ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    
    check_prerequisites
    get_configuration
    create_resources
    build_and_push_images
    deploy_containers
    run_migrations
    show_deployment_info
}

# Run main function
main
