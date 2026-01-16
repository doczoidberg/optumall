# createCompute Endpoint

## Overview
Creates a new Google Compute Engine virtual machine that is associated with a customer record and tracked inside Firestore. The function validates the request, provisions the VM, and updates the `machines/{vmName}` document with the initial lifecycle metadata. The legacy `createVM` endpoint remains available as an alias for backward compatibility.

## URL
`POST https://us-central1-optum-80593.cloudfunctions.net/createCompute`

> Replace the base URL with the deployed Firebase Functions domain for non-production projects.

## Authentication
No authentication is enforced by default. Restrict the endpoint with IAM, HTTPS rewrites, or signed JWT verification before exposing it publicly.

## Request Body
Send JSON in the request body.

| Field        | Type     | Required | Description |
|--------------|----------|----------|-------------|
| `customer`   | string   | ✅       | Firestore document ID in `customers/{customerId}`. |
| `type`       | string   | ✅       | Machine profile label. Accepts `fast`, `very fast`, or `fastest`. Legacy GCE type names still resolve to `machinetypes` when supplied directly. |
| `projectFile` | string | ✅ | `gs://` path returned by `uploadFile` containing the project definition bundle. |
| `projectJson` | object / string | ❌ | Optional inline JSON definition. When supplied, it is stored alongside the VM and truncated into metadata. |
| `meshFile`   | string   | ✅       | `gs://` path returned by `uploadFile`. Points at the mesh / geometry file to mount on the VM. |
| `jobId`      | string   | ❌       | Optional job identifier stored on the machine document. |
| `clusterId`  | string   | ❌       | Optional cluster identifier stored on the machine document. |
| `metadata`   | object   | ❌       | Arbitrary JSON metadata that is captured as `requestMetadata` on the machine document. |

### Validation Rules
- `customer` must reference an existing customer document; the call returns 404 if not found.
- `type` must resolve to a `machinetypes` document whose `enabled` flag is not `false`.
- `projectFile` must reference an existing object in Cloud Storage (path must start with `gs://`). Upload the project bundle via `uploadFile`.
- `projectJson`, when provided, must contain valid JSON (object or JSON string) describing the workload. It is optional but useful for quick previewing in the admin UI.
- `meshFile` must reference an existing object in Cloud Storage (path must start with `gs://`). Use `uploadFile` to create the file and capture its `gs://` path.
- Machine type defaults (image, disk, subnet, service account scopes) are centrally defined in `functions/index.js`. Override there if necessary.

### Workflow
1. **Upload artifacts first.** Call `uploadFile` for the project bundle and for each mesh / supporting asset. The endpoint responds with `storagePath` values ( `gs://...` ).
2. **Create the compute job.** Pass the returned `storagePath` for the project bundle as `projectFile`, and the mesh `storagePath` as `meshFile`, together with the remaining payload described below.

### Project JSON
The project definition must capture everything the workload needs (simulation constants, environment settings, solver options, etc.). The API stores the JSON alongside the machine record and injects a trimmed version into the VM metadata.

Upload large mesh / binary inputs and the project bundle itself with `uploadFile` (see dedicated doc) and pass back the returned `projectFile` / `meshFile` paths when creating the compute job.

## Machine Type Profiles

| Friendly label | Backing GCE type | vCPUs | Memory (GB) | Notes |
|----------------|------------------|-------|-------------|-------|
| `fast` | `n2d-standard-4` | 4 | 16 | Balanced option for most single-tenant jobs. |
| `very fast` | `n2d-standard-8` | 8 | 32 | Doubles the CPU/memory footprint for heavier workloads. |
| `fastest` | `n2d-standard-16` | 16 | 64 | Highest performance of the catalog; use for parallel or memory-bound tasks. |

## Example Request
```http
POST /createCompute HTTP/1.1
Host: us-central1-optum-80593.cloudfunctions.net
Content-Type: application/json

{
  "customer": "T22VDtiCN81Ryjvawibt",
  "type": "fast",
  "projectFile": "gs://optum-80593.appspot.com/projects/wing42/T22VDtiCN81Ryjvawibt/1730408123400-project.zip",
  "projectJson": {
    "name": "wing-sim-42",
    "solver": "optumCFD",
    "timesteps": 2500
  },
  "meshFile": "gs://optum-80593.appspot.com/projects/wing42/T22VDtiCN81Ryjvawibt/1730408123456-wing.mesh",
  "jobId": "job-1234",
  "clusterId": "cluster-alpha",
  "metadata": {
    "requestedBy": "external-service",
    "ticket": "INC-42"
  }
}
```

## Success Response
```json
{
  "vmName": "vm-t22vdticn81ryjvawibt-ll2raa4d3d",
  "computeId": "1234567890123456789",
  "state": "booting"
}
```

The VM document `machines/{vmName}` is created in Firestore with state `booting` once provisioning succeeds. When you pass a friendly label, the document keeps both `requestedType` (e.g., `fast`) and `resolvedMachineType` (e.g., `n2d-standard-4`). If Compute Engine returns an error, the document is updated to `state: "error"` and the HTTP response is `500`.

## C++ Example
```cpp
#include <iostream>
#include <string>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp) {
    userp->append((char*)contents, size * nmemb);
    return size * nmemb;
}

void createCompute() {
    CURL* curl = curl_easy_init();
    if (!curl) {
        std::cerr << "Failed to initialize CURL" << std::endl;
        return;
    }

    json payload = {
        {"customer", "T22VDtiCN81Ryjvawibt"},
        {"type", "fast"},
        {"projectFile", "gs://optum-80593.appspot.com/projects/wing42/T22VDtiCN81Ryjvawibt/1730408123400-project.zip"},
        {"projectJson", {
            {"name", "wing-sim-42"},
            {"solver", "optumCFD"},
            {"timesteps", 2500}
        }},
        {"meshFile", "gs://optum-80593.appspot.com/projects/wing42/T22VDtiCN81Ryjvawibt/1730408123456-wing.mesh"},
        {"jobId", "job-1234"},
        {"clusterId", "cluster-alpha"},
        {"metadata", {
            {"requestedBy", "external-service"}
        }}
    };

    std::string jsonStr = payload.dump();
    std::string responseStr;

    curl_easy_setopt(curl, CURLOPT_URL, "https://us-central1-optum-80593.cloudfunctions.net/createCompute");
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonStr.c_str());

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseStr);

    CURLcode res = curl_easy_perform(curl);
    if (res == CURLE_OK) {
        json response = json::parse(responseStr);
        std::cout << "Compute " << response["vmName"] << " is " << response["state"] << std::endl;
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
}
```

## Error Responses
| Status | When | Payload |
|--------|------|---------|
| 400 | Missing `customer` or `type`, or machine type disabled | `{ "error": "customer and type are required" }` or `{ "error": "Machine type disabled" }` |
| 404 | Customer or machine type not found | `{ "error": "Customer not found" }` |
| 405 | HTTP method is not POST | `{ "error": "Method not allowed" }` |
| 500 | GCE provisioning failure or unexpected errors | `{ "error": "Failed to create VM" }` |

## Side Effects
- Logs an entry into `logs` with the message `external createVM` (legacy message retained for monitoring consistency).
- Creates or updates the Firestore document at `machines/{vmName}`.
- Requests a new instance in the Compute Engine zone specified by `zonename`.
- Stores `projectFilePath`, `meshFilePath`, and optional `projectDefinition` alongside the VM document for downstream processing.
- The calculation kernel updates the machine document with `resultFilePath` once it uploads output artifacts; `getSimulationResults` relies on that field.

## Related Endpoints
- `uploadFile` – upload mesh/geometry artifacts and obtain the `gs://` path required by the `projectFile` / `meshFile` parameters.
- `getSimulationResults` – fetch the signed download link for the output archive after the kernel finishes.
