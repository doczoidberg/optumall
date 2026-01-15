<template>
<layout-basic>
    <div class="row">
        <div class="login-panel panel panel-default">
            <div class="panel-heading">
                <img class="login_logo" src="@/assets/images/login_logo_02.png" alt="login_logo">
            </div>
            <div class="panel-body">
                <h2>Reset password</h2>
                <form role="form" @submit.prevent="reset" @keydown="form.onKeydown($event)">
                    <fieldset>
                        <!-- Email -->
                        <div class="form-group hidden" :class="{ 'has-error': form.errors.has('email') }">
                            <label for="email">Email</label>
                            <input v-model="form.token" type="text" name="token" id="token" class="form-control" >
                            <input v-model="form.email" type="text" name="email" id="email" class="form-control" readonly>
                              <has-error :form="form" field="email"/>
                        </div>

                        <!-- Password -->
                        <div class="form-group" :class="{ 'has-error': form.errors.has('password') }">
                            <label for="password">Password</label>
                            <input v-model="form.password" type="password" name="password" id="password" class="form-control">
                            <has-error :form="form" field="password"></has-error>
                        </div>
                              <!-- Password Confirmation -->
                        <div class="form-group" :class="{ 'has-error': form.errors.has('password_confirmation') }">
                            <label for="password_confirmation">Confirm Password</label>
                            <input v-model="form.password_confirmation" type="password" name="password_confirmation" id="password_confirmation" class="form-control">
                            <has-error :form="form" field="password_confirmation"></has-error>
                        </div>

                        <div class="checkbox">
                            <label class="fg-label">
                                <router-link to="/login" class="fg-password">Already have an account? Login!</router-link>
                            </label>
                        </div>

                        <alert-success :form="form" message="Update password success.Please login!"></alert-success>
                        <alert-error :form="form"></alert-error>
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
import LayoutBasic from '@/components/layouts/default'
import Form from 'vform'

export default {
    middleware: 'guest',

    metaInfo() {
        return { title: 'reset_password' }
    },
    components: {
        LayoutBasic
    },
    data: () => ({
        status: '',
        form: new Form({
            token: '',
            email: '',
            password: '',
            password_confirmation: ''
        })
    }),

    created() {
        this.form.email = this.$route.query.email
        this.form.token = this.$route.query.token
        //  this.form.token = this.$route.params.token
    },

    methods: {
        async reset() {
            const { data } = await this.form.post(process.env.API_URL +'/api/password/reset')
            this.status = data.status

            this.form.reset()
        }
    }
}
</script>
