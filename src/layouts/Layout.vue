<template>
  <div class="app-shell">
    <Sidebar
      :open="mobileOpen"
      :active-nav="activeNav"
      :nav-items="navItems"
      @select="selectNav"
    />

    <button
      v-if="mobileOpen"
      class="sidebar-backdrop"
      aria-label="關閉側邊選單"
      @click="mobileOpen = false"
    />

    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { provide, ref } from 'vue'
import { RouterView } from 'vue-router'
import Sidebar from '@/layouts/Sidebar.vue'

const navItems = [
  ['總覽', '⌂'],
  ['品項管理', '▣'],
  ['提醒管理', '♧'],
  ['維護紀錄', '☑'],
  ['統計報表', '▥'],
  ['設定', '⚙'],
]

const activeNav = ref('總覽')
const mobileOpen = ref(false)

function selectNav(nav) {
  activeNav.value = nav
  mobileOpen.value = false
}

function toggleSidebar() {
  mobileOpen.value = !mobileOpen.value
}

provide('toggleSidebar', toggleSidebar)
</script>
