export const THEME_STORAGE_KEY = "relay:theme"
export const THEME_CHANGE_EVENT = "relay:theme-change"

export type RelayTheme = "dark" | "light"

export const THEME_INIT_SCRIPT = `(()=>{try{const key="${THEME_STORAGE_KEY}";const saved=localStorage.getItem(key);const theme=saved==="light"?"light":"dark";const root=document.documentElement;root.classList.toggle("dark",theme==="dark");root.dataset.theme=theme;root.style.colorScheme=theme}catch{}})()`

function setRootTheme(theme: RelayTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export function getThemeSnapshot(): RelayTheme {
  if (typeof document === "undefined") return "dark"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") return () => undefined
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    setRootTheme(event.newValue === "light" ? "light" : "dark")
    callback()
  }
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  window.addEventListener("storage", handleStorage)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
    window.removeEventListener("storage", handleStorage)
  }
}

export function applyTheme(theme: RelayTheme) {
  setRootTheme(theme)
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}
