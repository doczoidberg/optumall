<template>
    <div class="container-fluid login-page">
        <nav class="navbar navbar-default navbar-static-top" role="navigation" >
            <div class="navbar-header">
                <a class="">
                    <img class="logo_licen" src="@/assets/images/logo_licen.png" alt="logo_licen">
                </a>
            </div>
            <!-- /.navbar-header -->

            <ul class="nav navbar-top-links navbar-right">
                <button type="button" id="sidebarCollapse" class="btn-question"  @click="showSidebarRight()">
                    <img class="question" src="@/assets/images/question.png" alt="question">
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
                <li><a  href="https://optumce.com/about/terms-of-use/" target="_blank">Terms & conditions</a></li>
                <li><a href="https://optumce.com/about/privacy-policy/" target="_blank"> Privacy policy</a></li>
                <li />
                <li />
                <li><strong><a href="https://optumce.com/" target="_blank">www.OptumCE.com</a></strong></li>
                </ul>
            </div>
            </div>
        <div class="container">
            <div class="row">
                <div class="login-panel panel panel-default">
                    <div class="panel-heading">
                        <img class="login_logo" src="@/assets/images/login_logo_02.png" alt="login_logo">
                    </div>
                    <div class="panel-body">
                        <h5 class="message">Your account was successfully<br> deleted.</h5>
                         <router-link to="/login" class="gotologin">Go to login</router-link>
                    </div>
                </div>
            </div>
            <div class="user-change">
                <!--<a class="item-user"><i class="fa fa-user fa-fw"></i></a>-->
                <!--<a class="item-user"><i class="fa fa-users fa-fw"></i></a>-->
            </div>
        </div>
    </div>

</template>

<script>
export default {
  name: 'AccountDeleted',
  data () {
    return {
      msg: 'Welcome to OptumCE'
    }
  },
  methods: {
    showSidebarRight: () => {
      document.querySelector('.side-menu').classList.toggle('show')
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
</style>
