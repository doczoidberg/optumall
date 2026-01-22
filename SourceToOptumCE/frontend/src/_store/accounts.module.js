import { accountService } from '../_services';

const state = {
    all: {}
};

const actions = {
    getAll({ commit }) {
        commit('getAllRequest');

        accountService.getAll()
            .then(
                accounts => commit('getAllSuccess', accounts),
                error => commit('getAllFailure', error)
            );
    }
};

const mutations = {
    getAllRequest(state) {
        state.all = { loading: true };
    },
    getAllSuccess(state, response) {
        // Handle both old format and new pagination format
        const accounts = response.accounts || response;
        const pagination = response.total ? {
            total: response.total,
            page: response.page,
            per_page: response.per_page,
            total_pages: response.total_pages
        } : null;
        state.all = { items: accounts, pagination };
    },
    getAllFailure(state, error) {
        state.all = { error };
    }
};

export const accounts = {
    namespaced: true,
    state,
    actions,
    mutations
};
