<template>
<div id="myModalConfirmCode" class="modal fade" role="dialog">
    <div class="modal-dialog modal-sm popup-user-delete">
        <!-- Modal content-->
        <div class="modal-content">
            <div class="modal-body  text-center">
                <button type="button" data-dismiss="modal" class="close">×</button>
                <i class="fa fa-mobile"></i>
                <h4 class="modal-title">Please enter the security code sent to your email </h4>
                <!-- <h4 class="modal-title">Please enter the security code sent to your <br/> phone number ending with <span style="font-weight:bold">123</span> </h4> -->
                <form role="form" @submit.prevent="deleteAccount" @keydown="form.onKeydown($event)" class="otp">
                    <label for="otpcode">6-digit code</label>
                    <input class="form-control otpcode" v-model="form.code" type="text" name="code">
                    <a @click="resendCode" href="#">Resend</a>
                    <div class="modal-button">
                        <button type="submit" :disabled="form.busy" class="btn btn-primary">Confirm</button>
                        <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
</template>

<script>
/* eslint-disable */
import Form from 'vform'
import { authHeader, configHeaders, responseStatus} from '@/_helpers';
export default {
    name: 'ConfirmCode',
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                code: '',
            })
        }
    },
    methods: {
        async resendCode() {

            const __this = this;

            await this.form.post(process.env.API_URL + '/api/settings/delete/confirm', configHeaders()).then(({ data }) => {
                    console.log('data', data);

                    // alert(data.message);
                            __this.$swal({
                        icon: 'success',
                        title: data.message,
                        text: '',
                    });
                })
                .catch(function (error) {
                    // alert(error.response.data.message);
                     __this.$swal({
                        icon: 'error',
                        title: error.response.data.message,
                        text: '',
                    });
                })

        },
        async deleteAccount() {
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/settings/delete/account', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                         $('#myModalConfirmCode').modal('hide');
                    __this.$router.push('/account-deleted');
                })
                .catch(function (error) {
                    // alert(error.response.data.message);
                    responseStatus(error.response.status);
                    __this.$swal({
                        icon: 'error',
                        title: error.response.data.message,
                        text: '',
                    });
                })

        }
    }
}
</script>

<style lang="scss" scoped>
.otpcode {
    width: 100%;
}
</style>
