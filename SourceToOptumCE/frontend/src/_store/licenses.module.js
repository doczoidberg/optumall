import { licenseService } from '../_services';
const state = {
    all: {}
};

const actions = {
    getAll({ commit }) {
        commit('getAllRequest');
        licenseService.getAll()
            .then(
                licenses => commit('getAllSuccess', licenses),
                error => commit('getAllFailure', error)
            );
    },
    getAllByAdmin({ commit }) {
        commit('getAllRequest');
        licenseService.getAllByAdmin()
            .then(
                licenses => commit('getAllSuccess', licenses),
                error => commit('getAllFailure', error)
            );
    },
    getById({ commit }, id) {
        licenseService.getById(id)
            .then(
                license => commit('deleteSuccess', id),
                error => commit('deleteFailure', { id, error: error.toString() })
            );
    }
};

const mutations = {
    getAllRequest(state) {
        state.all = { loading: true };
    },
    getAllSuccess(state, response) {
        console.log('all licenses', response);
        // Handle both old format (array) and new format (object with licenses array)
        const licenses = response.licenses || response;
        const pagination = response.total ? {
            total: response.total,
            page: response.page,
            per_page: response.per_page,
            total_pages: response.total_pages
        } : null;
        state.all = { items: licenses, pagination };
    },
    getAllFailure(state, error) {
        console.error('licenses getAllFailure', error);
        state.all = { error };
    },
    deleteRequest(state, id) {
        state.all.items = state.all.items.map(license =>
            license.id === id
                ? { ...license, deleting: true }
                : license
        )
    },
    deleteSuccess(state, id) {
        // remove deleted license from state
        state.all.items = state.all.items.filter(license => license.id !== id)
    },
    deleteFailure(state, { id, error }) {
        // remove 'deleting:true' property and add 'deleteError:[error]' property to license
        state.all.items = state.items.map(license => {
            if (license.id === id) {
                // make copy of license without 'deleting:true' property
                const { deleting, ...licenseCopy } = license;
                // return copy of license with 'deleteError:[error]' property
                return { ...licenseCopy, deleteError: error };
            }

            return license;
        })
    }
};

export const licenses = {
    namespaced: true,
    state,
    actions,
    mutations
};
