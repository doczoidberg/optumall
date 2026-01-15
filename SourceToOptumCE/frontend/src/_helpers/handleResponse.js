export function handleResponse(response) {
    if (response.status === 401  || response.status === 403) {
        // auto logout if 401 response returned from api
        location.reload(true);
    }
    return response.text().then(text => {
        const data = text && JSON.parse(text);
        console.log("handleResponse");
        if (!response.ok) {
            if (response.status === 401) {
                // auto logout if 401 response returned from api
                location.reload(true);
            }

            const error = (data && data.message) || response.statusText;
            return Promise.reject(error);
        }

        return data;
    });
}
window.handleResponse = handleResponse;