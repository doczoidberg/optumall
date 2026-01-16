# getSimulationResults Endpoint

## Overview
Returns the Cloud Storage link for the simulation output produced by the calculation kernel. Call this after `getComputeState` reports `state: "completed"` to retrieve the generated result artifact.

## URL
`GET https://us-central1-optum-80593.cloudfunctions.net/getSimulationResults`

> Update the hostname if your Firebase Functions run in another project or region.

## Authentication
No authentication is enforced by default. Protect the endpoint with IAM, signed JWT verification, or HTTPS rewrites before exposing it publicly.

## Parameters
Parameters may be supplied via query string (`GET`) or JSON body (`POST`).

| Parameter | Location | Required | Description |
|-----------|----------|----------|-------------|
| `computid` | query/body | ✅ | Google Compute Engine numeric ID returned as `computeId` from `createCompute`. Alias `computeId` is also accepted. |

## Behaviour
1. Looks up the `machines` document where `gceId == computid`.
2. Reads the `resultFilePath` field populated by the calculation kernel after it uploads results to Cloud Storage.
3. Generates a one-hour signed download URL for the underlying object and returns both the raw `gs://` reference and the temporary HTTPS link.

If the result file is not yet available (e.g., the kernel has not finished uploading), the endpoint responds with HTTP `404`.

## Example Request
```
GET /getSimulationResults?computid=5224090039679406817 HTTP/1.1
Host: us-central1-optum-80593.cloudfunctions.net
```

### Sample Response
```json
{
  "computeId": "5224090039679406817",
  "machineName": "vm-cust-t22vdticn81-ll2raa",
  "state": "completed",
  "resultFilePath": "gs://optum-80593.appspot.com/results/wing42/run-2024-11-04/output.zip",
  "downloadUrl": "https://storage.googleapis.com/optum-80593.appspot.com/results/...&Expires=1730740954&Signature=...",
  "downloadUrlExpiresAt": "2024-11-04T14:42:34.000Z"
}
```

## Error Responses
| Status | When | Payload |
|--------|------|---------|
| 400 | `computid` missing or blank | `{ "error": "computid is required" }` |
| 404 | No machine matches the ID or no result file is recorded | `{ "error": "Result file not available" }` |
| 405 | HTTP verb other than GET/POST | `{ "error": "Method not allowed" }` |
| 500 | Firestore lookup or signed URL generation fails | `{ "error": "Failed to load simulation results" }` |

## Notes
- The endpoint returns a signed URL valid for one hour. Re-invoke the endpoint if the URL expires before the desktop client downloads the file.
- The calculation kernel is responsible for uploading the result archive to Cloud Storage and updating the VM document’s `resultFilePath`. Without that field, the endpoint cannot produce a download link.
