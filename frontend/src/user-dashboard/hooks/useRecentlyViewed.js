// ─────────────────────────────────────────────────────────────────────────────
// Recently Viewed lots — saved per user on this device, newest first (max 6).
// Updates live: the Home list changes the moment a lot is opened, including
// across other open tabs of the app.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'

const MAX_ITEMS = 6
const EVENT = 'gl-recent-change'
const keyFor = (userKey) => `gl-recent:${userKey || 'guest'}`

function read(userKey) {
  try {
    const list = JSON.parse(localStorage.getItem(keyFor(userKey)) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(userKey, list) {
  try { localStorage.setItem(keyFor(userKey), JSON.stringify(list)) } catch { /* storage full / private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { userKey } }))
}

// Call when a lot is opened.
export function addRecentlyViewed(userKey, lot) {
  if (!lot?.blockId || lot.lotNo == null) return
  const item = {
    blockId: lot.blockId,
    blockName: lot.blockName || '',
    lawnName: lot.lawnName || '',
    lotNo: lot.lotNo,
    classification: lot.classification || '',
    status: lot.status || '',
    intermentCount: lot.intermentCount || 0,
    viewedAt: new Date().toISOString(),
  }
  const rest = read(userKey).filter((x) => !(x.blockId === item.blockId && String(x.lotNo) === String(item.lotNo)))
  write(userKey, [item, ...rest].slice(0, MAX_ITEMS))
}

export function useRecentlyViewed(userKey) {
  const [items, setItems] = useState(() => read(userKey))
  const [, setTick] = useState(0) // re-render every minute so "5 min ago" stays fresh

  useEffect(() => {
    setItems(read(userKey))
    const refresh = () => setItems(read(userKey))
    const onStorage = (e) => { if (e.key === keyFor(userKey)) refresh() }
    window.addEventListener(EVENT, refresh)
    window.addEventListener('storage', onStorage) // other tabs
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000)
    return () => {
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener('storage', onStorage)
      clearInterval(id)
    }
  }, [userKey])

  const clear = useCallback(() => write(userKey, []), [userKey])
  return { items, clear }
}

// "just now" / "5 minutes ago" in the app's language (en / fil).
export function timeAgo(iso, lang = 'en') {
  const sec = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(lang === 'fil' ? 'fil' : 'en', { numeric: 'auto' })
  const abs = Math.abs(sec)
  if (abs < 60) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour')
  return rtf.format(Math.round(sec / 86400), 'day')
}