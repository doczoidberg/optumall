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
            <div class="col-lg-9 sort-left">
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
                                          <!-- <th>Status <i :class="[currentSortDir== 'asc' ? 'fa fa-sort-amount-asc' : 'fa fa-sort-amount-desc' ]" @click="sort('statusKey')"></i></th> -->
                                        <th>License type</th>
                                        <th>Seat limit/Seats in use</th>
                                        <!--<th>Active users</th> -->
                                        <th>Expiry date </th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template v-for="row in filteredRows">
                                        <tr class="r-line">
                                            <td @click="row.contentVisible = !row.contentVisible">
                                                <i :class="[row.contentVisible ? 'fa-angle-down' : 'fa-angle-right']" class="fa"></i>
                                            </td>
                                            <td @click="row.contentVisible = !row.contentVisible"><img :src="row.product.imageUrl" class="product-thumb" />{{row.product.name}}</td>
                                             <!--  <td @click="row.contentVisible = !row.contentVisible" class="status" v-html="row.status"></td> -->
                                            <td @click="row.contentVisible = !row.contentVisible">
                                                <span><span class="sub-type-main">{{row.scheme ? row.scheme.kindDisplay : row.kindDisplay}},</span> <i class="sub-type color-primary"> {{row.typeDisplay}}</i></span>
                                            </td>
                                            <td @click="row.contentVisible = !row.contentVisible" class="">
                                                {{row.seatDisplay}}
                                            </td>
                                            <!-- <td @click="row.contentVisible = !row.contentVisible" class="text-center">{{row.activeUsers}}</td> -->
                                            <td @click="row.contentVisible = !row.contentVisible" class="date color-red" v-bind:class="{'status': row.statusKey==3}">
                                                <span v-bind:class="{'status expired': row.statusKey==3}">{{row.expiry_date}}</span>
                                            </td>
                                            <td class="text-left">
                                                <a target="_blank" :href="row.product.dowloadUrl" v-if="row.statusKey==2" class="cursor-pointer btn btn-default btn-sm" type="button">Download latest version</a>
                                                <a target="_blank" href="https://optumce.com/get-quote/" v-if="row.statusKey==3" class="color-action cursor-pointer">Get quote</a>
                                                <a v-if="row.statusKey==1" class="color-action cursor-pointer" @click="sendMail('resend',row.id)">Resend email</a>
                                                <a v-if="row.kindDisplay && row.id" class="color-action cursor-pointer" @click="sendActivate('activate', row.id)">Activate License and Download Software</a>
                                            </td>
                                        </tr>
                                        <tr v-if="row.contentVisible" class="panel-mini">
                                            <td></td>
                                            <td colspan="1">
                                                <div class="pd-right-1">
                                                    <!-- <p><span class="bold inline">Activation key:</span> {{row.text}} </p> -->
                                                    <p><span class="bold inline">Available version:</span> {{row.version_limit}} </p>
                                                </div>
                                            </td>

                                            <td colspan="1">
                                                <div class="pd-right-2">
                                                    <p>
                                                        <span class="bold inline">License email:</span><br />
                                                        <span v-for="item in row.licenseEmails">
                                                            <span v-if="item.email"> {{ item.email }} <br /></span>
                                                        </span>
                                                    </p>
                                                    <p v-if="row.account != undefined"><span class="bold inline">Owner:</span> {{row.account.name}} </p>
                                                </div>
                                            </td>
                                            <td colspan="2" class="">
                                                <div class="pd-right-3">
                                                    <p><span class="bold">Active users:</span>
                                                        <span v-if="row.seatAccounts == null || row.seatAccounts.length === 0">None</span>
                                                        <span v-for="(item, key)  in row.seatAccounts">
                                                            <span v-if="item.email"> {{ item.email }}<br /> </span>
                                                        </span>
                                                    </p>
                                                </div>
                                            </td>
                                              <td></td>
                                            <!-- <td></td>-->
                                        </tr>
                                    </template>
                                    <tr v-if="licenses.items == null || licenses.items.length === 0  || filteredRows.length === 0">
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
import Form from 'vform'
import { authHeader, configHeaders, responseStatus} from '@/_helpers';
import { mapState, mapActions } from 'vuex'
export default {
    name: 'UserLicenses',
    created() {
        this.getAllLicenses();
        this.getAllProducts();
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
            columns: ['', 'Product', 'Status', 'License type', 'Available seats', 'Available seats', 'Available seats', ''],
            form: new Form({
                id: '',
                type: 0,
                userId: 0
            })
        }
    },
    methods: {
        ...mapActions('licenses', {
            getAllLicenses: 'getAll'
        }),
        ...mapActions('products', {
            getAllProducts: 'getAll'
        }),
        async sendMail(type, id) {

            this.form.id = id;
            this.form.type = type;
            let __this = this;
            await this.form.post(process.env.API_URL + '/api/licenses/sendMail', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                     __this.$swal({
                            icon: 'success',
                            html: '<h4>An activation email has been sent to '+data.email+'.<br/> Please check your email!</h4>',
                            text: '',
                        });
                })
                .catch(function (error) {
                    console.log('error', error);
                    responseStatus(error.response.status);
                     __this.$swal({
                        icon: 'error',
                        title: 'Cannot re-send. Please contact support!',
                        text: '',
                    });
                })
        },
        async sendActivate(type, id) {

            this.form.id = id;
            this.form.type = type;
            let __this = this;
            await this.form.post(process.env.API_URL + '/api/licenses/activeLicense', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    if (data.stauts) {
                         this.getAllLicenses();
                        __this.$swal({
                            icon: 'success',
                            title: 'Your license has been activated successfully.<br/> You can now download the software.',
                            text: '',
                        });
                    }
                })
                .catch(function (error) {
                    console.log('error', error);
                    responseStatus(error.response.status);
                    __this.$swal({
                        icon: 'error',
                        title: 'Your license is not activated successfully.<br/> Please contact support!',
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
            console.log('a[this.currentSort]', a[this.currentSort]);
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
                .sort(this.orderBy) : [];
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>

</style>
