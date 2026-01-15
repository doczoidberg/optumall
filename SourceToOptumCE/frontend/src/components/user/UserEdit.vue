<template>
<!-- Page Content -->
<div id="page-wrapper" class="profile-page user-edit">
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
                                    <div class="col-lg-3 avatar avatar-edit custom-avt" v-if="profile.item">
                                        <div class="avatar-content">
                                            <h5 class="profile-title">Profile picture</h5>
                                            <img class="avatar_default  img-circle" :src="profile.item.avatarUrl" alt="avatar_default  img-circle">
                                            <br />
                                            <div class="upload-avatar-popup">
                                                <label class="custom-file-upload">
                                                    <input type="file" @change="upload($event)" />
                                                    <i class="fa fa-refresh" aria-hidden="true"></i> Change image
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-lg-9 infomation infomation-edit" v-if="profile.item">
                                        <update-profile></update-profile>
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
    <div id="modalUploadAvatar" class="modal fade" role="dialog">
        <div class="modal-dialog modal-sm popup-user-delete popup-upload-avatar">
            <!-- Modal content-->
            <div class="modal-content">
                <div class="modal-body  text-left">
                    <button type="button" data-dismiss="modal" class="close">×</button>
                    <h4 class="modal-title">New profile picture</h4>
                    <div class="row">
                        <div class="col-xs-12 col-sm-6 left-img">
                            <clipper-basic class="my-clipper" ref="clipper"   :ratio="1" :src="imgURL" preview="my-preview">
                                <div class="placeholder" slot="placeholder">No image</div>
                            </clipper-basic>
                            <div class="clear-fix"></div>
                            <p>Crop image</p>
                        </div>
                        <div class="col-xs-12 col-sm-6 right-img">
                            <clipper-preview name="my-preview" class="my-clipper" v-if="!isLoad">
                                <div class="placeholder" slot="placeholder">preview area</div>
                            </clipper-preview>
                            <img class="my-clipper img-responsive" :src="resultURL" alt="" v-if="isLoad">
                            <p>Preview</p>
                        </div>
                    </div>
                    <div class="row" style="display:none">
                        <div class="col-sm-12">
                            <button>
                                <clipper-upload v-model="imgURL">upload image</clipper-upload>
                            </button>
                            <button @click="getResult" style="display:none">clip image</button>
                            <div>
                                <div>result:</div>
                                <!-- <img class="result" :src="resultURL" alt="">-->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer rm-line">
                        <button @click="getResult" class="btn btn-primary">Save changes</button>
                        <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- /.container-fluid -->
</div>
</template>

<script>
/* eslint-disable */
import Form from 'vform'
import Settings from '@/components/pages/Settings.vue'
import UploadAvatar from '@/components/popup/UploadAvatar.vue'
import UpdateProfile from '@/components/popup/UpdateProfile.vue'
import { mapState, mapActions } from 'vuex'
import { authHeader, configHeaders } from '@/_helpers';
export default {
    name: 'UserEdit',
    components: {
        'component-setting': Settings,
        'component-upload-avatar': UploadAvatar,
        UpdateProfile
    },
    methods: {
        ...mapActions('users', {
            getById: 'getById'
        })
    },
    computed: {
        ...mapState({
            account: state => state.account,
            profile: state => state.users.profile
        })
    },
    created() {
        this.getById();
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            imgURL: require('@/assets/images/avatar_preview.png'),
            resultURL: '',
            rotation: 0,
            ratio: 1,
            isLoad: true,
        }
    },
    methods: {
        ...mapActions('users', {
            getById: 'getById'
        }),
        imgLoad: function () {

        },
        getResult: function () {
            const canvas = this.$refs.clipper.clip({ wPixel: 350 }); //call component's clip method
            this.resultURL = canvas.toDataURL("image/jpeg", 1); //canvas->image
            const __this = this;
            this.$http.post(process.env.API_URL + '/api/upload', { image: this.resultURL }, configHeaders())
                .then(function (response) {
                    console.log(response.data);
                    $('#modalUploadAvatar').modal('hide');
                    // location.reload();
                    __this.$swal({
                        icon: 'success',
                        title: 'Profile piture updated successfully',
                        text: '',
                    });
                    __this.profile.item.avatarUrl = response.data.image
                }).catch(function (error) {
                    console.log(error)
                    responseStatus(error.response.status);
                    __this.$swal({
                        icon: 'error',
                        title: error.response.data.message,
                        text: '',
                    });
                });
        },
        uploadFile: function () {
            let elem = this.$els.myBtn
            elem.click()
        },
        closePopup: function (e) {

            $('#modalUploadAvatar').modal('hide')
        },
        makeImage: function () {

            const canvas = this.$refs.clipper.clip({ wPixel: 250 }); //call component's clip method
            this.resultURL = canvas.toDataURL("image/jpeg", 1);
        },
        upload: function (e) {
            if (e.target.files.length !== 0) {
                if (this.imgURL) URL.revokeObjectURL(this.imgURL)
                this.imgURL = window.URL.createObjectURL(e.target.files[0]);
                console.log('uploaded')
                $('#modalUploadAvatar').modal('show');
                const __this = this;
                setTimeout(function () { __this.makeImage(); }, 500);
            }
        }
    },
    mounted () {
        let i = 0;
        this.$refs.clipper.onChange$.subscribe(() => {
            console.log('onChange');
            i++;
            if(i>=1){
                this.isLoad = false;
            }
        })
    }
}
</script>

<style scoped>
</style>
