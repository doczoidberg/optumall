<template>
<!-- Page Content -->
<div id="page-wrapper" class="profile-page">
    <div class="container-fluid">
        <div class="row">
            <div class="col-lg-12">
                <h1 class="page-header">My profile</h1>
            </div>
            <!-- /.col-lg-12 -->
        </div>
        <!-- /.row -->
        <div class="row">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <!-- /.panel-heading -->
                    <div class="panel-body">
                        <!-- Nav tabs -->
                        <ul class="nav nav-tabs nav-tabs-info">
                            <li class="active">
                                <a href="#myinformation" data-toggle="tab">My information</a>
                            </li>
                            <li>
                                <a href="#settings" data-toggle="tab">Security settings</a>
                            </li>
                        </ul>
                        <!-- Tab panes -->
                        <div class="tab-content">
                            <div class="tab-pane fade in active" id="myinformation">
                                <div class="row">
                                    <div class="col-lg-3 avatar custom-avt" v-if="profile.item">
                                    <img  class="avatar_default  img-circle"  v-bind:src="profile.item.avatarUrl"  alt="avatar_default  img-circle">
                                    </div>
                                    <div class="col-lg-9 infomation">
                                        <ul class="list-group" v-if="profile.item">
                                            <li class="list-group-item"><span class="bold name">{{profile.item.first_name}} {{profile.item.last_name}}</span></li>
                                            <li class="list-group-item"><span class="bold">Company/organization:</span> {{profile.item.organization }}</li>
                                            <li class="list-group-item"><span class="bold">Title:</span>  {{profile.item.title }}</li>
                                            <li class="list-group-item"><span class="bold">Address:</span> {{profile.item.address }}</li>
                                            <li class="list-group-item"><span class="bold">Phone:</span> {{profile.item.phone_number }}</li>
                                            <li class="list-group-item"><span class="bold">Email:</span> {{profile.item.email }}</li>
                                            <li class="list-group-item">
                                                <router-link to="/profile-update" class="btn-edit">Edit profile</router-link>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="tab-pane fade" id="settings">
                                <component-setting></component-setting>
                            </div>
                        </div>

                    </div>
                    <!-- /.panel-body -->
                </div>
                <!-- /.panel -->
            </div>
            <!-- /.col-lg-12 -->
        </div>
    </div>

    <!-- /.container-fluid -->
</div>
</template>

<script>
/* eslint-disable */
import Settings from '../pages/Settings.vue'
import { mapState, mapActions } from 'vuex'
export default {
    name: 'MyProfile',
    components: {
        'component-setting': Settings
    },
    computed: {
        ...mapState({
            account: state => state.account,
            profile: state => state.users.profile
        })
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            baseUrl: process.env.API_URL
        }
    },
    created() {
        this.getById();
    },
    methods: {
        ...mapActions('users', {
            getById: 'getById'
        })
    }
}
</script>
