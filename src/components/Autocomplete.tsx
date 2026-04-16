import { useEffect, useRef, useState } from 'react'
import { opensearch, type Suggestion } from '../lib/wiki'

interface Props {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSelect?: (s: Suggestion) => void
}

export function Autocomplete({ id, label, placeholder, value, onChange, onSelect }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!value.trim() || value.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      abortRef.current?.abort()
      const c = new AbortController()
      abortRef.current = c
      opensearch(value, c.signal)
        .then((s) => {
          setSuggestions(s)
          setOpen(s.length > 0)
          setHighlight(0)
        })
        .catch(() => {})
    }, 220)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [value])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const select = (s: Suggestion) => {
    onChange(s.title)
    onSelect?.(s)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (suggestions[highlight]) select(suggestions[highlight])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="w-full rounded-lg border border-ink-700 bg-ink-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none ring-0 transition-colors placeholder:text-slate-500 focus:border-accent-500"
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-72 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900/95 p-1 shadow-xl shadow-black/40 backdrop-blur-sm"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(s)}
                className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  i === highlight
                    ? 'bg-accent-500/15 text-slate-100'
                    : 'text-slate-300 hover:bg-ink-800'
                }`}
                role="option"
                aria-selected={i === highlight}
              >
                <span className="font-medium">{s.title}</span>
                {s.description && (
                  <span className="line-clamp-1 text-xs text-slate-500">{s.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
