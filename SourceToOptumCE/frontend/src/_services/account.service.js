
import { httpClient } from '../_helpers';

export const accountService = {
    getAll,
    getById,
    searchAccounts
};

function getAll(params = {}) {
    // For superadmin, fetch all accounts
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isSuperAdmin = user && user.role === 2;

    const queryParams = isSuperAdmin
        ? { get_all: true, ...params }  // Superadmin gets all accounts
        : { per_page: 50, page: 1, ...params };  // Others get paginated

    const queryString = Object.keys(queryParams)
        .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
        .join('&');
    return httpClient().get(`api/accounts?${queryString}`);
}

function getById(id) {
    return httpClient().get(`api/accounts/${id}`);
}

function searchAccounts(query) {
    return httpClient().get(`api/admin/accounts/search?q=${encodeURIComponent(query)}`);
}
