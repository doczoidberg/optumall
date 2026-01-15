<template>
<!-- Page Content -->
<div id="page-wrapper" class="users-page user-detail-page">
    <div class="container-fluid manage-license-page">
        <div class="row">
            <div class="col-lg-12">
                <h1 class="page-header">View user</h1>
                <router-link to="/admin/users/grid" class="text-primary"><i class="fa fa-long-arrow-left"></i> Back to list</router-link>
            </div>
            <!-- /.col-lg-12 -->
        </div>
        <!-- end title -->
        <div class="row mt-20 cs-view-user">
            <div class="col-sm-12 col-md-2" v-if="user">
                <img :src="user.avatarUrl" class="img-rounded img-responsive" />
                <h3 class="h3-left">{{user.name}}</h3>
                <p>
                    <strong>Email: </strong> {{user.email}}<br />
                    <!-- <strong>test@optumce.com:</strong> 5<br /> -->

                </p>
                <div class="form-group">
                    <label for="sel1">User role:</label>
                    <select class="form-control" name="role" @change="onChangeRole($event)" v-model="user.role" id="sel1">
                        <option value="0">User</option>
                        <option value="1">Admin</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="sel12">Group:</label>
                    <select class="form-control" id="sel12" @change="onChangeGroup($event)" v-model="user.groupId">
                        <option value="">Select Group</option>
                        <option v-for="option in groups.items" v-bind:value="option.id">
                            {{ option.name }}
                        </option>
                    </select>
                </div>
                <button class="btn btn-info btn-delete btn-primary" type="button" data-toggle="modal" data-target="#myModalDelete"><i class="far fa-trash-alt"></i> Remove user</button>
            </div>
            <div class="col-sm-12 col-md-10">
                <!-- content -->
                <div class="row">
                    <div class="col-lg-6 sort-left">
                        <h3 class="mg-top-2">User's products: </h3>
                    </div>
                </div>
                <!-- end sort by -->
                <!-- /.row -->
                <div class="row licenses-page ">
                    <div class="col-lg-12">
                        <div class="panel panel-default">
                            <div class="panel-body">
                                <div class="table-responsive">
                                    <table class="table table-hover table-user-detail">
                                        <colgroup>
                                            <col width="62px">
                                            <col width="24.2%">
                                            <col width="20%">
                                            <col width="20%">
                                            <col width="20%">
                                            <col width="10%">
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <th>Product </th>
                                                <th>Status </th>
                                                <th>License type</th>
                                                <th>Seat limit/Seats in use</th>
                                                <th class="text-center">Assign</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <template v-for="row in licenses">
                                                <tr class="r-line">
                                                    <td @click="row.contentVisible = !row.contentVisible">
                                                        <i :class="[row.contentVisible ? 'fa-angle-down' : 'fa-angle-right']" class="fa"></i>
                                                    </td>
                                                    <td @click="row.contentVisible = !row.contentVisible"><img :src="row.product.imageUrl" class="product-thumb" />{{row.product.name}}</td>
                                                    <td  class="status pading-only">
                                                      <span  v-html="row.status"></span>
                                                    </td>
                                                    <td @click="row.contentVisible = !row.contentVisible">
                                                        <span class="sub-type-main" v-if="row.scheme">
                                                            {{row.scheme.kindDisplay}},</span> <i class="sub-type color-primary"> {{row.typeDisplay}}</i>
                                                    </td>
                                                    <td @click="row.contentVisible = !row.contentVisible" class="">{{row.seatDisplay}}</td>

                                                    <td class="text-center">
                                                       <btn-switch @isChecked="handleChangeBtn" :val="row.assign" :parentData="user.account_id" :parentExt="row.id"></btn-switch>
                                                        <!-- <label class="switch">
                                                            <input type="checkbox" v-bind:checked="row.assign" name="assign" @change="handleChange($event,row.id,user.account_id)">
                                                            <div class="slider round">

                                                                <span class="on">OK</span><span class="off">OFF</span>
                                                            </div>
                                                        </label> -->
                                                    </td>
                                                </tr>
                                                <tr v-if="row.contentVisible">
                                                    <td></td>
                                                    <td colspan="1">
                                                        <div class="pd-right-1">
                                                            <!-- <p><span class="bold inline">Activation key:</span> {{row.text}} </p> -->
                                                            <p><span class="bold inline">Available version:</span> {{row.version_limit}} </p>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <div class="pd-right-2">
                                                            <p>
                                                                <span class="bold inline">License email:</span><br />
                                                                <span v-for="item in row.licenseEmails">
                                                                    <span v-if="item.email"> {{ item.email }} <br /></span>
                                                                </span>
                                                            </p>
                                                            <p><span class="bold inline">Owner:</span> {{row.account.name}} </p>
                                                        </div>
                                                    </td>
                                                    <td colspan="2" class="pd-left-9">
                                                        <div class="pd-right-3">
                                                            <p><span class="bold">Active users:</span>
                                                                <span v-if="row.seatAccounts == null || row.seatAccounts.length === 0">None</span>
                                                                <span v-for="(item, key)  in row.seatAccounts">
                                                                    <span v-if="item.email"> {{ item.email }} <a @click="removeAccountOutSeat(item.seat_id);$delete(row.seatAccounts, key);row.activeUsers = row.activeUsers -1 ;" class="cursor-pointer hidden" data-toggle="tooltip" data-placement="top" title="Free up seat"><i class="fa fa-user"></i><i class="fa fa-plus"></i></a><br /> </span>
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </template>
                                            <tr v-if="licenses == null || licenses.length === 0">
                                                <td class="text-center" colspan="8"> No Match Found</td>
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
                <!-- /content -->
            </div>
        </div>
        <!-- popup delete -->

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
        <component-popup-confirm :user='user'></component-popup-confirm>
        <!-- /.-->
    </div>
    <!-- /.container-fluid -->
</div>
</template>

<script>
/* eslint-disable */
import ConfirmCode from '@/components/popup/ConfirmCodeAdmin.vue'
import { authHeader, configHeaders, responseStatus} from '@/_helpers';
import Form from 'vform';
import { mapState, mapActions } from 'vuex';
import BtnSwitch from '@/components/button/BtnSwitch.vue';
export default {
    name: 'UserDetail',
    components: {
        'component-popup-confirm': ConfirmCode,
        BtnSwitch
    },
    methods: {
           async removeAccountOutSeat(seat_id) {

            this.form.seat_id = seat_id;
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/licenses/removeAccountOutSeat', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    this.form.reset();
                    // alert(data.message);
                    __this.$swal({
                        icon: 'success',
                        title: data.message,
                        text: '',
                    });
                })
                .catch(function (error) {
                    responseStatus(error.response.status);
                    // alert(error.response.data.message)
                    __this.$swal({
                        icon: 'error',
                        title: error.response.data.message,
                        text: '',
                    });
                })
        },
        async confirmCode() {
            const __this = this;
            await this.formDelete.post(process.env.API_URL + '/api/settings/delete/confirm',  configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    $('#myModalDelete').modal('hide');
                    $('#myModalConfirmCode').modal('show');
                })
                .catch(function (error) {
                    responseStatus(error.response.status);
                    // alert(error.response.data.message);
                    __this.$swal({
                        icon: 'error',
                        title: 'Oops...',
                        text: error.response.data.message,
                    });
                })

        },
        handleChangeBtn(value){
            const type = value.checked ? 'Assign' : 'UnAssign';
            this.handleChange(type, value.parentExt, value.parentData);
        },
        async handleChange(type, licenseId, account_id) {

            this.form.account_id = account_id;
            this.form.type = type;
            this.form.licenseId = licenseId;
               const __this = this;
            await this.form.post(process.env.API_URL + '/api/licenses/assign',  configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    this.form.reset();
                    // alert(data.message);
                    __this.$swal({
                        icon: 'success',
                        title: data.message,
                        text: '',
                    });
                })
                .catch(function (error) {
                    responseStatus(error.response.status);
                    if(!error.response.data.stauts){
                        // __this.userFilterKey = 'all';
                         __this.getUser();
                    }
                    // alert(error.response.data.message)
                    __this.$swal({
                        icon: 'error',
                        title: error.response.data.message,
                        text: '',
                    });
                })
        },
        getUser(userId) {
            this.$http.get(`${process.env.API_URL}/api/users/${userId}`,  configHeaders()).then(response => {
                console.log(response.data);
                this.user = response.data.user;
            }) .catch(function (error) {
                    responseStatus(error.response ? error.response.status : undefined);

                })
        },
        getLicense(userId) {
            this.$http.get(`${process.env.API_URL}/api/mylicenses/${userId}`,  configHeaders()).then(response => {
                console.log('mylicenses', response.data);
                this.licenses = response.data;
            }) .catch(function (error) {
                    responseStatus(error.response ? error.response.status : undefined);

                })
        },
        ...mapActions('groups', {
            getAllGroups: 'getAll',
            deleteGroup: 'delete'
        }),
        onChangeGroup(event) {
            if (event.target.value == '') {
                return;
            }
            const __this = this;
            console.log(event.target.value)
            const userId = this.$route.params.id;

            this.$http.post(`${process.env.API_URL}/api/settings/changeGroup/${userId}`, { account_id: event.target.value, user_id: userId }, configHeaders())
                .then(response => {
                    console.log(response.data);
                    // alert('Updated')
                    __this.$swal({
                        icon: 'success',
                        title: 'Updated group success',
                        text: '',
                    });
                }).catch(error => {
                    responseStatus(error.response.status);
                    // alert(error.response.data.message)
                    __this.$swal({
                        icon: 'error',
                        title: error.response.data.message,
                        text: '',
                    });
                });
        },
        onChangeRole(event) {
            console.log(event.target.value)
            const userId = this.$route.params.id;
            const __this = this;
            this.$http.post(`${process.env.API_URL}/api/settings/changeRole/${userId}`, { role_id: event.target.value, user_id: userId }, configHeaders())
                .then(response => {
                    console.log(response.data);
                    // alert('Updated')
                    __this.$swal({
                        icon: 'success',
                        title: 'Updated role success',
                        text: '',
                    });
                }).catch(error => {
                    // alert(error.response.data.message)
                     responseStatus(error.response.status);
                    __this.$swal({
                        icon: 'error',
                        title: 'Cannot update role',
                        text: '',
                    });
                });
        }

    },
    created() {
        const userId = this.$route.params.id;
        this.getUser(userId);
        this.getAllGroups();
        this.getLicense(userId);
        console.log('userId', userId);
    },
    computed: {
        ...mapState({
            groups: state => state.groups.all
        }),
    },
    data() {
        return {
            user: {},
            form: new Form({
                licenseId: '',
                type: '',
                account_id: ''
            }),
            formDelete: new Form({
                type: 'confirm'
            }),
            msg: 'Welcome to Your Vue.js App',
            currentSort: 'statusKey',
            currentSortDir: 'asc',
            licenses: [],
            columns: ['', 'Product', 'Status', 'License type', 'Available seats', 'Available seats', 'Available seats', '']
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style lang="scss" scoped>
</style>
