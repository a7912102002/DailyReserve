import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

mkdirSync('data', { recursive: true })
const database = new DatabaseSync('data/daily-reserve.db')

database.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '📦',
    type TEXT NOT NULL,
    place TEXT NOT NULL,
    date TEXT,
    count INTEGER,
    status TEXT NOT NULL
  )
`)

const columns = database.prepare('PRAGMA table_info(items)').all()
if (!columns.some((column) => column.name === 'image')) database.exec('ALTER TABLE items ADD COLUMN image TEXT')

const defaultItems = [
  // ['櫃檯平板', '🖥️', '定期維護', '櫃檯', '2026/09/09', null, '正常'],
  // ['咖啡機', '☕', '定期維護', '茶水間', '2026/09/05', null, '即將到期'],
  // ['無線吸塵器', '🧹', '定期維護', '儲藏室', '2026/09/12', null, '正常'],
  // ['訪客用雨傘', '☂️', '庫存備品', '玄關雨傘架', null, 8, '正常'],
  // ['急救箱', '🧰', '庫存備品', '茶水間櫃子', null, 8, '正常'],
  // ['延長線組', '🔌', '庫存備品', '會議室櫃子', null, 1, '庫存不足'],
  // ['空氣清淨機', '🌬️', '定期維護', '辦公區域', '2026/10/01', null, '正常'],
]

const itemCount = database.prepare('SELECT COUNT(*) AS count FROM items').get().count
if (itemCount === 0) {
  const insertDefault = database.prepare(`
    INSERT INTO items (name, emoji, type, place, date, count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
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
  return ['name', 'type', 'place', 'status'].every(
    (field) => typeof item[field] === 'string' && item[field].trim(),
  )
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const idMatch = url.pathname.match(/^\/api\/items\/(\d+)$/)

  try {
    if (request.method === 'POST' && url.pathname === '/api/items') {
      const requestData = await readJson(request)
      const pageNum = Number(requestData.PageNum)
      const pageSize = Number(requestData.PageSize)
      if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
        return sendJson(response, 400, { State: 'ERROR', StateCode: 400, Message: 'PageNum 和 PageSize 必須是大於 0 的整數' })
      }

      const totalCount = database.prepare('SELECT COUNT(*) AS count FROM items').get().count
      const totalPage = Math.ceil(totalCount / pageSize)
      const list = database.prepare('SELECT * FROM items ORDER BY id LIMIT ? OFFSET ?')
        .all(pageSize, (pageNum - 1) * pageSize)

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
        INSERT INTO items (name, emoji, type, place, date, count, status, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(item.name, item.emoji || '📦', item.type, item.place, item.date ?? null, item.count ?? null, item.status, item.image ?? null)
      return sendJson(response, 201, database.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid))
    }

    if (request.method === 'PUT' && idMatch) {
      const id = Number(idMatch[1])
      const item = await readJson(request)
      if (!validItem(item)) return sendJson(response, 400, { message: '名稱、類型、位置與狀態為必填' })
      const result = database.prepare(`
        UPDATE items SET name = ?, emoji = ?, type = ?, place = ?, date = ?, count = ?, status = ?
        WHERE id = ?
      `).run(item.name, item.emoji || '📦', item.type, item.place, item.date ?? null, item.count ?? null, item.status, id)
      if (result.changes === 0) return sendJson(response, 404, { message: '找不到這筆品項' })
      return sendJson(response, 200, database.prepare('SELECT * FROM items WHERE id = ?').get(id))
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
