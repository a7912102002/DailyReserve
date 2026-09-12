import { getDatabase } from '@netlify/database'
import { ITEM_TYPE } from '../../shared/itemTypes.js'
import { ITEM_STATUS } from '../../shared/itemStatuses.js'

const itemColumns = 'id, name, type, place, date, count, status, image, last_date, cycle, threshold'

function json(data, status = 200) {
  return Response.json(data, { status })
}

function apiPath(request) {
  const pathname = new URL(request.url).pathname
  return pathname.replace(/^\/\.netlify\/functions\/items/, '').replace(/^\/api\/items/, '') || '/'
}

function validItem(item) {
  return (
    Object.values(ITEM_TYPE).includes(item.type) &&
    Object.values(ITEM_STATUS).includes(item.status) &&
    ['name', 'place'].every(field => typeof item[field] === 'string' && item[field].trim())
  )
}

function normalizedItem(item) {
  return {
    name: item.name.trim(),
    type: item.type,
    place: item.place.trim(),
    date: item.date || null,
    count: item.count ?? null,
    status: item.status,
    image: item.image || null,
    lastDate: item.lastDate || null,
    cycle: item.cycle ?? null,
    threshold: item.threshold ?? null
  }
}

async function refreshMaintenanceStatuses(db) {
  await db.sql`
    UPDATE items
    SET status = CASE
      WHEN date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date THEN ${ITEM_STATUS.EXPIRED}::integer
      WHEN date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date + 2 THEN ${ITEM_STATUS.EXPIRING_SOON}::integer
      ELSE ${ITEM_STATUS.NORMAL}::integer
    END
    WHERE type = ${ITEM_TYPE.MAINTENANCE} AND date IS NOT NULL
  `
}

async function findItem(db, id) {
  const rows = await db.sql`SELECT ${db.sql.raw(itemColumns)} FROM items WHERE id = ${id}`
  return rows[0] ?? null
}

export default async request => {
  const path = apiPath(request)
  const idMatch = path.match(/^\/(\d+)$/)

  try {
    const db = getDatabase()
    await refreshMaintenanceStatuses(db)

    if (request.method === 'GET' && path === '/stats') {
      const rows = await db.sql`
        SELECT status, COUNT(*)::integer AS count FROM items GROUP BY status ORDER BY status
      `
      return json(rows)
    }

    if (request.method === 'POST' && path === '/') {
      const { PageNum: pageNum, PageSize: pageSize, State: state } = await request.json()
      if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
        return json({ State: 'ERROR', StateCode: 400, Message: 'PageNum 與 PageSize 必須是大於 0 的整數' }, 400)
      }
      if (state !== null && !Object.values(ITEM_STATUS).includes(state)) {
        return json({ State: 'ERROR', StateCode: 400, Message: 'State 必須是 null 或有效狀態' }, 400)
      }

      const offset = (pageNum - 1) * pageSize
      let countRows
      let items
      if (state === null) {
        countRows = await db.sql`SELECT COUNT(*)::integer AS count FROM items`
        items = await db.sql`
          SELECT ${db.sql.raw(itemColumns)} FROM items
          ORDER BY
            CASE status WHEN 4 THEN 1 WHEN 5 THEN 2 WHEN 3 THEN 3 WHEN 2 THEN 4 WHEN 1 THEN 5 ELSE 999 END,
            CASE WHEN status IN (2, 5) THEN date END ASC NULLS LAST, id
          LIMIT ${pageSize} OFFSET ${offset}
        `
      } else {
        countRows = await db.sql`SELECT COUNT(*)::integer AS count FROM items WHERE status = ${state}`
        items = await db.sql`
          SELECT ${db.sql.raw(itemColumns)} FROM items WHERE status = ${state}
          ORDER BY
            CASE status WHEN 4 THEN 1 WHEN 5 THEN 2 WHEN 3 THEN 3 WHEN 2 THEN 4 WHEN 1 THEN 5 ELSE 999 END,
            CASE WHEN status IN (2, 5) THEN date END ASC NULLS LAST, id
          LIMIT ${pageSize} OFFSET ${offset}
        `
      }

      const totalCount = countRows[0]?.count ?? 0
      return json({
        State: 'SUCCESS',
        StateCode: 200,
        Data: {
          PageNum: pageNum,
          PageSize: pageSize,
          TotalCount: totalCount,
          TotalPage: Math.ceil(totalCount / pageSize),
          List: items
        }
      })
    }

    if (request.method === 'POST' && path === '/create') {
      const input = await request.json()
      if (!validItem(input)) return json({ message: '物品資料格式不正確' }, 400)
      const item = normalizedItem(input)
      const rows = await db.sql`
        INSERT INTO items (name, type, place, date, count, status, image, last_date, cycle, threshold)
        VALUES (${item.name}, ${item.type}, ${item.place}, ${item.date}, ${item.count}, ${item.status},
          ${item.image}, ${item.lastDate}, ${item.cycle}, ${item.threshold})
        RETURNING ${db.sql.raw(itemColumns)}
      `
      await refreshMaintenanceStatuses(db)
      return json(await findItem(db, rows[0].id), 201)
    }

    const useOneMatch = path.match(/^\/(\d+)\/use-one$/)
    if (request.method === 'POST' && useOneMatch) {
      const id = Number(useOneMatch[1])
      const item = await findItem(db, id)
      if (!item) return json({ message: '找不到物品' }, 404)
      if (item.type !== ITEM_TYPE.STOCK) return json({ message: '只有庫存物品可以使用一個' }, 400)
      if (item.count === null || item.count <= 0) return json({ message: '目前庫存已經是 0' }, 400)
      const rows = await db.sql`
        UPDATE items SET count = count - 1,
          status = CASE WHEN count - 1 < COALESCE(threshold, 0)
            THEN ${ITEM_STATUS.OUT_OF_STOCK}::integer ELSE ${ITEM_STATUS.NORMAL}::integer END
        WHERE id = ${id} AND count > 0 RETURNING ${db.sql.raw(itemColumns)}
      `
      if (!rows[0]) return json({ message: '目前庫存已經是 0' }, 409)
      return json(rows[0])
    }

    const maintainMatch = path.match(/^\/(\d+)\/maintain$/)
    if (request.method === 'POST' && maintainMatch) {
      const id = Number(maintainMatch[1])
      const { maintenanceDate } = await request.json()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(maintenanceDate || '')) return json({ message: '維護日期格式必須是 YYYY-MM-DD' }, 400)
      const item = await findItem(db, id)
      if (!item) return json({ message: '找不到物品' }, 404)
      if (item.type !== ITEM_TYPE.MAINTENANCE) return json({ message: '只有維護物品可以完成維護' }, 400)
      const rows = await db.sql`
        UPDATE items SET last_date = ${maintenanceDate}::date, cycle = COALESCE(cycle, 7),
          date = ${maintenanceDate}::date + COALESCE(cycle, 7)
        WHERE id = ${id} RETURNING id
      `
      await refreshMaintenanceStatuses(db)
      return json(await findItem(db, rows[0].id))
    }

    const restockMatch = path.match(/^\/(\d+)\/restock$/)
    if (request.method === 'POST' && restockMatch) {
      const id = Number(restockMatch[1])
      const { amount } = await request.json()
      if (!Number.isInteger(amount) || amount < 1) return json({ message: '補貨數量必須是大於 0 的整數' }, 400)
      const item = await findItem(db, id)
      if (!item) return json({ message: '找不到物品' }, 404)
      if (item.type !== ITEM_TYPE.STOCK) return json({ message: '只有庫存物品可以補貨' }, 400)
      const rows = await db.sql`
        UPDATE items SET count = COALESCE(count, 0) + ${amount},
          status = CASE WHEN COALESCE(count, 0) + ${amount} < COALESCE(threshold, 0)
            THEN ${ITEM_STATUS.OUT_OF_STOCK}::integer ELSE ${ITEM_STATUS.NORMAL}::integer END
        WHERE id = ${id} RETURNING ${db.sql.raw(itemColumns)}
      `
      return json(rows[0])
    }

    if (request.method === 'PUT' && idMatch) {
      const id = Number(idMatch[1])
      const input = await request.json()
      if (!validItem(input)) return json({ message: '物品資料格式不正確' }, 400)
      const item = normalizedItem(input)
      const rows = await db.sql`
        UPDATE items SET name = ${item.name}, type = ${item.type}, place = ${item.place},
          date = ${item.date}, count = ${item.count}, status = ${item.status}, image = ${item.image},
          last_date = ${item.lastDate}, cycle = ${item.cycle}, threshold = ${item.threshold}
        WHERE id = ${id} RETURNING id
      `
      if (!rows[0]) return json({ message: '找不到物品' }, 404)
      await refreshMaintenanceStatuses(db)
      return json(await findItem(db, id))
    }

    if (request.method === 'DELETE' && idMatch) {
      const rows = await db.sql`DELETE FROM items WHERE id = ${Number(idMatch[1])} RETURNING id`
      if (!rows[0]) return json({ message: '找不到物品' }, 404)
      return new Response(null, { status: 204 })
    }

    return json({ message: '找不到 API' }, 404)
  } catch (error) {
    console.error(error)
    return json({ message: error instanceof SyntaxError ? 'JSON 格式錯誤' : '伺服器發生錯誤' }, error instanceof SyntaxError ? 400 : 500)
  }
}
