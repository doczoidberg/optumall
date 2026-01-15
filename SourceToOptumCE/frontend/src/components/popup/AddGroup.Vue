<template>
<div>
    <div id="addNewUser" class="modal fade" role="dialog">
        <div class="modal-dialog">
            <!-- Modal content-->
            <div class="modal-content">
                <form role="form" @submit.prevent="send" @keydown="form.onKeydown($event)">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal">&times;</button>
                        <h4 class="modal-title">Add Group</h4>
                    </div>
                    <div class="modal-body popup-user">
                        <div class="form-group">
                            <label for="usr">Name:</label>
                            <input type="text" class="form-control" v-model="form.name" name="name" id="usr">
                        </div>
                        <!-- <div class="form-group">
                            <label for="sel1">Type:</label>
                            <select class="form-control" v-model="form.type" id="sel1">
                                <option value="0">individual</option>
                                <option value="1">organization</option>
                                <option value="2">university</option>
                            </select>
                        </div>
                         -->
                         <div class="form-group">
                            <label for="usr">Description:</label>
                            <input type="text" class="form-control" v-model="form.description" name="description" id="description">
                        </div>
                        <div class="form-group">
                            <label for="usr">Bulk add users:</label>
                            <textarea class="form-control" v-model="form.emails" name="emails" id="emails"></textarea>
                            <i>Example: test01@gmail;tester02@gmail;</i>
                        </div>
                        <div class="modal-footer">
                            <alert-success :form="form" message="Created success!"></alert-success>
                            <button type="submit" :disabled="form.busy" class="btn btn-info btn-add-popup">Add</button>
                            <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    </div>
    <!-- popup add success -->
    <div id="addNewUserSuccess" class="modal fade" role="dialog">
        <div class="modal-dialog modal-sm popup-add-success">
            <!-- Modal content-->
            <div class="modal-content">
                <div class="modal-body popup-user text-center">
                    <h4 class="modal-title">Group(s) added succesfully</h4>
                    <!-- <p>An email has been sent with an invitation to the user(s)<br /> to join your organization.</p> -->
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
import Vue from 'vue';
export default {
    name: 'AddGroupPopup',
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            form: new Form({
                name: '',
                type: 0,
                description: '',
                emails: ''
            })
        }
    },
    methods: {

        async send() {
            const __this = this;
            await this.form.post(process.env.API_URL + '/api/group', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    $("#addNewUser").modal('hide');
                    $("#addNewUserSuccess").modal('show');
                    this.form.reset();
                    this.$emit('reloadList', 'reload');

                })
                .catch(function (error) {
                    responseStatus(error.response.status);
                     __this.$swal({
                        icon: 'error',
                        title: error.response.data.message,
                        text: '',
                    });
                    //  alert(error.response.data.message)
                    //  this.$alert(error.response.data.message,'', 'error');
                })

        }
    }
}
</script>
