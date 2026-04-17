import { useEffect, useState } from 'react'

const THEMES = [
  { id: 'mocha', label: 'Mocha', color: '#f5c2e7' },
  { id: 'tokyo-night', label: 'Tokyo Night', color: '#73daca' },
  { id: 'miami', label: 'Miami', color: '#ff2d95' },
  { id: 'forest', label: 'Forest', color: '#8fbc6a' },
] as const

type ThemeId = (typeof THEMES)[number]['id']

const STORAGE_KEY = 'site-theme'

export function ThemePicker() {
  const [active, setActive] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    return stored && THEMES.some((t) => t.id === stored) ? stored : 'mocha'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = active
    localStorage.setItem(STORAGE_KEY, active)
  }, [active])

  const apply = (id: ThemeId) => {
    setActive(id)
  }

  return (
    <div className="flex items-center gap-2" aria-label="Theme picker">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          title={theme.label}
          aria-label={`Switch to ${theme.label} theme`}
          onClick={() => apply(theme.id)}
          style={{ backgroundColor: theme.color }}
          className={`h-5 w-5 rounded-full transition-transform hover:scale-110 focus:outline-none ${
            active === theme.id
              ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-bg scale-110'
              : 'opacity-70 hover:opacity-100'
          }`}
        />
      ))}
    </div>
  )
}
