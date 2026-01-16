import Vue from 'vue'
import Router from 'vue-router'
// Backend
import Home from '@/components/Home'
// Frontend
import Layout from '@/components/Layout'
Vue.use(Router)

const router = new Router({
  routes: [
    { path: '/admin',
      name: 'Home',
      redirect: 'admin/licenses',
      component: Home,
      children: [
        { path: 'licenses', meta: { requiresAuth: true , adminAuth:true , residentAuth : false},name: 'Licenses', component: () => import('@/components/admin/licenses/Licenses') },
        { path: 'licenses-as-user',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'UserLicenses', component: () => import('@/components/admin/licenses/UserLicenses') },
        { path: 'manage-license/:id',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'ManageLicense', component: () => import('@/components/admin/licenses/ManageLicense') },
        { path: 'profile', meta: { requiresAuth: true , adminAuth:true , residentAuth : false},name: 'Profile', component: () => import('@/components/admin/customer/Profile') },
        { path: 'profile-update',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'UserEdit', component: () => import('@/components/admin/customer/UserEdit') },
        { path: 'users',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'Users', component: () => import('@/components/admin/customer/Users') },
        { path: 'users/grid',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'UsersGird', component: () => import('@/components/admin/customer/UsersGird') },
        { path: 'user/detail/:id',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'UserDetail', component: () => import('@/components/admin/customer/UserDetail') },
        { path: 'group',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'Group', component: () => import('@/components/admin/customer/Group') },
        { path: 'group/grid',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'GroupGrid', component: () => import('@/components/admin/customer/GroupGrid') },
        { path: 'reporting',meta: { requiresAuth: true , adminAuth:true , residentAuth : false}, name: 'Report', component: () => import('@/components/admin/Report') }
      ]
    },
    { path: '/',
      name: 'Layout',
      component: Layout,
      redirect: 'homepage',
      children: [
        { path: 'licenses', meta: { requiresAuth: true , adminAuth:false , residentAuth : true}, name: 'MyLicenses', component: () => import('@/components/user/Licenses') },
        { path: 'tokens', meta: { requiresAuth: true , adminAuth:false , residentAuth : true}, name: 'Tokens', component: () => import('@/components/user/Tokens') },
        { path: 'tokens/success', meta: { requiresAuth: true , adminAuth:false , residentAuth : true}, name: 'TokensSuccess', component: () => import('@/components/user/Tokens') },
        { path: 'profile-update', meta: { requiresAuth: true , adminAuth:false , residentAuth : true}, name: 'ProfileEdit', component: () => import('@/components/admin/customer/UserEdit') },
        { path: 'profile', meta: { requiresAuth: true , adminAuth:false , residentAuth : true},name: 'MyProfile', component: () => import('@/components/user/Profile') }
      ]
    },
    { path: '/homepage', name: 'Homepage', component: () => import('@/components/user/Homepage') },
    { path: '/get-quote', name: 'GetQuote', component: () => import('@/components/pages/GetQuote') },
    { path: '/login', name: 'Login', component: () => import('@/components/user/Login') },
    { path: '/register', name: 'Register', component: () => import('@/components/user/Register') },
    { path: '/forgot-password', name: 'password.request', component: () => import('@/components/auth/PasswordEmail') },
    { path: '/password/reset', name: 'password.reset', component: () => import('@/components/auth/PasswordReset') },
    { path: '/account-deleted', name: 'AccountDeleted', component: () => import('@/components/user/AccountDeleted') },
    { path: '/admin/login', name: 'AdminLogin', component: () => import('@/components/admin/Login') },
    { path: '/admin/forgot-password', name: 'admin.password.request', component: () => import('@/components/auth/PasswordEmail') },
    { path: '/reverify', name: 'reverify', component: () => import('@/components/auth/ReverifyEmail') }

  ]
})
router.beforeEach((to, from, next) => {
    // redirect to login page if not logged in and trying to access a restricted page
    // const publicPages = ['/login', '/admin/login'];
    // const authRequired = !publicPages.includes(to.path);
    // const loggedIn = localStorage.getItem('user');

    // if (authRequired && !loggedIn) {
    //   return next('/login');
    // }

    // next();
    const authUser = JSON.parse(localStorage.getItem('user'))
    let isLogin = authUser && authUser.token;
    let isNextToLogin = to.name === "Login"||to.name === "AdminLogin"
    if(isNextToLogin){
      if(isLogin) {
        // Role: 0=user, 1=admin, 2=superadmin
        if(authUser.role >= 1) {
            next('/admin/licenses');
        }
        else {
            next('/licenses');
        }
      }
      else {
        next()
      }
    }
    else if(to.meta.requiresAuth) {
        if(!isLogin) {
          next({name:'Login'})
        }
        else if(to.meta.adminAuth) {
            const authUser = JSON.parse(localStorage.getItem('user'))
            // Allow admin (1) and superadmin (2)
            if(authUser.role >= 1) {
                next()
            }else {
                next('/licenses')
            }
        } else if(to.meta.residentAuth) {
            const authUser = JSON.parse(localStorage.getItem('user'))
            // Allow all authenticated users to access user routes
            // (admins/superadmins can view user pages too)
            next()
        }
      } else {
        next()
      }
  })
// router.replace({ path: '/licenses', redirect: '/licenses' })
export default router