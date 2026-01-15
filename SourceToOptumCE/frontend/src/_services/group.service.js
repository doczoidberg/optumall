
import { httpClient } from '../_helpers';

export const groupService = {
    getAll,
    update,
    delete: _delete
};
function getAll() {
    return  httpClient().get(`api/group`);
}
function update(user) {
    return httpClient().put(`api/group/${user.id}`, JSON.stringify(user));
}

// prefixed function name with underscore because delete is a reserved word in javascript
function _delete(id) {
    return httpClient().post(`api/group/delete/${id}`,{});
}
