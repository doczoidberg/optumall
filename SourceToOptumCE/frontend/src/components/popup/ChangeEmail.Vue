<template>
<div>

    <div id="ChangeEmail" class="modal fade" role="dialog">
        <div class="modal-dialog modal-group-view">
            <!-- Modal content-->
            <div class="modal-content">
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal">&times;</button>
                        <h4 class="modal-title">Change email address</h4>
                    </div>
                    <div class="modal-body popup-user">
                        <div class="form-group">
                            <label for="usr">Email:</label>
                            <input type="email" class="form-control" v-model="form.email" name="email" id="usr">
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
import { authHeader, configHeaders, responseStatus} from '@/_helpers';
export default {
    name: 'ChangeEmail',
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                email: '',
            })
        }
    },
    methods: {
        async send() {
            let __this = this;
            await this.form.post(process.env.API_URL + '/api/settings/changeEmail', configHeaders()).then(({ data }) => {
                    console.log('changeEmail', data);
                    $("#ChangeEmail").modal('hide');
                    __this.$swal({
                        icon: 'success',
                        title: 'Your email changed successfully',
                        text: '',
                    });
              __this.$emit('clickedChangeEmail', __this.form.email);
                })
                .catch(function (error) {
                    responseStatus(error.response.status);
                    console.log(error);
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
