<template>
<layout-basic>
    <div class="row">
        <div class="login-panel panel panel-default w-panel-register pd-bt-64">
            <div class="panel-heading">
                <img class="login_logo mb-64" src="@/assets/images/Optum-logos-Account.svg" alt="login_logo">
            </div>
            <div class="panel-body">
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <fieldset>
                        <div class="form-group">
                            <label class="form-label" for="usr">First Name</label>
                            <input type="text" class="form-control" v-model="form.first_name" required id="usr"  />
                            <has-error :form="form" field="first_name"></has-error>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="lastname">Last Name</label>
                            <input type="text" class="form-control" id="last_name" required  v-model="form.last_name">
                            <has-error :form="form" field="last_name"></has-error>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="email">Email address</label>
                            <input type="email" class="form-control" :readonly="form.code" id="email" required   v-model="form.email">
                            <has-error :form="form" field="email"></has-error>
                        </div>
                        <!-- <div class="form-group">
                            <label for="confirm_email">Confirm Email:</label>
                            <input type="email" class="form-control" readonly onfocus="this.removeAttribute('readonly');" id="confirm_email" required placeholder="Confirm Email" v-model="form.confirm_email">
                            <has-error :form="form" field="confirm_email"></has-error>
                        </div> -->
                        <div class="form-group">
                            <label class="form-label" for="password">Password</label>
                            <input type="password" class="form-control" readonly onfocus="this.removeAttribute('readonly');" v-model="form.password"  id="password">
                            <has-error :form="form" field="password"></has-error>
                        </div>
                        <!-- Password Confirmation -->
                        <div class="form-group" :class="{ 'has-error': form.errors.has('password_confirmation') }">
                            <label class="form-label" for="password_confirmation">Confirm Password</label>
                            <input v-model="form.password_confirmation" type="password" name="password_confirmation" id="password_confirmation" class="form-control">
                            <has-error :form="form" field="password_confirmation"></has-error>
                        </div>
                        <div class="checkbox">
                            <label><input type="checkbox" value="true" v-model="form.accept_conditions">
                                I agree to the <a href="https://optumce.com/about/terms-of-use/" taget="_blank" class="link"> Optum Terms of Use</a> and acknowledge the<a href="https://optumce.com/about/privacy-policy/" taget="_blank" class="link"> Privacy Policy</a> 
                                <span class="text-danger">*</span>
                            </label>
                             <has-error :form="form" field="accept_conditions"></has-error>
                             <label><input type="checkbox" value="true" v-model="form.subscribe_email">
                                Keep me up to date on software updates, webinars and special offers. You can unsubscribe at any time 
                            </label>
                        </div>
                        <!-- <div class="checkbox">
                            <label class="fg-label">
                                <router-link to="/login" class="fg-password">Already have an account? Login!</router-link>
                            </label>
                        </div> -->
                        <!-- <alert-success :form="form" message="Please check your email to actived your account!"></alert-success> -->
                        <alert-error :form="form" message="Error! An error occurred. Please try again later."></alert-error>
                        <!-- Change this to a button or input when using this as a form -->
                        <button :disabled="form.busy" class="btn btn-lg btn-block pd-btn-register">REGISTER</button>
                        <div class="checkbox align-center"> <i>Already have a account? <router-link to="/login" class="fg-password">Sign in</router-link></i></div>
                    </fieldset>
                </form>
            </div>
        </div>

    </div>
</layout-basic>
</template>

<script>
/* eslint-disable */
import { mapState, mapActions } from 'vuex'
import Form from 'vform'
import Message from '@/components/popup/Message.vue'
import LayoutBasic from '@/components/layouts/default'
export default {
    name: 'Register',
    components: {
        'app-message': Message,
        LayoutBasic,
    },
    data() {
        return {
            msg: 'Register OptumCE',
            form: new Form({
                confirm_email: '',
                password: '',
                email: '',
                first_name: '',
                accept_conditions: false,
                password_confirmation: '',
                last_name: ''
            }),
            submitted: false,
            toggle: true
        }
    },
    computed: {
        ...mapState('account', ['status', 'logout'])
    },
    mounted() {
        this.form.email = this.$route.query['email'];
        this.form.confirm_email =  this.$route.query['email'];
        this.form.code =  this.$route.query['code'];
        this.form.organization_id = this.$route.query['organization'];
        console.log(this.form);
    },
    methods: {
        async send() {
        const __this = this;
            await this.form.post(process.env.API_URL + '/api/auth/register').then(({ data }) => {
                    console.log('data', data);
                    // this.form.reset();
                    __this.$swal({
                        // icon: 'success',
                        title: "Please verify your email via the link \n we just sent you",
                        text: '',
                        confirmButtonText: 'SIGN IN',
                    }).then(result=>{
                        if (result.isConfirmed) {
                           __this.$router.push( { path: '/login', name: 'Login'});
                        }
                    });
                })
                .catch(function (error) {
                    console.log(error);
                    // alert(error.response.data.message)
                })
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
