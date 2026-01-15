<template>
   <div class="row" v-if="alert.message">
        <div class="col-sm-12">
            <div v-if="asHtml" :class="'alert ' + alert.type" v-html="alert.message"/>
            <div v-else :class="'alert ' + alert.type">{{alert.message}}</div>
        </div>
    </div>
</template>
<script>
/* eslint-disable */
import { mapState, mapActions } from 'vuex'

export default {
    name: 'app-message',
    props: {
        asHtml:{
            type: Boolean,
            default: false
        },
    },
    computed: {
        ...mapState({
            alert: state => state.alert
        })
    },
    methods: {
        ...mapActions({
            clearAlert: 'alert/clear'
        })
    },
    watch: {
        $route (to, from){
            // clear alert on location change
            this.clearAlert();
        }
    }
};
</script>
<style lang="scss" scoped>
</style>