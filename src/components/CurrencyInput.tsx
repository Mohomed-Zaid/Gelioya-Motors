import { useState, useEffect, useRef } from 'react'
import { formatNumberInput, parseCurrencyInput } from '../lib/utils'

interface CurrencyInputProps {
  value: string
  onChange: (rawValue: string) => void
  placeholder?: string
  className?: string
  min?: number
  max?: number
  required?: boolean
  prefix?: string
  id?: string
  allowBlank?: boolean
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  min,
  max,
  required,
  prefix = 'Rs.',
  id,
  allowBlank,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatNumberInput(value))
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      if (allowBlank && (value === '' || value === undefined)) {
        setDisplayValue('')
      } else {
        setDisplayValue(formatNumberInput(value))
      }
    }
  }, [value, focused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (allowBlank && raw.trim() === '') {
      setDisplayValue('')
      onChange('')
      return
    }
    const formatted = formatNumberInput(raw)
    setDisplayValue(formatted)
    const numeric = parseCurrencyInput(formatted)
    onChange(String(numeric))
  }

  const handleBlur = () => {
    setFocused(false)
    if (allowBlank && (value === '' || value === undefined)) {
      setDisplayValue('')
      return
    }
    if (value !== '' && value !== undefined) {
      const num = parseCurrencyInput(value)
      if (!isNaN(num) && num > 0) {
        setDisplayValue(formatNumberInput(String(num)))
      }
    }
  }

  const handleFocus = () => {
    setFocused(true)
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={className}
        min={min}
        max={max}
        required={required}
      />
    </div>
  )
}
