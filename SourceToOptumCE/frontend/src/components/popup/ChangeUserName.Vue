<template>
<div>

    <div id="ChangeUserName" class="modal fade" role="dialog">
        <div class="modal-dialog modal-group-view">
            <!-- Modal content-->
            <div class="modal-content">
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal">&times;</button>
                        <h4 class="modal-title">Change Username</h4>
                    </div>
                    <div class="modal-body popup-user">
                        <div class="form-group">
                            <label for="user_name">Username:</label>
                            <input type="text" class="form-control" v-model="form.user_name" name="user_name" id="user_name">
                        </div>
                    </div>
                    <div class="modal-footer">

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
import { authHeader, configHeaders, responseStatus } from '@/_helpers';
export default {
    name: 'ChangeUserName',
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                user_name: '',
            })
        }
    },
    methods: {
        async send() {
            let __this = this;
            await this.form.post(process.env.API_URL + '/api/settings/changeUserName', configHeaders()).then(({ data }) => {
                    console.log('ChangeUserName', data);
                    $("#ChangeUserName").modal('hide');
                    __this.$emit('clickedChangeUserName', __this.form.user_name);
                    // this.form.reset();
                    __this.$swal({
                        icon: 'success',
                        title: 'Your username changed successfully',
                        text: '',
                    });

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
