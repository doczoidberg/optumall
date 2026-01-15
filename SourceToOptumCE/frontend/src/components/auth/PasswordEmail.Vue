<template>
<layout-basic>
    <div class="row">
        <div class="login-panel panel panel-default">
            <div class="panel-heading">
                <img class="login_logo" src="@/assets/images/login_logo_02.png" alt="login_logo">
            </div>
            <div class="panel-body">
                <h2>Forgot password</h2>
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <fieldset>
                        <div class="form-group" :class="{ 'has-error': form.errors.has('user_name') }">
                            <label class="form-label">Find Your Account</label>
                            <input class="form-control" v-model="form.user_name" placeholder="Please enter your username" name="user_name" type="text" value="" autofocus>
                            <has-error :form="form" field="user_name"></has-error>
                        </div>
                        <div class="checkbox">
                            <label class="fg-label">
                                <router-link to="/login" class="fg-password">Already have an account? Login!</router-link>
                            </label>
                        </div>

                        <alert-success :form="form" message=" Please check your email!"></alert-success>
                        <alert-error :form="form"  message="Your account does not exist in the system"></alert-error>
                        <!-- Change this to a button or input when using this as a form -->
                        <button :disabled="form.busy" type="submit" class="btn btn-lg btn-block"> Send</button>
                    </fieldset>
                </form>
            </div>
        </div>
    </div>
</layout-basic>
</template>

<script>
import Form from 'vform'
import LayoutBasic from '@/components/layouts/default'
export default {
    middleware: 'guest',
    metaInfo() {
        return { title: 'Forgot Password' }
    },
    components: {
        LayoutBasic
    },
    data: () => ({
        status: '',
        form: new Form({
            user_name: ''
        })
    }),
    methods: {
        async send() {
            await this.form.post(process.env.API_URL + '/api/password/email').then(({ data }) => {
                    this.status = data.status
                    console.log('status',this.status);
                    this.form.reset()
                })
                .catch(function (error) {
                    console.log(error);
                })

        }
    }
}
</script>
