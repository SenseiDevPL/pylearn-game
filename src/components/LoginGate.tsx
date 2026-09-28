import { useState } from 'react'

interface LoginGateProps {
  onLogin: (email: string) => void
  onClose: () => void
}

export function LoginGate({ onLogin, onClose }: LoginGateProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Wpisz poprawny adres email')
      return
    }

    setSending(true)
    setError('')

    try {
      await fetch('https://agent.senseidev.pl/webhook/pylearn-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, timestamp: new Date().toISOString() }),
      })
    } catch {
      // nie blokuj gry jeśli webhook nie odpowie
    }

    onLogin(trimmed)
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center">
          <svg viewBox="0 0 110 110" className="w-12 h-12">
            <defs>
              <linearGradient id="pyA" x1="12.96" y1="12.78" x2="52.74" y2="52.74" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#5A9FD4"/>
                <stop offset="1" stopColor="#306998"/>
              </linearGradient>
              <linearGradient id="pyB" x1="55.22" y1="57.23" x2="98.9" y2="97.08" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFD43B"/>
                <stop offset="1" stopColor="#FFE873"/>
              </linearGradient>
            </defs>
            <path d="M54.92 0C26.81 0 28.59 11.73 28.59 11.73l.03 12.16h26.81v3.65H17.68S0 25.26 0 53.58c0 28.32 15.4 27.31 15.4 27.31h9.2V68.22s-.5-15.4 15.15-15.4h26.08s14.66.24 14.66-14.17V14.84S82.83 0 54.92 0zm-14.5 8.57a4.73 4.73 0 110 9.46 4.73 4.73 0 010-9.46z" fill="url(#pyA)"/>
            <path d="M55.08 110c28.11 0 26.33-11.73 26.33-11.73l-.03-12.16H54.57v-3.65h37.75S110 84.74 110 56.42c0-28.32-15.4-27.31-15.4-27.31h-9.2v12.67s.5 15.4-15.15 15.4H44.17s-14.66-.24-14.66 14.17v23.81S27.17 110 55.08 110zm14.5-8.57a4.73 4.73 0 110-9.46 4.73 4.73 0 010 9.46z" fill="url(#pyB)"/>
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          Podoba Ci się? Graj dalej!
        </h2>
        <p className="text-slate-400 mb-6">
          Przeszedłeś 5 poziomów demo. Zarejestruj się aby odblokować wszystkie 20 poziomów — za darmo!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder="twoj@email.pl"
              autoFocus
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 text-lg"
          >
            {sending ? 'Odblokowuję...' : 'Odblokuj wszystkie poziomy'}
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-4 text-slate-500 hover:text-slate-400 text-sm transition-colors"
        >
          Wróć do demo
        </button>

        <p className="text-slate-600 text-xs mt-4">
          Bez spamu. Email tylko do kontaktu w sprawie gry.
        </p>
      </div>
    </div>
  )
}
