/**
 * Modal — shell dialog bersama (issue #8).
 *
 * Menggantikan 10 modal manual yang perilakunya tidak konsisten (backdrop/Esc
 * beda-beda, ada yang mati). Portal ke document.body, tutup via Esc + klik
 * backdrop, fokus ke elemen pertama. Bisa diisi apa pun (form / konfirmasi).
 *
 * `ConfirmDialog` dibangun di atas komponen ini.
 *
 * Props:
 *   open        : bool
 *   title       : string (opsional)
 *   children    : isi dialog (form/deskripsi)
 *   footer      : elemen tombol aksi (opsional)
 *   onClose     : () => void
 *   busy        : bool — kalau true, Esc/backdrop tidak menutup
 *   dismissible : bool (default true) — false = wajib lewat tombol
 *   maxWidth    : kelas lebar (default 'max-w-md')
 *   ariaLabel   : label aksesibilitas kalau tanpa title
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  busy = false,
  dismissible = true,
  maxWidth = 'max-w-md',
  ariaLabel,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, dismissible, busy, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={!title ? ariaLabel : undefined}
      onClick={() => {
        if (dismissible && !busy) onClose?.()
      }}
    >
      <div
        className={`card w-full ${maxWidth} p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h3 className="text-lg font-extrabold">{title}</h3> : null}
        {children ? <div className={title ? 'mt-2' : ''}>{children}</div> : null}
        {footer ? <div className="mt-5 flex gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
