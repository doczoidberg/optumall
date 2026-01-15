
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
                    role: res.user.role >= 1 ? 'admin' : 'user'
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

function getAll() {
    return httpClient().get(`api/users`);
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

