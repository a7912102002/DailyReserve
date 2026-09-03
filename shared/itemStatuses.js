export const ITEM_STATUS = Object.freeze({
  NORMAL: 1,
  EXPIRING_SOON: 2,
  LOW_STOCK: 3,
  OUT_OF_STOCK: 4,
  EXPIRED: 5,
})

export const ITEM_STATUS_LABEL = Object.freeze({
  [ITEM_STATUS.NORMAL]: '正常',
  [ITEM_STATUS.EXPIRING_SOON]: '即將到期',
  [ITEM_STATUS.LOW_STOCK]: '微量庫存',
  [ITEM_STATUS.OUT_OF_STOCK]: '庫存不足',
  [ITEM_STATUS.EXPIRED]: '已逾期',
})

export const ITEM_STATUS_SORT_ORDER = Object.freeze([
  ITEM_STATUS.OUT_OF_STOCK,
  ITEM_STATUS.EXPIRED,
  ITEM_STATUS.LOW_STOCK,
  ITEM_STATUS.EXPIRING_SOON,
  ITEM_STATUS.NORMAL,
])

export function getItemStatusLabel(status) {
  return ITEM_STATUS_LABEL[status] ?? '未知狀態'
}
