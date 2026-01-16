# uploadFile Endpoint

## Overview
Uploads binary assets (mesh files, CAD exports, project bundles, etc.) to Cloud Storage and associates the file with a customer and project. Invoke this endpoint before calling `createCompute`, then reference the returned `gs://` path in the `projectFile` and/or `meshFile` fields.

## URL
`POST https://us-central1-optum-80593.cloudfunctions.net/uploadFile`

> Replace the hostname if your Firebase Functions run in another region/project.

## Authentication
No authentication is enforced by default. Restrict the endpoint via IAM, HTTPS rewrites, or signed JWT verification before exposing it publicly.

## Request Body
Send JSON with a base64-encoded payload.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer` | string | ✅ | Customer ID in Firestore (`customers/{customerId}`). |
| `project` | string | ✅ | Project identifier used when organizing files in Cloud Storage. |
| `file` | string | ✅ | Base64 string representing the file contents. Data URLs such as `data:application/octet-stream;base64,...` are also accepted. |
| `filename` | string | ❌ | Human-friendly file name. Illegal characters are replaced automatically. Defaults to `upload-{timestamp}.bin`. |
| `contentType` | string | ❌ | MIME type (e.g., `application/octet-stream`). Defaults to `application/octet-stream`. |

## Example Request
```http
POST /uploadFile HTTP/1.1
Host: us-central1-optum-80593.cloudfunctions.net
Content-Type: application/json

{
  "customer": "T22VDtiCN81Ryjvawibt",
  "project": "wing42",
  "filename": "wing.mesh",
  "contentType": "application/octet-stream",
  "file": "ZGVmYXVsdCBrbm90dGluZyBtZXNoIGZpbGUgY29udGVudA=="
}
```

## Success Response
```json
{
  "fileId": "zJ9yP5FzF4aLZ6w6D5KX",
  "customerId": "T22VDtiCN81Ryjvawibt",
  "projectId": "wing42",
  "filename": "wing.mesh",
  "storagePath": "gs://optum-80593.appspot.com/projects/wing42/T22VDtiCN81Ryjvawibt/1730408123456-wing.mesh",
  "objectPath": "projects/wing42/T22VDtiCN81Ryjvawibt/1730408123456-wing.mesh",
  "contentType": "application/octet-stream",
  "size": 34,
  "uploadedAt": 1730408123456
}
```

## Error Responses
| Status | When | Payload |
|--------|------|---------|
| 400 | Missing `customer`, `project`, or `file` | `{ "error": "customer and project are required" }` or `{ "error": "file must be a base64 string" }` |
| 400 | Base64 decode fails | `{ "error": "file could not be decoded" }` |
| 405 | Method other than POST | `{ "error": "Method not allowed" }` |
| 500 | Storage write failure | `{ "error": "Failed to upload file" }` |
| 500 | Firestore metadata write failure | `{ "error": "Failed to record file metadata" }` |

## C++ Example
```cpp
#include <iostream>
#include <string>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Implement base64Encode with your preferred helper (OpenSSL, libb64, etc.).
std::string base64Encode(const std::string& data);

void uploadMesh(const std::string& customerId, const std::string& projectId, const std::string& meshData) {
    CURL* curl = curl_easy_init();
    if (!curl) {
        std::cerr << "Failed to initialize CURL" << std::endl;
        return;
    }

    json payload = {
        {"customer", customerId},
        {"project", projectId},
        {"filename", "wing.mesh"},
        {"contentType", "application/octet-stream"},
        {"file", base64Encode(meshData)}
    };

    std::string jsonStr = payload.dump();
    std::string responseStr;

    curl_easy_setopt(curl, CURLOPT_URL, "https://us-central1-optum-80593.cloudfunctions.net/uploadFile");
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonStr.c_str());

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, +[](void* contents, size_t size, size_t nmemb, std::string* out) {
        out->append(static_cast<char*>(contents), size * nmemb);
        return size * nmemb;
    });
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseStr);

    CURLcode res = curl_easy_perform(curl);
    if (res == CURLE_OK) {
        json response = json::parse(responseStr);
        std::cout << "Uploaded mesh to " << response["storagePath"] << std::endl;
    } else {
        std::cerr << "Upload failed: " << curl_easy_strerror(res) << std::endl;
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
}
```

## Notes
- Files are stored in Cloud Storage under `projects/{projectId}/{customerId}/...`. Use the returned `storagePath` as the `projectFile` (for bundles) and/or `meshFile` when calling `createCompute`.
- Metadata is mirrored into the `projectFiles` collection for auditing and UI surfacing.
- Maximum payload size is capped by Cloud Functions HTTP limits (default 32 MB). Split very large assets into multiple uploads if necessary.
- Recommended workflow: upload project bundle and meshes first, capture their `storagePath` values, then invoke `createCompute` with those URLs.
