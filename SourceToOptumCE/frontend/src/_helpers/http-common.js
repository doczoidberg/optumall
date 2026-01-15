import axios from 'axios';
import { authHeader} from '.';
import router from '../router';

export  function httpClient() {
    const axiosInstance = axios.create({
        baseURL: `${process.env.API_URL}/`,
        timeout: 30000,
        headers: authHeader()
    });
    axiosInstance.interceptors.response.use(function (response) {
        return response.data;
    }, function (error) {
        console.log("error", error)
        if (!error.response) {
            // Network error (no response from server)
            return Promise.reject('Network error: Cannot connect to server');
        }
        if (401 === error.response.status || 403 === error.response.status) {
            localStorage.removeItem('user');
            // location.reload();
            router.push("/login");
            return Promise.resolve(error.response);
        } else if(400 === error.response.status){
            const msg = error.response.data ? error.response.data.message : 'Connect to server faild, please try again!';
            return Promise.reject(msg);
        }else if(500 === error.response.status){
            const msg =  'Connect to server faild, please try again!';
            return Promise.reject(msg);
        }
        else {
            console.log(error.response.data)
            return Promise.reject(error);
        }
});
    return axiosInstance;
}