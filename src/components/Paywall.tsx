interface PaywallProps {
  onUnlock: () => void
}

export function Paywall({ onUnlock }: PaywallProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl">
          &#9733;
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          Wersja demo ukończona!
        </h2>
        <p className="text-slate-400 mb-6">
          Przeszedłeś 5 darmowych poziomów. Odblokuj pełną wersję z 15 kolejnymi poziomami — warunki, pętle while, funkcje, listy, skarby, labirynty i wielki finał!
        </p>

        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-300 font-medium">PyLearn — pełna wersja</span>
            <span className="text-2xl font-bold text-slate-100">9 PLN</span>
          </div>
          <ul className="text-left text-sm text-slate-400 space-y-1.5">
            <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> 20 poziomów (zmienne, if, while, funkcje, listy, skarby)</li>
            <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> Labirynty, spirale i wielki finał</li>
            <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> Dożywotni dostęp</li>
            <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> Przyszłe aktualizacje za darmo</li>
          </ul>
        </div>

        <button
          onClick={onUnlock}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/20 text-lg mb-3"
        >
          Kup teraz — 9 PLN
        </button>

        <p className="text-slate-500 text-xs">
          Symulacja płatności (tryb testowy) — kliknięcie odblokuje pełną wersję.
        </p>
      </div>
    </div>
  )
}
