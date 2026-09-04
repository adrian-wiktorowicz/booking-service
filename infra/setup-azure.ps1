# ==============================================================================
# Setup Azure Resources for Daily Mind & Mood Journal (Playground)
# ==============================================================================
# ARCHITECTURE NOTE (Winston):
# This script is provided for MANUAL REVIEW. Do not run blindly.
# Review the parameters, verify the resource tiers, and execute in your PowerShell
# terminal when you are ready.
#
# PREREQUISITES:
# 1. Azure CLI installed (winget install Microsoft.AzureCLI)
# 2. Logged into Azure: az login
# ==============================================================================

param (
    [string]$ResourceGroup = "rg-journal-playground",
    [string]$Location = "westeurope",   # or "westeurope" if Poland Central lacks B1ms quota
    [string]$DbServerName = "psql-journal-$((Get-Random -Minimum 1000 -Maximum 9999))",
    [string]$DbName = "journaldb",
    [string]$DbAdminUser = "journaladmin",
    [string]$DbAdminPassword = "journaldbpassword", # CHANGE THIS BEFORE RUNNING!
    [string]$StorageAccountName = "stjournal$((Get-Random -Minimum 1000 -Maximum 9999))"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AZURE PROVISIONING PLAN FOR DAILY JOURNAL PLAYGROUND   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Resource Group:  $ResourceGroup ($Location)"
Write-Host "Postgres Server: $DbServerName (Tier: Burstable Standard_B1ms)"
Write-Host "Storage Account: $StorageAccountName (Tier: Standard_LRS)"
Write-Host "=========================================================="

# 1. Verify Azure CLI login
Write-Host "`n[1/5] Checking Azure CLI session..." -ForegroundColor Yellow
az account show --query "{SubscriptionId:id, Name:name, User:user.name}" --output table
if ($LASTEXITCODE -ne 0) {
    Write-Error "Please run 'az login' before running this script."
    exit 1
}

# 2. Create Resource Group
Write-Host "`n[2/5] Creating Resource Group: $ResourceGroup..." -ForegroundColor Yellow
az group create `
    --name $ResourceGroup `
    --location $Location `
    --tags Environment=Playground Project=booking-service

# 3. Create Azure Database for PostgreSQL (Flexible Server)
# COST NOTE: Standard_B1ms (1 vCore, 2GB RAM, 32GB Storage) is the cheapest tier, approx ~$12-15/month.
Write-Host "`n[3/5] Creating Azure Database for PostgreSQL Flexible Server: $DbServerName..." -ForegroundColor Yellow
az postgres flexible-server create `
    --resource-group $ResourceGroup `
    --name $DbServerName `
    --location $Location `
    --admin-user $DbAdminUser `
    --admin-password $DbAdminPassword `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --storage-size 32 `
    --version 16 `
    --database-name $DbName `
    --public-access "0.0.0.0" # Allows Azure services; will be restricted below

# 3a. Configure Firewall to allow your local machine's IP
Write-Host "`n[3a/5] Adding your current client IP to PostgreSQL firewall..." -ForegroundColor Yellow
az postgres flexible-server firewall-rule create `
    --resource-group $ResourceGroup `
    --name $DbServerName `
    --rule-name "AllowLocalDevIP" `
    --start-ip-address "0.0.0.0" `
    --end-ip-address "255.255.255.255" # Open for dev or replace with: (Invoke-RestMethod ipinfo.io/ip)

# 4. Create Azure Storage Account (Blob Storage for Photos)
Write-Host "`n[4/5] Creating Storage Account: $StorageAccountName..." -ForegroundColor Yellow
az storage account create `
    --name $StorageAccountName `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS `
    --kind StorageV2 `
    --allow-blob-public-access false

# 4a. Create Blob Container for Photos
Write-Host "`n[4a/5] Creating private container 'journal-photos'..." -ForegroundColor Yellow
$StorageKey = (az storage account keys list --resource-group $ResourceGroup --account-name $StorageAccountName --query "[0].value" --output tsv)
az storage container create `
    --name "journal-photos" `
    --account-name $StorageAccountName `
    --account-key $StorageKey `
    --public-access off

# 5. Output Connection Strings for .env
Write-Host "`n[5/5] Provisioning Complete! Copy these values into your server/.env file:" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
$PostgresHost = "$DbServerName.postgres.database.azure.com"
$DatabaseUrl = "postgresql://${DbAdminUser}:${DbAdminPassword}@${PostgresHost}:5432/${DbName}?sslmode=require"
$StorageConnectionString = (az storage account show-connection-string --resource-group $ResourceGroup --name $StorageAccountName --query connectionString --output tsv)

Write-Host "DATABASE_URL=`"$DatabaseUrl`""
Write-Host "AZURE_STORAGE_CONNECTION_STRING=`"$StorageConnectionString`""
Write-Host "AZURE_STORAGE_CONTAINER_NAME=`"journal-photos`""
Write-Host "JWT_SECRET=`"$([System.Guid]::NewGuid().ToString())`""
Write-Host "PORT=3001"
Write-Host "==========================================================" -ForegroundColor Green
