<template>
<div id="page-wrapper" class="licenses-page">
    <div class=" container-fluid">
        <div class="row">
            <div class="col-lg-12">
                <h1 class="page-header">All licenses</h1>
            </div>
            <!-- /.col-lg-12 -->
        </div>
        <div class="row">
            <div class="col-xs-12 col-lg-9 sort-left">
                <span class="text">Filter list: </span>&nbsp;&nbsp;
                <div class="form-group product" v-if="products.items">
                    <select class="form-control" v-model="productSelected">
                        <option value="null">Products</option>
                        <option v-for="option in products.items" v-bind:value="option.id">
                            {{ option.name }}
                        </option>
                    </select>
                </div>
                <div class="form-group status">
                    <select class="form-control" v-model="statusSelected">
                        <option v-for="option in Status" v-bind:value="option.value">
                            {{ option.text }}
                        </option>
                    </select>
                </div>
                <div class="form-group license">
                    <select class="form-control" v-model="typeSelected">
                        <option v-for="option in LicenseTypes" v-bind:value="option.value">
                            {{ option.text }}
                        </option>
                    </select>
                </div>
                <!-- <button type="button" class="btn btn-dark active" @click="userFilterKey = 'apply'">Apply</button> -->
                <button type="button" class="btn btn-secondary" @click="clearInput">Clear</button>
            </div>
            <div class="col-xs-12 col-lg-3 button-right">
                <span>View as: </span>&nbsp;&nbsp;
                <div role="group" class="btn-group">
                    <button type="button" class="btn btn-dark active">Admin</button>
                    <router-link to="/admin/licenses-as-user" class="btn btn-secondary">User</router-link>
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <!-- /.panel-heading -->
                    <div class="panel-body">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Product </th>
                                        <!-- <th class="active">Status <i :class="[currentSortDir== 'asc' ? 'fa fa-sort-amount-asc' : 'fa fa-sort-amount-desc' ]" @click="sort('statusKey')"></i></th> -->
                                        <th>License type</th>
                                        <th class="">Seat limit/Seats in use</th>
                                        <!-- <th class="text-center">Active users</th> -->
                                        <th>Expiry date </th>
                                        <th class="text-center"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template v-for="row in filteredRows">
                                        <tr class="r-line">
                                            <td @click="row.contentVisible = !row.contentVisible">
                                                <i :class="[row.contentVisible ? 'fa-angle-down' : 'fa-angle-right']" class="fa"></i>
                                            </td>
                                            <td @click="row.contentVisible = !row.contentVisible"><img :src="row.product.imageUrl" class="product-thumb" />{{row.product.name}}</td>
                                            <!--  <td @click="row.contentVisible = !row.contentVisible" class="status" v-html="row.status">  -->
                                            </td>
                                            <td @click="row.contentVisible = !row.contentVisible">
                                                <span class="sub-type-main" v-if="row.scheme">{{row.scheme.kindDisplay}},</span> <i class="sub-type color-primary"> {{row.typeDisplay}}</i>
                                            </td>
                                            <td @click="row.contentVisible = !row.contentVisible" class="">{{row.seatDisplay}}</td>
                                            <!-- <td @click="row.contentVisible = !row.contentVisible" class="text-center" >{{row.activeUsers}}</td>-->
                                            <td @click="row.contentVisible = !row.contentVisible" class="status color-red" v-html="row.expiry_date"></td>
                                            <td class="fl-right text-center">
                                                <router-link :to="{ name: 'ManageLicense', params: { id: row.id }}" class="btn btn-default btn-sm">Manage license </router-link>
                                            </td>
                                        </tr>
                                        <tr v-if="row.contentVisible" class="panel-mini">
                                            <td></td>
                                            <td colspan="1">
                                                <div class="pd-right-1">
                                                    <!-- <p><span class="bold inline">Activation Key:</span> {{row.text}}</p> -->
                                                    <p><span class="bold inline">Available version:</span> {{row.version_limit}} </p>
                                                </div>
                                            </td>
                                            <td colspan="1">
                                                <div class="pd-right-2">
                                                    <p>
                                                        <span class="bold">Groups:</span>
                                                        <span v-for="item in row.groups">{{ item }} <br /></span>
                                                    </p>
                                                </div>
                                            </td>
                                            <td colspan="2">
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
                                            <!-- <td></td> -->
                                        </tr>
                                    </template>
                                    <tr v-if="licenses.items == null || licenses.items.length === 0 || filteredRows.length === 0">
                                        <td class="text-center" colspan="7"> No Match Found</td>
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
        </div>
    </div>

</div>
<!-- /#page-wrapper -->
</template>

<script>
/* eslint-disable */
import { authHeader, configHeaders, responseStatus } from '@/_helpers';
import { mapState, mapActions } from 'vuex';
import Form from 'vform';
import Vue from 'vue';
export default {
    name: 'Licenses',
    created() {
        this.getAllLicenses();
        this.getAllProducts();

        setTimeout(function () {
            Vue.nextTick(function () {
                $('[data-toggle="tooltip"]').tooltip()
            })
        }, 2000);
    },
    data() {
        return {
            msg: 'Licenses',
            userFilterKey: 'apply',
            currentSort: 'statusKey',
            currentSortDir: 'asc',
            productSelected: null,
            typeSelected: null,
            statusSelected: null,
            // Products: [
            //     { value: null, text: 'Products' },
            //     { value: 'OPTUM CS', text: 'OPTUM CS' },
            //     { value: 'OPTUM G2', text: 'OPTUM G2' },
            //     { value: 'OPTUM G3', text: 'OPTUM G3' },
            //     { value: 'OPTUM MP', text: 'OPTUM MP' }
            // ],
            LicenseTypes: [
                { value: null, text: 'License types' },
                { value: 3, text: 'Single license' },
                { value: 2, text: 'Multi license' },
                { value: 1, text: 'Academic license' },
                { value: 0, text: 'Trial license' }
            ],
            Status: [
                { value: null, text: 'Status' },
                { value: 2, text: 'Active' },
                { value: 3, text: 'Expired' },
                { value: 1, text: 'Verification required' },
                { value: 0, text: 'Available' }
            ],
            form: new Form({
                licenseId: '',
                type: '',
                account_id: ''
            }),
            columns: ['', 'Product', 'Status', 'License type', 'Available seats', 'Available seats', 'Available seats', '']
        }
    },
    methods: {
        ...mapActions('licenses', {
            getAllLicenses: 'getAllByAdmin'
        }),
        ...mapActions('products', {
            getAllProducts: 'getAll'
        }),
        async assignUsers(type, account_id, licenseId) {
            this.form.type = type;
            this.form.account_id = account_id;
            this.form.licenseId = licenseId;
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/licenses/assign', configHeaders()).then(({ data }) => {
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
        sort: function (s) {
            this.userFilterKey = 'apply';
            //if s == current sort, reverse
            if (s === this.currentSort) {
                this.currentSortDir = this.currentSortDir === 'asc' ? 'desc' : 'asc';
            }
            this.currentSort = s;
        },
        showRow(data) {
            this.contentVisible = !this.contentVisible;

        },
        clearInput() {
            this.productSelected = null;
            this.statusSelected = null;
            this.typeSelected = null;
            this.userFilterKey = 'apply';
            this.sort = 'asc';
        },
        filterByProductName: function (row) {
            if (row.product) {
                const department = row.product_id.toString().toLowerCase();
                console.log('row.product_id', row.product_id);
                console.log(' this.productSelected', this.productSelected);
                if (this.productSelected != null) {
                    const searchTerm = this.productSelected.toString().toLowerCase();
                    return department.includes(searchTerm);
                } else {
                    return true;
                }
            } else {
                return true;
            }

        },
        filterByStatus: function (row) {
            if(row.statusKey == undefined){
                return true;
            }
            const department = row.statusKey.toString().toLowerCase();
            if (this.statusSelected != null) {
                const searchTerm = this.statusSelected.toString().toLowerCase();
                return department.includes(searchTerm);
            } else {
                return true;
            }
        },
        filterByType: function (row) {
            if (row.scheme) {
                const department = row.scheme.kind.toString().toLowerCase();
                if (this.typeSelected != null) {
                    const searchTerm = this.typeSelected.toString().toLowerCase();
                    return department.includes(searchTerm);
                } else {
                    return department;
                }
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
            licenses: state => state.licenses.all,
            products: state => state.products.all,
        }),
        filteredRows() {
            return this[this.userFilterKey]
        },
        all() {

            return this.licenses.items ? this.licenses.items : [];
        },
        apply() {
            return this.licenses.items ? this.licenses.items
                .filter(this.filterByProductName)
                .filter(this.filterByStatus)
                .filter(this.filterByType)
                .sort(this.orderBy): [];
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>

</style>
