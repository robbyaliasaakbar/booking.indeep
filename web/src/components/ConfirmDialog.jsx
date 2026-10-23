/**
 * ConfirmDialog — dialog konfirmasi bersama (issue #8), di atas `Modal.jsx`.
 *
 * Menggantikan 10 modal konfirmasi manual yang perilakunya tidak konsisten
 * (backdrop/Esc beda-beda, window.confirm).
 *
 * Props:
 *   open        : bool
 *   title       : string/judul
 *   children    : isi dialog (deskripsi)
 *   confirmLabel: label tombol utama (default 'Ya')
 *   cancelLabel : label tombol batal (default 'Batal')
 *   onConfirm   : () => void
 *   onCancel    : () => void
 *   busy        : bool (tombol utama disabled + 'Memproses…')
 *   variant     : 'default' | 'destructive'
 *   dismissible : bool (default true) — false = wajib pakai tombol
 */

import { useEffect, useRef } from 'react'
import Modal from './Modal.jsx'

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Ya',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  busy = false,
  variant = 'default',
  dismissible = true,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  const confirmClass =
    variant === 'destructive'
      ? 'btn border-red-700 bg-red-600 text-white hover:bg-red-700'
      : 'btn btn-cta'

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      busy={busy}
      dismissible={dismissible}
      footer={
        <>
          <button
            ref={confirmRef}
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`${confirmClass} py-2`}
          >
            {busy ? 'Memproses…' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel?.()}
            className="btn btn-ghost py-2"
          >
            {cancelLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
