<template>
<!-- Page Content -->
<div id="page-wrapper" class="users-page manage-license-page">
    <div class="container-fluid">
        <div class="row">
            <div class="col-lg-12">
                <h1 class="page-header Manage-header">Manage license</h1>
                <router-link to="/admin/licenses" class="text-primary btn-back-to-list"><i class="fa fa-long-arrow-left"></i> Back to list</router-link>
            </div>
            <!-- /.col-lg-12 -->
        </div>
        <!-- end title -->
        <div class="row mt-35" v-if="!loading">
            <div class="col-sm-12 col-md-3" v-if="license.product">
                <img :src="license.product.imageUrl" class="product-thumb" />
                <h3 class="name">{{license.product.name}}</h3>
                <!-- <p>
                    <strong>License: </strong> <span class="sub-type-main">{{license.scheme.kindDisplay}},</span> <i class="sub-type color-primary"> {{license.scheme.typeDisplay}}</i><br />
                    <strong>Available seats:</strong> {{license.availableSeats}}<br />
                    <strong>Status:</strong> <span class="status" v-html="license.status"> </span><br /> -->
                    <!-- <strong>Ownership:</strong> Subscription<br /> -->
                    <!-- <strong>Expiry date:</strong> {{license.expiry_date}} <br />
                    <strong>Available Domain:</strong> {{license.available_domain}} <br />
                    <strong>Arbitrary domain restriction:</strong>
                    <span v-if="license.arbitrary_domain == 1">
                        Yes
                    </span>
                    <span v-else>
                        No
                    </span>
                    <br />
                    <strong>Automatic assign user: </strong> -->
                    <!-- <span class="btn-switch">
                        <label class="switch switch-btn">
                            <input type="checkbox" v-bind:checked="license.automatic_assign" name="assign" @change="handleChangeAutomaticAssign($event,license.id)">
                            <div class="slider round">
                                <span class="on">OK</span><span class="off">OFF</span>
                            </div>
                        </label>
                    </span> -->
                    <!-- <btn-switch @isChecked="handleChangeAutomaticAssign" :val="license.automatic_assign" :parentData="license.id"></btn-switch>
                    <br />
                </p> -->
                <div class="left-content">
                    <p><strong>License: </strong> <span class="sub-type-main">{{license.scheme.kindDisplay}},</span> <i class="sub-type color-primary"> {{license.scheme.typeDisplay}}</i></p>
                    <p><strong>Available seats:</strong> {{license.availableSeats}}</p>
                    <p><strong>Status:</strong> <span class="status" v-html="license.status"> </span></p>
                    <p><strong>Expiry date:</strong> {{license.expiry_date}} </p>
                    <p><strong>Available Domain:</strong> {{license.available_domain}}</p>
                    <p><strong>Arbitrary domain restriction:</strong><span v-if="license.arbitrary_domain == 1">Yes</span><span v-else>No</span></p>
                    <p><strong>Automatic assign user: </strong><btn-switch @isChecked="handleChangeAutomaticAssign" :val="license.automatic_assign" :parentData="license.id"></btn-switch></p>
                   
                </div>
            </div>
            <div class="col-sm-12 col-md-8">
                <!-- content -->
                <div class="row">
                    <div class="col-lg-12 sort-left manage-edit">
                        <span class="fl-left-manage">Assigned users </span>
                        <input class="form-control search-input" type="text" name="search" v-model="userSelected" placeholder="Search users...">
                        <button class="btn btn-search" @click="userFilterKey = 'apply'"><i class="fa fa-search"></i></button>
                        <button class="btn btn-addnew" @click="assignUsers('Assign')">
                            Assign all users <i class="fa fa-plus"></i>
                        </button>
                        <button class="btn btn-black" @click="assignUsers('Unassign')">
                            Unassign all users <i class="fa fa-times"></i>
                        </button>
                    </div>
<!-- 
                    <div class="col-lg-2 button-right button-right-manage">
                       
                    </div> -->
                    <!-- <div class="col-lg-2 button-right button-right-manage">
                        
                    </div> -->
                </div>
                <!-- end sort by -->
                <!-- /.row -->
                <div class="row">
                    <div class="col-lg-12 table-manager">
                        <div class="panel panel-default">
                            <div class="panel-body">
                                <div class="table-responsive">
                                    <table class="table table-users">
                                        <colgroup>
                                            <col width="30%">
                                            <col width="30%">
                                            <col width="20%">
                                            <col width="20%">
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th>Name <i class="fa fa-sort-amount-desc"></i></th>
                                                <th>Email</th>
                                                <th>Group</th>
                                                <th class="txt-right">Assign</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            
                                            <tr class="r-line mr-32" v-for="(item, index) in filteredRows" :key="index" v-if="item.member">
                                                <td>{{item.member.name}}</td>
                                                <td>{{item.member.email}}</td>
                                                <td>{{item.member.group}}</td>
                                                <td>
                                                    <!-- <label class="switch">
                                                        <input type="checkbox"  v-model="item.assign" :value="item.id" v-bind:checked="item.assign" name="assign" @change="handleChange($event,item.member.account_id)">
                                                        <div class="slider round">
                                                            <span class="on">OK</span><span class="off">OFF</span>

                                                        </div>
                                                    </label> -->
                                                     <btn-switch @isChecked="handleChangeBtn" :val="item.assign" :parentData="item"></btn-switch>
                                                </td>
                                              
                                            </tr>
                                          
                                            <tr v-if="members == null || members.length === 0 || filteredRows.length === 0">
                                                <td class="text-center" colspan="4"> Empty Data</td>
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
    </div>
    <!-- /.container-fluid -->
</div>
</template>

<script>
/* eslint-disable */
import { authHeader, configHeaders, responseStatus } from '@/_helpers';
import { mapState, mapActions } from 'vuex';
import Form from 'vform';
import BtnSwitch from '@/components/button/BtnSwitch.vue';
export default {
    name: 'ManageLicense',
    components: {
        BtnSwitch
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            license: {},
            members: [],
            userFilterKey: 'all',
            userSelected: '',
            loading: true,
            form: new Form({
                licenseId: '',
                type: '',
                account_id: ''
            })
        }
    },
    methods: {
        // userFilterKey() {
        //     console.log('search')
        //     return this.members
        //         .filter(this.filterByNameOrEmail);
        // },
        filterByNameOrEmail: function (row) {
            if (row.member) {
                const department = row.member.name.toString().toLowerCase();
                const departmentEmail = row.member.email.toString().toLowerCase();
                if (this.userSelected != null && this.userSelected != '') {
                    const searchTerm = this.userSelected.toString().toLowerCase();
                    return department.includes(searchTerm) || departmentEmail.includes(searchTerm);
                } else {
                    return true;
                }
            } else {
                return true;
            }

        },
          async handleChangeAutomaticAssign(value) {
            this.form.licenseId = value.parentData;
            this.form.type = value.checked ? 1 : 0;
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/licenses/automatic_assign', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    // this.getUser();
                    this.form.reset();
                    // alert(data.message);
                    __this.$swal({
                        icon: 'success',
                        title: data.message,
                        text: '',
                    });
                })
                .catch(function (error) {
                    // alert(error.response.data.message)
                    responseStatus(error.response.status);
                    __this.$swal({
                        icon: 'error',
                        title: 'An error occurred. Please try again',
                        text: '',
                    });
                })
        },
        handleChangeBtn(value){
            const type = value.checked ? 'Assign' : 'UnAssign';
            this.handleChange(type, value.parentData.member.account_id);
        },
        async handleChange(type, account_id) {
            this.form.account_id = account_id;
            this.form.type = type;
            this.form.licenseId = this.$route.params.id;
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/licenses/assign', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    __this.getUser();
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
                     if(error.response.data.message){
                         __this.$swal({
                            icon: 'error',
                            title: error.response.data.message,
                            text: '',
                        });
                    }
                })
        },
        async assignUsers(type) {
            this.form.type = type;
            const __this = this;
            this.form.licenseId = this.$route.params.id;
            await this.form.post(process.env.API_URL + '/api/licenses/assignUsers', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    __this.getUser();
                    this.form.reset();
                    __this.$swal({
                        icon: 'success',
                        title: data.message,
                        text: '',
                    });
                })
                .catch(function (error) {
                    responseStatus(error.response.status);
                    if(error.response.data.message){
                         __this.$swal({
                            icon: 'error',
                            title: error.response.data.message,
                            text: '',
                        });
                    }

                })
        },
        getUser() {
            const licensesId = this.$route.params.id;
            this.$http.get(`${process.env.API_URL}/api/licenses/getDetail/${licensesId}`, configHeaders()).then(response => {
                console.log('==licenses:==', response.data);
                this.license = response.data.license;
                // console.log('===this.license:===', response.data);
                this.members = response.data.members;
                this.loading = false;
            }).catch(function (error) {
                    responseStatus(error.response.status);
                    if(error.response.data.message){
                         __this.$swal({
                            icon: 'error',
                            title: error.response.data.message,
                            text: '',
                        });
                    }
                })
        },
    },
    created() {
        this.getUser();
        // console.log('licensesId', licensesId);
    },
    computed: {
        filteredRows() {
            return this[this.userFilterKey]
        },
        all() {
            return this.members;
        },
        apply() {
            return this.members
                .filter(this.filterByNameOrEmail);
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>

</style>
