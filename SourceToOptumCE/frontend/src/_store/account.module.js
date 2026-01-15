import { userService } from '../_services';
import router from '../router'
const user = JSON.parse(localStorage.getItem('user'));
const state = user
    ? { status: { loggedIn: true,showPoup2Step: false }, user }
    : { status: {}, user: null };

const actions = {
    login({ dispatch, commit }, { username, password, code }) {
        if(code != ''){

            commit('login2StepRequest', { username });
        }else{
            commit('loginRequest', { username });
        }

        userService.login(username, password, code)
            .then(
                user => {
                    console.log('user login',user);
                    if(user.twoStepVerification){
                        // router.push('/two-step-verification');
                        commit('loginSuccess2Step', user);
                        if(user.twoStepVerification && user.error){
                            dispatch('alert/error', user.message, { root: true });
                        }
                    }else{
                        commit('loginSuccess', user);
                        console.log('user loginSuccess',user);
                        setTimeout(() => {
                            if(user.user.role >= 1){
                                router.push('/admin/licenses');
                            }else{
                                router.push('/licenses');
                            }
                        }, 500);

                    }


                },
                error => {
                    commit('loginFailure', error);
                    console.log('error',error);
                    dispatch('alert/error', error, { root: true });
                }
            );
    },
    logout({ commit }) {
        userService.logout();
        commit('logout');
    },
    register({ dispatch, commit }, user) {
        commit('registerRequest', user);

        userService.register(user)
            .then(
                user => {
                    commit('registerSuccess', user);
                    router.push('/login');
                    setTimeout(() => {
                        // display success message after route change completes
                        dispatch('alert/success', 'Registration successful', { root: true });
                    })
                },
                error => {
                    commit('registerFailure', error);
                    dispatch('alert/error', error, { root: true });
                }
            );
    }
};

const mutations = {
    login2StepRequest(state, user) {
        state.status = { loggingIn: true, showPoup2Step: true };
        state.user = user;
    },
    loginRequest(state, user) {
        state.status = { loggingIn: true };
        state.user = null;
    },
    loginSuccess(state, user) {
        state.status = { loggedIn: true };
        state.user = user;
    },
    loginSuccess2Step(state, user) {
        state.status = { loggedIn: false, showPoup2Step: true };
        state.user = null;
    },

    loginFailure(state) {
        state.status = {};
        state.user = null;
    },
    logout(state) {
        state.status = {};
        state.user = null;
    },
    registerRequest(state, user) {
        state.status = { registering: true };
    },
    registerSuccess(state, user) {
        state.status = {};
    },
    registerFailure(state, error) {
        state.status = {};
    }
};

export const account = {
    namespaced: true,
    state,
    actions,
    mutations
};