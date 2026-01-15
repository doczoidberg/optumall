import { userService } from '../_services';
import Vue from 'vue';
const state = {
    all: {},
    profile: {},
    notifications:{}
};

const actions = {
    getNotifications({ commit }) {
        // commit('getAllRequest');

        userService.getNotifications()
            .then(
                notifications => commit('getNotificationsSuccess', notifications),
                error => commit('getAllFailure', error)
            );
    },
    getAll({ commit }) {
        commit('getAllRequest');

        userService.getAll()
            .then(
                users => commit('getAllSuccess', users),
                error => commit('getAllFailure', error)
            );
    },
    getById({ commit }) {
        // commit('getById');
        console.log("ssssssssssssssss")
        userService.getById()
            .then(
                profile => commit('getByIdSuccess', profile),
                error => commit('getAllFailure', error)
            );
    },

    delete({ commit, dispatch }, id) {
        Vue.swal({
            icon: 'warning',
            title: 'Do you really want to delete?',
            text: '',
            showCancelButton: true,
        }).then((willDelete) => {
            if (willDelete.value) {
                commit('deleteRequest', id);

                userService.delete(id)
                    .then(
                        user => dispatch('getAll'),
                        error => commit('deleteFailure', { id, error: error.toString() })
                    );
            }
          })
        // if(confirm("Do you really want to delete?")){
        //     commit('deleteRequest', id);

        //     userService.delete(id)
        //         .then(
        //             user => commit('deleteSuccess', id),
        //             error => commit('deleteFailure', { id, error: error.toString() })
        //         );
        // }

    }
};

const mutations = {
    getAllRequest(state) {
        state.all = { loading: true };
    },
    getAllSuccess(state, users) {
        state.all = { items: users.users };
    },
    getNotificationsSuccess(state, notify) {
        state.notifications = { items: notify };
    },

    getByIdSuccess(state, data) {
        console.log('user1233item profile',data.user);
        state.profile = {item : data.user };
    },
    getAllFailure(state, error) {
        state.all = { error };
    },
    deleteRequest(state, id) {
        state.all.items = state.all.items.map(user =>
            user.id === id
                ? { ...user, deleting: true }
                : user
        )
    },
    deleteSuccess(state, id) {
        // remove deleted user from state
        state.all.items = state.all.items.filter(user => user.id !== id)
    },
    deleteFailure(state, { id, error }) {
        // remove 'deleting:true' property and add 'deleteError:[error]' property to user
        state.all.items = state.items.map(user => {
            if (user.id === id) {
                // make copy of user without 'deleting:true' property
                const { deleting, ...userCopy } = user;
                // return copy of user with 'deleteError:[error]' property
                return { ...userCopy, deleteError: error };
            }

            return user;
        })
    }
};

export const users = {
    namespaced: true,
    state,
    actions,
    mutations
};
