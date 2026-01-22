import { groupService } from '../_services';
import Vue from 'vue';
const state = {
    all: {}
};

const actions = {
    getAll({ commit }) {
        commit('getAllRequest');

        groupService.getAll()
            .then(
                groups => commit('getAllSuccess', groups),
                error => commit('getAllFailure', error)
            );
    },
    delete({ commit }, id) {
        Vue.swal({
            icon: 'warning',
            title: 'Do you really want to delete?',
            text: '',
            showCancelButton: true,
        }).then((willDelete) => {
            if (willDelete.value) {
                commit('deleteRequest', id);
                groupService.delete(id)
                    .then(
                        group => commit('deleteSuccess', id),
                        error => commit('deleteFailure', error)
                    );
            }
          })

    }
};

const mutations = {
    getAllRequest(state) {
        state.all = { loading: true };
    },
    getAllSuccess(state, response) {
        console.log('all groups', response);
        // Handle both old format (array) and new format (object with data array)
        const groups = response.data || response;
        const pagination = response.total ? {
            total: response.total,
            page: response.page,
            per_page: response.per_page,
            total_pages: response.total_pages
        } : null;
        state.all = { items: groups, pagination };
    },
    deleteRequest(state, id) {
        state.all.items = state.all.items.map(group =>
            group.id === id
                ? { ...group, deleting: true }
                : group
        )
    },
    deleteSuccess(state, id) {
        // remove deleted group from state
        state.all.items = state.all.items.filter(group => group.id !== id)
    },
    deleteFailure(state, error) {
        console.log('error remove group',error)
        // alert(error)
        Vue.swal({
            icon: 'error',
            title:error,
            text: '',
        });
        // remove 'deleting:true' property and add 'deleteError:[error]' property to group
        // state.all.items = state.items.map(group => {
        //     if (group.id === id) {
        //         // make copy of group without 'deleting:true' property
        //         const { deleting, ...groupCopy } = group;
        //         // return copy of group with 'deleteError:[error]' property
        //         return { ...groupCopy, deleteError: error };
        //     }

        //     return group;
        // })
    }
};

export const groups = {
    namespaced: true,
    state,
    actions,
    mutations
};
