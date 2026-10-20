// ─────────────────────────────────────────────────────────────────────────────
// PrefsContext — app-wide Language + Theme preferences.
//   theme: 'light' | 'dark' | 'system'   (saved on this device)
//   lang:  'en' | 'fil'                   (saved on this device)
// Applies the theme by setting <html data-theme="light|dark">, which
// MobileApp.css uses to switch colors.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translate } from '../i18n'

const LS_THEME = 'gl-theme'
const LS_LANG = 'gl-lang'
const THEME_COLOR = { light: '#0284C7', dark: '#0B1620' }

function readSaved(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function save(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode etc. */ }
}

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

// Call once before React renders (main.jsx) so there's no light→dark flash.
export function applySavedTheme() {
  const theme = readSaved(LS_THEME, ['light', 'dark', 'system'], 'light')
  const resolved = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = resolved
  document.documentElement.lang = readSaved(LS_LANG, ['en', 'fil'], 'en')
}

const PrefsContext = createContext(null)

export function PrefsProvider({ children }) {
  const [theme, setThemeState] = useState(() => readSaved(LS_THEME, ['light', 'dark', 'system'], 'light'))
  const [lang, setLangState] = useState(() => readSaved(LS_LANG, ['en', 'fil'], 'en'))
  const [systemDark, setSystemDark] = useState(prefersDark)

  // Follow the device setting live when theme = 'system'.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.lang = lang
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_COLOR[resolvedTheme])
  }, [resolvedTheme, lang])

  const setTheme = useCallback((v) => { setThemeState(v); save(LS_THEME, v) }, [])
  const setLang = useCallback((v) => { setLangState(v); save(LS_LANG, v) }, [])
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, lang, setLang, t }),
    [theme, resolvedTheme, setTheme, lang, setLang, t],
  )
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

// Safe even outside the provider (falls back to English + light).
export function usePrefs() {
  const ctx = useContext(PrefsContext)
  if (ctx) return ctx
  return {
    theme: 'light', resolvedTheme: 'light', setTheme: () => {},
    lang: 'en', setLang: () => {}, t: (key, vars) => translate('en', key, vars),
  }
}