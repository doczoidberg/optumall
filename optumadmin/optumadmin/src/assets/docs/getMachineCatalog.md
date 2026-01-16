# getMachineCatalog Endpoint

## Overview
Fetches every Compute Engine machine type available to the current project and groups them by region and zone. Use this endpoint to populate catalog pickers or to compare CPU/RAM profiles across regions.

## URL
`GET https://us-central1-optum-80593.cloudfunctions.net/getMachineCatalog`

Update the hostname if you deploy to a different Firebase project or region.

## Authentication
Authentication is performed via the license key / customerId. This endpoint requires valid customer credentials for access.

## HTTP Methods
- `GET`

## Example Request
```
GET /getMachineCatalog HTTP/1.1
Host: us-central1-optum-80593.cloudfunctions.net
```

## Success Response
```json
{
  "updatedAt": "2024-06-02T09:40:12.203Z",
  "priceReleaseDate": "2024-05-31T18:15:00Z",
  "total": 186,
  "regions": [
    {
      "region": "europe-west1",
      "zones": [
        {
          "zone": "europe-west1-b",
          "machineTypes": [
            {
              "name": "e2-micro",
              "description": "E2 shared-core, 0.25 vCPU, 1 GB RAM",
              "guestCpus": 0.25,
              "memoryMb": 1024,
              "memoryGb": 1,
              "maximumPersistentDisks": 16,
              "maximumPersistentDisksSizeGb": "6144",
              "deprecated": null,
              "zone": "europe-west1-b",
              "region": "europe-west1",
              "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-micro",
              "pricePerHourUsd": 0.0076,
              "pricePerMonthUsd": 5.47,
              "priceSource": "cpu:services/6F81-5844-456A/skus/0004-0D61-2F9B;ram:services/6F81-5844-456A/skus/000C-1234-ABCD"
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
| 500 | Unable to read the machine catalog from the Compute Engine API | `{ "error": "Failed to load machine catalog" }` |

## Notes
- Results are split by region and then zone. Zones that do not expose machine types are omitted.
- `total` counts every machine type entry. Use `machineTypes[].deprecated` to filter out retired SKUs.
- Memory is provided in both megabytes and gigabytes for convenience.
- Pricing comes from the Cloud Billing catalog's on-demand CPU and RAM SKUs for each machine family; `priceSource` lists the SKU identifiers applied, and `pricePerMonthUsd` assumes 720 billable hours.

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

void fetchMachineCatalog() {
    const std::string url = "https://us-central1-optum-80593.cloudfunctions.net/getMachineCatalog";

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
        std::cout << "Catalog contains " << response["total"] << " machine types" << std::endl;
        for (const auto& region : response["regions"]) {
            std::cout << region["region"] << ": " << region["zones"].size() << " zones" << std::endl;
        }
    } else {
        std::cerr << "Request failed: " << curl_easy_strerror(res) << std::endl;
    }

    curl_easy_cleanup(curl);
}
```
