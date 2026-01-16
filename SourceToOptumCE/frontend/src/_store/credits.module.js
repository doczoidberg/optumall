import { creditsService } from '../_services';

const state = {
    packages: { items: [], loading: false, error: null },
    balance: { data: null, loading: false, error: null },
    transactions: { items: [], loading: false, error: null },
    checkout: { loading: false, error: null }
};

const actions = {
    getPackages({ commit }) {
        commit('getPackagesRequest');
        creditsService.getPackages()
            .then(
                response => commit('getPackagesSuccess', response),
                error => commit('getPackagesFailure', error)
            );
    },

    getBalance({ commit }, accountId = null) {
        commit('getBalanceRequest');
        creditsService.getBalance(accountId)
            .then(
                response => commit('getBalanceSuccess', response),
                error => commit('getBalanceFailure', error)
            );
    },

    getTransactions({ commit }, accountId = null) {
        commit('getTransactionsRequest');
        creditsService.getTransactions(accountId)
            .then(
                response => commit('getTransactionsSuccess', response),
                error => commit('getTransactionsFailure', error)
            );
    },

    createCheckoutSession({ commit }, packageId) {
        commit('checkoutRequest');
        return creditsService.createCheckoutSession(packageId)
            .then(
                response => {
                    commit('checkoutSuccess');
                    // Redirect to Stripe checkout
                    if (response.checkout_url) {
                        window.location.href = response.checkout_url;
                    }
                    return response;
                },
                error => {
                    commit('checkoutFailure', error);
                    throw error;
                }
            );
    }
};

const mutations = {
    getPackagesRequest(state) {
        state.packages = { items: [], loading: true, error: null };
    },
    getPackagesSuccess(state, response) {
        state.packages = { items: response.packages || [], loading: false, error: null };
    },
    getPackagesFailure(state, error) {
        state.packages = { items: [], loading: false, error };
    },

    getBalanceRequest(state) {
        state.balance = { ...state.balance, loading: true, error: null };
    },
    getBalanceSuccess(state, response) {
        state.balance = { data: response, loading: false, error: null };
    },
    getBalanceFailure(state, error) {
        state.balance = { data: null, loading: false, error };
    },

    getTransactionsRequest(state) {
        state.transactions = { items: [], loading: true, error: null };
    },
    getTransactionsSuccess(state, response) {
        state.transactions = { items: response.transactions || [], loading: false, error: null };
    },
    getTransactionsFailure(state, error) {
        state.transactions = { items: [], loading: false, error };
    },

    checkoutRequest(state) {
        state.checkout = { loading: true, error: null };
    },
    checkoutSuccess(state) {
        state.checkout = { loading: false, error: null };
    },
    checkoutFailure(state, error) {
        state.checkout = { loading: false, error };
    }
};

const getters = {
    currentBalance: state => {
        if (state.balance.data) {
            return state.balance.data.credits - (state.balance.data.credits_used || 0);
        }
        return 0;
    },
    totalCredits: state => state.balance.data?.credits || 0,
    creditsUsed: state => state.balance.data?.credits_used || 0
};

export const credits = {
    namespaced: true,
    state,
    actions,
    mutations,
    getters
};
