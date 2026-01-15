
import { httpClient } from '../_helpers';
export const licenseService = {
    getAll,
    getById,
    getAllByAdmin
};

function getAll() {
    return httpClient().get(`api/licenses`);
}

function getAllByAdmin() {
    return httpClient().get(`api/licenses/getAll`);
}

function getById(id) {
     return httpClient().get(`api/licenses/${id}`);
}

