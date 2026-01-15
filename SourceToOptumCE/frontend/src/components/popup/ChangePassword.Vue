<template>
<div>

    <div id="ChangePassword" class="modal fade" role="dialog">
        <div class="modal-dialog modal-group-view">
            <!-- Modal content-->
            <div class="modal-content">
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal">&times;</button>
                        <h4 class="modal-title">Change password</h4>
                    </div>
                    <div class="modal-body popup-user">
                        <div class="form-group">
                            <label for="old_password">Current password:</label>
                            <input type="password" class="form-control" v-model="form.old_password" name="old_password" id="old_password">
                            <has-error :form="form" field="old_password"></has-error>
                        </div>
                    </div>
                    <div class="modal-body popup-user">
                        <div class="form-group">
                            <label for="new_password">New password:</label>
                            <input type="password" class="form-control" v-model="form.new_password" name="new_password" id="new_password">
                            <has-error :form="form" field="new_password"></has-error>
                        </div>
                    </div>
                    <div class="modal-body popup-user">
                        <div class="form-group">
                            <label for="confirm_password">Confirm password:</label>
                            <input type="password" class="form-control" v-model="form.confirm_password" name="confirm_password" id="confirm_password">
                            <has-error :form="form" field="confirm_password"></has-error>
                        </div>
                    </div>

                    <div class="modal-footer">

                        <alert-error :form="form"></alert-error>
                        <button type="submit" :disabled="form.busy" class="btn btn-info btn-add-popup">Submit</button>
                        <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
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
    name: 'ChangeEmail',
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                old_password: '',
                new_password: '',
                confirm_password: ''
            })
        }
    },
    methods: {
        async send() {
            let __this = this;
            await this.form.post(process.env.API_URL + '/api/settings/changePassword', configHeaders()).then(({ data }) => {
                    console.log('changeEmail', data);
                    $("#ChangePassword").modal('hide');
                    __this.$swal({
                        icon: 'success',
                        title: 'Your password changed successfully',
                        text: '',
                    });
                    // this.form.reset();
                    // setTimeout(() => {
                    //     location.reload();
                    // }, 1500);

                })
                .catch(function (error) {
                    console.log(error);
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
