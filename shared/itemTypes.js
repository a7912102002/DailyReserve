export const ITEM_TYPE = Object.freeze({
  MAINTENANCE: 1,
  STOCK: 2,
})

export const ITEM_TYPE_LABEL = Object.freeze({
  [ITEM_TYPE.MAINTENANCE]: '定期維護',
  [ITEM_TYPE.STOCK]: '庫存備品',
})

export function getItemTypeLabel(type) {
  return ITEM_TYPE_LABEL[type] ?? '未知類型'
}
