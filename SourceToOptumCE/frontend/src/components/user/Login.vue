<template>
<layout-basic>
<div>
    <div class="row">
        <div class="login-panel panel panel-default  w-panel-register pd-bt-64">
            <div class="panel-heading">
                <img class="login_logo mb-64" src="@/assets/images/Optum-logos-Account.svg" alt="login_logo">
            </div>
            <div class="panel-body">
                <form role="form" @submit.prevent="handleSubmit">
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
                        <div class="form-group mg-bottom-40" v-if="status.showPoup2Step">
                            <label class="form-label">Enter a verification code</label>
                            <input class="form-control" v-model="code" placeholder="Enter the 6-digit code" name="code" :class="{ 'is-invalid': submitted && !code }" type="text" value="">
                            <div v-show="!code" class="invalid-feedback">A verification code was sent to your email!</div>
                        </div>

                        <div class="checkbox" v-bind:class="{ 'hidden': status.showPoup2Step }">
                            <label class="fg-label">
                                <router-link to="/forgot-password" class="fg-password">Forgot password?</router-link>
                            </label>
                        </div>
                        <app-message asHtml></app-message>
                        <div class="row" v-if="showMsgActivate">
                            <div class="col-sm-12">
                                <div :class="[resCode== '00' ? 'alert alert-success' : 'alert alert-danger' ]">{{msg}}</div>
                            </div>
                        </div>
                        <!-- Change this to a button or input when using this as a form -->
                        <button :disabled="status.loggingIn" class="btn btn-lg btn-block pd-btn-register" v-bind:class="{ 'hidden': status.showPoup2Step }">LOGIN</button>
                        <button :disabled="status.loggingIn" class="btn btn-lg btn-block"  v-if="status.showPoup2Step">SUBMIT</button>
                        <div class="checkbox align-center" v-bind:class="{ 'hidden': status.showPoup2Step }"> <i>New to Optum?<router-link to="/register" class="fg-password"> Create account</router-link></i></div>
                        <div class="h-40" v-if="status.showPoup2Step"></div>

                    </fieldset>
                </form>
            </div>
        </div>
    </div>
    <!-- <div class="user-change" v-bind:class="{ 'hidden': status.showPoup2Step }">
        <router-link to="/admin/login" class="item-user"><i class="fa fa-user fa-fw"></i></router-link>
    </div> -->
</div>

</layout-basic>
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
            msg: '',
            username: '',
            password: '',
            code: '',
            resCode: '',
            submitted: false,
            toggle: true,
            showMsgActivate: false,
        }
    },
    computed: {
        ...mapState('account', ['status'])
    },
    created() {
        this.resCode = this.$route.query.resCode;
        this.msg = this.$route.query.msg;
        if(this.resCode != undefined && this.resCode != '' && this.msg != ''){
            this.showMsgActivate = true;
            console.log(' this.msg ', this.msg );
        }
        //this.logout();
    },
    methods: {
        ...mapActions('account', ['login', 'logout']),
        handleSubmit(e) {
            this.resCode = '';
            this.submitted = true;
            const { username, password, code } = this;
            if (username && password) {
                console.log(username, password, code);
                this.login({ username, password, code })
            }
             setTimeout(function(){
                    this.msg  = '';
                }, 3000);
        },
        showSidebarRight: () => {
            document.querySelector('.side-menu').classList.toggle('show')
        }
    },
    watch: {
        $route(to, from) {
             this.resCode = '';
             this.msg  = '';
            // clear alert on location change
            this.clearAlert();
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped lang="scss">
</style>
