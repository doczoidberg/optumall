<template>
<layout-basic>
    <div class="row">
        <div class="login-panel panel panel-default">
            <div class="panel-heading">
                <img class="login_logo  mb-64" src="@/assets/images/Optum-logos-Account.svg" alt="login_logo">
            </div>
            <div class="panel-body panel-flex">
                <router-link to="/register" class="btn btn-lg btn-black btn-block">CREATE ACCOUNT</router-link>
                <router-link to="/login" class="btn btn-lg btn-block">SIGN IN</router-link><br/>
            </div>
        </div>
    </div>
</layout-basic>
</template>

<script>
/* eslint-disable */
import { mapState, mapActions } from 'vuex'
import Message from '@/components/popup/Message.vue'
import LayoutBasic from '@/components/layouts/default'
export default {
    name: 'Homepage',
    components: {
        'app-message': Message,
        LayoutBasic
    },
    data() {
        return {
            msg: ''
        }
    }
}
</script>
