
import { httpClient } from '../_helpers';

export const groupService = {
    getAll,
    update,
    delete: _delete
};
function getAll(params = {}) {
    // Default to get_all=true to fetch all groups without pagination
    const queryParams = { get_all: true, ...params };
    const queryString = Object.keys(queryParams)
        .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
        .join('&');
    return httpClient().get(`api/group?${queryString}`);
}
function update(user) {
    return httpClient().put(`api/group/${user.id}`, JSON.stringify(user));
}

// prefixed function name with underscore because delete is a reserved word in javascript
function _delete(id) {
    return httpClient().post(`api/group/delete/${id}`,{});
}
