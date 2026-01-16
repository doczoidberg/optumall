# getMachinesByRegion Endpoint

## Overview
Returns every Google Compute Engine VM in the project and groups the instances by region (with zones nested underneath). Useful for presenting fleet status dashboards or running sanity checks across multiple regions.

## URL
`GET https://us-central1-optum-80593.cloudfunctions.net/getMachinesByRegion`

> Update the base hostname if you deploy to another Firebase project or region.

## Authentication
Authentication is performed via the license key / customerId. This endpoint requires valid customer credentials for access.

## HTTP Methods
- `GET`

## Example Request
```
GET /getMachinesByRegion HTTP/1.1
Host: us-central1-optum-80593.cloudfunctions.net
```

## Success Response
```json
{
  "updatedAt": "2024-06-02T08:45:31.102Z",
  "total": 4,
  "regions": [
    {
      "region": "europe-west1",
      "zones": [
        {
          "zone": "europe-west1-b",
          "machines": [
            {
              "id": "1234567890",
              "name": "vm-europe-1",
              "status": "RUNNING",
              "zone": "europe-west1-b",
              "region": "europe-west1",
              "machineType": "n2-standard-4",
              "creationTimestamp": "2024-05-30T11:02:05.000-07:00",
              "internalIp": "10.40.0.2",
              "externalIp": "34.118.207.10",
              "labels": {
                "env": "prod"
              },
              "tags": [
                "http-server"
              ],
              "serviceAccounts": [
                {
                  "email": "1234567890-compute@developer.gserviceaccount.com",
                  "scopes": [
                    "https://www.googleapis.com/auth/cloud-platform"
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Error Responses
| Status | When | Payload |
|--------|------|---------|
| 500 | Underlying Compute API call fails | `{ "error": "Failed to load machines by region" }` |

## Notes
- Instances are grouped by region (derived from the zone name) and then by zone. Empty regions are omitted.
- Machine summaries expose basic networking, machine type, label, and service account information. Extend the Cloud Function if additional metadata is required.
- Results include `total` for quick sanity checks. Use the `updatedAt` timestamp to display the last refresh time in UI dashboards.

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

void listMachinesByRegion() {
    const std::string url = "https://us-central1-optum-80593.cloudfunctions.net/getMachinesByRegion";

    CURL* curl = curl_easy_init();
    if (!curl) {
        std::cerr << "Failed to initialize CURL" << std::endl;
        return;
    }

    std::string responseStr;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseStr);

    CURLcode res = curl_easy_perform(curl);
    if (res == CURLE_OK) {
        json response = json::parse(responseStr);
        for (const auto& region : response["regions"]) {
            std::cout << region["region"] << std::endl;
            for (const auto& zone : region["zones"]) {
                std::cout << "  - " << zone["zone"] << ": " << zone["machines"].size() << " machines" << std::endl;
            }
        }
    } else {
        std::cerr << "Request failed: " << curl_easy_strerror(res) << std::endl;
    }

    curl_easy_cleanup(curl);
}
```
