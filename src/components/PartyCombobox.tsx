import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, UserPlus, X } from 'lucide-react'
import type { Party } from '../types'

interface PartyComboboxProps {
  parties: Party[]
  value: string // customer/supplier name
  partyId: string | null
  onNameChange: (name: string) => void
  onPartySelect: (partyId: string | null, name: string) => void
  placeholder?: string
  label?: string
  required?: boolean
  className?: string
}

export function PartyCombobox({
  parties,
  value,
  partyId,
  onNameChange,
  onPartySelect,
  placeholder = 'Type to search or enter new name...',
  label = 'Customer / Party',
  required,
  className = '',
}: PartyComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(value.toLowerCase())
  )

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
      zIndex: 9999,
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setIsOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onNameChange(val)
    setIsOpen(val.length > 0)
    setHighlightIndex(-1)
  }

  const handleSelect = (party: Party) => {
    onPartySelect(party.id, party.name)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  const handleClear = () => {
    onPartySelect(null, '')
    setIsOpen(false)
    setHighlightIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filtered.length === 0) {
      if (e.key === 'ArrowDown' && parties.length > 0) {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          handleSelect(filtered[highlightIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightIndex(-1)
        break
    }
  }

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const selectedParty = partyId ? parties.find((p) => p.id === partyId) : null

  const dropdownContent = isOpen && (filtered.length > 0 || (value.length > 0 && filtered.length === 0))
    ? createPortal(
        <div style={dropdownStyle}>
          {filtered.length > 0 && (
            <ul
              ref={listRef}
              className="max-h-52 overflow-y-auto rounded-xl border border-emerald-900/40 bg-slate-900/95 backdrop-blur-sm shadow-xl shadow-black/30 py-1"
            >
              {filtered.map((party, index) => (
                <li key={party.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(party)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                      index === highlightIndex
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'text-slate-300 hover:bg-emerald-950/30'
                    } ${party.id === partyId ? 'bg-emerald-500/10' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-900/40 flex items-center justify-center text-xs font-bold text-emerald-300">
                      {party.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{party.name}</div>
                      {party.phone && (
                        <div className="text-xs text-slate-500">{party.phone}</div>
                      )}
                    </div>
                    {party.id === partyId && (
                      <span className="text-xs text-emerald-400 font-semibold">✓ Selected</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {value.length > 0 && filtered.length === 0 && (
            <div className="rounded-xl border border-emerald-900/40 bg-slate-900/95 backdrop-blur-sm shadow-xl shadow-black/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <UserPlus size={16} className="text-emerald-500" />
                <span>
                  No match found — <span className="text-emerald-300 font-medium">"{value}"</span> will be created as a new party
                </span>
              </div>
            </div>
          )}
        </div>,
        document.body
      )
    : null

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (value.length > 0 || parties.length > 0) {
              setIsOpen(true)
              updatePosition()
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-3 input-surface rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          required={required}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Selected party badge */}
      {selectedParty && !isOpen && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-800/30">
            <UserPlus size={12} />
            Linked: {selectedParty.name}
          </span>
          {selectedParty.phone && (
            <span className="text-xs text-slate-500">{selectedParty.phone}</span>
          )}
        </div>
      )}

      {dropdownContent}
    </div>
  )
}
