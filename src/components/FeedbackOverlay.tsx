import type { GameState } from '../types/index.ts'

interface FeedbackOverlayProps {
  state: GameState
  error: string | null
  output: string
  executionTime: number | null
  onNextLevel: () => void
  isLastLevel: boolean
}

export function FeedbackOverlay({ state, error, output, executionTime, onNextLevel, isLastLevel }: FeedbackOverlayProps) {
  if (state === 'idle') return null

  return (
    <div className="space-y-3">
      {state === 'running' && (
        <div className="bg-slate-800/80 rounded-lg px-4 py-3 border border-slate-700/50 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-300 text-sm">Wykonuję kod...</span>
        </div>
      )}

      {state === 'success' && (
        <div className="bg-emerald-950/50 rounded-lg px-4 py-3 border border-emerald-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-lg">&#10003;</span>
              <span className="text-emerald-300 font-medium">Brawo! Poziom ukończony!</span>
            </div>
            {!isLastLevel && (
              <button
                onClick={onNextLevel}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Następny poziom &rarr;
              </button>
            )}
          </div>
          {isLastLevel && (
            <div className="mt-3 bg-indigo-950/50 rounded-lg px-4 py-4 border border-indigo-700/50 text-center">
              <p className="text-indigo-300 font-bold text-lg">Gratulacje! Ukończyłeś PyLearn!</p>
              <p className="text-indigo-400/80 text-sm mt-1">Przeszedłeś wszystkie poziomy. Jesteś gotowy pisać prawdziwy kod w Pythonie!</p>
            </div>
          )}
          {executionTime !== null && (
            <span className="text-emerald-500/70 text-xs mt-1 block">
              Czas: {executionTime.toFixed(0)}ms
            </span>
          )}
        </div>
      )}

      {state === 'failure' && (
        <div className="bg-red-950/50 rounded-lg px-4 py-3 border border-red-700/50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 text-lg">&#10007;</span>
            <span className="text-red-300 font-medium">Nie udało się — spróbuj jeszcze raz!</span>
          </div>
          {error && (
            <pre className="text-red-400/80 text-xs font-mono mt-2 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
              {error}
            </pre>
          )}
        </div>
      )}

      {output && (
        <div className="bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Konsola</span>
          <pre className="text-slate-300 text-sm font-mono mt-1 whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  )
}
