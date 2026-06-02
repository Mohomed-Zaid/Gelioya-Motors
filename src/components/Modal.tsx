import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
  wide?: boolean
}

export function Modal({ isOpen, onClose, title, children, maxWidth, wide }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative surface rounded-2xl w-full ${wide ? 'max-w-6xl' : (maxWidth || 'max-w-lg')} max-h-[90vh] overflow-y-auto animate-fade-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/30">
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-emerald-950/40 rounded-xl transition-colors"
          >
            <X size={18} className="text-slate-300" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
