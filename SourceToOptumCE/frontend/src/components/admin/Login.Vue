<template>
    <div class="container-fluid login-page">
        <nav class="navbar navbar-default navbar-static-top" role="navigation" >
            <div class="navbar-header">
                <a class="">
                    <img class="logo_licen" src="@/assets/images/Optum-logos-CE.svg" alt="logo_licen">
                </a>
            </div>
            <!-- /.navbar-header -->

            <ul class="nav navbar-top-links navbar-right">
                <button type="button" id="sidebarCollapse" class="btn-question"  @click="showSidebarRight()">
                    <i class="fas fa-question-circle"></i>
                </button>
            </ul>
            <!-- /.navbar-top-links -->
        </nav>
          <div class="side-menu" >
            <div class="side-menu-content">
                <i class="fa fa-times btn-close"  @click="showSidebarRight()" />
                <ul>
                <li>
                    <h3> <i class="fa fa-question-circle question-icon" />Help</h3>
                </li>
                <li><a href="https://optumce.com/knowledge-base/faq/" target="_blank">Q&A </a></li>
                <li><a href="https://optumce.com/about/terms-of-use/" target="_blank">Terms & conditions</a></li>
                <li><a href="https://optumce.com/about/privacy-policy/" target="_blank"> Privacy policy</a></li>
                <li />
                <li />
                <li><strong><a href="https://optumce.com/" target="_blank">www.OptumCE.com</a></strong></li>
                </ul>
            </div>
            </div>
        <div class="container">
            <div class="row">
                <div class="login-panel panel panel-default w-panel-register">
                    <div class="panel-heading">
                        <img class="login_logo mb-64" src="@/assets/images/Optum-logos-Account.svg" alt="login_logo">
                    </div>
                    <div class="panel-body">
                        <form role="form"  @submit.prevent="handleSubmit">
                            <fieldset>
                                <div class="form-group" v-bind:class="{ 'hidden': status.showPoup2Step }">
                                    <label class="form-label">Username</label>
                                    <input class="form-control" v-model="username"  name="username" :class="{ 'is-invalid': submitted && !username }" type="text" value="test@optumce.com" autofocus>
                                    <div v-show="submitted && !username" class="invalid-feedback">Username is required</div>
                                </div>
                                <div class="form-group" v-bind:class="{ 'hidden': status.showPoup2Step }">
                                    <label class="form-label">Password</label>
                                    <input class="form-control" v-model="password"  name="password" :class="{ 'is-invalid': submitted && !password }" type="password" value="">
                                    <div v-show="submitted && !password" class="invalid-feedback">Password is required</div>
                                </div>
                                <div class="form-group mg-bottom-40" v-if="status.showPoup2Step" >
                                    <label class="form-label">Enter a verification code</label>
                                    <input class="form-control" v-model="code" placeholder="Enter the 6-digit code" name="code" :class="{ 'is-invalid': submitted && !code }" type="text" value="">
                                    <div v-show="!code" class="invalid-feedback">A verification code was sent to your email!</div>
                                </div>

                                <div class="checkbox" v-bind:class="{ 'hidden': status.showPoup2Step }">
                                    <label class="fg-label">
                                        <router-link to="forgot-password" class="fg-password">Forgot password?</router-link>
                                    </label>
                                </div>
                                <app-message asHtml></app-message>
                                <!-- Change this to a button or input when using this as a form -->
                                <button  :disabled="status.loggingIn" class="btn btn-lg btn-block pd-btn-register" v-bind:class="{ 'hidden': status.showPoup2Step }">LOGIN</button>
                                <button  :disabled="status.loggingIn" class="btn btn-lg btn-block" v-if="status.showPoup2Step">SUBMIT</button>
                            </fieldset>
                        </form>
                    </div>
                </div>
            </div>
            <div class="user-change" v-bind:class="{ 'hidden': status.showPoup2Step }">
               <div class="user-change">
                 <!-- <a class="item-user" v-if="toggle" v-on:click="toggle = !toggle"><i class="fa fa-user fa-fw"></i></a> -->
                  <!--  <router-link to="/login" class="item-user"><i class="fa fa-users fa-fw"></i></router-link> -->
                </div>
            </div>
        </div>
    </div>

</template>

<script>
/* eslint-disable */
import { mapState, mapActions } from 'vuex'
import Message from '@/components/popup/Message.vue'
import LayoutBasic from '@/components/layouts/default'
export default {
    name: 'Login',
    components: {
        'app-message': Message,
        LayoutBasic
    },
    data() {
        return {
            msg: 'Welcome to OptumCE',
            username: '',
            password: '',
            code: '',
            submitted: false,
            toggle: true
        }
    },
    computed: {
        ...mapState('account', ['status'])
    },
    created() {
        //this.logout();
    },
    methods: {
        ...mapActions('account', ['login', 'logout']),
        handleSubmit(e) {
            this.submitted = true;
            const { username, password,code } = this;
            if (username && password) {
                console.log(username, password, code);
                this.login({ username, password, code })
            }
        },
        showSidebarRight: () => {
            document.querySelector('.side-menu').classList.toggle('show')
        }
    },
    watch: {
        $route(to, from) {
            // clear alert on location change
            this.clearAlert();
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped lang="scss">
</style>
