export function authHeader() {
    // return authorization header with jwt token
    let user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token) {
        return {  'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + user.token
        } ;
    } else {
        return { 'Content-Type': 'application/json'} ;
    }
}
export function requestOptions() {
    // return authorization header with jwt token
   return {
    method: 'GET',
    headers: authHeader()
};
}
export function configHeaders() {
    // return authorization header with jwt token
   return {
    headers: authHeader()
};
}

export function responseStatus(status) {
    console.log('status', status)
    // Handle undefined status (network error)
    if (status === undefined) {
        console.log('Network error - no response');
        return;
    }
    // return authorization header with jwt token
    switch (status) {
        case 400:
            console.log('400 error');  // not getting here
            break;
        case 401:
            localStorage.removeItem('user');
            location.reload();
            console.log('401 error');  // or here
            break;
        case 403:
            localStorage.removeItem('user');
            location.reload();  // not getting here
            break;
        default:
            console.log('some other error');  // end up here all the time
            break;
        }
}
export function handleResponse(response) {
    console.log('response123', response);
    responseStatus(response.status);

    return response.text().then(text => {
        const data = text && JSON.parse(text);
        console.log("handleResponse");
        if (!response.ok) {
            const error = (data && data.message) || response.statusText;
            return Promise.reject(error);
        }

        return data;
    });
}