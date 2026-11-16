// The two Repwise services as Azure Container Apps. Both scale to zero when idle.
// Deployed by deploy.sh after the images are built; see README.md in this folder.

param prefix string = 'repwise'
param location string = resourceGroup().location
param environmentId string
param identityId string
param registryServer string
param coreApiImage string
param aiServiceImage string

@description('SQLAlchemy URL for the core API database.')
@secure()
param databaseUrl string

@description('Secret for signing access tokens, 32+ characters.')
@secure()
param jwtSecret string

@description('Comma-separated Google OAuth client IDs accepted by the core API.')
param googleClientIds string = ''

var registries = [
  {
    server: registryServer
    identity: identityId
  }
]
var probes = [
  {
    type: 'Liveness'
    httpGet: { path: '/health', port: 8000 }
    periodSeconds: 30
  }
  {
    type: 'Readiness'
    httpGet: { path: '/health', port: 8000 }
    periodSeconds: 10
  }
]

resource coreApi 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-core-api'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identityId}': {} }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
      }
      registries: registries
      secrets: [
        { name: 'database-url', value: databaseUrl }
        { name: 'jwt-secret', value: jwtSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'core-api'
          image: coreApiImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'CORE_API_DATABASE_URL', secretRef: 'database-url' }
            { name: 'CORE_API_JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'CORE_API_GOOGLE_CLIENT_IDS', value: googleClientIds }
          ]
          probes: probes
        }
      ]
      // One replica: migrations run on start, and the rate limit is in memory.
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

resource aiService 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-ai-service'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identityId}': {} }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
      }
      registries: registries
    }
    template: {
      containers: [
        {
          name: 'ai-service'
          image: aiServiceImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AI_SERVICE_MODEL_TIMEOUT_SECONDS', value: '90' }
          ]
          probes: probes
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

output coreApiUrl string = 'https://${coreApi.properties.configuration.ingress.fqdn}'
output aiServiceUrl string = 'https://${aiService.properties.configuration.ingress.fqdn}'
