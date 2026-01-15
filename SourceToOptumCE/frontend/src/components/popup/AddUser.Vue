<template>
<div>
    <div id="addNewUser" class="modal fade" role="dialog">
        <div class="modal-dialog">
            <!-- Modal content-->
            <div class="modal-content">

                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal">&times;</button>
                    <h4 class="modal-title">Add Users</h4>
                </div>
                <div class="modal-body popup-user">
                    <ul class="nav nav-pills">
                        <!-- <li class="active"><a data-toggle="pill" href="#home">Add single user</a></li>-->
                        <li class="active"><a data-toggle="pill" href="#menu1">Enter multiple email addresses separated with comma or / and space</a></li>
                    </ul>
                    <div class="tab-content">
                       <!-- <div id="home" class="tab-pane fade in active">
                            <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">-->
                                <!-- <div class="form-group">
                                <label for="username">Username:</label>
                                <input type="text" class="form-control"  v-model="form.user_name" id="username">
                                <has-error :form="form" field="user_name"></has-error>
                            </div>
                            <div class="form-group">
                                <label for="password">Password:</label>
                                <input type="password" class="form-control" v-model="form.password" id="password">
                                <has-error :form="form" field="password"></has-error>
                            </div> -->

                              <!--    <div class="form-group">
                                    <label for="usr">First Name:</label>
                                    <input type="text" class="form-control" v-model="form.first_name" id="usr">
                                    <has-error :form="form" field="first_name"></has-error>
                                </div>
                                <div class="form-group">
                                    <label for="lastname">Last Name:</label>
                                    <input type="text" class="form-control" id="last_name" v-model="form.last_name">
                                    <has-error :form="form" field="last_name"></has-error>
                                </div>
                                <div class="form-group">
                                    <label for="email">Email:</label>
                                    <input type="email" class="form-control" id="email" v-model="form.email">
                                    <has-error :form="form" field="email"></has-error>
                                </div>
                                <div class="modal-footer">
                                    <button type="submit" class="btn btn-info btn-add-popup">Add</button>
                                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                                </div>
                            </form>
                        </div>-->
                        <div id="menu1" class="tab-pane fade in active">
                            <form role="form" @submit.prevent="sendBulk" @keydown="bulkForm.onKeydown($event)">
                                <div class="form-group">
                                    <textarea class="form-control h-auto" v-model="bulkForm.accounts" placeholder="name@domain.com,name@domain.com,email@domain.com" rows="7" id="accounts"></textarea>
                                    <!--<span class="note">Example: John Doe ,jdoe@domain.com>,</span> -->
                                </div>
                                <div class="modal-footer">
                                    <button type="submit" class="btn btn-info btn-add-popup">Add</button>
                                    <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
                                </div>
                            </form>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    </div>
    <!-- popup add success -->
    <div id="addNewUserSuccess" class="modal fade" role="dialog">
        <div class="modal-dialog modal-sm popup-add-success">
            <!-- Modal content-->
            <div class="modal-content">
                <div class="modal-body popup-user text-center">
                    <h4 class="modal-title">User(s) added succesfully</h4>
                    <p>An email has been sent with an invitation to the user(s)<br /> to join your organization.</p>
                    <button type="button" class="btn btn-info btn-add-popup" data-dismiss="modal">OK</button>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
/* eslint-disable */
import Form from 'vform'
import { authHeader, configHeaders, responseStatus} from '@/_helpers';
export default {
    name: 'AddUserPopup',
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                user_name: '',
                password: '',
                email: '',
                first_name: '',
                last_name: ''
            }),
            bulkForm: new Form({
                accounts: ''
            })
        }
    },
    methods: {
        async send() {
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/createUser', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    if (!data.show_popup) {
                        // $("#addNewUser").modal('hide');
                        // $("#addNewUserSuccess").modal('show');
                        //

                    } else {
                        $("#addNewUser").modal('hide');
                        __this.$swal({
                            icon: 'success',
                            title: data.message,
                            text: '',
                        });
                         this.form.reset();
                    }

                    this.$emit('reloadList', 'reload');
                })
                .catch(function (error) {
                    console.log(error);
                    responseStatus(error.response.status);
                    if (error.response.data.message) {
                        __this.$swal({
                            icon: 'error',
                            title: error.response.data.message,
                            text: '',
                        });
                    }

                    // alert(error.response.data.message)
                })
        },
        async sendBulk() {
            const __this = this;
            await this.bulkForm.post(process.env.API_URL + '/api/createBulk', configHeaders()).then(({ data }) => {
                    $("#addNewUser").modal('hide');
                    $("#addNewUserSuccess").modal('show');
                    this.form.reset();
                    this.$emit('reloadList', 'reload');
                    // setTimeout(()=>{
                    //    location.reload();
                    // },1000);
                })
                .catch(function (error) {
                    console.log(error);
                    responseStatus(error.response.status);
                    if (error.response.data.message) {
                        __this.$swal({
                            icon: 'error',
                            title: error.response.data.message,
                            text: '',
                        });
                    }
                })
        }

    }
}
</script>
