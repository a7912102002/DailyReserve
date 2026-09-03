<template>
  <div class="overview-page">
      <header class="page-header">
        <button class="menu-toggle" @click="toggleSidebar">☰</button>
        <div><h1>總覽</h1><p>掌握所有品項的維護與庫存狀態</p></div>
        <button class="add-button" @click="addItem"><span>＋</span> 新增品項</button>
      </header>

      <section class="stats-grid">
        <article v-for="stat in stats" :key="stat.label" class="stat-card">
          <div><p>{{ stat.label }}</p><strong>{{ stat.value }}</strong><small>個</small></div>
          <div class="stat-icon" :class="stat.tone">{{ stat.icon }}</div>
        </article>
      </section>

      <section class="items-card">
        <div class="list-toolbar">
          <h2>品項清單</h2>
          <label class="search-box"><span>⌕</span><input v-model="search" placeholder="搜尋品項名稱、類型或放置位置" /></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>品項</th><th>類型</th><th>放置位置</th><th>下次維護日</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="item in filteredItems" :key="item.name">
                <td><div class="item-name"><span class="thumb">{{ item.emoji }}</span><b>{{ item.name }}</b></div></td>
                <td><span class="badge" :class="item.type === '庫存備品' ? 'orange' : 'green'">{{ item.type }}</span></td>
                <td>{{ item.place }}</td><td>{{ item.date }}</td>
                <td><span class="badge" :class="item.status === '正常' ? 'green' : item.status === '即將到期' ? 'orange' : 'red'">{{ item.status }}</span></td>
                <td><button class="more" aria-label="更多操作">⋮</button></td>
              </tr>
              <tr v-if="!filteredItems.length"><td colspan="6" class="empty">找不到符合條件的品項</td></tr>
            </tbody>
          </table>
        </div>
        <footer class="table-footer">
          <span>顯示第 1 至 10 項結果，共 156 項</span>
          <div class="pagination"><button disabled>‹</button><button v-for="n in 5" :key="n" :class="{ current: page === n }" @click="page = n">{{ n }}</button><button>›</button></div>
        </footer>
      </section>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'

const toggleSidebar = inject('toggleSidebar', () => {})
const stats = [
  { label: '總品項', value: 156, icon: '▣', tone: 'green' },
  { label: '正常', value: 128, icon: '✓', tone: 'green' },
  { label: '即將到期', value: 14, icon: '◷', tone: 'orange' },
  { label: '已逾期', value: 8, icon: '!', tone: 'red' },
  { label: '庫存不足', value: 3, icon: '◇', tone: 'red' },
]
const items = ref([
  { name: '櫃檯平板', emoji: '🖥️', type: '定期維護', place: '櫃檯', date: '2026/09/09', status: '正常' },
  { name: '咖啡機', emoji: '☕', type: '定期維護', place: '茶水間', date: '2026/09/05', status: '即將到期' },
  { name: '無線吸塵器', emoji: '🧹', type: '定期維護', place: '儲藏室', date: '2026/09/12', status: '正常' },
  { name: '訪客用雨傘', emoji: '☂️', type: '庫存備品', place: '玄關雨傘架', date: '2026/09/18', status: '正常' },
  { name: '急救箱', emoji: '🧰', type: '庫存備品', place: '茶水間櫃子', date: '2026/09/25', status: '正常' },
  { name: '延長線組', emoji: '🔌', type: '庫存備品', place: '會議室櫃子', date: '-', status: '庫存不足' },
  { name: '空氣清淨機', emoji: '🌬️', type: '定期維護', place: '辦公區域', date: '2026/10/01', status: '正常' },
])
const search = ref('')
const page = ref(1)
const filteredItems = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return items.value
  return items.value.filter((item) => Object.values(item).some((value) => String(value).toLowerCase().includes(keyword)))
})
function addItem() {
  items.value.unshift({ name: '新日常用品', emoji: '📦', type: '定期維護', place: '尚未設定', date: '-', status: '正常' })
}
</script>
