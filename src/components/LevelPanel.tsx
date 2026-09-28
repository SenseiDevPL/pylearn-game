import type { Level } from '../types/index.ts'

interface LevelPanelProps {
  level: Level
  currentHint: number
  onShowHint: () => void
  onShowSolution: () => void
  showingSolution: boolean
}

export function LevelPanel({ level, currentHint, onShowHint, onShowSolution, showingSolution }: LevelPanelProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-3">
        <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
          #{level.id}
        </span>
        <h2 className="text-lg font-bold text-slate-100">{level.title}</h2>
      </div>
      <p className="text-slate-300 text-sm mb-3">{level.description}</p>
      <div className="bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-700/30">
        <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Cel</span>
        <p className="text-slate-200 text-sm mt-0.5">{level.objective}</p>
      </div>

      <div className="mt-3 flex items-center gap-4">
        {level.hints.length > 0 && (
          <button
            onClick={onShowHint}
            className="text-amber-400/80 hover:text-amber-300 text-xs font-medium transition-colors"
          >
            {currentHint < level.hints.length ? `Pokaż podpowiedź (${currentHint}/${level.hints.length})` : 'Wszystkie podpowiedzi pokazane'}
          </button>
        )}

        <button
          onClick={onShowSolution}
          className="text-rose-400/80 hover:text-rose-300 text-xs font-medium transition-colors"
        >
          {showingSolution ? 'Rozwiązanie wstawione do edytora' : 'Pokaż rozwiązanie'}
        </button>
      </div>

      {currentHint > 0 && (
        <div className="mt-2 space-y-1">
          {level.hints.slice(0, currentHint).map((hint, i) => (
            <p key={i} className="text-amber-300/70 text-xs pl-3 border-l-2 border-amber-500/30">
              {hint}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
