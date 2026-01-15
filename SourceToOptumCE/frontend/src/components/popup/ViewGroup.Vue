<template>
<!-- Modal -->
<div id="ViewGroup" class="modal fade" role="dialog">
    <div class="modal-dialog modal-group-view modal-w-400" v-if="group">

        <!-- Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal">&times;</button>
                <h4 class="modal-title">Manage group: {{group.name}}</h4>
            </div>
            <div class="modal-body">
                 <ul class="list-group" v-if="group.members && group.members.length > 0">
                    <li class="list-group-item" v-for="(item, index) in group.members" :key="item.id">
                        <span> {{item.account.user.name}} - {{item.account.user.email}} </span>
                        <button @click="remeUserGroup(item.account_id,item.group_id,item.id, index)" class="btn-i"><i class="far fa-trash-alt"></i> </button></li>
                </ul>

                <div class="add_user">
                    <h5 class="title-add-user">Add users to group</h5>
                    <p class="memo">Add users by choosing from the drop-down list</p>
                    <input class="inp-email" type="text" v-on:keyup="search($event)" placeholder="Start typing name or email to filter users...">

                    <select name="userId" id="userId" class="dropdown" v-if="users" @change="onChange($event)" v-model="userId">
                        <option v-for="item in filteredUsers" :value="item.id" :key="item.id">
                            {{ item.name }} - {{ item.email }}
                        </option>
                    </select>
                </div>

                <p v-if="!group.members || group.members.length == 0">
                    <span>Data empty</span>
                </p>
            </div>
            <div class="modal-footer">
                <button type="button"  @click="updateGroup()" :disabled="form.busy" class="btn btn-info btn-add-popup">Update</button>
                <button type="button" data-dismiss="modal" class="btn btn-default">Cancel</button>
            </div>
        </div>

    </div>
</div>
</template>

<script>
/* eslint-disable */
import Form from 'vform';
import { authHeader, configHeaders, responseStatus} from '@/_helpers';
import { mapState, mapActions } from 'vuex';
export default {
    name: 'ViewGroup',
    props: ['group'],
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                account_id: '',
                group_id: '',
                id: ''
            }),
            keyword: '',
            userId: 0,

        }
    },
    created: function () {
        this.getAllUsers();
    },
    methods: {
        ...mapActions('users', {
            getAllUsers: 'getAll'
        }),
        onChange(event) {
            this.userId = event.target.value;
            console.log(event.target.value)
        },
        search(e) {
            this.userId = 0;
            this.keyword = e.target.value;
            const us = this.users.filter(this.filterByNameOrEmail);
            if(us.length > 0){
               this.userId = us[0].id;
            }
		},
        async remeUserGroup(account_id, group_id, id, index) {
            this.form.id = id;
            this.form.account_id = account_id;
            this.form.group_id = group_id;
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/group/removeuser', configHeaders()).then(({ data }) => {
                    __this.$swal({
                        icon: 'success',
                        title: data.message,
                        text: '',
                    });
                    this.group.members.splice(index, 1);
                    this.$emit('reloadList', 'reload');
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
        },
        async updateGroup() {
            if(this.userId == 0){
                return;
            }
            const userId = this.userId;
            const user = this.users.filter(function (el) {
                 return el.id == userId;
            });
            if(user == null || user.length == 0){
                 return;
            }
            this.form.account_id = user[0].account_id;
            this.form.group_id = this.group.id;
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/group/adduser', configHeaders()).then(({ data }) => {
                   console.log('$group', data)
                    __this.$swal({
                        icon: 'success',
                        title: data.message,
                        text: '',
                    });
                    const group = {
                        account_id: data.group.account_id,
                        group_id: data.group.group_id,
                        id: data.group.id,
                        account: {
                            user: user[0]
                        }
                    }
                    this.userId = 0;
                    this.group.members.push(group);
                    this.$emit('reloadList', 'reload');
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
        },
        filterByNameOrEmail: function (row) {
            if(!row.name || !row.email ){
               return true;
            }
            const department = row.name.toLowerCase();
            const email = row.email.toLowerCase();
            if (this.keyword != '') {
                const searchTerm = this.keyword.toLowerCase();
                return department.includes(searchTerm) || email.includes(searchTerm);
            } else {
                return true;
            }
        },
    },
    computed: {
        ...mapState({
            users: state => state.users.all.items
        }),
        filteredUsers() {
            return this.users ? this.users.filter(this.filterByNameOrEmail) : [];
        }
    }
}
</script>
