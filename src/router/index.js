import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layouts/Layout.vue'
import Overview from '../views/overview/index.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: Layout,
      children: [
        {
          path: '',
          name: 'overview',
          component: Overview,
        },
      ],
    },
  ],
})

export default router
