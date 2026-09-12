<template>
  <div class="overview-page">
    <header class="page-header">
      <button class="menu-toggle" @click="toggleSidebar">☰</button>
      <div>
        <h1>總覽</h1>
        <p>掌握所有品項的維護與庫存狀態</p>
      </div>
      <button class="add-button" @click="openAddModal"><span>＋</span> 新增品項</button>
    </header>

    <section class="stats-grid">
      <article
        v-for="stat in stats"
        :key="stat.label"
        class="stat-card"
        :class="{ selected: selectedStatus === stat.status }"
        role="button"
        tabindex="0"
        @click="filterByStatus(stat.status)"
        @keydown.enter="filterByStatus(stat.status)"
        @keydown.space.prevent="filterByStatus(stat.status)"
      >
        <div>
          <p>{{ stat.label }}</p>
          <strong>{{ stat.value }}</strong
          ><small>個</small>
        </div>
        <div class="stat-icon" :class="stat.tone">{{ stat.icon }}</div>
      </article>
    </section>

    <section class="items-card">
      <div class="list-toolbar">
        <h2>品項清單</h2>
        <label class="search-box"
          ><span>⌕</span><input v-model="search" placeholder="搜尋品項名稱、類型或放置位置"
        /></label>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>品項</th>
              <th>狀態</th>
              <th>目前數量</th>
              <th>下次維護</th>
              <th>放置位置</th>
              <th>類型</th>
              <th>編輯</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id">
              <td>
                <div class="item-name">
                  <button
                    v-if="item.image"
                    class="thumb image-preview-button"
                    type="button"
                    :aria-label="`放大查看${item.name}圖片`"
                    @click="previewImage = item.image"
                  >
                    <img :src="item.image" :alt="item.name" /></button
                  ><span v-else class="thumb">{{ item.type === ITEM_TYPE.STOCK ? '◇' : '▣' }}</span
                  ><b>{{ item.name }}</b>
                </div>
              </td>
              <td>
                <span class="badge" :class="statusTone(item.status)">{{
                  getItemStatusLabel(item.status)
                }}</span>
              </td>
              <td>
                <div class="item-count">
                  <span>{{ item.count ?? '-' }}</span
                  ><button
                    v-if="item.type === ITEM_TYPE.STOCK && item.count > 0"
                    class="use-one-button"
                    type="button"
                    @click="itemToUse = item"
                  >
                    我用了一個
                  </button>
                </div>
              </td>
              <td>
                <div class="maintenance-cell">
                  <span>{{ item.date ?? '-' }}</span
                  ><button
                    v-if="
                      item.type === ITEM_TYPE.MAINTENANCE &&
                      [ITEM_STATUS.EXPIRING_SOON, ITEM_STATUS.EXPIRED].includes(item.status)
                    "
                    class="maintained-button"
                    type="button"
                    @click="openMaintainModal(item)"
                  >
                    已維護</button
                  ><button
                    v-if="
                      item.type === ITEM_TYPE.STOCK &&
                      [ITEM_STATUS.LOW_STOCK, ITEM_STATUS.OUT_OF_STOCK].includes(item.status)
                    "
                    class="maintained-button"
                    type="button"
                    @click="openRestockModal(item)"
                  >
                    已補貨
                  </button>
                </div>
              </td>
              <td>{{ item.place && item.place !== '尚未設定' ? item.place : '-' }}</td>
              <td>
                <span class="badge" :class="item.type === ITEM_TYPE.STOCK ? 'orange' : 'green'">{{
                  getItemTypeLabel(item.type)
                }}</span>
              </td>
              <td>
                <button class="more" aria-label="修改品項" @click="openEditModal(item)">⋮</button>
              </td>
            </tr>
            <tr v-if="loadError">
              <td colspan="7" class="empty">{{ loadError }}</td>
            </tr>
            <tr v-else-if="loading">
              <td colspan="7" class="empty">資料載入中…</td>
            </tr>
            <tr v-else-if="!filteredItems.length">
              <td colspan="7" class="empty">找不到符合條件的品項</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="table-footer">
        <span>顯示第 {{ rangeStart }} 至 {{ rangeEnd }} 項結果，共 {{ totalCount }} 項</span>
        <div class="pagination">
          <button :disabled="page === 1" @click="goToPage(page - 1)">‹</button>
          <button
            v-for="n in totalPage"
            :key="n"
            :class="{ current: page === n }"
            @click="goToPage(n)"
          >
            {{ n }}
          </button>
          <button :disabled="page === totalPage || totalPage === 0" @click="goToPage(page + 1)">
            ›
          </button>
        </div>
      </footer>
    </section>
    <AddItemModal
      v-if="showAddModal"
      :item="selectedItem"
      @close="showAddModal = false"
      @saved="itemSaved"
    />
    <Teleport to="body">
      <div
        v-if="itemToUse"
        class="fixed inset-0 z-120 grid place-items-center bg-black/45 p-4"
        @click.self="itemToUse = null"
      >
        <section
          class="w-full max-w-[410px] rounded-2xl bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="use-one-title"
        >
          <h2 id="use-one-title" class="m-0 text-xl">確認使用庫存</h2>
          <p class="my-4 text-[#555d59]">
            確定使用一個 <b class="text-[#087747]">{{ itemToUse.name }}</b> 嗎？<br />目前庫存將從
            <b class="text-[#ef7300]">{{ itemToUse.count }}</b> 扣為
            <b class="text-[#ef7300]">{{ itemToUse.count - 1 }}</b
            >。
          </p>
          <p v-if="useOneError" class="mb-3 text-sm text-red-600">{{ useOneError }}</p>
          <footer
            class="flex justify-end gap-3 [&_button]:h-10 [&_button]:min-w-24 [&_button]:cursor-pointer [&_button]:rounded-lg"
          >
            <button
              class="border border-[#cbd1ce] bg-white"
              type="button"
              @click="itemToUse = null"
            >
              取消
            </button>
            <button
              class="border-0 bg-[#087d4b] !text-white disabled:opacity-60"
              type="button"
              :disabled="usingItem"
              @click="useOneItem"
            >
              {{ usingItem ? '處理中…' : '確定' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="itemToRestock"
        class="fixed inset-0 z-120 grid place-items-center bg-black/45 p-4"
        @click.self="itemToRestock = null"
      >
        <section
          class="w-full max-w-[410px] rounded-2xl bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restock-title"
        >
          <h2 id="restock-title" class="m-0 text-xl">確認已完成補貨</h2>
          <p class="mt-3 mb-4 text-[#555d59]">
            請確認「<b class="text-[#087747]">{{ itemToRestock.name }}</b
            >」的補貨數量：
          </p>
          <div class="mb-4 flex items-center justify-center gap-4">
            <button
              class="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[#cbd1ce] bg-white text-xl disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              :disabled="restockAmount <= 1"
              @click="restockAmount--"
            >
              −
            </button>
            <input
              v-model.number="restockAmount"
              class="h-12 w-24 rounded-lg border border-[#cbd1ce] text-center text-lg outline-none focus:border-[#087d4b]"
              type="number"
              min="1"
            />
            <button
              class="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[#cbd1ce] bg-white text-xl"
              type="button"
              @click="restockAmount++"
            >
              ＋
            </button>
          </div>
          <p class="mb-4 text-center text-sm text-[#68706c]">
            目前 {{ itemToRestock.count ?? 0 }} 個，補貨後
            {{ (itemToRestock.count ?? 0) + (Number(restockAmount) || 0) }} 個
          </p>
          <p v-if="restockError" class="mb-3 text-sm text-red-600">{{ restockError }}</p>
          <footer
            class="flex justify-end gap-3 [&_button]:h-10 [&_button]:min-w-24 [&_button]:cursor-pointer [&_button]:rounded-lg"
          >
            <button
              class="border border-[#cbd1ce] bg-white"
              type="button"
              @click="itemToRestock = null"
            >
              取消
            </button>
            <button
              class="border-0 bg-[#087d4b] !text-white disabled:opacity-60"
              type="button"
              :disabled="restockingItem || !Number.isInteger(restockAmount) || restockAmount < 1"
              @click="confirmRestock"
            >
              {{ restockingItem ? '處理中…' : '確定' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="itemToMaintain"
        class="fixed inset-0 z-120 grid place-items-center bg-black/45 p-4"
        @click.self="itemToMaintain = null"
      >
        <section
          class="w-full max-w-[410px] rounded-2xl bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="maintain-title"
        >
          <h2 id="maintain-title" class="m-0 text-xl">確認已完成維護</h2>
          <p class="mt-3 mb-4 text-[#555d59]">
            「<b class="text-[#087747]">{{ itemToMaintain.name }}</b
            >」的維護日期：
          </p>
          <label class="mb-4 block"
            ><span class="mb-1.5 block font-medium">維護日期</span
            ><input
              v-model="maintenanceDate"
              class="h-11 w-full rounded-lg border border-[#cbd1ce] px-3 outline-none focus:border-[#087d4b]"
              type="date"
              required
          /></label>
          <p v-if="maintainError" class="mb-3 text-sm text-red-600">{{ maintainError }}</p>
          <footer
            class="flex justify-end gap-3 [&_button]:h-10 [&_button]:min-w-24 [&_button]:cursor-pointer [&_button]:rounded-lg"
          >
            <button
              class="border border-[#cbd1ce] bg-white"
              type="button"
              @click="itemToMaintain = null"
            >
              取消
            </button>
            <button
              class="border-0 bg-[#087d4b] !text-white disabled:opacity-60"
              type="button"
              :disabled="maintainingItem || !maintenanceDate"
              @click="confirmMaintained"
            >
              {{ maintainingItem ? '處理中…' : '確定' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="previewImage"
        class="fixed inset-0 z-110 flex items-center justify-center bg-black/75 p-6"
        role="dialog"
        aria-modal="true"
        aria-label="品項圖片預覽"
        @click.self="previewImage = ''"
      >
        <img
          class="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          :src="previewImage"
          alt="品項放大圖片"
        />
        <button
          class="absolute top-5 right-6 grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/40 bg-black/40 text-[30px] leading-none !text-white hover:bg-black/65"
          type="button"
          aria-label="關閉圖片"
          @click="previewImage = ''"
        >
          ×
        </button>
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
  {
    label: '總品項',
    status: null,
    value: Object.values(statusCounts.value).reduce((sum, count) => sum + count, 0),
    icon: '▣',
    tone: 'green',
  },
  {
    label: getItemStatusLabel(ITEM_STATUS.EXPIRING_SOON),
    status: ITEM_STATUS.EXPIRING_SOON,
    value: statusCounts.value[ITEM_STATUS.EXPIRING_SOON] || 0,
    icon: '◷',
    tone: 'orange',
  },
  {
    label: getItemStatusLabel(ITEM_STATUS.LOW_STOCK),
    status: ITEM_STATUS.LOW_STOCK,
    value: statusCounts.value[ITEM_STATUS.LOW_STOCK] || 0,
    icon: '✓',
    tone: 'orange',
  },
  {
    label: getItemStatusLabel(ITEM_STATUS.EXPIRED),
    status: ITEM_STATUS.EXPIRED,
    value: statusCounts.value[ITEM_STATUS.EXPIRED] || 0,
    icon: '!',
    tone: 'red',
  },
  {
    label: getItemStatusLabel(ITEM_STATUS.OUT_OF_STOCK),
    status: ITEM_STATUS.OUT_OF_STOCK,
    value: statusCounts.value[ITEM_STATUS.OUT_OF_STOCK] || 0,
    icon: '◇',
    tone: 'red',
  },
])
const items = ref([])
const loading = ref(true)
const loadError = ref('')
const showAddModal = ref(false)
const selectedItem = ref(null)
const previewImage = ref('')
const itemToUse = ref(null)
const usingItem = ref(false)
const useOneError = ref('')
const itemToMaintain = ref(null)
const maintenanceDate = ref('')
const maintainingItem = ref(false)
const maintainError = ref('')
const itemToRestock = ref(null)
const restockAmount = ref(1)
const restockingItem = ref(false)
const restockError = ref('')
const selectedStatus = ref(null)
const search = ref('')
const page = ref(1)
const pageSize = 15
const totalCount = ref(0)
const totalPage = ref(0)
const rangeStart = computed(() => (totalCount.value === 0 ? 0 : (page.value - 1) * pageSize + 1))
const rangeEnd = computed(() => Math.min(page.value * pageSize, totalCount.value))
const filteredItems = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return items.value
  return items.value.filter((item) =>
    Object.values(item).some((value) => String(value).toLowerCase().includes(keyword)),
  )
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
      body: JSON.stringify({
        PageNum: page.value,
        PageSize: pageSize,
        State: selectedStatus.value,
      }),
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
  if (event.key === 'Escape') {
    previewImage.value = ''
    itemToUse.value = null
    itemToMaintain.value = null
    itemToRestock.value = null
  }
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

async function useOneItem() {
  usingItem.value = true
  useOneError.value = ''
  try {
    const response = await fetch(`/api/items/${itemToUse.value.id}/use-one`, { method: 'POST' })
    const result = response.status === 204 ? null : await response.json()
    if (!response.ok) throw new Error(result?.message || '更新庫存失敗')
    itemToUse.value = null
    await Promise.all([loadItems(), loadStats()])
  } catch (error) {
    useOneError.value = error.message
  } finally {
    usingItem.value = false
  }
}

function openMaintainModal(item) {
  const now = new Date()
  const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
  itemToMaintain.value = item
  maintenanceDate.value = localToday
  maintainError.value = ''
}

async function confirmMaintained() {
  maintainingItem.value = true
  maintainError.value = ''
  try {
    const response = await fetch(`/api/items/${itemToMaintain.value.id}/maintain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maintenanceDate: maintenanceDate.value }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || '更新維護日期失敗')
    itemToMaintain.value = null
    await Promise.all([loadItems(), loadStats()])
  } catch (error) {
    maintainError.value = error.message
  } finally {
    maintainingItem.value = false
  }
}

function openRestockModal(item) {
  itemToRestock.value = item
  restockAmount.value = 1
  restockError.value = ''
}

async function confirmRestock() {
  restockingItem.value = true
  restockError.value = ''
  try {
    const response = await fetch(`/api/items/${itemToRestock.value.id}/restock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: restockAmount.value }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || '補貨失敗')
    itemToRestock.value = null
    await Promise.all([loadItems(), loadStats()])
  } catch (error) {
    restockError.value = error.message
  } finally {
    restockingItem.value = false
  }
}

async function itemSaved() {
  showAddModal.value = false
  if (!selectedItem.value) page.value = 1
  selectedItem.value = null
  await Promise.all([loadItems(), loadStats()])
}
</script>
