// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import VeeValidate from 'vee-validate'
import { store } from './_store';
// import { router } from './_helpers';
import VuejsClipper from 'vuejs-clipper'
import router from './router'
import axios from 'axios'
import VueTelInput from 'vue-tel-input'
import VueSweetalert2 from 'vue-sweetalert2';
// import 'sweetalert2/dist/sweetalert2.min.css';
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'

Vue.prototype.$http = axios;
Vue.config.productionTip = false
import { HasError, AlertError, AlertSuccess } from 'vform'
[
  HasError,
  AlertError,
  AlertSuccess
].forEach(Component => {
  Vue.component(Component.name, Component)
})
// setup fake backend
Vue.use(VeeValidate);
Vue.use(VuejsClipper);
Vue.use(VueTelInput);
Vue.use(VueSweetalert2);
Vue.use(BootstrapVue)
// Optionally install the BootstrapVue icon components plugin
Vue.use(IconsPlugin)
// import { configureFakeBackend } from './_helpers';
// configureFakeBackend();
/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  store,
  components: { App },
  template: '<App/>'
})
