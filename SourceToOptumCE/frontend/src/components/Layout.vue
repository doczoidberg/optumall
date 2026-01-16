<template>
<div id="wrapper" class="home-page">
    <!-- Navigation -->
    <nav class="navbar navbar-default navbar-fixed-top navbar-custom-header" role="navigation" style="margin-bottom: 0">
        <div class="navbar-header">
            <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
                <span class="sr-only">Toggle navigation</span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
            </button>
            <a class="navbar-brand" href="/#/licenses">
                <img src="@/assets/images/Optum-logos-User.svg" class="logo" />
            </a>
        </div>
        <!-- /.navbar-header -->

        <ul class="nav navbar-top-links navbar-right">

            <!-- /.dropdown -->
            <li>
                <a class="dropdown-toggle" @click="showSidebarRight()">
                    <i class="fa fa-question-circle fa-fw"></i>
                </a>
            </li>
            <notification></notification>
            <li>
                <div class="line"></div>
            </li>
            <!-- /.dropdown -->
            <li class="dropdown" v-if="profile.item">

                <a class="dropdown-toggle account-btn" data-toggle="dropdown" href="#">
                    <span class="user-name">{{profile.item.first_name}} {{profile.item.last_name}}</span>
                    <img class="user-img" v-bind:src="profile.item.avatarUrl" alt="user-img">
                </a>
                <ul class="dropdown-menu dropdown-user">
                    <div class="tangle"></div>
                    <li>
                        <span class="title">Account details</span>
                    </li>
                    <li>
                        <div v-if="profile.item">
                            <img class="avatar-sm" v-bind:src="profile.item.avatarUrl" alt="avatar-sm">
                            <div class="text-right">
                                <p><span class="bold">Name: </span>{{profile.item.first_name}} {{profile.item.last_name}}</p>
                                <p><span class="bold">Username: </span>{{profile.item.user_name}}</p>
                                <router-link to="/profile-update" class="edit-profile">Edit profile</router-link>
                            </div>
                            <div class="clear"></div>
                        </div>
                    </li>
                    <li class="logout">
                        <a @click="doLogout()" href="#"><i class="fa fa-sign-out fa-fw"></i> Log out</a>
                    </li>
                </ul>
                <!-- /.dropdown-user -->
            </li>
            <!-- /.dropdown -->
        </ul>
        <!-- /.navbar-top-links -->

        <div class="navbar-default sidebar" role="navigation">
            <div class="sidebar-nav navbar-collapse collapse">
                <div class="sidebar-content">
                    <ul class="nav" id="side-menu">
                        <li>
                            <router-link to="/profile"> <i class="fa fa-user fa-fw"></i><span>My profile</span></router-link>
                        </li>
                        <li>
                            <router-link to="/licenses"> <i class="fas fa-key fa-fw"></i><span>Licenses</span></router-link>
                        </li>
                        <li>
                            <router-link to="/tokens"> <i class="fa fa-coins fa-fw"></i><span>Optum Tokens</span></router-link>
                        </li>
                        <li class="sidebar-left-mb show-mb hidden-md hidden-lg">
                            <ul class="list-unstyled">
                                <slidebar-left></slidebar-left>
                            </ul>
                        </li>
                    </ul>
                    <ul class="footer-sidebar-left list-unstyled hidden-xs hidden-sm">
                        <slidebar-left></slidebar-left>
                    </ul>
                </div>
            </div>
            <!-- /.sidebar-collapse -->
        </div>
        <!-- /.navbar-static-side -->
    </nav>
    <div class="side-menu">
        <div class="side-menu-content">
            <i class="fa fa-times btn-close" @click="showSidebarRight()" />
            <ul>
                <li>
                    <h3> <i class="fa fa-question-circle question-icon" />Help</h3>
                </li>
                <li><a href="https://optumce.com/knowledge-base/faq/"  target="_blank">Q&A </a></li>
                <li>
                    <a href="https://optumce.com/about/terms-of-use/" target="_blank">Terms & conditions</a>
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
    <router-view />
    <cookies-page></cookies-page>
    <terms-conditions></terms-conditions>
    <privacy-policy></privacy-policy>
    <faq-page></faq-page>
</div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import SlidebarLeft from '@/components/pages/SlidebarLeft.vue'
import CookiesPage from '@/components/popup/CookiesPage.vue'
import TermsConditions from '@/components/popup/TermsConditions.vue'
import PrivacyPolicy from '@/components/popup/PrivacyPolicy.vue'
import FaqPage from '@/components/popup/FaqPage.vue'
import Notification from '@/components/pages/Notification.vue'
export default {
    name: 'Layout',
    components: {
        CookiesPage,
        SlidebarLeft,
        TermsConditions,
        PrivacyPolicy,
        FaqPage,
        Notification
    },
    data() {
        return {
            msg: 'Welcome to Your Vue.js App'
        }
    },
    computed: {
        ...mapState({
            account: state => state.account,
            profile: state => state.users.profile
        })
    },
    created() {
        this.getById();
        console.log('profile', this.profile)
        console.log('email', this.profile.email)

    },
    methods: {
        ...mapActions('account', ['logout']),
        ...mapActions('users', {
            getById: 'getById'
        }),
        showSidebarRight: () => {
            document.querySelector('.side-menu').classList.toggle('show')
        },
        doLogout: function(){
            this.logout();
            this.$router.push("login");
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>
</style>
