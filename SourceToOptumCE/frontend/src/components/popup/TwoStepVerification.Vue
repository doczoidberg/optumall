<template>
<div>

    <div id="TwoStepVerification" class="modal fade" role="dialog">
        <div class="modal-dialog modal-group-view modal-sm ">
            <!-- Modal content-->
            <div class="modal-content">
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal">&times;</button>
                        <h4 class="modal-title">Two step verification</h4>
                    </div>
                    <div class="modal-body popup-user popup-two-step">
                        <div class="form-group btn-switch text-center">
                            <label class="switch">
                                <input type="checkbox" v-bind:checked="user.two_factor_enabled" name="assign" @change="handleChange($event)">
                                <div class="slider round">
                                    <!--ADDED HTML -->
                                    <span class="on">On</span><span class="off">Off</span>
                                    <!--END-->
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <!--<alert-success :form="form" message="Changed success!"></alert-success> -->
                        <alert-error :form="form"></alert-error>
                        <!-- <button type="submit" :disabled="form.busy" class="btn btn-info btn-add-popup">Add</button> -->
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
    name: 'TwoStepVerification',
    props: ['user'],
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                type: ''
            })
        }
    },
    created: function () {
        console.log('user data from parent component:')
        console.log(this.user) //prints out an empty string
    },
    methods: {
        // handleChange(e){
        //     console.log(' e.target.checked',  e.target.checked)
        // },
        async handleChange(e) {

            let __this = this;
            this.form.type = e.target.checked;
            await this.form.post(process.env.API_URL + '/api/settings/changeTwoStepVerification', configHeaders()).then(({ data }) => {
                    console.log('changeTwoStepVerification', data);
                    //alert(data.message);
                    // this.form.reset();
                    // setTimeout(() => {
                    //     location.reload();
                    // }, 1500);
                    __this.$swal({
                        icon: 'success',
                        title: '2-step verification changed successfully',
                        text: '',
                    });
                      __this.$emit('clickedChangeTwoStep', __this.form.type);

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
