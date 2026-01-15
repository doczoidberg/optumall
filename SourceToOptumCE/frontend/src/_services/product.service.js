
import { httpClient } from '../_helpers';
export const productService = {
    getAll
};
function getAll() {
    return httpClient().get(`api/products`);
}