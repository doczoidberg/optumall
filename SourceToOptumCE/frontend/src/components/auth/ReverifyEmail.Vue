<template>
<layout-basic>
    <div class="row">
        <div class="login-panel panel panel-default">
            <div class="panel-heading">
                <img class="login_logo" src="@/assets/images/Optum-logos-Account.svg" alt="login_logo">
            </div>
            <div class="panel-body">
                <h2>Send verification email</h2>
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <fieldset>
                        <div class="form-group" :class="{ 'has-error': form.errors.has('email') }">
                            <input class="form-control" v-model="form.email" placeholder="Please enter your email" name="email" type="text" value="" autofocus>
                            <has-error :form="form" field="email"></has-error>
                        </div>
                        <alert-success :form="form" :message="status"></alert-success>
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
        return { title: 'Verify Email' }
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
            await this.form.post(process.env.API_URL + '/reverify-email').then(({ data }) => {
                    this.status = data.status
                    console.log('status',this.status);
                    this.form.reset()
                })
                .catch(function (error) {
                    this.status = error
                    console.log(error);
                })

        }
    }
}
</script>
