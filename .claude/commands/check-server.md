# Check Railway Server Status

Check the deployment status of frontend and backend services on Railway.

## Instructions

1. Read the Railway API token from `.claude/secrets/railway-token`
2. Query deployment status for both services using the Railway GraphQL API
3. Report the status of each service (SUCCESS, FAILED, BUILDING, etc.)
4. If any deployment is FAILED, get the build logs and analyze the error
5. Provide a summary of what actions may be needed

## Railway API Details

**Endpoint:** `https://backboard.railway.app/graphql/v2`

**Project IDs:**
- Project: `17d4bdea-5e9c-4823-8257-23f222974ab5`
- Environment: `44b97ab6-0ba3-42e8-b660-05645d25f345`
- Backend: `d0f3e879-7705-4c51-925a-7177bfe308ec`
- Frontend: `e4fb83bf-2b2c-4b89-9c77-895f7603a518`

**Query for status:**
```graphql
query {
  backendDep: deployments(first: 1, input: { serviceId: "d0f3e879-7705-4c51-925a-7177bfe308ec" }) {
    edges { node { id status createdAt } }
  }
  frontendDep: deployments(first: 1, input: { serviceId: "e4fb83bf-2b2c-4b89-9c77-895f7603a518" }) {
    edges { node { id status createdAt } }
  }
}
```

**Query for build logs (if FAILED):**
```graphql
query { buildLogs(deploymentId: "DEPLOYMENT_ID", limit: 50) { message } }
```

## Expected Output

Report format:
```
Railway Deployment Status:
- Backend: [STATUS] (deployed: [TIMESTAMP])
- Frontend: [STATUS] (deployed: [TIMESTAMP])

[If any failures, include error analysis and suggested fixes]
```
