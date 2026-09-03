import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { ITEM_TYPE } from '../shared/itemTypes.js'
import { ITEM_STATUS, ITEM_STATUS_SORT_ORDER } from '../shared/itemStatuses.js'

mkdirSync('data', { recursive: true })
const database = new DatabaseSync('data/daily-reserve.db')

database.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type INTEGER NOT NULL CHECK (type IN (${ITEM_TYPE.MAINTENANCE}, ${ITEM_TYPE.STOCK})),
    place TEXT NOT NULL,
    date TEXT,
    count INTEGER,
    status INTEGER NOT NULL CHECK (status IN (${Object.values(ITEM_STATUS).join(', ')}))
  )
`)

const columns = database.prepare('PRAGMA table_info(items)').all()
if (!columns.some((column) => column.name === 'image')) database.exec('ALTER TABLE items ADD COLUMN image TEXT')
if (!columns.some((column) => column.name === 'last_date')) database.exec('ALTER TABLE items ADD COLUMN last_date TEXT')
if (!columns.some((column) => column.name === 'cycle')) database.exec('ALTER TABLE items ADD COLUMN cycle INTEGER')
if (!columns.some((column) => column.name === 'threshold')) database.exec('ALTER TABLE items ADD COLUMN threshold INTEGER')
if (columns.some((column) => column.name === 'emoji')) database.exec('ALTER TABLE items DROP COLUMN emoji')
if (columns.some((column) => column.name === 'cycle_unit')) database.exec('ALTER TABLE items DROP COLUMN cycle_unit')
const typeColumn = columns.find((column) => column.name === 'type')
if (typeColumn && typeColumn.type.toUpperCase() !== 'INTEGER') {
  database.exec(`
    ALTER TABLE items RENAME COLUMN type TO old_type;
    ALTER TABLE items ADD COLUMN type INTEGER NOT NULL DEFAULT ${ITEM_TYPE.MAINTENANCE} CHECK (type IN (${ITEM_TYPE.MAINTENANCE}, ${ITEM_TYPE.STOCK}));
    UPDATE items SET type = CASE WHEN old_type = '庫存備品' THEN ${ITEM_TYPE.STOCK} ELSE ${ITEM_TYPE.MAINTENANCE} END;
    ALTER TABLE items DROP COLUMN old_type;
  `)
}
const statusColumn = columns.find((column) => column.name === 'status')
if (statusColumn && statusColumn.type.toUpperCase() !== 'INTEGER') {
  database.exec(`
    ALTER TABLE items RENAME COLUMN status TO old_status;
    ALTER TABLE items ADD COLUMN status INTEGER NOT NULL DEFAULT ${ITEM_STATUS.NORMAL} CHECK (status IN (${Object.values(ITEM_STATUS).join(', ')}));
    UPDATE items SET status = CASE old_status
      WHEN '即將到期' THEN ${ITEM_STATUS.EXPIRING_SOON}
      WHEN '微量庫存' THEN ${ITEM_STATUS.LOW_STOCK}
      WHEN '庫存不足' THEN ${ITEM_STATUS.OUT_OF_STOCK}
      ELSE ${ITEM_STATUS.NORMAL}
    END;
    ALTER TABLE items DROP COLUMN old_status;
  `)
}
const itemTableSql = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'items'").get().sql
const expiredStatusPattern = /CHECK\s*\(\s*status\s+IN\s*\([^)]*\b5\b/i
if (!expiredStatusPattern.test(itemTableSql)) {
  database.exec(`
    ALTER TABLE items RENAME COLUMN status TO old_status_v4;
    ALTER TABLE items ADD COLUMN status INTEGER NOT NULL DEFAULT ${ITEM_STATUS.NORMAL} CHECK (status IN (${Object.values(ITEM_STATUS).join(', ')}));
    UPDATE items SET status = old_status_v4;
    ALTER TABLE items DROP COLUMN old_status_v4;
  `)
}

const defaultItems = [
  // ['櫃檯平板', 1, '櫃檯', '2026/09/09', null, 1],
  // ['咖啡機', 1, '茶水間', '2026/09/05', null, 2],
  // ['無線吸塵器', 1, '儲藏室', '2026/09/12', null, 1],
  // ['訪客用雨傘', 2, '玄關雨傘架', null, 8, 1],
  // ['急救箱', 2, '茶水間櫃子', null, 8, 1],
  // ['延長線組', 2, '會議室櫃子', null, 1, 4],
  // ['空氣清淨機', 1, '辦公區域', '2026/10/01', null, 1],
]

const itemCount = database.prepare('SELECT COUNT(*) AS count FROM items').get().count
if (itemCount === 0) {
  const insertDefault = database.prepare(`
    INSERT INTO items (name, type, place, date, count, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const item of defaultItems) insertDefault.run(...item)
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(data))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function validItem(item) {
  return Object.values(ITEM_TYPE).includes(item.type) && Object.values(ITEM_STATUS).includes(item.status) && ['name', 'place'].every(
    (field) => typeof item[field] === 'string' && item[field].trim(),
  )
}

const itemColumns = 'id, name, type, place, date, count, status, image, last_date, cycle, threshold'
const statusOrderSql = ITEM_STATUS_SORT_ORDER
  .map((status, index) => `WHEN ${status} THEN ${index + 1}`)
  .join(' ')

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const idMatch = url.pathname.match(/^\/api\/items\/(\d+)$/)

  try {
    if (request.method === 'GET' && url.pathname === '/api/items/stats') {
      const stats = database.prepare(`
        SELECT status, COUNT(*) AS count
        FROM items
        GROUP BY status
        ORDER BY status
      `).all()
      return sendJson(response, 200, stats)
    }

    if (request.method === 'POST' && url.pathname === '/api/items') {
      const requestData = await readJson(request)
      const pageNum = Number(requestData.PageNum)
      const pageSize = Number(requestData.PageSize)
      const state = requestData.State
      if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
        return sendJson(response, 400, { State: 'ERROR', StateCode: 400, Message: 'PageNum 和 PageSize 必須是大於 0 的整數' })
      }
      if (state !== null && !Object.values(ITEM_STATUS).includes(state)) {
        return sendJson(response, 400, { State: 'ERROR', StateCode: 400, Message: 'State 必須是 null 或 1 到 5' })
      }

      const whereClause = state === null ? '' : 'WHERE status = ?'
      const queryParams = state === null ? [] : [state]
      const totalCount = database.prepare(`SELECT COUNT(*) AS count FROM items ${whereClause}`).get(...queryParams).count
      const totalPage = Math.ceil(totalCount / pageSize)
      const list = database.prepare(`
        SELECT ${itemColumns}
        FROM items ${whereClause}
        ORDER BY
          CASE status ${statusOrderSql} ELSE 999 END,
          CASE
            WHEN status IN (${ITEM_STATUS.EXPIRING_SOON}, ${ITEM_STATUS.EXPIRED}) AND date IS NULL THEN 1
            ELSE 0
          END,
          CASE
            WHEN status IN (${ITEM_STATUS.EXPIRING_SOON}, ${ITEM_STATUS.EXPIRED}) THEN date
          END ASC,
          id
        LIMIT ? OFFSET ?
      `)
        .all(...queryParams, pageSize, (pageNum - 1) * pageSize)

      return sendJson(response, 200, {
        State: 'SUCCESS',
        StateCode: 200,
        Data: { PageNum: pageNum, PageSize: pageSize, TotalCount: totalCount, TotalPage: totalPage, List: list },
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/items/create') {
      const item = await readJson(request)
      if (!validItem(item)) return sendJson(response, 400, { message: '名稱、類型、位置與狀態為必填' })
      const result = database.prepare(`
        INSERT INTO items (name, type, place, date, count, status, image, last_date, cycle, threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(item.name, item.type, item.place, item.date ?? null, item.count ?? null, item.status, item.image ?? null, item.lastDate ?? null, item.cycle ?? null, item.threshold ?? null)
      return sendJson(response, 201, database.prepare(`SELECT ${itemColumns} FROM items WHERE id = ?`).get(result.lastInsertRowid))
    }

    if (request.method === 'PUT' && idMatch) {
      const id = Number(idMatch[1])
      const item = await readJson(request)
      if (!validItem(item)) return sendJson(response, 400, { message: '名稱、類型、位置與狀態為必填' })
      const result = database.prepare(`
        UPDATE items SET name = ?, type = ?, place = ?, date = ?, count = ?, status = ?, image = ?, last_date = ?, cycle = ?, threshold = ?
        WHERE id = ?
      `).run(item.name, item.type, item.place, item.date ?? null, item.count ?? null, item.status, item.image ?? null, item.lastDate ?? null, item.cycle ?? null, item.threshold ?? null, id)
      if (result.changes === 0) return sendJson(response, 404, { message: '找不到這筆品項' })
      return sendJson(response, 200, database.prepare(`SELECT ${itemColumns} FROM items WHERE id = ?`).get(id))
    }

    if (request.method === 'DELETE' && idMatch) {
      const result = database.prepare('DELETE FROM items WHERE id = ?').run(Number(idMatch[1]))
      if (result.changes === 0) return sendJson(response, 404, { message: '找不到這筆品項' })
      response.writeHead(204)
      return response.end()
    }

    return sendJson(response, 404, { message: '找不到這個 API' })
  } catch (error) {
    console.error(error)
    const statusCode = error instanceof SyntaxError ? 400 : 500
    return sendJson(response, statusCode, { message: statusCode === 400 ? 'JSON 格式錯誤' : '伺服器發生錯誤' })
  }
})

const port = Number(process.env.DAILY_RESERVE_PORT) || 3100
server.listen(port, () => {
  console.log(`API 已啟動：http://localhost:${port}/api/items`)
})
