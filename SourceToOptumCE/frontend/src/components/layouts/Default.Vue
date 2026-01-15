<template>
    <div class="container-fluid login-page">
        <nav class="navbar navbar-default navbar-static-top" role="navigation" >
            <div class="navbar-header">
                <a class="">
                    <img class="logo_licen" src="@/assets/images/Optum-logos-CE.svg" alt="logo_licen">
                </a>
            </div>
            <!-- /.navbar-header -->

            <ul class="nav navbar-top-links navbar-right">
                <button type="button" id="sidebarCollapse" class="btn-question"  @click="showSidebarRight()">
                    <i class="fas fa-question-circle"></i>
                </button>
            </ul>
            <!-- /.navbar-top-links -->
        </nav>
          <div class="side-menu" >
            <div class="side-menu-content">
                <i class="fa fa-times btn-close"  @click="showSidebarRight()" />
                <ul>
                <li>
                    <h3> <i class="fa fa-question-circle question-icon" />Help</h3>
                </li>
                 <li><a  href="https://optumce.com/knowledge-base/faq/" target="_blank">Q&A </a></li>
                <li>
                 <a  href="https://optumce.com/about/terms-of-use/" target="_blank">Terms & conditions</a>
                <!--<a data-toggle="modal" data-target="#TermsConditions">Terms & conditions</a> -->
                </li>
                <li>
                <a href="https://optumce.com/about/privacy-policy/" target="_blank"> Privacy policy</a>
               <!-- <a data-toggle="modal" data-target="#PrivacyPolicy"> Privacy policy</a> -->
                </li>
                <li />
                <li />
                <li><strong><a href="https://optumce.com/" target="_blank">www.OptumCE.com</a></strong></li>
                </ul>
            </div>
            </div>
        <div class="container">
            <slot/>

        </div>
            <cookies-page></cookies-page>
    <terms-conditions></terms-conditions>
    <privacy-policy></privacy-policy>
    <faq-page></faq-page>
    </div>

</template>

<script>
/* eslint-disable */
import SlidebarLeft from '@/components/pages/SlidebarLeft.vue'
import CookiesPage from '@/components/popup/CookiesPage.vue'
import TermsConditions from '@/components/popup/TermsConditions.vue'
import PrivacyPolicy from '@/components/popup/PrivacyPolicy.vue'
import FaqPage from '@/components/popup/FaqPage.vue'
import { mapState, mapActions } from 'vuex'
import Message from '../popup/Message.vue'
export default {
    name: 'LayoutBasic',
        components: {
        CookiesPage,
        SlidebarLeft,
        TermsConditions,
        PrivacyPolicy,
        FaqPage,
        'app-message': Message
    },
    data () {
        return {
        msg: 'Welcome to OptumCE',
        username: '',
        password: '',
        submitted: false,
        toggle: true
        }
    },
    computed: {
        ...mapState('account', ['status'])
    },
    created () {
        //this.logout();
    },
    methods: {
        ...mapActions('account', ['login', 'logout']),
        handleSubmit (e) {
            this.submitted = true;
            const { username, password } = this;
            if (username && password) {
                console.log(username,password);
                this.login({ username, password })
            }
        },
        showSidebarRight: () => {
            document.querySelector('.side-menu').classList.toggle('show')
        }
    },
    watch: {
        $route (to, from){
            // clear alert on location change
            this.clearAlert();
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
