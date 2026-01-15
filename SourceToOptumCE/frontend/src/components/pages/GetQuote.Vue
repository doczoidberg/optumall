<template>
<layout-basic>
    <div class="row">
        <div class="login-panel panel panel-default">
            <div class="panel-heading">
                <h2>Get quote</h2>
            </div>
            <div class="panel-body">
                <p>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus pellentesque placerat sapien non condimentum. In hac habitasse platea dictumst. Etiam ut efficitur nulla. Ut sit amet odio odio. Fusce sit amet placerat enim. Mauris aliquam suscipit mauris. Maecenas nibh nulla, condimentum ullamcorper dolor vel, suscipit posuere ante. Curabitur euismod nulla arcu, in porta ex accumsan et. Curabitur in est viverra risus dictum sagittis. Curabitur condimentum volutpat nulla, quis tincidunt erat iaculis eget. Mauris cursus semper sapien quis malesuada.

                    Aliquam ac vehicula nulla. Quisque ac mauris vel nisi placerat auctor. Suspendisse imperdiet efficitur elit,. Duis ut augue consequat urna sodales porta suscipit eget sem. Morbi eros nisi, tempus nec auctor ut, ornare ac ante. Donec eu dapibus diam. Morbi bibendum eros ac nulla condimentum, vitae facilisis mi porta. Nullam eu commodo urna, maximus venenatis diam. Ut a purus diam. Vivamus maximus pulvinar venenatis. Morbi vulputate massa quis varius placerat. Vivamus convallis massa dui, sed suscipit ante maximus sed. Integer imperdiet, risus sit amet tristique fringilla, lorem turpis tempor nunc, a dictum velit odio sit amet purus. Curabitur tincidunt, augue id mattis ultricies, tellus nunc lacinia erat,
                </p>
            </div>
        </div>
    </div>
</layout-basic>
</template>

<script>
import Form from 'vform'
import LayoutBasic from '@/components/layouts/default'
export default {
    middleware: 'guest',
    metaInfo() {
        return { title: 'Get quote' }
    },
    components: {
        LayoutBasic
    },
    data: () => ({
        status: '',
        form: new Form({
            user_name: ''
        })
    }),

}
</script>
