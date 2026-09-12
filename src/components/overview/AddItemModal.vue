<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-100 grid place-items-center bg-[rgba(24,29,27,.48)] p-6 max-[700px]:p-2.5"
    >
      <section
        class="max-h-[calc(100vh-36px)] w-full max-w-[710px] overflow-auto rounded-[15px] bg-white px-[30px] pt-[26px] pb-[23px] text-sm shadow-[0_22px_64px_rgba(0,0,0,.28)] max-[700px]:px-4 max-[700px]:py-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header class="flex justify-between">
          <div>
            <h2 id="modal-title" class="m-0 mb-0.5 text-[26px] font-bold max-[700px]:text-[23px]">
              {{ isEditing ? '修改品項' : '新增品項' }}
            </h2>
            <p class="m-0 text-sm text-[#747a77]">
              {{ isEditing ? '更新品項與提醒設定' : '建立維護提醒或庫存提醒' }}
            </p>
          </div>
          <button
            class="cursor-pointer border-0 bg-transparent text-[26px] leading-none text-[#606966]"
            type="button"
            aria-label="關閉"
            @click="$emit('close')"
          >
            ×
          </button>
        </header>

        <div class="my-[21px] mb-[25px] grid grid-cols-2 gap-[17px] max-[700px]:grid-cols-1">
          <button
            type="button"
            :class="typeButtonClass(ITEM_TYPE.MAINTENANCE)"
            @click="form.type = ITEM_TYPE.MAINTENANCE"
          >
            <span class="text-4xl">▣</span
            ><span
              ><b class="block text-lg text-[#171a1f]">定期維護</b
              ><small class="mt-[3px] block text-[13px] text-[#68706c]"
                >依照週期提醒保養、清潔或充電</small
              ></span
            ><i :class="radioClass(ITEM_TYPE.MAINTENANCE)"></i>
          </button>
          <button
            type="button"
            :class="typeButtonClass(ITEM_TYPE.STOCK)"
            @click="form.type = ITEM_TYPE.STOCK"
          >
            <span class="text-4xl">◇</span
            ><span
              ><b class="block text-lg text-[#171a1f]">庫存備品</b
              ><small class="mt-[3px] block text-[13px] text-[#68706c]"
                >數量不足時提醒補貨</small
              ></span
            ><i :class="radioClass(ITEM_TYPE.STOCK)"></i>
          </button>
        </div>

        <form @submit.prevent="submitItem">
          <div class="grid grid-cols-[280px_1fr] gap-[22px] max-[700px]:grid-cols-1">
            <label
              class="flex h-[326px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-dashed border-[#cbd1ce] max-[700px]:h-[210px]"
            >
              <input
                class="hidden"
                type="file"
                accept="image/jpeg,image/png"
                @change="selectImage"
              />
              <img
                v-if="imagePreview"
                class="h-full w-full object-cover"
                :src="imagePreview"
                alt="品項預覽"
              />
              <template v-else
                ><span class="text-[62px] text-[#087d4b]">▧</span
                ><b class="mt-2 mb-[3px] text-lg">上傳品項照片</b
                ><small class="text-[13px] text-[#68706c]">支援 JPG、PNG，最大 5MB</small></template
              >
            </label>

            <div
              class="grid gap-[11px] [&_em]:not-italic [&_em]:text-red-600 [&_input]:h-[42px] [&_input]:w-full [&_input]:rounded-[7px] [&_input]:border [&_input]:border-[#ccd2cf] [&_input]:bg-white [&_input]:px-3 [&_input]:outline-none [&_input:focus]:border-[#087d4b] [&_label>span]:mb-[5px] [&_label>span]:block [&_label>span]:font-semibold [&_select]:h-[42px] [&_select]:w-full [&_select]:rounded-[7px] [&_select]:border [&_select]:border-[#ccd2cf] [&_select]:bg-white [&_select]:px-3"
            >
              <label
                ><span>品名 <em>*</em></span
                ><input
                  v-model.trim="form.name"
                  required
                  :placeholder="
                    form.type === ITEM_TYPE.MAINTENANCE ? '例如：櫃檯平板' : '例如：拋棄式牙刷'
                  "
              /></label>
              <label
                ><span>放置位置</span><input v-model.trim="form.place" placeholder="例如：一樓櫃檯"
              /></label>

              <template v-if="form.type === ITEM_TYPE.MAINTENANCE">
                <label
                  ><span>上次維護日期 <em>*</em></span
                  ><input v-model="form.lastDate" required type="date"
                /></label>
                <label
                  ><span>維護週期（天） <em>*</em></span
                  ><input v-model.number="form.cycle" required min="1" type="number"
                /></label>
              </template>
              <template v-else>
                <label
                  ><span>目前庫存數量 <em>*</em></span
                  ><input v-model.number="form.count" required min="0" type="number"
                /></label>
                <label
                  ><span>提醒數量 <em>*</em></span
                  ><input v-model.number="form.threshold" required min="0" type="number"
                /></label>
              </template>
            </div>
          </div>

          <div
            v-if="form.type === ITEM_TYPE.MAINTENANCE"
            class="mt-[21px] flex items-center gap-3.5 rounded-[9px] border border-[#c9e2d3] bg-[#f0f8f3] px-[18px] py-3.5 text-[#08764a]"
          >
            <span class="text-[26px]">▣</span>
            <div>
              <b class="block">預計下次維護：{{ nextDate || '請選擇日期與週期' }}</b
              ><small class="mt-0.5 block text-[13px] text-[#606864]">屆期當天將自動發送提醒</small>
            </div>
          </div>
          <div
            v-else
            class="mt-[21px] flex items-center gap-3.5 rounded-[9px] border border-[#f5d69f] bg-[#fff7e9] px-[18px] py-3.5 text-[#d97800]"
          >
            <span class="text-[26px]">◇</span>
            <div>
              <b class="block">庫存低於 {{ form.threshold }} 時將自動提醒</b
              ><small class="mt-0.5 block text-[13px] text-[#606864]"
                >目前庫存已低於提醒數量，建立後會立即通知</small
              >
            </div>
          </div>

          <p v-if="errorMessage" class="mt-2.5 mb-0 text-[#d9232e]">{{ errorMessage }}</p>
          <footer
            class="mt-[22px] flex justify-end gap-3 [&_button]:h-[45px] [&_button]:min-w-[118px] [&_button]:cursor-pointer [&_button]:rounded-lg [&_button]:text-sm"
          >
            <button type="button" class="border border-[#cbd1ce] bg-white" @click="$emit('close')">
              取消
            </button>
            <button
              type="submit"
              class="border-0 bg-[#087d4b] !text-white disabled:opacity-65"
              :disabled="submitting"
            >
              {{ submitting ? '儲存中…' : isEditing ? '儲存修改' : '建立品項' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ITEM_TYPE } from '../../../shared/itemTypes.js'
import { ITEM_STATUS } from '../../../shared/itemStatuses.js'

const props = defineProps({ item: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])
const isEditing = computed(() => Boolean(props.item?.id))

function inputDate(value) {
  return value ? value.replaceAll('/', '-') : ''
}

function initialLastDate(item) {
  if (item?.last_date) return inputDate(item.last_date)
  if (!item?.date) return ''
  const date = new Date(`${inputDate(item.date)}T00:00:00`)
  date.setDate(date.getDate() - 7)
  return date.toISOString().slice(0, 10)
}

const form = reactive({
  type: props.item?.type || ITEM_TYPE.MAINTENANCE,
  name: props.item?.name || '',
  place: props.item?.place || '',
  lastDate: initialLastDate(props.item),
  cycle: props.item?.cycle || 7,
  count: props.item?.count ?? 8,
  threshold: props.item?.threshold ?? 20,
})
const imagePreview = ref(props.item?.image || '')
const errorMessage = ref('')
const submitting = ref(false)

const typeButtonClass = (type) => [
  'relative flex min-h-[80px] cursor-pointer items-center gap-[15px] rounded-[10px] bg-white px-5 py-[17px] text-left',
  form.type === type
    ? 'border-2 border-[#087d4b] bg-[#f7fcf9] text-[#087d4b]'
    : 'border border-[#cfd5d2]',
]
const radioClass = (type) => [
  'absolute top-[13px] right-[13px] h-5 w-5 rounded-full border-2',
  form.type === type
    ? 'border-[#087d4b] bg-[#087d4b] shadow-[inset_0_0_0_4px_#fff]'
    : 'border-[#cbd1ce]',
]

const nextDate = computed(() => {
  if (!form.lastDate || !form.cycle || form.cycle < 1) return ''
  const date = new Date(`${form.lastDate}T00:00:00`)
  date.setDate(date.getDate() + form.cycle)
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
})

function selectImage(event) {
  const file = event.target.files[0]
  errorMessage.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    errorMessage.value = '請選擇 5MB 以下的 JPG 或 PNG 圖片'
    event.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    imagePreview.value = reader.result
  }
  reader.readAsDataURL(file)
}

async function submitItem() {
  errorMessage.value = ''
  submitting.value = true
  const isStock = form.type === ITEM_TYPE.STOCK
  const response = await fetch(
    isEditing.value ? `/api/items/${props.item.id}` : '/api/items/create',
    {
      method: isEditing.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        place: form.place || '-',
        image: imagePreview.value || null,
        date: isStock ? null : nextDate.value,
        count: isStock ? form.count : null,
        status:
          isStock && form.count < form.threshold ? ITEM_STATUS.OUT_OF_STOCK : ITEM_STATUS.NORMAL,
        lastDate: isStock ? null : form.lastDate,
        cycle: isStock ? null : form.cycle,
        threshold: isStock ? form.threshold : null,
      }),
    },
  )
  submitting.value = false
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    errorMessage.value = result.message || `${isEditing.value ? '修改' : '建立'}失敗，請稍後再試`
    return
  }
  emit('saved')
}
</script>
