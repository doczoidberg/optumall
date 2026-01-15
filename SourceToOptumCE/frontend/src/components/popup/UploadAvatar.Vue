<template>
<div class="upload-avatar-popup">
    <label class="custom-file-upload">
        <input type="file" @change="upload($event)" />
        <i class="fa fa-refresh" aria-hidden="true"></i> Change image
    </label>
    <div id="modalUploadAvatar" class="modal fade" role="dialog">
        <div class="modal-dialog modal-sm popup-user-delete popup-upload-avatar">
            <!-- Modal content-->
            <div class="modal-content">
                <div class="modal-body  text-left">
                    <button type="button" data-dismiss="modal" class="close">×</button>
                    <h4 class="modal-title">New profile picture</h4>
                    <div class="row">
                        <div class="col-xs-12 col-sm-6 left-img">
                            <clipper-basic  :wrapRatio="1" ref="clipper" class="my-clipper" :ratio="1" @load="imgLoad"  :src="imgURL" preview="my-preview">
                                <div class="placeholder" slot="placeholder">No image</div>
                            </clipper-basic>
                            <p>Crop image</p>
                        </div>
                        <div class="col-xs-12 col-sm-6 right-img">
                            <clipper-preview name="my-preview" class="my-clipper">
                                <div class="placeholder" slot="placeholder">preview area</div>
                            </clipper-preview>
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
                                <img class="result" :src="resultURL" alt="">
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
</div>
</template>

<script>
/* eslint-disable */
import { authHeader, configHeaders, responseStatus} from '../../_helpers';
export default {
    name: 'UploadAvatar',
    data() {
        return {
            msg: 'Welcome to Your Vue.js App',
            imgURL: require('@/assets/images/avatar_preview.png'),
            resultURL: ''
        }
    },
    created: function () {
        this.imgLoad();
    },
    methods: {
        imgLoad: function() {
             this.$refs.clipper.setWH$.next({width: 100, height: 100})
             this.$refs.clipper.clip({ wPixel: 250 });
        },
        getResult: function () {
            const canvas = this.$refs.clipper.clip(); //call component's clip method

            this.resultURL = canvas.toDataURL("image/jpeg", 1); //canvas->image
            const __this = this;
            this.$http.post(process.env.API_URL + '/api/upload', {image: this.resultURL}, configHeaders())
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
        upload: function (e) {
            if (e.target.files.length !== 0) {
                if (this.imgURL) URL.revokeObjectURL(this.imgURL)
                this.imgURL = window.URL.createObjectURL(e.target.files[0]);
                console.log('uploaded')
                $('#modalUploadAvatar').modal('show')
            }
        }
    }
}
</script>

<style lang="scss" scoped>
</style>
