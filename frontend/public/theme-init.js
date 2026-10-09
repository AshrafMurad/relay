;(() => {
  try {
    const key = "relay:theme"
    const saved = localStorage.getItem(key)
    const theme = saved === "light" ? "light" : "dark"
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.dataset.theme = theme
    root.style.colorScheme = theme
  } catch {}
})()
