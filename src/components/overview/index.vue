<template>
  <div class="overview-page">
      <header class="page-header">
        <button class="menu-toggle" @click="toggleSidebar">☰</button>
        <div><h1>總覽</h1><p>掌握所有品項的維護與庫存狀態</p></div>
        <button class="add-button" @click="openAddModal"><span>＋</span> 新增品項</button>
      </header>

      <section class="stats-grid">
        <article v-for="stat in stats" :key="stat.label" class="stat-card" :class="{ selected: selectedStatus === stat.status }" role="button" tabindex="0" @click="filterByStatus(stat.status)" @keydown.enter="filterByStatus(stat.status)" @keydown.space.prevent="filterByStatus(stat.status)">
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
                <td><div class="item-name"><button v-if="item.image" class="thumb image-preview-button" type="button" :aria-label="`放大查看${item.name}圖片`" @click="previewImage = item.image"><img :src="item.image" :alt="item.name" /></button><span v-else class="thumb">{{ item.type === ITEM_TYPE.STOCK ? '◇' : '▣' }}</span><b>{{ item.name }}</b></div></td>
                <td><span class="badge" :class="item.type === ITEM_TYPE.STOCK ? 'orange' : 'green'">{{ getItemTypeLabel(item.type) }}</span></td>
                <td>{{ item.place }}</td><td>{{ item.date??'-' }}</td><td>{{ item.count??'-' }}</td>
                <td><span class="badge" :class="statusTone(item.status)">{{ getItemStatusLabel(item.status) }}</span></td>
                <td><button class="more" aria-label="修改品項" @click="openEditModal(item)">⋮</button></td>
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
      <AddItemModal v-if="showAddModal" :item="selectedItem" @close="showAddModal = false" @saved="itemSaved" />
      <Teleport to="body">
        <div v-if="previewImage" class="fixed inset-0 z-110 flex items-center justify-center bg-black/75 p-6" role="dialog" aria-modal="true" aria-label="品項圖片預覽" @click.self="previewImage = ''">
          <img class="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl" :src="previewImage" alt="品項放大圖片" />
          <button class="absolute top-5 right-6 grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/40 bg-black/40 text-[30px] leading-none !text-white hover:bg-black/65" type="button" aria-label="關閉圖片" @click="previewImage = ''">×</button>
        </div>
      </Teleport>
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import AddItemModal from './AddItemModal.vue'
import { ITEM_TYPE, getItemTypeLabel } from '../../../shared/itemTypes.js'
import { ITEM_STATUS, getItemStatusLabel } from '../../../shared/itemStatuses.js'

const toggleSidebar = inject('toggleSidebar', () => {})
const statusCounts = ref({})
const stats = computed(() => [
  { label: '總品項', status: null, value: Object.values(statusCounts.value).reduce((sum, count) => sum + count, 0), icon: '▣', tone: 'green' },
  { label: getItemStatusLabel(ITEM_STATUS.EXPIRING_SOON), status: ITEM_STATUS.EXPIRING_SOON, value: statusCounts.value[ITEM_STATUS.EXPIRING_SOON] || 0, icon: '◷', tone: 'orange' },
  { label: getItemStatusLabel(ITEM_STATUS.LOW_STOCK), status: ITEM_STATUS.LOW_STOCK, value: statusCounts.value[ITEM_STATUS.LOW_STOCK] || 0, icon: '✓', tone: 'orange' },
  { label: getItemStatusLabel(ITEM_STATUS.EXPIRED), status: ITEM_STATUS.EXPIRED, value: statusCounts.value[ITEM_STATUS.EXPIRED] || 0, icon: '!', tone: 'red' },
  { label: getItemStatusLabel(ITEM_STATUS.OUT_OF_STOCK), status: ITEM_STATUS.OUT_OF_STOCK, value: statusCounts.value[ITEM_STATUS.OUT_OF_STOCK] || 0, icon: '◇', tone: 'red' },
])
const items = ref([])
const loading = ref(true)
const loadError = ref('')
const showAddModal = ref(false)
const selectedItem = ref(null)
const previewImage = ref('')
const selectedStatus = ref(null)
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

function statusTone(status) {
  if (status === ITEM_STATUS.NORMAL) return 'green'
  if (status === ITEM_STATUS.EXPIRING_SOON || status === ITEM_STATUS.LOW_STOCK) return 'orange'
  return 'red'
}

async function loadItems() {
  loading.value = true
  loadError.value = ''
  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ PageNum: page.value, PageSize: pageSize, State: selectedStatus.value }),
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

async function loadStats() {
  try {
    const response = await fetch('/api/items/stats')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    statusCounts.value = Object.fromEntries(result.map(({ status, count }) => [status, count]))
  } catch (error) {
    console.error('無法取得統計資料', error)
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') previewImage.value = ''
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  return Promise.all([loadItems(), loadStats()])
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

function goToPage(pageNumber) {
  if (pageNumber < 1 || pageNumber > totalPage.value || pageNumber === page.value) return
  page.value = pageNumber
  loadItems()
}

function filterByStatus(status) {
  if (selectedStatus.value === status) return
  selectedStatus.value = status
  page.value = 1
  loadItems()
}

function openAddModal() {
  selectedItem.value = null
  showAddModal.value = true
}

function openEditModal(item) {
  selectedItem.value = item
  showAddModal.value = true
}

async function itemSaved() {
  showAddModal.value = false
  if (!selectedItem.value) page.value = 1
  selectedItem.value = null
  await Promise.all([loadItems(), loadStats()])
}
</script>
