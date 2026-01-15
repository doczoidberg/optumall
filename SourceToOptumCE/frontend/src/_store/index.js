import Vue from 'vue';
import Vuex from 'vuex';

import { alert } from './alert.module';
import { account } from './account.module';
import { users } from './users.module';
import { groups } from './groups.module';
import { licenses } from './licenses.module';
import { products } from './products.module';

Vue.use(Vuex);

export const store = new Vuex.Store({
    modules: {
        alert,
        account,
        users,
        groups,
        licenses,
        products
    }
});
