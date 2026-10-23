/**
 * Banner — pesan error/success/info tunggal (issue #8 Batch 2).
 *
 * Menggantikan banner yang dulu ditulis manual dengan 2 gaya berbeda di ~15 file.
 * Tetap statis (muncul sampai state direset oleh pemanggil) — sesuai keputusan
 * Bang Rob: seragamkan visual dulu, auto-dismiss toast menyusul terpisah.
 *
 * Props:
 *   variant   : 'error' | 'success' | 'info' | 'warning' (default 'error')
 *   children  : isi pesan (string/elemen)
 *   className : kelas tambahan (mis. margin)
 *   onClose   : opsional — kalau diisi, tampil tombol tutup (×)
 *   action    : opsional — elemen tambahan di bawah pesan (mis. tombol Coba lagi)
 *   role      : override role ARIA (default: error→alert, lainnya→status)
 */

const VARIANTS = {
  error: 'bg-red-100',
  success: 'bg-green-100',
  info: 'bg-blue-100',
  warning: 'bg-amber-100',
}

export default function Banner({ variant = 'error', children, className = '', onClose, action, role }) {
  if (!children) return null
  const ariaRole = role ?? (variant === 'error' ? 'alert' : 'status')

  return (
    <div
      role={ariaRole}
      className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold ${VARIANTS[variant] || VARIANTS.error} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span>{children}</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pesan"
            className="shrink-0 font-extrabold leading-none"
          >
            ×
          </button>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
