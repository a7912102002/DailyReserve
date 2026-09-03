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
            <thead><tr><th>品項</th><th>類型</th><th>放置位置</th><th>下次維護</th><th>目前數量</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="item in filteredItems" :key="item.id">
                <td><div class="item-name"><span class="thumb">{{ item.emoji }}</span><b>{{ item.name }}</b></div></td>
                <td><span class="badge" :class="item.type === '庫存備品' ? 'orange' : 'green'">{{ item.type }}</span></td>
                <td>{{ item.place }}</td><td>{{ item.date??'-' }}</td><td>{{ item.count??'-' }}</td>
                <td><span class="badge" :class="item.status === '正常' ? 'green' : item.status === '即將到期' ? 'orange' : 'red'">{{ item.status }}</span></td>
                <td><button class="more" aria-label="更多操作">⋮</button></td>
              </tr>
              <tr v-if="loadError"><td colspan="7" class="empty">{{ loadError }}</td></tr>
              <tr v-else-if="loading"><td colspan="7" class="empty">資料載入中…</td></tr>
              <tr v-else-if="!filteredItems.length"><td colspan="7" class="empty">找不到符合條件的品項</td></tr>
            </tbody>
          </table>
        </div>
        <footer class="table-footer">
          <span>顯示第 {{ rangeStart }} 至 {{ rangeEnd }} 項結果，共 {{ totalCount }} 項</span>
          <div class="pagination">
            <button :disabled="page === 1" @click="goToPage(page - 1)">‹</button>
            <button v-for="n in totalPage" :key="n" :class="{ current: page === n }" @click="goToPage(n)">{{ n }}</button>
            <button :disabled="page === totalPage || totalPage === 0" @click="goToPage(page + 1)">›</button>
          </div>
        </footer>
      </section>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'

const toggleSidebar = inject('toggleSidebar', () => {})
const stats = [
  { label: '總品項', value: 156, icon: '▣', tone: 'green' },
  { label: '正常', value: 128, icon: '✓', tone: 'green' },
  { label: '即將到期', value: 14, icon: '◷', tone: 'orange' },
  { label: '已逾期', value: 8, icon: '!', tone: 'red' },
  { label: '庫存不足', value: 3, icon: '◇', tone: 'red' },
]
const items = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const page = ref(1)
const pageSize = 15
const totalCount = ref(0)
const totalPage = ref(0)
const rangeStart = computed(() => totalCount.value === 0 ? 0 : (page.value - 1) * pageSize + 1)
const rangeEnd = computed(() => Math.min(page.value * pageSize, totalCount.value))
const filteredItems = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return items.value
  return items.value.filter((item) => Object.values(item).some((value) => String(value).toLowerCase().includes(keyword)))
})

async function loadItems() {
  loading.value = true
  loadError.value = ''
  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ PageNum: page.value, PageSize: pageSize, State: 1 }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    items.value = result.Data.List
    page.value = result.Data.PageNum
    totalCount.value = result.Data.TotalCount
    totalPage.value = result.Data.TotalPage
  } catch (error) {
    console.error(error)
    loadError.value = '無法取得品項資料，請確認 API 是否已啟動'
  } finally {
    loading.value = false
  }
}

onMounted(loadItems)

function goToPage(pageNumber) {
  if (pageNumber < 1 || pageNumber > totalPage.value || pageNumber === page.value) return
  page.value = pageNumber
  loadItems()
}

async function addItem() {
  const response = await fetch('/api/items/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '新日常用品', emoji: '📦', type: '定期維護', place: '尚未設定',
      date: null, count: null, status: '正常',
    }),
  })
  if (response.ok) await loadItems()
}
</script>
