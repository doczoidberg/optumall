<template>
<li class="dropdown">
    <a class="dropdown-toggle bell-message" data-toggle="dropdown" href="#">
        <i class="fa fa-bell fa-fw"></i>
        <p class="count" v-if="notifications.items">{{notifications.items.length}}</p>
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
        <div  v-for="(item, index) in notifications.items" :key="index">
            <li class="outer">
                <a href="#">
                    <div>
                        <img class="logo-news" src="@/assets/images/product_01.png" alt="logo-news">
                        <span class="text" style="color: #262626;">{{item.title}}</span>
                        <span class="pull-right text-muted small">{{item.body}}</span>
                    </div>
                </a>
            </li>
            <li class="divider"></li>
        </div>
       <!-- <li class="outer">
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
        <li class="divider"></li> -->
    </ul>
    <!-- /.dropdown-alerts -->
</li>
</template>

<script>
/* eslint-disable */
import { mapState, mapActions } from 'vuex'
export default {
    name: 'Notification',
    data() {
        return {
            msg: 'Welcome'
        }
    },
    created() {
        this.getNotifications();
    },
    methods: {
        ...mapActions('users', {
            getNotifications: 'getNotifications'
        }),
    },
    computed: {
        ...mapState({
            notifications: state => state.users.notifications
        }),
    }
}
</script>

<style lang="scss" scoped>
</style>
