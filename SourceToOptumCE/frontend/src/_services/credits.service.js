
import { httpClient } from '../_helpers';

export const creditsService = {
    getPackages,
    getBalance,
    getTransactions,
    createCheckoutSession
};

function getPackages() {
    return httpClient().get('api/credits/packages');
}

function getBalance(accountId = null) {
    const url = accountId ? `api/credits/balance/${accountId}` : 'api/credits/balance';
    return httpClient().get(url);
}

function getTransactions(accountId = null) {
    const url = accountId ? `api/credits/transactions/${accountId}` : 'api/credits/transactions';
    return httpClient().get(url);
}

function createCheckoutSession(packageId) {
    return httpClient().post('api/credits/checkout', JSON.stringify({ package_id: packageId }));
}
