import Vue from 'vue'
import App from './App.vue'
import Vuetify from 'vuetify'
import VueRouter from 'vue-router'

import InboxPage from './Inbox.vue'
import SendPage from './Send.vue'

import './stylus/main.styl'

Vue.use(VueRouter)
Vue.use(Vuetify)


const routes = [
  { path: '/inbox', component: InboxPage } ,
  { path: '/send', component: SendPage }
]


var app = new Vue({
  router: new VueRouter({ routes }),
  el: '#app',
  template: "<App/>",
  components: { App }
})
