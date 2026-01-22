
import { httpClient } from '../_helpers';

export const userService = {
    login,
    logout,
    register,
    getAll,
    getById,
    getUserDetailById,
    update,
    getNotifications,
    delete: _delete
};

function login(username, password,code) {
    return httpClient().post(`api/auth/login`, JSON.stringify({user_name: username, password,code }))
        .then(res => {
            console.log('user', res);
            // login successful if there's a jwt token in the response
            if (res.token) {
                let responseJson = {
                    id: res.user.id,
                    username: res.user.user_name,
                    firstName: res.user.first_name,
                    lastName: res.user.last_name,
                    email: res.user.email,
                    token: res.token,
                    avatar: res.user.avatarUrl,
                    role: res.user.role, // Keep numeric role (0=user, 1=admin, 2=superadmin)
                    account_id: res.user.account_id // Add account_id for token purchases
                };
                // store user details and jwt token in local storage to keep user logged in between page refreshes
                localStorage.setItem('user', JSON.stringify(responseJson));
            }
            return res;
    });
}

function logout() {
    // remove user from local storage to log user out
    localStorage.removeItem('user');
}

function register(user) {
    return httpClient().post(`users/register`, JSON.stringify(user));
}

function getAll(params = {}) {
    // For superadmin, fetch all users. For others, default to pagination
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isSuperAdmin = user && user.role === 2;

    const queryParams = isSuperAdmin
        ? { get_all: true, ...params }  // Superadmin gets all users
        : { per_page: 50, page: 1, ...params };  // Others get paginated

    const queryString = Object.keys(queryParams)
        .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
        .join('&');
    return httpClient().get(`api/users?${queryString}`);
}
function getNotifications() {
    return httpClient().get(`api/notification`);
}

function getById() {
    return httpClient().get(`api/profile`);
}
function getUserDetailById(id) {
    return httpClient().get(`api/users/${id}`);
}
function update(user) {
    return httpClient().put(`api/users/${user.id}`, JSON.stringify(user));
}

// prefixed function name with underscore because delete is a reserved word in javascript
function _delete(id) {
    return httpClient().post(`api/users/delete/${id}`, {});
}

