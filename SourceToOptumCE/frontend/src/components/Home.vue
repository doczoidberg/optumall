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
                    <img src="@/assets/images/Optum-logos-Admin.svg" class="logo" />
                </a>
            </div>
            <!-- /.navbar-header -->
            <div class="organization-name">{{profile.item ? profile.item.organization : ''}}</div>
            <ul class="nav navbar-top-links navbar-right">

                <!-- /.dropdown -->
                <li>
                    <a class="dropdown-toggle" @click="showSidebarRight()">
                        <i class="fa fa-question-circle fa-fw"></i>
                    </a>
                </li>
                <notification></notification>
                <!--
                <li class="dropdown">
                    <a class="dropdown-toggle bell-message" data-toggle="dropdown" href="#">
                        <i class="fa fa-bell fa-fw"></i>
                        <p class="count">2</p>
                    </a>
                    <ul class="dropdown-menu dropdown-alerts">
                        <div class="tangle"></div>
                        <li>
                            <a href="#" class="first">
                                <div>
                                    <i class="fa fa-bell fa-fw"></i>
                                    <span class="title height-35">Notifications</span>
                                </div>
                            </a>
                        </li>
                        <li class="divider"></li>
                        <li class="outer">
                            <a href="#">
                                <div>
                                    <img class="logo-news" src="@/assets/images/product_01.png" alt="logo-news">
                                    <span class="text">License expires in 9 days</span>
                                    <span class="pull-right text-muted small">Show product</span>
                                </div>
                            </a>
                        </li>
                        <li class="divider"></li>
                        <li class="outer">
                            <a href="#">
                                <div>
                                    <img class="logo-news" src="@/assets/images/product_03.png" alt="logo-news">
                                    <span class="text">A new version of OPTUM G3 is available </span>
                                    <span class="pull-right text-muted small">Download now</span>
                                </div>
                            </a>
                        </li>
                        <li class="divider"></li>
                        <li class="outer disable">
                            <a href="#">
                                <div>
                                    <img class="logo-news" src="@/assets/images/product_02.png" alt="logo-news">
                                    <span class="text">License expired</span>
                                    <span class="pull-right text-muted small">Show product</span>
                                </div>
                            </a>
                        </li>
                        <li class="divider"></li>
                    </ul>

                </li>-->
                <li>
                    <div class="line"></div>
                </li>
                <!-- /.dropdown -->
                <li class="dropdown " v-if="profile.item">

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
                                    <router-link to="/admin/profile-update" class="edit-profile">Edit profile</router-link>
                                </div>
                                <div class="clear"></div>
                            </div>
                        </li>
                        <li class="logout"><a @click="doLogout()" href="#"><i class="fa fa-sign-out fa-fw"></i> Log out</a>
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
                                <router-link to="/admin/profile"> <i class="fa fa-user fa-fw"></i><span>My profile</span></router-link>
                            </li>
                            <li>
                                <router-link to="/admin/licenses"> <i class="fas fa-key fa-fw"></i><span>Licenses</span></router-link>
                            </li>
                            <li>
                                <router-link to="/admin/users/grid">  <i class="fa fa-users fa-fw"></i><span>User management</span></router-link>
                            </li>
                            <li>
                                <router-link to="/admin/reporting">  <i class="fa fa-bar-chart-o fa-fw"></i><span>Reporting</span></router-link>
                            </li>
                            <li>
                                <router-link to="/admin/credits">  <i class="fa fa-credit-card fa-fw"></i><span>Buy Credits</span></router-link>
                            </li>
                            <li class="sidebar-left-mb show-mb hidden-md hidden-lg">
                               <ul  class="list-unstyled">
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
       <div class="side-menu" >
            <div class="side-menu-content">
                <i class="fa fa-times btn-close"  @click="showSidebarRight()" />
                <ul>
                <li>
                    <h3> <i class="fa fa-question-circle question-icon" />Help</h3>
                </li>
                <li><a href="https://optumce.com/knowledge-base/faq/"  target="_blank">Q&A </a></li>
                <li><a href="https://optumce.com/about/terms-of-use/" target="_blank">Terms & conditions</a></li>
                <li><a href="https://optumce.com/about/privacy-policy/" target="_blank"> Privacy policy</a></li>
                <li />
                <li />
                <li><strong><a href="https://optumce.com/" target="_blank">www.OptumCE.com</a></strong></li>
                </ul>
            </div>
            </div>
        <router-view/>
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
    name: 'Home',
    components: {
        CookiesPage,
        SlidebarLeft,
        TermsConditions,
        PrivacyPolicy,
        FaqPage,
        Notification
    },
    data () {
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
        console.log('profile',this.profile)
        console.log('email',this.profile.email)

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
