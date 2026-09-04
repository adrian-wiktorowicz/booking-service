$ErrorActionPreference = "Continue"

Write-Host "Getting Azure Access Token..." -ForegroundColor Yellow
$token = (az account get-access-token --query "accessToken" -o tsv).Trim()
$subId = "6f359a34-a221-4dfe-be03-30e43a8ef32d"
$rg = "rg-journal-playground"
$deploymentName = "postgres-deploy"

$checkUri = "https://management.azure.com/subscriptions/$subId/resourcegroups/$rg/providers/Microsoft.Resources/deployments/$deploymentName`?api-version=2021-04-01"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

Write-Host "Monitoring Azure deployment '$deploymentName'..." -ForegroundColor Cyan

$state = "Running"
while ($state -eq "Accepted" -or $state -eq "Running") {
    Start-Sleep -Seconds 15
    try {
        $check = Invoke-RestMethod -Uri $checkUri -Method Get -Headers $headers -TimeoutSec 30
        $state = $check.properties.provisioningState
        Write-Host "Current Provisioning State: $state ($(Get-Date -Format 'HH:mm:ss'))..." -ForegroundColor Cyan
    } catch {
        Write-Host "Transient connection glitch, retrying in 15s..." -ForegroundColor DarkYellow
    }
}

if ($state -eq "Succeeded") {
    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " Azure PostgreSQL Flexible Server deployed successfully! " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    
    $DbServerName = "psql-journal-9168"
    $DbName = "journaldb"
    $DbAdminUser = "journaladmin"
    $DbAdminPassword = "ChangeMe123!SecurePassword"
    $StorageAccountName = "stjournal3957"
    
    $PostgresHost = "$DbServerName.postgres.database.azure.com"
    $DatabaseUrl = "postgresql://${DbAdminUser}:${DbAdminPassword}@${PostgresHost}:5432/${DbName}?sslmode=require"
    $StorageConnectionString = (az storage account show-connection-string --resource-group $rg --name $StorageAccountName --query connectionString --output tsv)
    
    Write-Host "`nCopy these values into your server/.env file:" -ForegroundColor Yellow
    Write-Host "DATABASE_URL=`"$DatabaseUrl`""
    Write-Host "AZURE_STORAGE_CONNECTION_STRING=`"$StorageConnectionString`""
    Write-Host "AZURE_STORAGE_CONTAINER_NAME=`"journal-photos`""
    Write-Host "PORT=3001"
} else {
    Write-Error "Deployment ended with state: $state."
}
