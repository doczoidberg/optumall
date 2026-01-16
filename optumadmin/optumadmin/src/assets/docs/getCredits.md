# getCredits Endpoint

## Overview
Returns the token allocation for a given customer, including the total tokens, tokens consumed, and the computed balance. Useful for external systems that need to enforce spending limits or display account status.

## URL
`GET https://us-central1-optum-80593.cloudfunctions.net/getCredits`

> Update the base hostname if you deploy to a different Firebase project or region.

## Authentication
Authentication is performed via the license key / customerId. Each request must include a valid customerId that corresponds to an active customer account in the system.

## HTTP Methods
- `GET` (preferred)
- `POST` (supported for legacy callers; accepts JSON body containing `customer`)

## Parameters

| Parameter | Location | Required | Description |
|-----------|----------|----------|-------------|
| `customer` | query/body | ✅ | Firestore document ID in `customers/{customerId}`. |

## Example Request
```
GET /getCredits?customer=T22VDtiCN81Ryjvawibt HTTP/1.1
Host: us-central1-optum-80593.cloudfunctions.net
```

## Success Response
```json
{
  "customer": "T22VDtiCN81Ryjvawibt",
  "tokens": 1200,
  "tokensUsed": 450.5,
  "balance": 749.5,
  "credits": 1200,
  "creditsUsed": 450.5
}
```

Values are numbers; missing fields on the Firestore document default to `0`.

## Error Responses
| Status | When | Payload |
|--------|------|---------|
| 400 | `customer` parameter missing | `{ "error": "customer is required" }` |
| 404 | Customer document not found | `{ "error": "Customer not found" }` |
| 405 | HTTP verb other than GET/POST | `{ "error": "Method not allowed" }` |
| 500 | Firestore read failure | `{ "error": "Failed to load tokens" }` |

## Notes
- The endpoint performs no rate limiting. Add middleware or Cloud Armor policies if you need throttling.
- Balance is computed as `tokens - tokensUsed`. The response also includes the legacy `credits`/`creditsUsed` fields for backwards compatibility.

## C++ Example
```cpp
#include <iostream>
#include <string>
#include <iomanip>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp) {
    userp->append((char*)contents, size * nmemb);
    return size * nmemb;
}

std::string urlEncode(const std::string& value) {
    CURL* curl = curl_easy_init();
    char* encoded = curl_easy_escape(curl, value.c_str(), value.length());
    std::string result(encoded);
    curl_free(encoded);
    curl_easy_cleanup(curl);
    return result;
}

void getTokens(const std::string& customerId) {
    std::string url = "https://us-central1-optum-80593.cloudfunctions.net/getCredits?customer=" + urlEncode(customerId);

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
        double balance = response["balance"];
        std::cout << "Balance: " << std::fixed << std::setprecision(2) << balance << std::endl;
    }

    curl_easy_cleanup(curl);
}
```
