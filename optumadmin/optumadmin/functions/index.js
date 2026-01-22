const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require('googleapis');
const fetch = require('node-fetch');
const Stripe = require("stripe");

admin.initializeApp(functions.config().firebase);

var zonename = "us-central1-a"

const projectId = admin.app().options.projectId || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "optum-80593";
const region = zonename.includes("-") ? zonename.substring(0, zonename.lastIndexOf("-")) : zonename;
const DEFAULT_IMAGE = "https://www.googleapis.com/compute/beta/projects/optum-80593/global/images/optumimg6";
const DEFAULT_DISK_TYPE = `projects/${projectId}/zones/${zonename}/diskTypes/pd-balanced`;
const DEFAULT_SUBNETWORK = `projects/${projectId}/regions/${region}/subnetworks/subnet-${region}`;
const DEFAULT_SERVICE_ACCOUNT = "158487002656-compute@developer.gserviceaccount.com";
const DEFAULT_SCOPES = [
    "https://www.googleapis.com/auth/devstorage.read_only",
    "https://www.googleapis.com/auth/logging.write",
    "https://www.googleapis.com/auth/monitoring.write",
    "https://www.googleapis.com/auth/servicecontrol",
    "https://www.googleapis.com/auth/service.management.readonly",
    "https://www.googleapis.com/auth/trace.append"
];

const FRIENDLY_MACHINE_TYPE_ALIASES = {
    "fast": "n2d-standard-4",
    "very fast": "n2d-standard-8",
    "fastest": "n2d-standard-16"
};

const Compute = require('@google-cloud/compute');
const compute = new Compute();
const zone = compute.zone(zonename);

const cors = require("cors")({
    origin: true
});

const stripeConfig = functions.config().stripe || {};
const stripeSecretKey = stripeConfig.secret_key || process.env.STRIPE_SECRET_KEY;
let stripe;
if (stripeSecretKey) {
    stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16"
    });
} else {
    functions.logger.warn("Stripe secret key is not configured. Stripe payment endpoints are disabled.");
}

// License Management API configuration for credit tracking
const licenseApiConfig = functions.config().licenseapi || {};
const LICENSE_API_URL = licenseApiConfig.url || process.env.LICENSE_API_URL || 'http://localhost:8000/api/optumadmin';
const LICENSE_API_KEY = licenseApiConfig.key || process.env.LICENSE_API_KEY || 'your-secret-api-key-change-this-in-production';

/**
 * Report VM usage to the License Management API for credit deduction
 */
async function reportVMUsageToLicenseAPI(accountId, creditsUsed, vmId, vmName, machineType, runtimeMinutes, zone) {
    try {
        const response = await fetch(`${LICENSE_API_URL}/vm/usage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': LICENSE_API_KEY
            },
            body: JSON.stringify({
                account_id: accountId,
                credits_used: creditsUsed,
                vm_id: vmId,
                vm_name: vmName,
                machine_type: machineType,
                runtime_minutes: runtimeMinutes,
                zone: zone
            })
        });
        const result = await response.json();
        functions.logger.info('License API usage report', { accountId, creditsUsed, result });
        return result;
    } catch (error) {
        functions.logger.error('Failed to report usage to License API', { error: error.message, accountId, creditsUsed });
        return { success: false, error: error.message };
    }
}

/**
 * Check if account has sufficient credits to start a VM
 */
async function checkCreditsForVM(accountId, minimumCredits = 1) {
    try {
        const response = await fetch(`${LICENSE_API_URL}/vm/check-credits/${accountId}?minimum_credits=${minimumCredits}`, {
            method: 'GET',
            headers: {
                'X-Api-Key': LICENSE_API_KEY
            }
        });
        const result = await response.json();
        return result;
    } catch (error) {
        functions.logger.error('Failed to check credits', { error: error.message, accountId });
        return { success: false, data: { can_start: true, message: 'Credit check failed, allowing by default' } };
    }
}

const paymentPackages = {
    basic: {
        id: "basic",
        name: "Token Package S",
        tokens: 500,
        price: 100,
        description: "500 tokens for running Optum AI workloads"
    },
    standard: {
        id: "standard",
        name: "Token Package M",
        tokens: 3000,
        price: 500,
        description: "3000 tokens for running Optum AI workloads"
    },
    premium: {
        id: "premium",
        name: "Token Package XL",
        tokens: 20000,
        price: 2500,
        description: "20000 tokens for running Optum AI workloads"
    }
};

const MACHINE_CATALOG_CACHE_TTL_MS = 15 * 60 * 1000;
let machineCatalogCache = {
    payload: null,
    fetchedAt: 0
};

async function resolveAuthToken(request) {
    const authHeader = request.headers.authorization || request.headers.Authorization;
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        return decoded;
    } catch (error) {
        functions.logger.warn("resolveAuthToken failed", { error });
        return null;
    }
}

async function enforceAdminAccess(decodedToken) {
    if (!decodedToken || !decodedToken.email) {
        return false;
    }
    const email = String(decodedToken.email).toLowerCase();
    const adminDoc = await admin.firestore().doc(`adminUsers/${email}`).get();
    const role = adminDoc.exists ? adminDoc.data().role : null;
    return role === "admin";
}

const stripeRuntimeOptions = {
    memory: "256MB",
    timeoutSeconds: 60
};

function resolveRequestBody(request) {
    if (!request.body) {
        return {};
    }
    if (typeof request.body === "string") {
        try {
            return JSON.parse(request.body);
        } catch (err) {
            functions.logger.warn("Unable to parse string request body", err);
            return {};
        }
    }
    return request.body;
}

function ensureSessionIdUrl(url) {
    if (!url) {
        return null;
    }
    return url.includes("{CHECKOUT_SESSION_ID}") ? url : `${url}${url.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}

function renderHtmlResponse(title, message, accentClass) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            text-align: center;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: ${accentClass === "success" ? "#2ecc71" : "#e74c3c"};
        }
        .btn {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/" class="btn">Return to Home</a>
    </div>
</body>
</html>
    `;
}

const stripeRegion = stripeConfig.region || "us-central1";

exports.createCheckoutSession = functions
    .region(stripeRegion)
    .runWith(stripeRuntimeOptions)
    .https.onRequest((request, response) => {
        cors(request, response, async () => {
            if (request.method !== "POST") {
                response.status(405).json({ error: "Method not allowed" });
                return;
            }
            if (!stripe) {
                response.status(500).json({ error: "Stripe is not configured" });
                return;
            }

            const body = resolveRequestBody(request);
            const packageId = body.packageId;
            const customerId = body.customerId || body.userId;
            const providedSuccessUrl = body.successUrl || stripeConfig.success_url;
            const providedCancelUrl = body.cancelUrl || stripeConfig.cancel_url || (request.headers.origin ? `${request.headers.origin}/tokens` : null);

            if (!packageId || !customerId) {
                response.status(400).json({ error: "Missing required parameters" });
                return;
            }

            const selectedPackage = paymentPackages[packageId];
            if (!selectedPackage) {
                response.status(400).json({ error: "Invalid package selected" });
                return;
            }

            const successUrl = ensureSessionIdUrl(providedSuccessUrl);
            const cancelUrl = providedCancelUrl || "/";

            if (!successUrl) {
                response.status(400).json({ error: "Missing success URL for checkout session" });
                return;
            }

            const unitAmount = Math.round(Number(selectedPackage.price) * 100);

            try {
                functions.logger.info("Creating Stripe checkout session", {
                    customerId,
                    packageId,
                    successUrl,
                    cancelUrl
                });

                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ["card"],
                    line_items: [
                        {
                            price_data: {
                                currency: "eur",
                                product_data: {
                                    name: selectedPackage.name,
                                    description: selectedPackage.description
                                },
                                unit_amount: unitAmount
                            },
                            quantity: 1
                        }
                    ],
                    mode: "payment",
                    success_url: successUrl,
                    cancel_url: cancelUrl,
                    metadata: {
                        customerId,
                        packageId,
                        tokens: String(selectedPackage.tokens)
                    }
                });

                functions.logger.info("Checkout session created", {
                    sessionId: session.id,
                    customerId,
                    packageId
                });

                response.json({
                    sessionId: session.id,
                    url: session.url
                });
            } catch (error) {
                functions.logger.error("Error creating checkout session", error);
                response.status(500).json({ error: "Failed to create checkout session" });
            }
        });
    });

exports.paymentSuccess = functions
    .region(stripeRegion)
    .runWith(stripeRuntimeOptions)
    .https.onRequest((request, response) => {
        cors(request, response, async () => {
            if (!stripe) {
                response.status(500).send(renderHtmlResponse("Payment Error", "Stripe is not configured.", "error"));
                return;
            }

            const body = resolveRequestBody(request);
            const sessionId = body.session_id || request.query.session_id;

            if (!sessionId) {
                functions.logger.warn("Missing session ID in payment success request");
                response.status(400).send(renderHtmlResponse("Payment Error", "We could not process your payment because the session ID is missing.", "error"));
                return;
            }

            try {
                functions.logger.info("Retrieving Stripe session", { sessionId });
                const session = await stripe.checkout.sessions.retrieve(String(sessionId));

                if (session.payment_status !== "paid") {
                    functions.logger.warn("Payment not completed", {
                        sessionId,
                        paymentStatus: session.payment_status
                    });
                    response.status(400).send(renderHtmlResponse("Payment Not Completed", "Your payment has not been completed. Please try again.", "error"));
                    return;
                }

                const metadata = session.metadata || {};
                const customerId = metadata.customerId || metadata.userId;
                const packageId = metadata.packageId;
                const tokensString = metadata.tokens;

                if (!customerId || !packageId || !tokensString) {
                    functions.logger.warn("Missing metadata in Stripe session", {
                        sessionId,
                        metadata
                    });
                    response.status(400).send(renderHtmlResponse("Payment Error", "We could not process your payment because of missing information.", "error"));
                    return;
                }

                const tokens = parseInt(tokensString, 10);
                if (isNaN(tokens)) {
                    functions.logger.warn("Invalid tokens metadata in session", {
                        sessionId,
                        tokensString
                    });
                    response.status(400).send(renderHtmlResponse("Payment Error", "Token information attached to the payment is invalid.", "error"));
                    return;
                }

                const db = admin.firestore();
                const customerRef = db.collection("customers").doc(customerId);
                const customerDoc = await customerRef.get();

                if (!customerDoc.exists) {
                    functions.logger.warn("Customer not found for payment success", { customerId, sessionId });
                    response.status(404).send(renderHtmlResponse("Customer Not Found", "We could not find your customer account. Please contact support.", "error"));
                    return;
                }

                const customerData = customerDoc.data() || {};
                const currentTokens = Number(customerData.tokens ?? customerData.credits) || 0;
                const newTokens = currentTokens + tokens;

                await customerRef.update({
                    tokens: newTokens,
                    credits: newTokens,
                    lastTokenPurchase: admin.firestore.FieldValue.serverTimestamp(),
                    lastCreditPurchase: admin.firestore.FieldValue.serverTimestamp()
                });

                await db.collection("transactions").add({
                    customerId,
                    packageId,
                    tokens,
                    credits: tokens,
                    amount: session.amount_total,
                    currency: session.currency,
                    status: "completed",
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSessionId: sessionId
                });

                functions.logger.info("Payment success processed", {
                    customerId,
                    packageId,
                    tokens,
                    sessionId
                });

                const selectedPackage = paymentPackages[packageId];
                const packageName = selectedPackage ? selectedPackage.name : "Token package";

                response.status(200).send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payment Successful!</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            text-align: center;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #2ecc71;
        }
        .purchase-details {
            margin-top: 20px;
        }
        .purchase-details p {
            margin: 8px 0;
        }
        .btn {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Payment Successful!</h1>
        <p>Thank you for your purchase. Your tokens have been added to your account.</p>
        <div class="purchase-details">
            <p><strong>Package:</strong> ${packageName}</p>
            <p><strong>Tokens Added:</strong> ${tokens}</p>
            <p><strong>Total Tokens:</strong> ${newTokens}</p>
        </div>
        <a href="/" class="btn">Return to Home</a>
    </div>
</body>
</html>
                `);
            } catch (error) {
                functions.logger.error("Error processing payment success", error);
                response.status(500).send(renderHtmlResponse("Payment Error", "Something went wrong while processing your payment. Please contact support.", "error"));
            }
        });
    });





exports.helloWorld = functions.https.onRequest(async (request, response) => {
    cors(request, response, async () => {
        console.log('test');

        // calculate credits from usage time



        var olddoc = (await admin.firestore().doc("machines/vm-ithpq7285qk-1634027322578").get()).data();
        // var x = await admin.firestore().collection("users").get().then();
        // for (let us of x.docs) {
        //     var u = us.data();
        // }

        functions.logger.info("Hello logs!", { structuredData: true });

        admin.firestore().collection("logs").add({ message: 'test', datetime: new Date().getTime(), source: "locals" });

        response.send("Hello from Firebasec!");
    });
});


exports.helloWorld2 = functions.https.onRequest((request, response) => {
    var machinetypes = {
        "id": "projects/optum-80593/zones/europe-west1-b/machineTypes",
        "items": [
            {
                "id": "801016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-16",
                "description": "Compute Optimized: 16 vCPUs, 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801030",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-30",
                "description": "Compute Optimized: 30 vCPUs, 120 GB RAM",
                "guestCpus": 30,
                "memoryMb": 122880,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-30",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-4",
                "description": "Compute Optimized: 4 vCPUs, 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801060",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-60",
                "description": "Compute Optimized: 60 vCPUs, 240 GB RAM",
                "guestCpus": 60,
                "memoryMb": 245760,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-60",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-8",
                "description": "Compute Optimized: 8 vCPUs, 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-16",
                "description": "Efficient Instance, 16 vCPUs, 16 GB RAM",
                "guestCpus": 16,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-2",
                "description": "Efficient Instance, 2 vCPUs, 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-32",
                "description": "Efficient Instance, 32 vCPUs, 32 GB RAM",
                "guestCpus": 32,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-4",
                "description": "Efficient Instance, 4 vCPUs, 4 GB RAM",
                "guestCpus": 4,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-8",
                "description": "Efficient Instance, 8 vCPUs, 8 GB RAM",
                "guestCpus": 8,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-16",
                "description": "Efficient Instance, 16 vCPUs, 128 GB RAM",
                "guestCpus": 16,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-2",
                "description": "Efficient Instance, 2 vCPUs, 16 GB RAM",
                "guestCpus": 2,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-4",
                "description": "Efficient Instance, 4 vCPUs, 32 GB RAM",
                "guestCpus": 4,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-8",
                "description": "Efficient Instance, 8 vCPUs, 64 GB RAM",
                "guestCpus": 8,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "334004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-medium",
                "description": "Efficient Instance, 2 vCPU (1/2 shared physical core) and 4 GB RAM",
                "guestCpus": 2,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-medium",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "334002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-micro",
                "description": "Efficient Instance, 2 vCPU (1/8 shared physical core) and 1 GB RAM",
                "guestCpus": 2,
                "memoryMb": 1024,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-micro",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "334003",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-small",
                "description": "Efficient Instance, 2 vCPU (1/4 shared physical core) and 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-small",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "335016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-16",
                "description": "Efficient Instance, 16 vCPUs, 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-2",
                "description": "Efficient Instance, 2 vCPUs, 8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-32",
                "description": "Efficient Instance, 32 vCPUs, 128 GB RAM",
                "guestCpus": 32,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-4",
                "description": "Efficient Instance, 4 vCPUs, 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-8",
                "description": "Efficient Instance, 8 vCPUs, 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "1000",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "f1-micro",
                "description": "1 vCPU (shared physical core) and 0.6 GB RAM",
                "guestCpus": 1,
                "memoryMb": 614,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/f1-micro",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "2000",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "g1-small",
                "description": "1 vCPU (shared physical core) and 1.7 GB RAM",
                "guestCpus": 1,
                "memoryMb": 1740,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/g1-small",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "9196",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-megamem-96",
                "description": "96 vCPUs, 1.4 TB RAM",
                "guestCpus": 96,
                "memoryMb": 1468006,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-megamem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "11160",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-ultramem-160",
                "description": "160 vCPUs, 3844 GB RAM",
                "guestCpus": 160,
                "memoryMb": 3936256,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-160",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "11040",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-ultramem-40",
                "description": "40 vCPUs, 961 GB RAM",
                "guestCpus": 40,
                "memoryMb": 984064,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-40",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "11080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-ultramem-80",
                "description": "80 vCPUs, 1922 GB RAM",
                "guestCpus": 80,
                "memoryMb": 1968128,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-16",
                "description": "16 vCPUs, 14.4 GB RAM",
                "guestCpus": 16,
                "memoryMb": 14746,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-2",
                "description": "2 vCPUs, 1.8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 1843,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-32",
                "description": "32 vCPUs, 28.8 GB RAM",
                "guestCpus": 32,
                "memoryMb": 29491,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-4",
                "description": "4 vCPUs, 3.6 GB RAM",
                "guestCpus": 4,
                "memoryMb": 3686,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-64",
                "description": "64 vCPUs, 57.6 GB RAM",
                "guestCpus": 64,
                "memoryMb": 58982,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-8",
                "description": "8 vCPUs, 7.2 GB RAM",
                "guestCpus": 8,
                "memoryMb": 7373,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-96",
                "description": "96 vCPUs, 86 GB RAM",
                "guestCpus": 96,
                "memoryMb": 88474,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-16",
                "description": "16 vCPUs, 104 GB RAM",
                "guestCpus": 16,
                "memoryMb": 106496,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-2",
                "description": "2 vCPUs, 13 GB RAM",
                "guestCpus": 2,
                "memoryMb": 13312,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-32",
                "description": "32 vCPUs, 208 GB RAM",
                "guestCpus": 32,
                "memoryMb": 212992,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-4",
                "description": "4 vCPUs, 26 GB RAM",
                "guestCpus": 4,
                "memoryMb": 26624,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-64",
                "description": "64 vCPUs, 416 GB RAM",
                "guestCpus": 64,
                "memoryMb": 425984,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-8",
                "description": "8 vCPUs, 52 GB RAM",
                "guestCpus": 8,
                "memoryMb": 53248,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-96",
                "description": "96 vCPUs, 624 GB RAM",
                "guestCpus": 96,
                "memoryMb": 638976,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "9096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-megamem-96",
                "description": "96 vCPUs, 1.4 TB RAM",
                "guestCpus": 96,
                "memoryMb": 1468006,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-megamem-96"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-megamem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3001",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-1",
                "description": "1 vCPU, 3.75 GB RAM",
                "guestCpus": 1,
                "memoryMb": 3840,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-1",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-16",
                "description": "16 vCPUs, 60 GB RAM",
                "guestCpus": 16,
                "memoryMb": 61440,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-2",
                "description": "2 vCPUs, 7.5 GB RAM",
                "guestCpus": 2,
                "memoryMb": 7680,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-32",
                "description": "32 vCPUs, 120 GB RAM",
                "guestCpus": 32,
                "memoryMb": 122880,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-4",
                "description": "4 vCPUs, 15 GB RAM",
                "guestCpus": 4,
                "memoryMb": 15360,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-64",
                "description": "64 vCPUs, 240 GB RAM",
                "guestCpus": 64,
                "memoryMb": 245760,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-8",
                "description": "8 vCPUs, 30 GB RAM",
                "guestCpus": 8,
                "memoryMb": 30720,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-96",
                "description": "96 vCPUs, 360 GB RAM",
                "guestCpus": 96,
                "memoryMb": 368640,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "10160",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-ultramem-160",
                "description": "160 vCPUs, 3844 GB RAM",
                "guestCpus": 160,
                "memoryMb": 3936256,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-160"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-160",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "10040",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-ultramem-40",
                "description": "40 vCPUs, 961 GB RAM",
                "guestCpus": 40,
                "memoryMb": 984064,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-40"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-40",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "10080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-ultramem-80",
                "description": "80 vCPUs, 1922 GB RAM",
                "guestCpus": 80,
                "memoryMb": 1968128,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-80"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-16",
                "description": "16 vCPUs 16 GB RAM",
                "guestCpus": 16,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-2",
                "description": "2 vCPUs 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-32",
                "description": "32 vCPUs 32 GB RAM",
                "guestCpus": 32,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-4",
                "description": "4 vCPUs 4 GB RAM",
                "guestCpus": 4,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-48",
                "description": "48 vCPUs 48 GB RAM",
                "guestCpus": 48,
                "memoryMb": 49152,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-64",
                "description": "64 vCPUs 64 GB RAM",
                "guestCpus": 64,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-8",
                "description": "8 vCPUs 8 GB RAM",
                "guestCpus": 8,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-80",
                "description": "80 vCPUs 80 GB RAM",
                "guestCpus": 80,
                "memoryMb": 81920,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-16",
                "description": "16 vCPUs 128 GB RAM",
                "guestCpus": 16,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-2",
                "description": "2 vCPUs 16 GB RAM",
                "guestCpus": 2,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-32",
                "description": "32 vCPUs 256 GB RAM",
                "guestCpus": 32,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-4",
                "description": "4 vCPUs 32 GB RAM",
                "guestCpus": 4,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-48",
                "description": "48 vCPUs 384 GB RAM",
                "guestCpus": 48,
                "memoryMb": 393216,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-64",
                "description": "64 vCPUs 512 GB RAM",
                "guestCpus": 64,
                "memoryMb": 524288,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-8",
                "description": "8 vCPUs 64 GB RAM",
                "guestCpus": 8,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-80",
                "description": "80 vCPUs 640 GB RAM",
                "guestCpus": 80,
                "memoryMb": 655360,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-16",
                "description": "16 vCPUs 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-2",
                "description": "2 vCPUs 8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-32",
                "description": "32 vCPUs 128 GB RAM",
                "guestCpus": 32,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-4",
                "description": "4 vCPUs 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-48",
                "description": "48 vCPUs 192 GB RAM",
                "guestCpus": 48,
                "memoryMb": 196608,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-64",
                "description": "64 vCPUs 256 GB RAM",
                "guestCpus": 64,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-8",
                "description": "8 vCPUs 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-80",
                "description": "80 vCPUs 320 GB RAM",
                "guestCpus": 80,
                "memoryMb": 327680,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910128",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-128",
                "description": "128 vCPUs 128 GB RAM",
                "guestCpus": 128,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-128",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-16",
                "description": "16 vCPUs 16 GB RAM",
                "guestCpus": 16,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-2",
                "description": "2 vCPUs 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910224",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-224",
                "description": "224 vCPUs 224 GB RAM",
                "guestCpus": 224,
                "memoryMb": 229376,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-224",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-32",
                "description": "32 vCPUs 32 GB RAM",
                "guestCpus": 32,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-4",
                "description": "4 vCPUs 4 GB RAM",
                "guestCpus": 4,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-48",
                "description": "48 vCPUs 48 GB RAM",
                "guestCpus": 48,
                "memoryMb": 49152,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-64",
                "description": "64 vCPUs 64 GB RAM",
                "guestCpus": 64,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-8",
                "description": "8 vCPUs 8 GB RAM",
                "guestCpus": 8,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-80",
                "description": "80 vCPUs 80 GB RAM",
                "guestCpus": 80,
                "memoryMb": 81920,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-96",
                "description": "96 vCPUs 96 GB RAM",
                "guestCpus": 96,
                "memoryMb": 98304,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-16",
                "description": "16 vCPUs 128 GB RAM",
                "guestCpus": 16,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-2",
                "description": "2 vCPUs 16 GB RAM",
                "guestCpus": 2,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-32",
                "description": "32 vCPUs 256 GB RAM",
                "guestCpus": 32,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-4",
                "description": "4 vCPUs 32 GB RAM",
                "guestCpus": 4,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-48",
                "description": "48 vCPUs 384 GB RAM",
                "guestCpus": 48,
                "memoryMb": 393216,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-64",
                "description": "64 vCPUs 512 GB RAM",
                "guestCpus": 64,
                "memoryMb": 524288,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-8",
                "description": "8 vCPUs 64 GB RAM",
                "guestCpus": 8,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-80",
                "description": "80 vCPUs 640 GB RAM",
                "guestCpus": 80,
                "memoryMb": 655360,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-96",
                "description": "96 vCPUs 768 GB RAM",
                "guestCpus": 96,
                "memoryMb": 786432,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911128",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-128",
                "description": "128 vCPUs 512 GB RAM",
                "guestCpus": 128,
                "memoryMb": 524288,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-128",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-16",
                "description": "16 vCPUs 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-2",
                "description": "2 vCPUs 8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911224",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-224",
                "description": "224 vCPUs 896 GB RAM",
                "guestCpus": 224,
                "memoryMb": 917504,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-224",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-32",
                "description": "32 vCPUs 128 GB RAM",
                "guestCpus": 32,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-4",
                "description": "4 vCPUs 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-48",
                "description": "48 vCPUs 192 GB RAM",
                "guestCpus": 48,
                "memoryMb": 196608,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-64",
                "description": "64 vCPUs 256 GB RAM",
                "guestCpus": 64,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-8",
                "description": "8 vCPUs 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-80",
                "description": "80 vCPUs 320 GB RAM",
                "guestCpus": 80,
                "memoryMb": 327680,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-96",
                "description": "96 vCPUs 384 GB RAM",
                "guestCpus": 96,
                "memoryMb": 393216,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            }
        ],
        "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes",
        "kind": "compute#machineTypeList"
    }

    response.json(machinetypes);
});


exports.listVMs = functions.https.onRequest(async (request, response) => {
    const compute = google.compute('v1');
    const authClient = await google.auth.getClient({
        scopes: [
            'https://www.googleapis.com/auth/cloud-platform',
            'https://www.googleapis.com/auth/compute',
            'https://www.googleapis.com/auth/compute.readonly',
        ],
    });

    const projectId = await google.auth.getProjectId();
    const result = await compute.instances.list({
        auth: authClient,
        project: projectId,
    });
    const vms = result.data;
    console.log('VMs:', vms);

    response.send(vms);
});
exports.getMachinesByRegion = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        try {
            const [instances = []] = await compute.getVMs();
            const instanceList = Array.isArray(instances) ? instances : [];

            const machines = instanceList.map(vm => {
                const metadata = vm.metadata || {};
                const zonePath = metadata.zone || "";
                const zone = zonePath.split("/").pop() || "unknown";
                const region = zone.includes("-") ? zone.substring(0, zone.lastIndexOf("-")) : zone;
                const machineTypePath = metadata.machineType || "";
                const machineType = machineTypePath.split("/").pop() || null;
                const networkInterfaces = Array.isArray(metadata.networkInterfaces) ? metadata.networkInterfaces : [];
                const primaryNic = networkInterfaces[0] || {};
                const internalIp = primaryNic.networkIP || null;
                const accessConfigs = Array.isArray(primaryNic.accessConfigs) ? primaryNic.accessConfigs : [];
                const externalIp = accessConfigs[0]?.natIP || null;

                return {
                    id: metadata.id || vm.id || null,
                    name: metadata.name || vm.name || null,
                    status: metadata.status || null,
                    zone,
                    region,
                    machineType,
                    creationTimestamp: metadata.creationTimestamp || null,
                    internalIp,
                    externalIp,
                    labels: metadata.labels || {},
                    tags: (metadata.tags && metadata.tags.items) ? metadata.tags.items : [],
                    serviceAccounts: Array.isArray(metadata.serviceAccounts) ? metadata.serviceAccounts.map(account => ({
                        email: account.email || null,
                        scopes: account.scopes || []
                    })) : []
                };
            });

            const regionMap = new Map();

            for (const machine of machines) {
                if (!regionMap.has(machine.region)) {
                    regionMap.set(machine.region, new Map());
                }
                const zoneMap = regionMap.get(machine.region);
                if (!zoneMap.has(machine.zone)) {
                    zoneMap.set(machine.zone, []);
                }
                zoneMap.get(machine.zone).push(machine);
            }

            const regions = Array.from(regionMap.keys()).sort().map(region => {
                const zoneMap = regionMap.get(region);
                return {
                    region,
                    zones: Array.from(zoneMap.keys()).sort().map(zone => ({
                        zone,
                        machines: zoneMap.get(zone).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                    }))
                };
            });

            response.json({
                updatedAt: new Date().toISOString(),
                total: machines.length,
                regions
            });
        } catch (error) {
            functions.logger.error("getMachinesByRegion failed", { error });
            response.status(500).json({ error: "Failed to load machines by region" });
        }
    });
});

exports.getMachineCatalog = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        try {
            const debug = (getRequestValue(req, "debug") || "").toLowerCase();
            const skipCache = debug === "pricing" || debug === "families";
            const now = Date.now();
            if (!skipCache && machineCatalogCache.payload && (now - machineCatalogCache.fetchedAt) < MACHINE_CATALOG_CACHE_TTL_MS) {
                response.json(machineCatalogCache.payload);
                return;
            }

            const authClient = await google.auth.getClient({
                scopes: [
                    "https://www.googleapis.com/auth/cloud-platform",
                    "https://www.googleapis.com/auth/compute",
                    "https://www.googleapis.com/auth/compute.readonly",
                    "https://www.googleapis.com/auth/cloud-billing"
                ]
            });
            const projectId = await google.auth.getProjectId();
            const computeApi = google.compute("v1");
            const cloudbilling = google.cloudbilling("v1");

            const pricingByRegion = new Map();
            let latestEffectiveTime = null;
            const pricingDebugList = [];

            function capturePricing(region, familyKey, component, price, skuName) {
                if (!region || !familyKey || price == null) {
                    return;
                }
                const normalizedRegion = region.toLowerCase();
                if (!pricingByRegion.has(normalizedRegion)) {
                    pricingByRegion.set(normalizedRegion, new Map());
                }
                const familyMap = pricingByRegion.get(normalizedRegion);
                if (!familyMap.has(familyKey)) {
                    familyMap.set(familyKey, {});
                }
                const entry = familyMap.get(familyKey);
                if (component === "cpu") {
                    entry.cpu = price;
                    entry.cpuSource = skuName;
                } else if (component === "ram") {
                    entry.ram = price;
                    entry.ramSource = skuName;
                }
            }

            function deriveFamilyKey(resourceGroup = "", description = "") {
                const candidates = (resourceGroup ? [resourceGroup] : []).concat(description || "");
                const joined = candidates.join(" ").toLowerCase();

                const seriesList = [
                    "ct6e", "ct5lp", "ct5p", "ct5l", "ct3p", "ct3",
                    "c4d", "c4a", "c4", "c3d", "c3", "c2d", "c2",
                    "n4", "n2d", "n2", "n1",
                    "e2", "t2d", "t2a",
                    "m4", "m3", "m2", "m1",
                    "a4", "a3", "a2",
                    "g2", "g1",
                    "h4d", "h3",
                    "f1", "z3", "x4"
                ];

                let matchedSeries = null;
                for (const series of seriesList) {
                    if (joined.includes(series)) {
                        matchedSeries = series;
                        break;
                    }
                }
                if (!matchedSeries && resourceGroup) {
                    matchedSeries = resourceGroup.replace(/[^a-z0-9]/g, "").toLowerCase();
                }
                if (!matchedSeries) {
                    return null;
                }

                const variantChecks = [
                    { key: "highmem", patterns: ["highmem", "high-memory", "high memory"] },
                    { key: "highcpu", patterns: ["highcpu", "high-cpu", "high cpu"] },
                    { key: "ultramem", patterns: ["ultramem", "ultra memory", "ultra-memory"] },
                    { key: "megamem", patterns: ["megamem", "mega memory", "mega-memory"] },
                    { key: "metal", patterns: ["metal"] },
                    { key: "memoryoptimized", patterns: ["memory optimized", "memory-optimized"] },
                    { key: "computeoptimized", patterns: ["compute optimized", "compute-optimized"] },
                    { key: "highgpu", patterns: ["highgpu", "high-gpu", "high gpu"] },
                    { key: "megagpu", patterns: ["megagpu", "mega gpu", "mega-gpu"] },
                    { key: "ultragpu", patterns: ["ultragpu", "ultra gpu", "ultra-gpu"] },
                    { key: "micro", patterns: ["micro"] },
                    { key: "small", patterns: ["small"] },
                    { key: "medium", patterns: ["medium"] },
                    { key: "standard", patterns: ["standard", "predefined"] }
                ];

                let variant = "";
                for (const candidate of variantChecks) {
                    if (candidate.patterns.some(pattern => joined.includes(pattern))) {
                        variant = candidate.key;
                        break;
                    }
                }

                if (!variant) {
                    if ([
                        "e2", "n1", "n2", "n2d", "n4",
                        "c2", "c2d", "c3", "c3d", "c4", "c4a", "c4d",
                        "ct3", "ct3p", "ct5l", "ct5lp", "ct5p", "ct6e",
                        "t2d", "t2a",
                        "m1", "m2", "m3", "m4",
                        "a2", "a3", "a4",
                        "g1", "g2",
                        "h3", "h4d",
                        "f1", "z3", "x4"
                    ].includes(matchedSeries)) {
                        variant = "standard";
                    }
                }

                return `${matchedSeries}${variant}`.replace(/[^a-z0-9]/g, "");
            }

            function machineTypeNameToFamilyKey(machineTypeName = "") {
                if (!machineTypeName) {
                    return null;
                }
                const tokens = machineTypeName.toLowerCase().split("-");
                const familyTokens = [];
                for (const token of tokens) {
                    if (!token) {
                        continue;
                    }
                    if (/^\d/.test(token)) {
                        break;
                    }
                    familyTokens.push(token);
                }
                if (!familyTokens.length && tokens.length) {
                    familyTokens.push(tokens[0]);
                }
                return familyTokens.join("").replace(/[^a-z0-9]/g, "") || null;
            }

            function deriveComponent(resourceGroup = "", description = "") {
                const lowerGroup = resourceGroup.toLowerCase();
                if (lowerGroup.includes("ram") || lowerGroup.includes("memory")) {
                    return "ram";
                }
                if (lowerGroup.includes("core") || lowerGroup.includes("cpu")) {
                    return "cpu";
                }
                const lowerDescription = description.toLowerCase();
                if (lowerDescription.includes(" ram") || lowerDescription.includes(" memory")) {
                    return "ram";
                }
                if (lowerDescription.includes(" core")) {
                    return "cpu";
                }
                return null;
            }

            function extractUnitPrice(pricingInfo = []) {
                const pricing = Array.isArray(pricingInfo) ? pricingInfo[0] : null;
                const expression = pricing?.pricingExpression;
                if (!expression || !Array.isArray(expression.tieredRates) || expression.tieredRates.length === 0) {
                    return null;
                }
                const rate = expression.tieredRates[0];
                const unitPrice = rate.unitPrice;
                if (!unitPrice) {
                    return null;
                }
                const units = Number(unitPrice.units || 0);
                const nanos = Number(unitPrice.nanos || 0) / 1e9;
                return Number((units + nanos).toFixed(10));
            }

            function collectRegionCandidates(serviceRegions = [], geoRegions = []) {
                const regions = new Set();
                for (const region of serviceRegions || []) {
                    if (region) {
                        regions.add(region.toLowerCase());
                    }
                }
                for (const region of geoRegions || []) {
                    if (region) {
                        regions.add(region.toLowerCase());
                    }
                }
                if (regions.size === 0) {
                    regions.add("global");
                }
                return Array.from(regions);
            }

            let skuPageToken = undefined;
            do {
                const { data } = await cloudbilling.services.skus.list({
                    auth: authClient,
                    parent: "services/6F81-5844-456A",
                    pageSize: 5000,
                    pageToken: skuPageToken
                });
                const skus = data.skus || [];
                for (const sku of skus) {
                    if (sku?.category?.usageType !== "OnDemand") {
                        continue;
                    }
                    if (sku?.category?.resourceFamily !== "Compute") {
                        continue;
                    }
                    const component = deriveComponent(sku?.category?.resourceGroup, sku?.description || "");
                    if (!component) {
                        continue;
                    }
                    const familyKey = deriveFamilyKey(sku?.category?.resourceGroup, sku?.description || "");
                    if (!familyKey) {
                        continue;
                    }
                    const unitPrice = extractUnitPrice(sku.pricingInfo);
                    if (unitPrice == null) {
                        continue;
                    }
                    const regions = collectRegionCandidates(sku.serviceRegions, sku.geoTaxonomy?.regions);
                    for (const region of regions) {
                        capturePricing(region, familyKey, component, unitPrice, sku.name || sku.skuId || null);
                        if (debug === "pricing") {
                            pricingDebugList.push({
                                region,
                                familyKey,
                                component,
                                unitPrice,
                                sku: sku.name || sku.skuId || null,
                                resourceGroup: sku?.category?.resourceGroup || null,
                                description: sku?.description || null
                            });
                        }
                    }
                    const effectiveTime = sku.pricingInfo?.[0]?.effectiveTime;
                    if (effectiveTime && (!latestEffectiveTime || effectiveTime > latestEffectiveTime)) {
                        latestEffectiveTime = effectiveTime;
                    }
                }
                skuPageToken = data.nextPageToken || undefined;
            } while (skuPageToken);

            let pageToken = undefined;
            const regionMap = new Map();
            let total = 0;
            const missingFamilies = new Map();

            do {
                const { data } = await computeApi.machineTypes.aggregatedList({
                    project: projectId,
                    auth: authClient,
                    pageToken
                });
                const items = data.items || {};

                Object.entries(items).forEach(([scope, value]) => {
                    const machineTypes = value.machineTypes || [];
                    if (!machineTypes.length) {
                        return;
                    }
                    const scopeName = scope.includes("/") ? scope.split("/").pop() : scope;
                    if (!scopeName || !scopeName.includes("-")) {
                        return;
                    }
                    const zone = scopeName;
                    const region = zone.substring(0, zone.lastIndexOf("-"));

                    if (!regionMap.has(region)) {
                        regionMap.set(region, new Map());
                    }
                    const zoneMap = regionMap.get(region);
                    if (!zoneMap.has(zone)) {
                        zoneMap.set(zone, []);
                    }

                    machineTypes.forEach(machineType => {
                        const machineName = machineType?.name || "";
                        const familyKey = machineTypeNameToFamilyKey(machineName);
                        let pricing = null;
                        if (familyKey) {
                            const regionCandidates = [
                                region,
                                region.split("-")[0] || null,
                                "global"
                            ].filter(Boolean).map(r => r.toLowerCase());
                            for (const candidate of regionCandidates) {
                                const familyMap = pricingByRegion.get(candidate);
                                if (!familyMap) {
                                    continue;
                                }
                                const entry = familyMap.get(familyKey);
                                if (entry && entry.cpu != null && entry.ram != null) {
                                    pricing = entry;
                                    break;
                                }
                            }
                        }

                        let pricePerHourUsd = null;
                        let pricePerMonthUsd = null;
                        let priceSource = null;
                        if (pricing && pricing.cpu != null && pricing.ram != null) {
                            const cpus = Number(machineType.guestCpus || 0);
                            const memoryGb = Number(machineType.memoryMb || 0) / 1024;
                            const hourly = (pricing.cpu * cpus) + (pricing.ram * memoryGb);
                            pricePerHourUsd = Number(hourly.toFixed(6));
                            pricePerMonthUsd = Number((hourly * 24 * 30).toFixed(2));
                            const sources = [];
                            if (pricing.cpuSource) {
                                sources.push(`cpu:${pricing.cpuSource}`);
                            }
                            if (pricing.ramSource) {
                                sources.push(`ram:${pricing.ramSource}`);
                            }
                            priceSource = sources.length ? sources.join(";") : null;
                        }
                        if (!pricing && familyKey) {
                            const key = `${familyKey}|${region}`;
                            missingFamilies.set(key, (missingFamilies.get(key) || 0) + 1);
                        }

                        zoneMap.get(zone).push({
                            name: machineType.name || null,
                            description: machineType.description || null,
                            guestCpus: machineType.guestCpus ?? null,
                            memoryMb: machineType.memoryMb ?? null,
                            memoryGb: machineType.memoryMb != null ? machineType.memoryMb / 1024 : null,
                            maximumPersistentDisks: machineType.maximumPersistentDisks ?? null,
                            maximumPersistentDisksSizeGb: machineType.maximumPersistentDisksSizeGb ?? null,
                            deprecated: machineType.deprecated?.state || null,
                            zone,
                            region,
                            selfLink: machineType.selfLink || null,
                            pricePerHourUsd,
                            pricePerMonthUsd,
                            priceSource
                        });
                        total += 1;
                    });
                });

                pageToken = data.nextPageToken || undefined;
            } while (pageToken);

            const regions = Array.from(regionMap.keys()).sort().map(region => {
                const zoneMap = regionMap.get(region);
                return {
                    region,
                    zones: Array.from(zoneMap.keys()).sort().map(zone => ({
                        zone,
                        machineTypes: zoneMap.get(zone).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                    }))
                };
            });

            const payload = {
                updatedAt: new Date().toISOString(),
                total,
                regions,
                priceReleaseDate: latestEffectiveTime
            };

            if (debug === "pricing") {
                response.json({
                    pricingEntries: pricingDebugList.slice(0, 200),
                    pricingByRegionKeys: Array.from(pricingByRegion.keys()),
                    pricingFamiliesSample: Array.from(pricingByRegion.entries()).slice(0, 20).map(([regionKey, familyMap]) => ({
                        region: regionKey,
                        families: Array.from(familyMap.keys()).slice(0, 20)
                    }))
                });
                return;
            }

            if (debug === "families") {
                response.json({
                    missingFamilies: Array.from(missingFamilies.keys()).slice(0, 200)
                });
                return;
            }

            if (!skipCache) {
                machineCatalogCache = {
                    payload,
                    fetchedAt: Date.now()
                };
            }

            response.json(payload);
        } catch (error) {
            functions.logger.error("getMachineCatalog failed", { error });
            response.status(500).json({ error: "Failed to load machine catalog" });
        }
    });
});

exports.createAdminUser = functions.https.onRequest(async (request, response) => {
    cors(request, response, async () => {
        if (request.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        try {
            const decodedToken = await resolveAuthToken(request);
            if (!decodedToken) {
                response.status(401).json({ error: "Unauthorized" });
                return;
            }

            const isAdmin = await enforceAdminAccess(decodedToken);
            if (!isAdmin) {
                response.status(403).json({ error: "Forbidden" });
                return;
            }

            const body = resolveRequestBody(request) || {};
            const emailRaw = body.email;
            const displayName = body.displayName || null;
            const continueUrl = body.continueUrl;

            if (!emailRaw || typeof emailRaw !== "string") {
                response.status(400).json({ error: "Email is required" });
                return;
            }

            const email = emailRaw.trim().toLowerCase();
            let userRecord;
            let created = false;

            try {
                userRecord = await admin.auth().getUserByEmail(email);
            } catch (error) {
                if (error.code === "auth/user-not-found") {
                    userRecord = await admin.auth().createUser({
                        email,
                        displayName: displayName || undefined
                    });
                    created = true;
                } else {
                    throw error;
                }
            }

            if (!created && displayName && !userRecord.displayName) {
                await admin.auth().updateUser(userRecord.uid, { displayName });
            }

            const actionSettings = {};
            if (typeof continueUrl === "string" && continueUrl) {
                actionSettings.url = continueUrl;
            } else if (request.headers.origin) {
                actionSettings.url = `${request.headers.origin}/login`;
            }

            const resetLink = await admin.auth().generatePasswordResetLink(email, actionSettings);

            response.json({
                email,
                resetLink,
                created,
                actionUrl: actionSettings.url || null
            });
        } catch (error) {
            functions.logger.error("createAdminUser failed", { error });
            response.status(500).json({ error: "Failed to create admin user" });
        }
    });
});

exports.deleteAdminUser = functions.https.onRequest(async (request, response) => {
    cors(request, response, async () => {
        if (request.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        try {
            const decodedToken = await resolveAuthToken(request);
            if (!decodedToken) {
                response.status(401).json({ error: "Unauthorized" });
                return;
            }

            const isAdmin = await enforceAdminAccess(decodedToken);
            if (!isAdmin) {
                response.status(403).json({ error: "Forbidden" });
                return;
            }

            const body = resolveRequestBody(request) || {};
            const emailRaw = body.email;

            if (!emailRaw || typeof emailRaw !== "string") {
                response.status(400).json({ error: "Email is required" });
                return;
            }

            const email = emailRaw.trim().toLowerCase();

            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                await admin.auth().deleteUser(userRecord.uid);
                response.json({ email, deleted: true });
            } catch (error) {
                if (error.code === "auth/user-not-found") {
                    response.json({ email, deleted: false, message: "User not found" });
                } else {
                    throw error;
                }
            }
        } catch (error) {
            functions.logger.error("deleteAdminUser failed", { error });
            response.status(500).json({ error: "Failed to delete admin user" });
        }
    });
});

exports.listmachinetypes = functions.https.onRequest((request, response) => {
    // https://cloud.google.com/compute/docs/reference/rest/v1/machineTypes/list
    //    optum-80593
    //   europe-west1-b

    var machinetypes = {
        "id": "projects/optum-80593/zones/europe-west1-b/machineTypes",
        "items": [
            {
                "id": "801016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-16",
                "description": "Compute Optimized: 16 vCPUs, 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801030",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-30",
                "description": "Compute Optimized: 30 vCPUs, 120 GB RAM",
                "guestCpus": 30,
                "memoryMb": 122880,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-30",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-4",
                "description": "Compute Optimized: 4 vCPUs, 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801060",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-60",
                "description": "Compute Optimized: 60 vCPUs, 240 GB RAM",
                "guestCpus": 60,
                "memoryMb": 245760,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-60",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "801008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "c2-standard-8",
                "description": "Compute Optimized: 8 vCPUs, 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-16",
                "description": "Efficient Instance, 16 vCPUs, 16 GB RAM",
                "guestCpus": 16,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-2",
                "description": "Efficient Instance, 2 vCPUs, 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-32",
                "description": "Efficient Instance, 32 vCPUs, 32 GB RAM",
                "guestCpus": 32,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-4",
                "description": "Efficient Instance, 4 vCPUs, 4 GB RAM",
                "guestCpus": 4,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "337008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highcpu-8",
                "description": "Efficient Instance, 8 vCPUs, 8 GB RAM",
                "guestCpus": 8,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-16",
                "description": "Efficient Instance, 16 vCPUs, 128 GB RAM",
                "guestCpus": 16,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-2",
                "description": "Efficient Instance, 2 vCPUs, 16 GB RAM",
                "guestCpus": 2,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-4",
                "description": "Efficient Instance, 4 vCPUs, 32 GB RAM",
                "guestCpus": 4,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "336008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-highmem-8",
                "description": "Efficient Instance, 8 vCPUs, 64 GB RAM",
                "guestCpus": 8,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "334004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-medium",
                "description": "Efficient Instance, 2 vCPU (1/2 shared physical core) and 4 GB RAM",
                "guestCpus": 2,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-medium",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "334002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-micro",
                "description": "Efficient Instance, 2 vCPU (1/8 shared physical core) and 1 GB RAM",
                "guestCpus": 2,
                "memoryMb": 1024,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-micro",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "334003",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-small",
                "description": "Efficient Instance, 2 vCPU (1/4 shared physical core) and 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-small",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "335016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-16",
                "description": "Efficient Instance, 16 vCPUs, 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-2",
                "description": "Efficient Instance, 2 vCPUs, 8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-32",
                "description": "Efficient Instance, 32 vCPUs, 128 GB RAM",
                "guestCpus": 32,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-4",
                "description": "Efficient Instance, 4 vCPUs, 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "335008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "e2-standard-8",
                "description": "Efficient Instance, 8 vCPUs, 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "1000",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "f1-micro",
                "description": "1 vCPU (shared physical core) and 0.6 GB RAM",
                "guestCpus": 1,
                "memoryMb": 614,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/f1-micro",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "2000",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "g1-small",
                "description": "1 vCPU (shared physical core) and 1.7 GB RAM",
                "guestCpus": 1,
                "memoryMb": 1740,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 16,
                "maximumPersistentDisksSizeGb": "3072",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/g1-small",
                "isSharedCpu": true,
                "kind": "compute#machineType"
            },
            {
                "id": "9196",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-megamem-96",
                "description": "96 vCPUs, 1.4 TB RAM",
                "guestCpus": 96,
                "memoryMb": 1468006,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-megamem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "11160",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-ultramem-160",
                "description": "160 vCPUs, 3844 GB RAM",
                "guestCpus": 160,
                "memoryMb": 3936256,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-160",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "11040",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-ultramem-40",
                "description": "40 vCPUs, 961 GB RAM",
                "guestCpus": 40,
                "memoryMb": 984064,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-40",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "11080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "m1-ultramem-80",
                "description": "80 vCPUs, 1922 GB RAM",
                "guestCpus": 80,
                "memoryMb": 1968128,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-16",
                "description": "16 vCPUs, 14.4 GB RAM",
                "guestCpus": 16,
                "memoryMb": 14746,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-2",
                "description": "2 vCPUs, 1.8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 1843,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-32",
                "description": "32 vCPUs, 28.8 GB RAM",
                "guestCpus": 32,
                "memoryMb": 29491,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-4",
                "description": "4 vCPUs, 3.6 GB RAM",
                "guestCpus": 4,
                "memoryMb": 3686,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-64",
                "description": "64 vCPUs, 57.6 GB RAM",
                "guestCpus": 64,
                "memoryMb": 58982,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-8",
                "description": "8 vCPUs, 7.2 GB RAM",
                "guestCpus": 8,
                "memoryMb": 7373,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "4096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highcpu-96",
                "description": "96 vCPUs, 86 GB RAM",
                "guestCpus": 96,
                "memoryMb": 88474,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-16",
                "description": "16 vCPUs, 104 GB RAM",
                "guestCpus": 16,
                "memoryMb": 106496,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-2",
                "description": "2 vCPUs, 13 GB RAM",
                "guestCpus": 2,
                "memoryMb": 13312,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-32",
                "description": "32 vCPUs, 208 GB RAM",
                "guestCpus": 32,
                "memoryMb": 212992,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-4",
                "description": "4 vCPUs, 26 GB RAM",
                "guestCpus": 4,
                "memoryMb": 26624,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-64",
                "description": "64 vCPUs, 416 GB RAM",
                "guestCpus": 64,
                "memoryMb": 425984,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-8",
                "description": "8 vCPUs, 52 GB RAM",
                "guestCpus": 8,
                "memoryMb": 53248,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "5096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-highmem-96",
                "description": "96 vCPUs, 624 GB RAM",
                "guestCpus": 96,
                "memoryMb": 638976,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "9096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-megamem-96",
                "description": "96 vCPUs, 1.4 TB RAM",
                "guestCpus": 96,
                "memoryMb": 1468006,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-megamem-96"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-megamem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3001",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-1",
                "description": "1 vCPU, 3.75 GB RAM",
                "guestCpus": 1,
                "memoryMb": 3840,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-1",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-16",
                "description": "16 vCPUs, 60 GB RAM",
                "guestCpus": 16,
                "memoryMb": 61440,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-2",
                "description": "2 vCPUs, 7.5 GB RAM",
                "guestCpus": 2,
                "memoryMb": 7680,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-32",
                "description": "32 vCPUs, 120 GB RAM",
                "guestCpus": 32,
                "memoryMb": 122880,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-4",
                "description": "4 vCPUs, 15 GB RAM",
                "guestCpus": 4,
                "memoryMb": 15360,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-64",
                "description": "64 vCPUs, 240 GB RAM",
                "guestCpus": 64,
                "memoryMb": 245760,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-8",
                "description": "8 vCPUs, 30 GB RAM",
                "guestCpus": 8,
                "memoryMb": 30720,
                "imageSpaceGb": 10,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "3096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-standard-96",
                "description": "96 vCPUs, 360 GB RAM",
                "guestCpus": 96,
                "memoryMb": 368640,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "10160",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-ultramem-160",
                "description": "160 vCPUs, 3844 GB RAM",
                "guestCpus": 160,
                "memoryMb": 3936256,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-160"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-160",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "10040",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-ultramem-40",
                "description": "40 vCPUs, 961 GB RAM",
                "guestCpus": 40,
                "memoryMb": 984064,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-40"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-40",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "10080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n1-ultramem-80",
                "description": "80 vCPUs, 1922 GB RAM",
                "guestCpus": 80,
                "memoryMb": 1968128,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "deprecated": {
                    "state": "DEPRECATED",
                    "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-80"
                },
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-16",
                "description": "16 vCPUs 16 GB RAM",
                "guestCpus": 16,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-2",
                "description": "2 vCPUs 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-32",
                "description": "32 vCPUs 32 GB RAM",
                "guestCpus": 32,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-4",
                "description": "4 vCPUs 4 GB RAM",
                "guestCpus": 4,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-48",
                "description": "48 vCPUs 48 GB RAM",
                "guestCpus": 48,
                "memoryMb": 49152,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-64",
                "description": "64 vCPUs 64 GB RAM",
                "guestCpus": 64,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-8",
                "description": "8 vCPUs 8 GB RAM",
                "guestCpus": 8,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "903080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highcpu-80",
                "description": "80 vCPUs 80 GB RAM",
                "guestCpus": 80,
                "memoryMb": 81920,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-16",
                "description": "16 vCPUs 128 GB RAM",
                "guestCpus": 16,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-2",
                "description": "2 vCPUs 16 GB RAM",
                "guestCpus": 2,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-32",
                "description": "32 vCPUs 256 GB RAM",
                "guestCpus": 32,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-4",
                "description": "4 vCPUs 32 GB RAM",
                "guestCpus": 4,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-48",
                "description": "48 vCPUs 384 GB RAM",
                "guestCpus": 48,
                "memoryMb": 393216,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-64",
                "description": "64 vCPUs 512 GB RAM",
                "guestCpus": 64,
                "memoryMb": 524288,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-8",
                "description": "8 vCPUs 64 GB RAM",
                "guestCpus": 8,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "902080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-highmem-80",
                "description": "80 vCPUs 640 GB RAM",
                "guestCpus": 80,
                "memoryMb": 655360,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-16",
                "description": "16 vCPUs 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-2",
                "description": "2 vCPUs 8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-32",
                "description": "32 vCPUs 128 GB RAM",
                "guestCpus": 32,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-4",
                "description": "4 vCPUs 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-48",
                "description": "48 vCPUs 192 GB RAM",
                "guestCpus": 48,
                "memoryMb": 196608,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-64",
                "description": "64 vCPUs 256 GB RAM",
                "guestCpus": 64,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-8",
                "description": "8 vCPUs 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "901080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2-standard-80",
                "description": "80 vCPUs 320 GB RAM",
                "guestCpus": 80,
                "memoryMb": 327680,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910128",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-128",
                "description": "128 vCPUs 128 GB RAM",
                "guestCpus": 128,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-128",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-16",
                "description": "16 vCPUs 16 GB RAM",
                "guestCpus": 16,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-2",
                "description": "2 vCPUs 2 GB RAM",
                "guestCpus": 2,
                "memoryMb": 2048,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910224",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-224",
                "description": "224 vCPUs 224 GB RAM",
                "guestCpus": 224,
                "memoryMb": 229376,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-224",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-32",
                "description": "32 vCPUs 32 GB RAM",
                "guestCpus": 32,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-4",
                "description": "4 vCPUs 4 GB RAM",
                "guestCpus": 4,
                "memoryMb": 4096,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-48",
                "description": "48 vCPUs 48 GB RAM",
                "guestCpus": 48,
                "memoryMb": 49152,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-64",
                "description": "64 vCPUs 64 GB RAM",
                "guestCpus": 64,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-8",
                "description": "8 vCPUs 8 GB RAM",
                "guestCpus": 8,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-80",
                "description": "80 vCPUs 80 GB RAM",
                "guestCpus": 80,
                "memoryMb": 81920,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "910096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highcpu-96",
                "description": "96 vCPUs 96 GB RAM",
                "guestCpus": 96,
                "memoryMb": 98304,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-16",
                "description": "16 vCPUs 128 GB RAM",
                "guestCpus": 16,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-2",
                "description": "2 vCPUs 16 GB RAM",
                "guestCpus": 2,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-32",
                "description": "32 vCPUs 256 GB RAM",
                "guestCpus": 32,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-4",
                "description": "4 vCPUs 32 GB RAM",
                "guestCpus": 4,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-48",
                "description": "48 vCPUs 384 GB RAM",
                "guestCpus": 48,
                "memoryMb": 393216,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-64",
                "description": "64 vCPUs 512 GB RAM",
                "guestCpus": 64,
                "memoryMb": 524288,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-8",
                "description": "8 vCPUs 64 GB RAM",
                "guestCpus": 8,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-80",
                "description": "80 vCPUs 640 GB RAM",
                "guestCpus": 80,
                "memoryMb": 655360,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "912096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-highmem-96",
                "description": "96 vCPUs 768 GB RAM",
                "guestCpus": 96,
                "memoryMb": 786432,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911128",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-128",
                "description": "128 vCPUs 512 GB RAM",
                "guestCpus": 128,
                "memoryMb": 524288,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-128",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911016",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-16",
                "description": "16 vCPUs 64 GB RAM",
                "guestCpus": 16,
                "memoryMb": 65536,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-16",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911002",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-2",
                "description": "2 vCPUs 8 GB RAM",
                "guestCpus": 2,
                "memoryMb": 8192,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-2",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911224",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-224",
                "description": "224 vCPUs 896 GB RAM",
                "guestCpus": 224,
                "memoryMb": 917504,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-224",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911032",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-32",
                "description": "32 vCPUs 128 GB RAM",
                "guestCpus": 32,
                "memoryMb": 131072,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-32",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911004",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-4",
                "description": "4 vCPUs 16 GB RAM",
                "guestCpus": 4,
                "memoryMb": 16384,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-4",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911048",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-48",
                "description": "48 vCPUs 192 GB RAM",
                "guestCpus": 48,
                "memoryMb": 196608,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-48",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911064",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-64",
                "description": "64 vCPUs 256 GB RAM",
                "guestCpus": 64,
                "memoryMb": 262144,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-64",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911008",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-8",
                "description": "8 vCPUs 32 GB RAM",
                "guestCpus": 8,
                "memoryMb": 32768,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-8",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911080",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-80",
                "description": "80 vCPUs 320 GB RAM",
                "guestCpus": 80,
                "memoryMb": 327680,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-80",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            },
            {
                "id": "911096",
                "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                "name": "n2d-standard-96",
                "description": "96 vCPUs 384 GB RAM",
                "guestCpus": 96,
                "memoryMb": 393216,
                "imageSpaceGb": 0,
                "maximumPersistentDisks": 128,
                "maximumPersistentDisksSizeGb": "263168",
                "zone": "europe-west1-b",
                "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-96",
                "isSharedCpu": false,
                "kind": "compute#machineType"
            }
        ],
        "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes",
        "kind": "compute#machineTypeList"
    }

    response.send(machinetypes);
});


exports.machinetypes = functions.https.onRequest((request, response) => {
    cors(request, response, () => {
        var machinetypes = {
            "id": "projects/optum-80593/zones/europe-west1-b/machineTypes",
            "items": [
                {
                    "id": "801016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "c2-standard-16",
                    "description": "Compute Optimized: 16 vCPUs, 64 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "801030",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "c2-standard-30",
                    "description": "Compute Optimized: 30 vCPUs, 120 GB RAM",
                    "guestCpus": 30,
                    "memoryMb": 122880,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-30",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "801004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "c2-standard-4",
                    "description": "Compute Optimized: 4 vCPUs, 16 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "801060",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "c2-standard-60",
                    "description": "Compute Optimized: 60 vCPUs, 240 GB RAM",
                    "guestCpus": 60,
                    "memoryMb": 245760,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-60",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "801008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "c2-standard-8",
                    "description": "Compute Optimized: 8 vCPUs, 32 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/c2-standard-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "337016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highcpu-16",
                    "description": "Efficient Instance, 16 vCPUs, 16 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "337002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highcpu-2",
                    "description": "Efficient Instance, 2 vCPUs, 2 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 2048,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "337032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highcpu-32",
                    "description": "Efficient Instance, 32 vCPUs, 32 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "337004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highcpu-4",
                    "description": "Efficient Instance, 4 vCPUs, 4 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 4096,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "337008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highcpu-8",
                    "description": "Efficient Instance, 8 vCPUs, 8 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 8192,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highcpu-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "336016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highmem-16",
                    "description": "Efficient Instance, 16 vCPUs, 128 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 131072,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "336002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highmem-2",
                    "description": "Efficient Instance, 2 vCPUs, 16 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "336004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highmem-4",
                    "description": "Efficient Instance, 4 vCPUs, 32 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "336008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-highmem-8",
                    "description": "Efficient Instance, 8 vCPUs, 64 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-highmem-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "334004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-medium",
                    "description": "Efficient Instance, 2 vCPU (1/2 shared physical core) and 4 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 4096,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-medium",
                    "isSharedCpu": true,
                    "kind": "compute#machineType"
                },
                {
                    "id": "334002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-micro",
                    "description": "Efficient Instance, 2 vCPU (1/8 shared physical core) and 1 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 1024,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 16,
                    "maximumPersistentDisksSizeGb": "3072",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-micro",
                    "isSharedCpu": true,
                    "kind": "compute#machineType"
                },
                {
                    "id": "334003",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-small",
                    "description": "Efficient Instance, 2 vCPU (1/4 shared physical core) and 2 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 2048,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 16,
                    "maximumPersistentDisksSizeGb": "3072",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-small",
                    "isSharedCpu": true,
                    "kind": "compute#machineType"
                },
                {
                    "id": "335016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-standard-16",
                    "description": "Efficient Instance, 16 vCPUs, 64 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "335002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-standard-2",
                    "description": "Efficient Instance, 2 vCPUs, 8 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 8192,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "335032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-standard-32",
                    "description": "Efficient Instance, 32 vCPUs, 128 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 131072,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "335004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-standard-4",
                    "description": "Efficient Instance, 4 vCPUs, 16 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "335008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "e2-standard-8",
                    "description": "Efficient Instance, 8 vCPUs, 32 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/e2-standard-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "1000",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "f1-micro",
                    "description": "1 vCPU (shared physical core) and 0.6 GB RAM",
                    "guestCpus": 1,
                    "memoryMb": 614,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 16,
                    "maximumPersistentDisksSizeGb": "3072",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/f1-micro",
                    "isSharedCpu": true,
                    "kind": "compute#machineType"
                },
                {
                    "id": "2000",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "g1-small",
                    "description": "1 vCPU (shared physical core) and 1.7 GB RAM",
                    "guestCpus": 1,
                    "memoryMb": 1740,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 16,
                    "maximumPersistentDisksSizeGb": "3072",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/g1-small",
                    "isSharedCpu": true,
                    "kind": "compute#machineType"
                },
                {
                    "id": "9196",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "m1-megamem-96",
                    "description": "96 vCPUs, 1.4 TB RAM",
                    "guestCpus": 96,
                    "memoryMb": 1468006,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-megamem-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "11160",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "m1-ultramem-160",
                    "description": "160 vCPUs, 3844 GB RAM",
                    "guestCpus": 160,
                    "memoryMb": 3936256,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-160",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "11040",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "m1-ultramem-40",
                    "description": "40 vCPUs, 961 GB RAM",
                    "guestCpus": 40,
                    "memoryMb": 984064,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-40",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "11080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "m1-ultramem-80",
                    "description": "80 vCPUs, 1922 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 1968128,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/m1-ultramem-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "4016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highcpu-16",
                    "description": "16 vCPUs, 14.4 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 14746,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "4002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highcpu-2",
                    "description": "2 vCPUs, 1.8 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 1843,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "4032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highcpu-32",
                    "description": "32 vCPUs, 28.8 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 29491,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "4004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highcpu-4",
                    "description": "4 vCPUs, 3.6 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 3686,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "4064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highcpu-64",
                    "description": "64 vCPUs, 57.6 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 58982,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "4008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highcpu-8",
                    "description": "8 vCPUs, 7.2 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 7373,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "4096",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highcpu-96",
                    "description": "96 vCPUs, 86 GB RAM",
                    "guestCpus": 96,
                    "memoryMb": 88474,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highcpu-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "5016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highmem-16",
                    "description": "16 vCPUs, 104 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 106496,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "5002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highmem-2",
                    "description": "2 vCPUs, 13 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 13312,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "5032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highmem-32",
                    "description": "32 vCPUs, 208 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 212992,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "5004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highmem-4",
                    "description": "4 vCPUs, 26 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 26624,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "5064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highmem-64",
                    "description": "64 vCPUs, 416 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 425984,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "5008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highmem-8",
                    "description": "8 vCPUs, 52 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 53248,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "5096",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-highmem-96",
                    "description": "96 vCPUs, 624 GB RAM",
                    "guestCpus": 96,
                    "memoryMb": 638976,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-highmem-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "9096",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-megamem-96",
                    "description": "96 vCPUs, 1.4 TB RAM",
                    "guestCpus": 96,
                    "memoryMb": 1468006,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "deprecated": {
                        "state": "DEPRECATED",
                        "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-megamem-96"
                    },
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-megamem-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3001",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-1",
                    "description": "1 vCPU, 3.75 GB RAM",
                    "guestCpus": 1,
                    "memoryMb": 3840,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-1",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-16",
                    "description": "16 vCPUs, 60 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 61440,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-2",
                    "description": "2 vCPUs, 7.5 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 7680,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-32",
                    "description": "32 vCPUs, 120 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 122880,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-4",
                    "description": "4 vCPUs, 15 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 15360,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-64",
                    "description": "64 vCPUs, 240 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 245760,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-8",
                    "description": "8 vCPUs, 30 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 30720,
                    "imageSpaceGb": 10,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "3096",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-standard-96",
                    "description": "96 vCPUs, 360 GB RAM",
                    "guestCpus": 96,
                    "memoryMb": 368640,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-standard-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "10160",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-ultramem-160",
                    "description": "160 vCPUs, 3844 GB RAM",
                    "guestCpus": 160,
                    "memoryMb": 3936256,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "deprecated": {
                        "state": "DEPRECATED",
                        "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-160"
                    },
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-160",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "10040",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-ultramem-40",
                    "description": "40 vCPUs, 961 GB RAM",
                    "guestCpus": 40,
                    "memoryMb": 984064,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "deprecated": {
                        "state": "DEPRECATED",
                        "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-40"
                    },
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-40",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "10080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n1-ultramem-80",
                    "description": "80 vCPUs, 1922 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 1968128,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "deprecated": {
                        "state": "DEPRECATED",
                        "replacement": "https://www.googleapis.com/compute/v1/projects/optum-80593/global/machineTypes/m1-ultramem-80"
                    },
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n1-ultramem-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-16",
                    "description": "16 vCPUs 16 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-2",
                    "description": "2 vCPUs 2 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 2048,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-32",
                    "description": "32 vCPUs 32 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-4",
                    "description": "4 vCPUs 4 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 4096,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903048",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-48",
                    "description": "48 vCPUs 48 GB RAM",
                    "guestCpus": 48,
                    "memoryMb": 49152,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-48",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-64",
                    "description": "64 vCPUs 64 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-8",
                    "description": "8 vCPUs 8 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 8192,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "903080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highcpu-80",
                    "description": "80 vCPUs 80 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 81920,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highcpu-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-16",
                    "description": "16 vCPUs 128 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 131072,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-2",
                    "description": "2 vCPUs 16 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-32",
                    "description": "32 vCPUs 256 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 262144,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-4",
                    "description": "4 vCPUs 32 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902048",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-48",
                    "description": "48 vCPUs 384 GB RAM",
                    "guestCpus": 48,
                    "memoryMb": 393216,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-48",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-64",
                    "description": "64 vCPUs 512 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 524288,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-8",
                    "description": "8 vCPUs 64 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "902080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-highmem-80",
                    "description": "80 vCPUs 640 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 655360,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-16",
                    "description": "16 vCPUs 64 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-2",
                    "description": "2 vCPUs 8 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 8192,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-32",
                    "description": "32 vCPUs 128 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 131072,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-4",
                    "description": "4 vCPUs 16 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901048",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-48",
                    "description": "48 vCPUs 192 GB RAM",
                    "guestCpus": 48,
                    "memoryMb": 196608,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-48",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-64",
                    "description": "64 vCPUs 256 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 262144,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-8",
                    "description": "8 vCPUs 32 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "901080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2-standard-80",
                    "description": "80 vCPUs 320 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 327680,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-standard-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910128",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-128",
                    "description": "128 vCPUs 128 GB RAM",
                    "guestCpus": 128,
                    "memoryMb": 131072,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-128",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-16",
                    "description": "16 vCPUs 16 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-2",
                    "description": "2 vCPUs 2 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 2048,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910224",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-224",
                    "description": "224 vCPUs 224 GB RAM",
                    "guestCpus": 224,
                    "memoryMb": 229376,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-224",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-32",
                    "description": "32 vCPUs 32 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-4",
                    "description": "4 vCPUs 4 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 4096,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910048",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-48",
                    "description": "48 vCPUs 48 GB RAM",
                    "guestCpus": 48,
                    "memoryMb": 49152,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-48",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-64",
                    "description": "64 vCPUs 64 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-8",
                    "description": "8 vCPUs 8 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 8192,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-80",
                    "description": "80 vCPUs 80 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 81920,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "910096",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highcpu-96",
                    "description": "96 vCPUs 96 GB RAM",
                    "guestCpus": 96,
                    "memoryMb": 98304,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highcpu-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-16",
                    "description": "16 vCPUs 128 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 131072,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-2",
                    "description": "2 vCPUs 16 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-32",
                    "description": "32 vCPUs 256 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 262144,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-4",
                    "description": "4 vCPUs 32 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912048",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-48",
                    "description": "48 vCPUs 384 GB RAM",
                    "guestCpus": 48,
                    "memoryMb": 393216,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-48",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-64",
                    "description": "64 vCPUs 512 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 524288,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-8",
                    "description": "8 vCPUs 64 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-80",
                    "description": "80 vCPUs 640 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 655360,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "912096",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-highmem-96",
                    "description": "96 vCPUs 768 GB RAM",
                    "guestCpus": 96,
                    "memoryMb": 786432,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-highmem-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911128",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-128",
                    "description": "128 vCPUs 512 GB RAM",
                    "guestCpus": 128,
                    "memoryMb": 524288,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-128",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911016",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-16",
                    "description": "16 vCPUs 64 GB RAM",
                    "guestCpus": 16,
                    "memoryMb": 65536,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-16",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911002",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-2",
                    "description": "2 vCPUs 8 GB RAM",
                    "guestCpus": 2,
                    "memoryMb": 8192,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-2",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911224",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-224",
                    "description": "224 vCPUs 896 GB RAM",
                    "guestCpus": 224,
                    "memoryMb": 917504,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-224",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911032",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-32",
                    "description": "32 vCPUs 128 GB RAM",
                    "guestCpus": 32,
                    "memoryMb": 131072,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-32",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911004",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-4",
                    "description": "4 vCPUs 16 GB RAM",
                    "guestCpus": 4,
                    "memoryMb": 16384,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-4",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911048",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-48",
                    "description": "48 vCPUs 192 GB RAM",
                    "guestCpus": 48,
                    "memoryMb": 196608,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-48",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911064",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-64",
                    "description": "64 vCPUs 256 GB RAM",
                    "guestCpus": 64,
                    "memoryMb": 262144,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-64",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911008",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-8",
                    "description": "8 vCPUs 32 GB RAM",
                    "guestCpus": 8,
                    "memoryMb": 32768,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-8",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911080",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-80",
                    "description": "80 vCPUs 320 GB RAM",
                    "guestCpus": 80,
                    "memoryMb": 327680,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-80",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                },
                {
                    "id": "911096",
                    "creationTimestamp": "1969-12-31T16:00:00.000-08:00",
                    "name": "n2d-standard-96",
                    "description": "96 vCPUs 384 GB RAM",
                    "guestCpus": 96,
                    "memoryMb": 393216,
                    "imageSpaceGb": 0,
                    "maximumPersistentDisks": 128,
                    "maximumPersistentDisksSizeGb": "263168",
                    "zone": "europe-west1-b",
                    "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2d-standard-96",
                    "isSharedCpu": false,
                    "kind": "compute#machineType"
                }
            ],
            "selfLink": "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes",
            "kind": "compute#machineTypeList"
        }
        response.send(machinetypes);
    });

});

// deprecated, optumwatcher schreibt direkt in db
exports.addlog = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        admin.firestore().collection("logs").add({
            customerid: req.body.customerid,
            message: req.body.message,
            localdatetime: req.body.localdatetime,
            datetime: new Date().getTime(),
            machinename: req.body.machinename
            //        ip4: req.body.ip4, ip6: req.body.ip6, meta: {}
        });


        // handle state, Problem: addlog wird unterschiedlich über API aufgerufen
        var val = {
            // ip4: req.body.ip4,
            // ip6: req.body.ip6,
            machinename: req.body.machinename,
            message: req.body.message,
            datetime: req.body.localdatetime,
            customerid: req.body.customerid
        }
        // if (val) {
        //     admin.firestore().collection("machines/" + val.machinename + "/logs").add(val);
        //     admin.firestore().doc("machines/" + val.machinename).update({ lastlog: val.message, lastlogtime: val.datetime }); // TODO: lag Lösung?
        //     // handle state
        //     if (val.message == "start optumwatcher") {
        //         admin.firestore().doc("machines/" + val.machinename).update({ starttime: val.datetime, state: "job started", lastlog: "job started" });
        //     }
        //     if (val.message == "Dummy application completed") {
        //         admin.firestore().doc("machines/" + val.machinename).update({ endtime: val.datetime, state: "job completed", lastlog: "job completed" });
        //         // TODO: kill VM
        //         // TODO: error handling
        //     }
        //     // TODO calc credits
        // }
        response.send("success");
    });
});

exports.setmachinestate = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        console.log('setmaschinestate', req.body);
        try {
            admin.firestore().doc("machines/" + req.body.machinename).set(
                {
                    customerid: req.body.customerid,
                    state: req.body.state,
                    datetime: new Date().getTime(),
                    //   ip4: req.body.ip4, ip6: req.body.ip6,
                    machinename: req.body.machinename,
                    meta: req.body.meta
                });
            response.send("success");
        } catch (err) {
            console.error(err);
            response.send("error");
        }
    });
});


exports.addcustomerevent = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        admin.firestore().collection("customerevents").add({
            customerid: req.body.customerid,
            message: req.body.message,
            datetime: new Date().getTime(),
            machinename: req.body.machinename
            //   ip4: req.body.ip4, ip6: req.body.ip6, meta: {}
        });
        response.send("success");
    });
});




exports.stopVM = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        console.log('STOPVM!');

        console.log('STOPVM' + req.body.vmname);
        console.log('STOPVM' + req.body.machinename);


        const zone = compute.zone(zonename);
        const vm = zone.vm(req.body.vmname);

        await vm.delete().then(async (data) => {
            console.log('deleted')
            const operation = data[0];
            const apiResponse = data[1];
            admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'delete apiResponse' });//, meta: JSON.parse(JSON.stringify(apiResponse)) });


            // calculate credits from usage time
            var olddoc = (await admin.firestore().doc("machines/" + req.body.machinename).get()).data();
            //        await admin.firestore().doc("machines/" + vmName).update({ state: 'booting', machinetype: md, customerid: customerid, clusterid: clusterid, jobid: jobid });
            console.log('olddoc:', olddoc);
            var starttime = olddoc.startTime;
            var endtime = new Date().getTime();
            var timediff = endtime - starttime;
            var creditsused = olddoc.machinetype.creditsminute * timediff / 1000 / 60
            var customerid = olddoc.customerid;
            await admin.firestore().doc("machines/" + req.body.machinename).update({
                endtime: endtime,
                state: 'deleted',
                creditsused: creditsused,
                tokensused: creditsused
            }); // TODO: lag Lösung?
            // add customer tokens (Firestore - legacy)
            var oldvalue = (await admin.firestore().doc("customers/" + customerid).get()).data();
            var currentTokensUsed = Number(oldvalue.tokensused ?? oldvalue.creditsused ?? 0);
            var newvalue = currentTokensUsed + creditsused;
            await admin.firestore().doc("customers/" + customerid).update({
                tokensused: newvalue,
                creditsused: newvalue,
                lastUsage: new Date().getTime()
            });

            // Report usage to License Management API (MySQL backend)
            // The accountId in the license system should be mapped from customerid
            // For now, we'll try to use the account_id if it's stored in the customer record
            var accountId = oldvalue.account_id || customerid;
            var runtimeMinutes = timediff / 1000 / 60;
            var licenseApiResult = await reportVMUsageToLicenseAPI(
                accountId,
                creditsused,
                req.body.machinename,
                req.body.vmname,
                olddoc.machinetype?.name || 'unknown',
                runtimeMinutes,
                zonename
            );
            console.log('License API result:', licenseApiResult);

            console.log('VM Deleted!')
            response.send({ success: true, licenseApiResult: licenseApiResult });
        });



    });
});
exports.startVM = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        const zone = compute.zone(zonename);
        const vm = zone.vm(req.body.vmname);

        admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'start vm' });
        await vm.start().then((data) => {
            const operation = data[0];
            const apiResponse = data[1];
            // admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'startvm operation', meta: JSON.parse(JSON.stringify(operation)) });
            admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'startvm apiResponse', meta: JSON.parse(JSON.stringify(apiResponse)) });
        });
        response.send({ success: true });

    });
});
exports.getVM = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        const zone = compute.zone(zonename);
        const vm = zone.vm('instance-5');
        await vm.get().then((data) => {
            const vm = data[0];
            const apiResponse = data[1];
            //  admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'getvm vm', meta: JSON.parse(JSON.stringify(vm)) });
            admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'getvm apiResponse', meta: JSON.parse(JSON.stringify(apiResponse)) });
        });
        response.send({ success: true });

    });
});



exports.getImage = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        const image = compute.image('projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20210720');
        image.get().then(function (data) {
            const image = data[0];
            const apiResponse = data[1];

            var parsed = JSON.parse(JSON.stringify(data[0]));
            response.send(parsed);
        });
    });
});


exports.createVM = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        if (req.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        const customerId = normalizeString(getRequestValue(req, "customer")).trim();
        const requestedMachineType = normalizeString(getRequestValue(req, "type")).trim();
        const jobId = getRequestValue(req, "jobId");
        const clusterId = getRequestValue(req, "clusterId");
        const projectJsonInput = getRequestValue(req, "projectJson") ?? getRequestValue(req, "project");
        const projectFilePathRaw = getRequestValue(req, "projectFile") ?? getRequestValue(req, "projectFilePath");
        const meshFilePathRaw = getRequestValue(req, "meshFile") ?? getRequestValue(req, "meshFilePath") ?? getRequestValue(req, "mesh");

        if (!customerId || !requestedMachineType) {
            response.status(400).json({ error: "customer and type are required" });
            return;
        }

        let projectDefinition = null;
        if (projectJsonInput !== undefined && projectJsonInput !== null) {
            try {
                projectDefinition = parseProjectDefinition(projectJsonInput);
            } catch (error) {
                response.status(400).json({ error: "projectJson must be valid JSON" });
                return;
            }
        }

        const projectFilePath = normalizeString(projectFilePathRaw).trim();
        if (!projectFilePath) {
            response.status(400).json({ error: "projectFile is required" });
            return;
        }
        if (!projectFilePath.startsWith("gs://")) {
            response.status(400).json({ error: "projectFile must be a gs:// path" });
            return;
        }

        const meshFilePath = normalizeString(meshFilePathRaw).trim();
        if (!meshFilePath) {
            response.status(400).json({ error: "meshFile is required" });
            return;
        }
        if (!meshFilePath.startsWith("gs://")) {
            response.status(400).json({ error: "meshFile must be a gs:// path" });
            return;
        }

        try {
            const customerSnapshot = await admin.firestore().doc(`customers/${customerId}`).get();
            if (!customerSnapshot.exists) {
                response.status(404).json({ error: "Customer not found" });
                return;
            }
            const customerData = customerSnapshot.data();

            // Check credits in License Management API before creating VM
            const accountId = customerData.account_id || customerId;
            const creditCheck = await checkCreditsForVM(accountId, 1);
            if (creditCheck.success && creditCheck.data && !creditCheck.data.can_start) {
                functions.logger.warn('Insufficient credits to start VM', { accountId, creditCheck });
                response.status(403).json({
                    error: "Insufficient credits",
                    message: creditCheck.data.message,
                    available_credits: creditCheck.data.available_credits
                });
                return;
            }

            const machineTypeCandidates = buildMachineTypeCandidates(requestedMachineType);
            let machineTypeSnapshot = null;
            let resolvedMachineTypeName = null;

            for (const candidate of machineTypeCandidates) {
                const snapshot = await admin.firestore().collection("machinetypes")
                    .where("name", "==", candidate)
                    .limit(1)
                    .get();
                if (!snapshot.empty) {
                    machineTypeSnapshot = snapshot;
                    resolvedMachineTypeName = candidate;
                    break;
                }
            }

            if (!machineTypeSnapshot) {
                response.status(404).json({ error: "Machine type not found" });
                return;
            }

            const machineTypeData = machineTypeSnapshot.docs[0].data();
            const effectiveMachineTypeName = resolvedMachineTypeName || machineTypeData.name || requestedMachineType;
            if (machineTypeData.enabled === false) {
                response.status(400).json({ error: "Machine type disabled" });
                return;
            }

            const vmName = buildVmName(customerId);
            const machineTypePath = machineTypeData.selfLink || `projects/${projectId}/zones/${zonename}/machineTypes/${effectiveMachineTypeName}`;
            const zoneInstance = compute.zone(zonename);
            const vmDocRef = admin.firestore().doc(`machines/${vmName}`);
            const requestTimestamp = new Date().getTime();

            const machineRecord = {
                machinename: vmName,
                customerid: customerId,
                machinetype: machineTypeData,
                requestedType: requestedMachineType,
                resolvedMachineType: effectiveMachineTypeName,
                state: "provisioning",
                creditsused: 0,
                tokensused: 0,
                startTime: requestTimestamp,
                provisiontime: requestTimestamp,
                source: "external-api",
                meshFilePath,
                projectDefinition,
                projectFilePath
            };

            if (jobId) {
                machineRecord.jobid = jobId;
            }
            if (clusterId) {
                machineRecord.clusterid = clusterId;
            }
            if (req.body && typeof req.body.metadata === "object") {
                machineRecord.requestMetadata = req.body.metadata;
            }

            await vmDocRef.set(machineRecord);

            const metadataItems = [];
            if (meshFilePath) {
                metadataItems.push({
                    key: "mesh-file-path",
                    value: meshFilePath
                });
            }
            if (projectFilePath) {
                metadataItems.push({
                    key: "project-file-path",
                    value: projectFilePath
                });
            }
            if (projectDefinition) {
                metadataItems.push({
                    key: "project-json",
                    value: stringifyMetadataValue(projectDefinition)
                });
            }

            const vmConfig = {
                canIpForward: false,
                confidentialInstanceConfig: {
                    enableConfidentialCompute: false
                },
                deletionProtection: false,
                description: "",
                disks: [
                    {
                        autoDelete: true,
                        boot: true,
                        initializeParams: {
                            diskSizeGb: String(machineTypeData.diskSizeGb || 10),
                            diskType: DEFAULT_DISK_TYPE,
                            labels: {},
                            sourceImage: DEFAULT_IMAGE
                        },
                        mode: "READ_WRITE",
                        type: "PERSISTENT"
                    }
                ],
                displayDevice: {
                    enableDisplay: false
                },
                guestAccelerators: [],
                labels: {},
                machineType: machineTypePath,
                metadata: {
                    items: metadataItems
                },
                networkInterfaces: [
                    {
                        subnetwork: DEFAULT_SUBNETWORK
                    }
                ],
                reservationAffinity: {
                    consumeReservationType: "ANY_RESERVATION"
                },
                scheduling: {
                    automaticRestart: true,
                    onHostMaintenance: "MIGRATE",
                    preemptible: false
                },
                serviceAccounts: [
                    {
                        email: DEFAULT_SERVICE_ACCOUNT,
                        scopes: DEFAULT_SCOPES
                    }
                ],
                shieldedInstanceConfig: {
                    enableIntegrityMonitoring: true,
                    enableSecureBoot: false,
                    enableVtpm: true
                },
                tags: {
                    items: []
                },
                zone: `projects/${projectId}/zones/${zonename}`
            };

            let apiResponse;
            try {
                const [, , rawResponse] = await zoneInstance.createVM(vmName, vmConfig);
                apiResponse = rawResponse;
            } catch (error) {
                functions.logger.error("createVM compute failed", { error, customerId, machineTypeName: effectiveMachineTypeName, requestedMachineType, vmName });
                await vmDocRef.update({
                    state: "error",
                    error: error.message,
                    errorAt: new Date().getTime()
                });
                response.status(500).json({ error: "Failed to create VM" });
                return;
            }

            await vmDocRef.update({
                state: "booting",
                gceId: apiResponse?.id || null,
                lastProvisionUpdate: new Date().getTime()
            });

            admin.firestore().collection("logs").add({
                datetime: new Date().getTime(),
                message: "external createVM",
                meta: {
                    customerId,
                    requestedMachineType,
                    machineTypeName: effectiveMachineTypeName,
                    vmName,
                    computeId: apiResponse?.id || null,
                    meshFilePath,
                    projectFilePath,
                    projectProvided: Boolean(projectDefinition)
                }
            });

            response.status(201).json({
                vmName,
                computeId: apiResponse?.id || null,
                state: "booting"
            });
        } catch (error) {
            functions.logger.error("createVM unexpected failure", { error, customerId, requestedMachineType });
            response.status(500).json({ error: "Unexpected error creating VM" });
        }
    });
});

exports.getComputeState = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        if (req.method !== "GET" && req.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        const computeIdInput = getRequestValue(req, "computid") ?? getRequestValue(req, "computeId");
        const computeId = normalizeString(computeIdInput).trim();

        if (!computeId) {
            response.status(400).json({ error: "computid is required" });
            return;
        }

        try {
            const snapshot = await admin.firestore()
                .collection("machines")
                .where("gceId", "==", computeId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                response.status(404).json({ error: "Compute not found" });
                return;
            }

            const doc = snapshot.docs[0];
            const machine = toPlainObject(doc.data());
            const lastStateChange = machine.lastProvisionUpdate ?? machine.datetime ?? machine.provisiontime ?? machine.startTime ?? null;

            response.json({
                computeId,
                machineName: doc.id,
                state: machine.state || "unknown",
                customer: machine.customerid || null,
                requestedType: machine.requestedType || machine.machinetype?.name || null,
                lastStateChange
            });
        } catch (error) {
            functions.logger.error("getComputeState failed", { error, computeId });
            response.status(500).json({ error: "Failed to load compute state" });
        }
    });
});

exports.getSimulationResults = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        if (req.method !== "GET" && req.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        const computeIdInput = getRequestValue(req, "computid") ?? getRequestValue(req, "computeId");
        const computeId = normalizeString(computeIdInput).trim();

        if (!computeId) {
            response.status(400).json({ error: "computid is required" });
            return;
        }

        try {
            const snapshot = await admin.firestore()
                .collection("machines")
                .where("gceId", "==", computeId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                response.status(404).json({ error: "Compute not found" });
                return;
            }

            const doc = snapshot.docs[0];
            const machine = toPlainObject(doc.data());
            const resultPath = machine.resultFilePath || machine.result?.path || null;

            if (!resultPath) {
                response.status(404).json({ error: "Result file not available" });
                return;
            }

            const { bucketName, objectPath } = resolveStorageReference(resultPath);
            let signedUrl = null;
            let expiresAt = null;
            if (bucketName && objectPath) {
                try {
                    const expires = Date.now() + 60 * 60 * 1000;
                    const [url] = await admin.storage().bucket(bucketName).file(objectPath).getSignedUrl({
                        action: "read",
                        expires
                    });
                    signedUrl = url;
                    expiresAt = new Date(expires).toISOString();
                } catch (error) {
                    functions.logger.error("getSimulationResults signing failed", { error, computeId, bucketName, objectPath });
                }
            }

            response.json({
                computeId,
                machineName: doc.id,
                state: machine.state || null,
                resultFilePath: resultPath,
                downloadUrl: signedUrl,
                downloadUrlExpiresAt: expiresAt
            });
        } catch (error) {
            functions.logger.error("getSimulationResults failed", { error, computeId });
            response.status(500).json({ error: "Failed to load simulation results" });
        }
    });
});

exports.uploadFile = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        if (req.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        const customerId = normalizeString(getRequestValue(req, "customer")).trim();
        const projectId = normalizeString(getRequestValue(req, "project")).trim();
        const filenameInput = getRequestValue(req, "filename");
        const contentType = normalizeString(getRequestValue(req, "contentType")).trim() || "application/octet-stream";
        const filePayload = getRequestValue(req, "file");

        if (!customerId || !projectId) {
            response.status(400).json({ error: "customer and project are required" });
            return;
        }
        if (!filePayload || typeof filePayload !== "string") {
            response.status(400).json({ error: "file must be a base64 string" });
            return;
        }

        const buffer = bufferFromBase64(filePayload);
        if (!buffer || !buffer.length) {
            response.status(400).json({ error: "file could not be decoded" });
            return;
        }

        const filename = sanitizeFilename(filenameInput, "mesh");
        const timestamp = new Date().getTime();
        const bucket = admin.storage().bucket();
        const storagePath = `projects/${projectId}/${customerId}/${timestamp}-${filename}`;

        try {
            await bucket.file(storagePath).save(buffer, {
                metadata: {
                    contentType,
                    metadata: {
                        customerId,
                        projectId,
                        originalFilename: filename
                    }
                },
                resumable: false
            });
        } catch (error) {
            functions.logger.error("uploadFile storage save failed", { error, customerId, projectId, storagePath });
            response.status(500).json({ error: "Failed to upload file" });
            return;
        }

        const fileRecord = {
            customerId,
            projectId,
            filename,
            storagePath: `gs://${bucket.name}/${storagePath}`,
            objectPath: storagePath,
            contentType,
            size: buffer.length,
            uploadedAt: timestamp
        };

        try {
            const docRef = await admin.firestore().collection("projectFiles").add(fileRecord);
            response.status(201).json({
                fileId: docRef.id,
                ...fileRecord
            });
        } catch (error) {
            functions.logger.error("uploadFile firestore failed", { error, customerId, projectId, storagePath });
            response.status(500).json({ error: "Failed to record file metadata" });
        }
    });
});


exports.getCredits = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        if (req.method !== "GET" && req.method !== "POST") {
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        const customerId = normalizeString(getRequestValue(req, "customer")).trim();
        if (!customerId) {
            response.status(400).json({ error: "customer is required" });
            return;
        }

        try {
            const customerDoc = await admin.firestore().doc(`customers/${customerId}`).get();
            if (!customerDoc.exists) {
                response.status(404).json({ error: "Customer not found" });
                return;
            }

            const data = toPlainObject(customerDoc.data());
            const tokens = Number(data.tokens ?? data.credits ?? 0);
            const tokensUsed = Number(data.tokensused ?? data.creditsused ?? 0);
            const balance = tokens - tokensUsed;

            response.json({
                customer: customerId,
                tokens,
                tokensUsed,
                balance,
                credits: tokens,
                creditsUsed: tokensUsed
            });
        } catch (error) {
            functions.logger.error("getCredits failed", { error, customerId });
            response.status(500).json({ error: "Failed to load tokens" });
        }
    });
});


exports.testInstance = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {
        var customerid = req.body.customerid;
        var machinetype = req.body.machinetype;
        var clusterid = req.body.clusterid;
        var jobid = req.body.jobid;

        if (!customerid)
            customerid = "T22VDtiCN81Ryjvawibt";
        if (!machinetype)
            machinetype = 'n1-standard-1';
        var machineinfos = (await admin.firestore().collection("machinetypes").where("name", "==", machinetype).get());
        var md = machineinfos.docs[0].data();


        console.log('starte vm ' + customerid + ' ' + machinetype);

        let r = (Math.random() + 1).toString(36).substring(5);
        var vmName = "vm-" + customerid.toLowerCase() + "-" + clusterid + "-" + jobid; // + new Date().getTime();
        const zone = compute.zone(zonename);

        var config2 = {
            "canIpForward": false,
            "confidentialInstanceConfig": {
                "enableConfidentialCompute": false
            },
            "deletionProtection": false,
            machineType: machinetype,
            "description": "",
            "disks": [
                {
                    "autoDelete": true,
                    "boot": true,

                    "initializeParams": {
                        "diskSizeGb": "10",
                        "diskType": "projects/optum-80593/zones/us-central1-a/diskTypes/pd-balanced",
                        "labels": {},
                        "sourceImage": 'https://www.googleapis.com/compute/beta/projects/optum-80593/global/images/optumimg6'
                    },
                    "mode": "READ_WRITE",
                    "type": "PERSISTENT"
                }
            ],
            "displayDevice": {
                "enableDisplay": false
            },
            "guestAccelerators": [],
            "labels": {},
            "machineType": "projects/optum-80593/zones/us-central1-a/machineTypes/e2-medium",
            "metadata": {
                "items": []
            },

            "networkInterfaces": [
                {
                    "subnetwork": "projects/optum-80593/regions/us-central1/subnetworks/subnet-us-central1"
                }
            ],
            "reservationAffinity": {
                "consumeReservationType": "ANY_RESERVATION"
            },
            "scheduling": {
                "automaticRestart": true,
                "onHostMaintenance": "MIGRATE",
                "preemptible": false
            },
            "serviceAccounts": [
                {
                    "email": "158487002656-compute@developer.gserviceaccount.com",
                    "scopes": [
                        "https://www.googleapis.com/auth/devstorage.read_only",
                        "https://www.googleapis.com/auth/logging.write",
                        "https://www.googleapis.com/auth/monitoring.write",
                        "https://www.googleapis.com/auth/servicecontrol",
                        "https://www.googleapis.com/auth/service.management.readonly",
                        "https://www.googleapis.com/auth/trace.append"
                    ]
                }
            ],
            "shieldedInstanceConfig": {
                "enableIntegrityMonitoring": true,
                "enableSecureBoot": false,
                "enableVtpm": true
            },
            "tags": {
                "items": []
            },
            "zone": "projects/optum-80593/zones/us-central1-a"
        }

        await admin.firestore().doc("machines/" + vmName).set({ machinename: vmName, startTime: new Date().getTime(), provisiontime: new Date().getTime(), state: 'starting', jobid: jobid, clusterid, clusterid });

        await zone.createVM(vmName, config2).then(async (data) => {
            const vm = data[0];
            const operation = data[1];
            const apiResponse = data[2];

            var vmid = data[2].id;
            console.log('created vm ' + vmid);

            console.log('created vm ar' + JSON.stringify(apiResponse));

            //   console.log('data', data[0]);
            var parsed = JSON.parse(JSON.stringify(data[0]));

            await admin.firestore().doc("machines/" + vmName).update({ state: 'booting', machinetype: md, customerid: customerid, clusterid: clusterid, jobid: jobid });

            admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'created vm' + vmid, meta: JSON.parse(JSON.stringify(parsed)) });
            admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'created vm apiresp' + vmid, meta: JSON.parse(JSON.stringify(data[2])) });
            admin.firestore().collection("logs").add({ datetime: new Date().getTime(), message: 'created vm operation' + vmid, meta: JSON.parse(JSON.stringify(data[1])) });



            // await operation.on('complete', metadata => {
            //     console.log('complete1' + vmName)

            //     vm.getMetadata().then(data => {
            //         console.log('complete2' + vmName)
            //         const metadata = data[0];
            //         const ip = metadata['networkInterfaces'][0]['accessConfigs'][0]['natIP'];
            //         console.log(vmName + ' created, running at ' + ip);
            //         admin.firestore().doc("machines/" + ip).set({ state: "starting...", vmname: vmName })
            //         // console.log('Waiting for startup...')

            //         // const timer = setInterval(ip => {
            //         //     http.get(ip, res => {
            //         //         const { statusCode } = res
            //         //         if (statusCode === 200) {
            //         //             clearTimeout(timer);
            //         //             console.log('Ready!');
            //         //             this.afs.doc("machines/" + str).set({ state: "starting...", vmname: str })
            //         //         }

            //         //     }).on('error', () => process.stdout.write('.'))
            //         // }, 2000, 'http://' + ip)
            //     })
            //         .catch(
            //             err => console.error(err)
            //         );

            //     console.log('complete1b' + metadata)


            //   })

            response.send(parsed);
        }).catch(
            err => console.error(err)
        );;



    });
});

exports.waitVM = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {

        const zone = compute.zone(zonename);
        const vm = zone.vm('instance-5');

        vm.waitFor('RUNNING', function (err, metadata) {
            if (!err) {
                // The VM is running.
            }
        });
        const options = {
            timeout: 600
        };
        vm.waitFor('RUNNING', options).then(function (data) {
            const metadata = data[0];
        });


        vm.waitFor('TERMINATED', options, function (err, metadata) {
            if (!err) {
                // The VM is terminated.
            }
        });



    });
});






////////////
exports.createcluster = functions.https.onRequest(async (req, response) => {
    cors(req, response, async () => {


        //  var count = req.body.count;
        //  if (!count)
        var count = 4;

        var vmnames = [];
        for (var i = 0; i < count; i++) {

            console.log('startestvm',)
            //   var customerid = req.body.customerid;
            //   if (!customerid)
            var customerid = "T22VDtiCN81Ryjvawibt";

            var vmName = 'optumvm-' + new Date().getTime() + "_" + i;


            const zone = compute.zone(zonename);

            const config = {
                machineType: 'n1-standard-1',
                maintenancePolicy: 'MIGRATE',
                http: true,
                disks: [
                    {
                        boot: true,
                        initializeParams: {
                            //                        sourceImage: 'https://www.googleapis.com/compute/v1/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20210720'
                            // https://console.cloud.google.com/compute/machineImages/details/test1?project=optum-80593
                            sourceImage: 'https://www.googleapis.com/compute/beta/projects/optum-80593/global/images/optumimg6'
                            //                        sourceImage: 'https://www.googleapis.com/compute/beta/projects/optum-80593/global/images/image10'

                            //                                   'https://www.googleapis.com/compute/v1/projects/debian-cloud/global/images/debian-7-wheezy-v20150710'

                        }
                    }
                ]
            };


            await zone.createVM(vmName, config).then(function (data) {
                const vm = data[0];
                const operation = data[1];
                const apiResponse = data[2];

                var vmid = data[2].id;
                vmnames.push(vmid);
                console.log('data', data[0]);
                var parsed = JSON.parse(JSON.stringify(data[0]));

            });









        }

        response.send(JSON.stringify({ vmnames: vmnames }));


        response.send("success");
    });
});


// exports.logToBW = functions.firestore
//     .document("/logs/{logId}")
//     .onCreate((snap, context) => {
//         console.log('logToBW')
//         const newValue = snap.data();
//         admin.firestore().collection("logs2").add(newValue);
//     });



exports.logslisten = functions.firestore
    .document('logs/{docId}')
    .onWrite((change, context) => {

        console.log('logslisten')
        //   const oldDocument = change.before.data();
        const val = change.after.exists ? change.after.data() : null;



        if (val) {
            admin.firestore().collection("machines/" + val.machinename + "/logs").add(val);
            //       admin.firestore().doc("machines/" + val.machinename).update({ lastlog: val.message, lastlogtime: val.datetime }); // TODO: lag Lösung?
            // handle state
            // if (val.message == "start optumwatcher") {
            //     admin.firestore().doc("machines/" + val.machinename).update({ starttime: val.datetime, state: "job started", lastlog: "job started" });
            // }
            // if (val.message == "Dummy application completed") {
            //     admin.firestore().doc("machines/" + val.machinename).update({ endtime: val.datetime, state: "job completed", lastlog: "job completed" });
            //     // TODO: kill VM
            //     // TODO: error handling
            // }
            // TODO calc credits
        }



    });



function bufferFromBase64(raw) {
    if (typeof raw !== "string") {
        return null;
    }
    const cleaned = raw.includes(",") ? raw.substring(raw.indexOf(",") + 1) : raw;
    if (!cleaned.trim()) {
        return null;
    }
    try {
        return Buffer.from(cleaned, "base64");
    } catch (error) {
        return null;
    }
}

function sanitizeFilename(name, fallbackPrefix = "upload") {
    const fallback = `${fallbackPrefix}-${Date.now()}.bin`;
    if (!name || typeof name !== "string") {
        return fallback;
    }
    const trimmed = name.trim();
    if (!trimmed) {
        return fallback;
    }
    return trimmed.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function resolveStorageReference(path) {
    if (!path || typeof path !== "string") {
        return { bucketName: null, objectPath: null };
    }
    const trimmed = path.trim();
    const gsMatch = trimmed.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (gsMatch) {
        return { bucketName: gsMatch[1], objectPath: gsMatch[2] };
    }
    const bucketName = admin.storage().bucket().name;
    const objectPath = trimmed.startsWith("/") ? trimmed.substring(1) : trimmed;
    return { bucketName, objectPath };
}

const DOC_ENDPOINT_ALIASES = {
    createCompute: "createVM"
};

Object.entries(DOC_ENDPOINT_ALIASES).forEach(([docName, implementationName]) => {
    if (!exports[docName] && exports[implementationName]) {
        exports[docName] = exports[implementationName];
    }
});

function getRequestValue(req, key) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
        return req.body[key];
    }
    if (req.query && Object.prototype.hasOwnProperty.call(req.query, key)) {
        const value = req.query[key];
        return Array.isArray(value) ? value[0] : value;
    }
    return undefined;
}

function normalizeString(value) {
    if (value === undefined || value === null) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    return String(value);
}

function buildVmName(customerId) {
    const base = normalizeString(customerId).toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const prefix = base || "cust";
    const maxPrefixLength = Math.max(0, 63 - suffix.length - 4);
    const trimmedPrefix = prefix.substring(0, maxPrefixLength);
    const fallbackPrefix = maxPrefixLength > 0 ? "cust".substring(0, maxPrefixLength) : "";
    const prefixPart = trimmedPrefix || fallbackPrefix;
    const name = prefixPart ? `vm-${prefixPart}-${suffix}` : `vm-${suffix}`;
    return name.length > 63 ? name.substring(0, 63) : name;
}

function buildMachineTypeCandidates(machineTypeInput) {
    const normalized = normalizeString(machineTypeInput).trim();
    if (!normalized) {
        return [];
    }
    const candidates = [];
    const seen = new Set();

    const pushCandidate = (value) => {
        if (!value) {
            return;
        }
        if (seen.has(value)) {
            return;
        }
        seen.add(value);
        candidates.push(value);
    };

    pushCandidate(normalized);
    const alias = FRIENDLY_MACHINE_TYPE_ALIASES[normalized.toLowerCase()];
    if (alias) {
        pushCandidate(alias);
    }

    return candidates;
}

function toPlainObject(data) {
    return JSON.parse(JSON.stringify(data || {}));
}

function parseProjectDefinition(input) {
    if (input === undefined || input === null) {
        return null;
    }
    if (typeof input === "string") {
        const trimmed = input.trim();
        if (!trimmed) {
            return null;
        }
        return JSON.parse(trimmed);
    }
    if (typeof input === "object") {
        return toPlainObject(input);
    }
    return null;
}

function stringifyMetadataValue(value) {
    try {
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        const limit = 4096;
        return serialized.length > limit ? serialized.substring(0, limit) : serialized;
    } catch (error) {
        return "";
    }
}


function msToTime(duration) {
    var milliseconds = Math.floor((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}



// cronjob - Test running time and kill if anything went wrong
SERVER = "https://us-central1-optum-80593.cloudfunctions.net";
exports.scheduledFunction = functions.pubsub.schedule('every 1 minutes').onRun((context) => {
    console.log('This will be run every 2 minutes!');
    // http.get(SERVER + "/getComputeState").subscribe(x => {
    //     console.log('vms', x);
    //     admin.firestore().doc("states/vmsgce").set(x);

    // });


    const zone = compute.zone(zonename);
    zone.getVMs().then((data) => {
        //    console.log('data', data[0]);
        var parsed = JSON.parse(JSON.stringify(data[0]));

        admin.firestore().doc("states/vmsgce").set({ data: parsed });

        console.log('parsed.lenth', parsed.length);
        for (var i = 0; i < parsed.length; i++) {
            console.log('parsed i ', i)
            if (parsed[i]) {

                console.log('name', parsed[i].name)
                var m = {
                    name: parsed[i].name,
                    id: parsed[i].metadata.id,
                    state: parsed[i].metadata.status,
                    lastStartTimestamp: parsed[i].metadata.lastStartTimestamp,
                    lastStopTimestamp: parsed[i].metadata.lastStopTimestamp,

                    machineType: parsed[i].metadata.machineType,
                    zone: parsed[i].metadata.zone,
                    cpuPlatform: parsed[i].metadata.cpuPlatform,
                    networkinterface: parsed[i].metadata.networkInterfaces[0]

                }
                admin.firestore().doc("states/vmsgce/vms/" + m.id).set(m);
            }
            else {
                console.log('no ' + i)
            }



        }


        // response.send(parsed);
    });



    // deprecated
    // fetch(SERVER + "/getComputeState")
    //     .then(res => res.json())
    //     .then(
    //         json => {
    //             console.log('vms gotten')
    //             //     console.log('text' + json);
    //             // console.log('stringified: ' + JSON.stringify(json))
    //             var json = JSON.parse(JSON.stringify(json));
    //             admin.firestore().doc("states/vmsgce").set({ test: new Date().getTime() });
    //             console.log('vms', json);
    //             admin.firestore().doc("states/vmsgce").set({ data: json });

    //         }
    //     )

    return null;
});
