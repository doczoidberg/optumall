<template>
<div class="btn-switch">
    <label class="switch">
        <input type="checkbox" v-model="val" name="assign" @change="handleChange($event)">
        <div class="slider round">
            <!--ADDED HTML -->
            <span class="on">ON</span><span class="off">OFF</span>
            <!--END-->
        </div>
    </label>
</div>
</template>

<script>
/* eslint-disable */
import Vue from 'vue';
export default {
    name: 'BtnSwitch',
    data() {
        return {
            msg: 'Welcome to btn switch',

        }
    },
    props: ['val', 'parentData', 'parentExt'],
    methods: {
        handleChange(event) {
            console.log('isChecked user data from parent component:')
             const output = {
                parentData: this.parentData,
                parentExt: this.parentExt,
                checked: event.target.checked
            };
            console.log(output) //prints out an empty string
            this.$emit('isChecked',output)
        }
    },
    created: function () {
        console.log('user data from parent component:')
        console.log(this.parentData) //prints out an empty string
    }
}
</script>
