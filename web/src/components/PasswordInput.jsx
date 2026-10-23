import { useId, useState } from 'react'

/**
 * Input password dengan tombol show/hide (mata).
 * Reusable di semua form login/profil/lupa-password — aksesibel
 * (tombol punya aria-label + aria-pressed).
 */
export default function PasswordInput({
  value,
  onChange,
  id,
  name,
  autoComplete = 'current-password',
  placeholder,
  required = false,
  minLength,
  className = '',
}) {
  const [lihat, setLihat] = useState(false)
  const autoId = useId()
  const inputId = id || autoId

  return (
    <div className="relative">
      <input
        id={inputId}
        name={name}
        type={lihat ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        value={value}
        onChange={onChange}
        className={'w-full rounded-xl border-2 border-ink px-3 py-2 pr-12 focus-visible:outline-none ' + className}
      />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        aria-label={lihat ? 'Sembunyikan password' : 'Lihat password'}
        aria-pressed={lihat}
        title={lihat ? 'Sembunyikan password' : 'Lihat password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-bold text-gray-500 hover:text-ink"
      >
        {lihat ? '🙈' : '👁'}
      </button>
    </div>
  )
}
