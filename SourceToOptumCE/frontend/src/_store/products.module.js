import { productService } from '../_services';
const state = {
    all: {}
};

const actions = {
    getAll({ commit }) {
        commit('getAllRequest');
        productService.getAll()
            .then(
                datas => commit('getAllSuccess', datas),
                error => commit('getAllFailure', error)
            );
    }
};

const mutations = {
    getAllRequest(state) {
        state.all = { loading: true };
    },
    getAllSuccess(state, datas) {
        console.log('all products', datas);
        state.all = { items: datas };
    },
    getAllFailure(state, error) {
        console.error('products getAllFailure', error);
        state.all = { error };
    }
};

export const products = {
    namespaced: true,
    state,
    actions,
    mutations
};
