<template>
<!-- Page Content -->
<div id="page-wrapper" class="users-page">
    <div class="container-fluid">
        <div class="row">
            <div class="col-lg-12">
                <h1 class="page-header">User management</h1>
            </div>
            <!-- /.col-lg-12 -->
        </div>
        <!-- end title -->
        <div class="row">
            <div class="col-lg-10 sort-left">
                <span>Sort by: </span>&nbsp;&nbsp;
                <router-link to="/admin/users/grid" class="btn active">User</router-link>
                <router-link class="btn" to="/admin/group/grid">Group</router-link>
                <div class="content-search">
                    <input class="form-control search-input" v-model="keyword" @keyup="applyFilter('')" type="text" name="keyword" placeholder="Search users...">
                    <button class="btn btn-search" @click="applyFilter('')"><i class="fa fa-search"></i></button>
                </div>
            </div>
            <div class="col-lg-2 button-right">
                <button class="btn btn-addnew" data-toggle="modal" data-target="#addNewUser">
                    <i class="fa fa-plus"></i> Add new user<span class="badge badge-primary"></span>
                </button>
            </div>
            <add-user @reloadList="reloadListView"></add-user>
        </div>
        <!-- end sort by -->
        <div class="row">
            <div class="col-lg-5 change-view">
                <router-link to="/admin/users/grid" class="btn btn-changeview"><img src="@/assets/images/User-Man-Icons-02.png" alt="userManIcons"></router-link>
                <router-link to="/admin/users" class="btn btn-changeview active"><img src="@/assets/images/User-Man-Icons-05.png" alt="userManIcons"></router-link>
                <span class="user-count" v-if="users.items">All users ({{users.items.length}})</span>
            </div>
        </div>
        <!-- /.row -->
        <div class="row" v-if="users.items">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <div class="panel-body">
                        <div class="table-responsive">
                            <table class="table table-users">
                                <colgroup>
                                    <col width="30%">
                                    <col width="30%">
                                    <col width="10%">
                                   <!--  <col width="10%"> -->
                                    <col width="17%">
                                    <col width="13%">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Name <i :class="[currentSortDir== 'asc' ? 'fa fa-sort-amount-asc' : 'fa fa-sort-amount-desc' ]" @click="sort('name')"></i></th>
                                        <th>Email</th>
                                        <th>Role</th>
                                       <!-- <th>Status</th> -->
                                        <th>Group</th>
                                        <th> </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="item in filteredRows" class="r-line">
                                        <td>{{item.name}}</td>
                                        <td>{{item.email}}</td>
                                        <td>{{item.roleName}}</td>
                                      <!--  <td><span  :class="{'active': item.email_validated == 1,  'inactive': item.email_validated == 0}">{{item.status}}</span></td> -->
                                        <td>{{item.group}}</td>
                                        <td>
                                            <router-link :to="{ name: 'UserDetail', params: { id: item.id }}" class="btn-view">View</router-link>
                                            <a  @click="deleteUser(item.id)" class="btn-delete"><i class="far fa-trash-alt"></i></a>
                                        </td>
                                    </tr>
                                     <tr v-if="filteredRows.length === 0">
                                        <td class="text-center" colspan="6"> No Match Found</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <!-- /.table-responsive -->
                    </div>
                    <!-- /.panel-body -->
                </div>
                <!-- /.panel -->
            </div>
            <!-- /.col-lg-12 -->
        </div>
    </div>
    <!-- /.container-fluid -->
    <!-- modal -->
    <!-- Modal -->

</div>
</template>

<script>
/* eslint-disable */
import AddUser from '@/components/popup/AddUser.vue'
import { mapState, mapActions } from 'vuex'
export default {
    name: 'Users',
    components: {
        AddUser
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            userFilterKey: 'all',
            currentSort: 'name',
            currentSortDir: 'asc',
            keyword: ''
            // users: [
            //     {
            //         id: 6,
            //         name: 'AJørgen Krabbenhøft',
            //         email: 'jkrabbenhoft@optumce.com',
            //         role: 'Admin',
            //         status: '<span class="active">Active</span>',
            //         group: 'Team 4',
            //         avatar: require('@/assets/images/avatar_02.png')
            //     },
            //     {
            //         id: 4,
            //         name: 'Joel Olsen',
            //         email: 'jolsen@optumce.com',
            //         role: 'User',
            //         status: '<span class="inactive">Invitation pending</span>',
            //         group: 'Team 4',
            //         avatar: require('@/assets/images/avatar_default  img-circle.jpg')
            //     }
            // ]
        }
    },
    created () {
        this.getAllUsers();
    },
    methods: {
        ...mapActions('users', {
            getAllUsers: 'getAll',
            deleteUser: 'delete'
        }),
        applyFilter() {
            console.log('this.keyword', this.keyword);
            if (this.keyword != '') {
                this.userFilterKey = 'apply';
            }
        },
        reloadListView(){
             this.getAllUsers();
        },
        sort: function (s) {
            this.userFilterKey = 'apply';
            //if s == current sort, reverse
            if (s === this.currentSort) {
                this.currentSortDir = this.currentSortDir === 'asc' ? 'desc' : 'asc';
            }
            this.currentSort = s;
        },
        clearInput() {
            this.keyword = '';
            this.userFilterKey = 'all';
            this.sort = 'asc';
        },
        filterByNameOrEmail: function (row) {
            const department = row.name.toLowerCase();
            const email = row.email.toLowerCase();
            if (this.keyword != '') {
                const searchTerm = this.keyword.toLowerCase();
                return department.includes(searchTerm) || email.includes(searchTerm);
            } else {
                return true;
            }
        },

        orderBy: function (a, b) {
            let modifier = 1;
            if (this.currentSortDir === 'desc') modifier = -1;
            if (a[this.currentSort] < b[this.currentSort]) return -1 * modifier;
            if (a[this.currentSort] > b[this.currentSort]) return 1 * modifier;
            return 0;
        },
    },
    computed: {
        ...mapState({
            users: state => state.users.all
        }),
        filteredRows() {
            return this[this.userFilterKey]
        },
        all() {
            console.log('usersall',this.users);
            return this.users.items;
        },
        apply() {
            return this.users.items
                .filter(this.filterByNameOrEmail)
                .sort(this.orderBy);
        }
    }

}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>
</style>
