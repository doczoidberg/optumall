<template>
<form @submit.prevent="update" @keydown="form.onKeydown($event)">
    <div class="row">
        <div class="col-sm-6">
            <div class="form-group">
                <label for="usr">First name</label>
                <input type="text" class="form-control" id="usr" name="first_name" v-model="form.first_name">
                <has-error :form="form" field="first_name"></has-error>
            </div>
            <div class="form-group">
                <label for="organization">Company/organization</label>
                <input type="text" class="form-control" id="organization" name="organization" v-model="form.organization">
                <has-error :form="form" field="organization"></has-error>
            </div>
            <div class="form-group">
                <label for="street">Street</label>
                <input type="text" class="form-control" id="street" value="Street name" v-model="form.street">
                <has-error :form="form" field="street"></has-error>
            </div>
            <div class="form-group">
                <label for="city">City</label>
                <input type="text" class="form-control" name="city" id="city" v-model="form.city">
                <has-error :form="form" field="city"></has-error>
            </div>
            <div class="form-group">
                <label for="country">Country</label>
                <input type="text" class="form-control" name="country" id="country" v-model="form.country">
                <has-error :form="form" field="country"></has-error>
            </div>
            <!-- <label for="phone">Phone</label>
            <div class="input-group">
                <span class="input-group-addon">
                    <img src="@/assets/images/flags-english.png" />
                </span>
                <input id="phone" type="text" class="form-control custom-input-192" name="phone_number" v-model="form.phone_number" placeholder="Phone">
            </div> -->
            <div class="form-group">
                <label for="country">Phone</label>
                <vue-tel-input v-model="form.phone_number"  v-bind="bindProps"></vue-tel-input>
                <has-error :form="form" field="phone_number"></has-error>
            </div>

            <div class="footer-form">
                <alert-success :form="form" message="Updated success!"></alert-success>
                <button :disabled="form.busy" type="submit" class="btn btn-primary">Save changes</button>
                <router-link to="/profile" class="btn btn-default btn-cancel" v-if="profile.item && profile.item.role == 0">Cancel</router-link>
                <router-link to="/admin/profile" class="btn btn-default btn-cancel" v-if="profile.item &&  profile.item.role == 1">Cancel</router-link>
            </div>
        </div>
        <div class="col-sm-6">
            <div class="form-group">
                <label for="lastname">Last name:</label>
                <input type="text" class="form-control" id="lastname" name="last_name" v-model="form.last_name">
                <has-error :form="form" field="last_name"></has-error>
            </div>
            <div class="form-group">
                <label for="title">Title:</label>
                <input type="text" class="form-control" id="title" name="title" v-model="form.title">
                <has-error :form="form" field="title"></has-error>
            </div>
            <div class="form-group">
                <label for="street_number">Number:</label>
                <input type="text" class="form-control custom-input-sm" name="street_number" id="street_number" v-model="form.street_number">
                <has-error :form="form" field="street_number"></has-error>
            </div>
            <div class="form-group">
                <label for="zipcode">Zip:</label>
                <input type="text" class="form-control custom-input-sm" name="zipcode" id="zipcode" v-model="form.zipcode">
                <has-error :form="form" field="zipcode"></has-error>
            </div>
            <div class="form-group">
                <label for="region">Region:</label>
                <input type="text" class="form-control" name="region" id="region" v-model="form.region">
                <has-error :form="form" field="region"></has-error>
            </div>
             <input type="hidden" class="form-control" name="roleType" id="roleType" v-model="roleType">
        </div>
    </div>
</form>
</template>

<script>
/* eslint-disable */
import Form from 'vform'
import { mapState, mapActions } from 'vuex'
import { authHeader, configHeaders, responseStatus} from '@/_helpers';
export default {
    name: 'UpdateProfile',

    computed: {
        ...mapState({
            account: state => state.account,
            profile: state => state.users.profile
        })
    },
    created() {
        this.getById();
        if (this.profile.item) {
            this.roleType =  this.profile.item.role;
            this.form.keys().forEach(key => {
                console.log('key', this.profile.item[key]);
                this.form[key] = this.profile.item[key]
            })
        }
    },
    methods: {
        ...mapActions('users', {
            getById: 'getById'
        }),
        async update() {
            const __this = this;
            this.form.phone_number = this.form.phone_number != null &&  this.form.phone_number != "" ?  this.form.phone_number.replace(/ /g, "") : "";
            await this.form.post(process.env.API_URL + '/api/settings/profile', configHeaders()).then(({ data }) => {
                    console.log('data', data);
                    // __this.$swal({
                    //     icon: 'success',
                    //     title: "Updated success!",
                    //     text: '',
                    // });
                    setTimeout(() => {
                         __this.$router.push(__this.roleType == 1 ? '/admin/profile' : '/profile')
                    }, 1000);

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

        }

    },
    data() {
        return {
            bindProps: {
                mode: "international",
                defaultCountry: "DK",
                disabledFetchingCountry: false,
                disabled: false,
                disabledFormatting: false,
                placeholder: "Enter a phone number",
                required: false,
                enabledCountryCode: false,
                enabledFlags: true,
                roleType: 0,
                // preferredCountries: ["AU", "BR"],
                onlyCountries: [],
                ignoredCountries: [],
                autocomplete: "off",
                name: "telephone",
                maxLen: 25,
                wrapperClasses: "",
                inputClasses: "",
                dropdownOptions: {
                disabledDialCode: false
                },
                inputOptions: {
                showDialCode: false
                }
            },
            form: new Form({
                region: '',
                zipcode: '',
                city: '',
                title: '',
                first_name: '',
                last_name: '',
                street_number: '',
                title: '',
                street: '',
                country: '',
                street: '',
                organization: '',
                phone_number: ''
            }),
            msg: 'Welcome to Your Vue.js App'
        }
    }
}
</script>

<style lang="scss" scoped>
</style>
