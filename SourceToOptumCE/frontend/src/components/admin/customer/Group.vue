<template>
<!-- Page Content -->
<div id="page-wrapper" class="users-page group-page">
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
                <router-link to="/admin/users/grid" class="btn">User</router-link>
                <router-link to="/admin/users" class="btn active">Group</router-link>
                <div class="content-search">
                    <input class="form-control search-input" v-model="keyword" @keyup="applyFilter('')" type="text" name="keyword" placeholder="Search groups...">
                    <button class="btn btn-search" @click="applyFilter('')"><i class="fa fa-search"></i></button>
                </div>
            </div>
            <div class="col-lg-2 button-right">
                <button class="btn btn-addnew" data-toggle="modal" data-target="#addNewUser">
                    <i class="fa fa-plus"></i> Create new group<span class="badge badge-primary"></span>
                </button>
                <add-group @reloadList="reloadListView"></add-group>
            </div>
        </div>
        <!-- end sort by -->
        <div class="row">
            <div class="col-lg-5 change-view">
                <router-link to="/admin/group/grid" class="btn btn-changeview"><img src="@/assets/images/User-Man-Icons-02.png" alt="userManIcons"></router-link>
                <router-link to="/admin/group" class="btn btn-changeview active"><img src="@/assets/images/User-Man-Icons-05.png" alt="userManIcons"></router-link>
                <span class="user-count">All group
                <span v-if="groups.items"> ({{groups.items.length}})</span>

                </span>
            </div>
        </div>
        <!-- /.row -->
        <div class="row">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <div class="panel-body">
                        <div class="table-responsive">
                            <table class="table table-users">
                                <colgroup>
                                    <col width="25%">
                                    <col width="25%">
                                    <col width="25%">
                                    <col width="25%">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Group <i :class="[currentSortDir== 'asc' ? 'fa fa-sort-amount-asc' : 'fa fa-sort-amount-desc' ]" @click="sort('name')"></i></th>
                                        <th>Available products</th>
                                        <th class="text-center">Team members</th>
                                        <th> </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="item in filteredRows">
                                        <td>{{item.name}}</td>
                                        <td>
                                        <span v-for="license in item.licenses">{{license.product.code}},</span>
                                        </td>
                                        <td class="text-center">{{item.totalMember}}</td>
                                        <td class="text-right">
                                            <a @click="viewGroup(item)" class="btn-view   cursor-pointer">Manage</a>
                                            <a  @click="deleteGroup(item.id)" class="btn-delete  cursor-pointer"><i class="far fa-trash-alt"></i></a>
                                        </td>
                                    </tr>
                                    <tr v-if="groups.items && groups.items.length === 0">
                                      <td class="text-center" colspan="4"> No Match Found</td>
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
    <view-group :group="group" @reloadList="reloadListView"></view-group>
</div>
</template>

<script>
/* eslint-disable */
import AddGroup from '@/components/popup/AddGroup.vue'
import ViewGroup from '@/components/popup/ViewGroup.vue'
import { mapState, mapActions } from 'vuex'
export default {
    name: 'Group',
    components: {
        AddGroup,
        ViewGroup
    },
    created () {
        this.getAllGroups();
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            userFilterKey: 'all',
            currentSort: 'name',
            currentSortDir: 'asc',
            keyword: '',
            group: {},
            teams: [{
                    id: 1,
                    name: 'Team 01',
                    member: 5,
                    products: 'CS, G2'
                },
                {
                    id: 2,
                    name: 'Team 02',
                    member: 10,
                    products: 'CS, G3'
                },
                {
                    id: 3,
                    name: 'Team 03',
                    member: 15,
                    products: 'CS, G3, G2'
                }
            ]
        }
    },
    methods: {
        ...mapActions('groups', {
            getAllGroups: 'getAll',
            deleteGroup: 'delete'
        }),
        reloadListView(){
             this.getAllGroups();
        },
        viewGroup(item){
            console.log('ViewGroup',item);
            this.group = item;
            $("#ViewGroup").modal('show');
        },
        applyFilter() {
            console.log('this.keyword', this.keyword);
            if (this.keyword != '') {
                this.userFilterKey = 'apply';
            }
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
            if (this.keyword != '') {
                const searchTerm = this.keyword.toLowerCase();
                return department.includes(searchTerm);
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
        }
    },
    computed: {
        ...mapState({
            groups: state => state.groups.all
        }),
        filteredRows() {
            return this[this.userFilterKey]
        },
        all() {
            return this.groups.items;
            // console.log('groups', this.groups.items);
            // return this.teams;
        },
        apply() {
            return this.groups.items
                .filter(this.filterByNameOrEmail)
                .sort(this.orderBy);
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>
</style>
