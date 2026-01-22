
import { httpClient } from '../_helpers';
export const licenseService = {
    getAll,
    getById,
    getAllByAdmin
};

function getAll() {
    return httpClient().get(`api/licenses`);
}

function getAllByAdmin(params = {}) {
    // Default to get_all=true to fetch all licenses without pagination
    const queryParams = { get_all: true, ...params };
    const queryString = Object.keys(queryParams)
        .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
        .join('&');
    return httpClient().get(`api/licenses/getAll?${queryString}`);
}

function getById(id) {
     return httpClient().get(`api/licenses/${id}`);
}

