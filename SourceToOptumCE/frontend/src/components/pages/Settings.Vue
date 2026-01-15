<template>
<div v-if="profile.item">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-md-5">
            <span class="bold">Username: </span>{{profile.item.user_name}}
        </div>
        <div class="col-xs-12 col-sm-4 col-md-7">
            <!-- <button class="btn-edit-2">Change username</button> -->
            <button class="btn-edit-2" type="button" data-toggle="modal" data-target="#ChangeUserName">Change username</button>
        </div>
    </div>
    <change-userName @clickedChangeUserName="onClickChildUserName"></change-userName>
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-md-5">
            <span class="bold">Primary email address: </span>{{profile.item.email}}
        </div>
        <div class="col-xs-12 col-sm-4 col-md-7">

            <button class="btn-edit-2" type="button" data-toggle="modal" data-target="#ChangeEmail">Change email address</button>
        </div>
    </div>
    <change-email @clickedChangeEmail="onClickChildEmail"></change-email>
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-md-5">
            <span class="bold">Password: </span>••••••••••
        </div>
        <div class="col-xs-12 col-sm-4 col-md-7">
            <button class="btn-edit-2" type="button" data-toggle="modal" data-target="#ChangePassword">Change password</button>
        </div>
    </div>
    <change-password></change-password>
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-md-5">
            <span class="bold">2 step verification: </span>
            <span v-if="profile.item.two_factor_enabled">Enabled</span>
             <span v-if="!profile.item.two_factor_enabled">Disabled</span>
        </div>
        <div class="col-xs-12 col-sm-4 col-md-7">
            <button class="btn-edit-2" data-toggle="modal" data-target="#TwoStepVerification">Change settings</button>
        </div>
    </div>
    <TwoStepVerification :user="profile.item" @clickedChangeTwoStep="onClickChildTwoStep"></TwoStepVerification>

    <div class="row">
        <div class="col-xs-12 col-sm-8 col-md-5">
            <span class="bold">Account deletion </span>Delete your Optum account and data<a href="" class="small">Learn more</a>
        </div>
        <div class="col-xs-12 col-sm-4 col-md-7">
            <button class="btn-edit-2" data-toggle="modal" data-target="#myModalDelete">Delete</button>
        </div>
    </div>

    <div id="myModalDelete" class="modal fade" role="dialog">
        <div class="modal-dialog modal-sm popup-user-delete">
            <!-- Modal content-->
            <div class="modal-content">

                <div class="modal-body  text-center">
                <form role="form" @submit.prevent="confirmCode" @keydown="form.onKeydown($event)">
                    <button type="button" data-dismiss="modal" class="close">×</button>
                    <h5 class="modal-title">Are you sure you want to delete<br /> your account?</h5>
                    <div class="modal-button">
                        <button type="submit" :disabled="form.busy" class="btn btn-primary">Delete</button>
                        <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    </div>
                </form>
                </div>
            </div>
        </div>
    </div>
    <!-- Popup confirm OTP -->
    <component-popup-confirm></component-popup-confirm>
</div>
</template>

<script>
/* eslint-disable */
import ConfirmCode from '@/components/popup/ConfirmCode.vue'
import ChangeEmail from '@/components/popup/ChangeEmail.vue'
import ChangeUserName from '@/components/popup/ChangeUserName.vue'
import ChangePassword from '@/components/popup/ChangePassword.vue'
import TwoStepVerification from '@/components/popup/TwoStepVerification.vue'
import Form from 'vform'
import { authHeader, configHeaders } from '@/_helpers';
import { mapState, mapActions } from 'vuex'
export default {
    name: 'Settings',
    components: {
        'component-popup-confirm': ConfirmCode,
        ChangeEmail,
        ChangeUserName,
        ChangePassword,
        TwoStepVerification
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                type: 'confirm'
            })
        }
    },
    computed: {
        ...mapState({
            profile: state => state.users.profile
        })
    },
    methods: {
        onClickChildEmail(value){
            this.profile.item.email = value;
        },
        onClickChildUserName(value){
           this.profile.item.user_name = value;
        },
        onClickChildTwoStep(value){
            this.profile.item.two_factor_enabled = value;
        },
        async confirmCode() {
            const __this = this;

            await this.form.post(process.env.API_URL + '/api/settings/delete/confirm', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    $('#myModalDelete').modal('hide');
                    $('#myModalConfirmCode').modal('show')

                })
                .catch(function (error) {
                    // alert(error.response.data.message);
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
</style>
