import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCanvas, type GameCanvasHandle } from './components/GameCanvas.tsx'
import { CodeEditor } from './components/CodeEditor.tsx'
import { LevelPanel } from './components/LevelPanel.tsx'
import { FeedbackOverlay } from './components/FeedbackOverlay.tsx'
import { usePyodide } from './hooks/usePyodide.ts'
import levelsData from './data/levels.json'
import type { GameState, Level } from './types/index.ts'

const levels = levelsData as Level[]

export default function App() {
  const gameRef = useRef<GameCanvasHandle>(null)
  const { execute, isReady, isRunning } = usePyodide()

  const [currentLevelIdx, setCurrentLevelIdx] = useState(0)
  const [code, setCode] = useState(levels[0].starterCode)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState('')
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  const [hintCount, setHintCount] = useState(0)
  const [showingSolution, setShowingSolution] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [folder, setFolder] = useState<string[] | null>(null)
  const [outbox, setOutbox] = useState<string[]>([])
  const [fetched, setFetched] = useState<string[]>([])

  const currentLevel = levels[currentLevelIdx]
  const isWorkTask = !currentLevel.grid

  useEffect(() => {
    gameRef.current?.loadLevel(currentLevel)
    setCode(currentLevel.starterCode)
    setGameState('idle')
    setError(null)
    setOutput('')
    setExecutionTime(null)
    setHintCount(0)
    setShowingSolution(false)
    setImage(null)
    setFolder(null)
    setOutbox([])
    setFetched([])
  }, [currentLevel])

  const handleRun = useCallback(async () => {
    if (!isReady || isRunning) return

    setGameState('running')
    setError(null)
    setOutput('')
    setImage(null)
    gameRef.current?.resetLevel()

    try {
      const result = await execute(code, currentLevel.id)
      setImage(result.image ?? null)
      setFolder(result.files ?? null)
      setOutbox(result.outbox ?? [])
      setFetched(result.requests ?? [])

      if (!result.success) {
        setGameState('failure')
        setError(result.error)
        setOutput(result.output)
        setExecutionTime(result.executionTime)
        return
      }

      setOutput(result.output)
      setExecutionTime(result.executionTime)

      if (isWorkTask) {
        const req = currentLevel.requires
        const expected = currentLevel.expectedOutput
        if (expected !== undefined && result.output.trim() !== expected) {
          setGameState('failure')
          setError(`W konsoli miało się wypisać:\n${expected}`)
        } else if (result.problems?.length) {
          setGameState('failure')
          setError(result.problems.join('\n\n'))
        } else if (req && !new RegExp(req.pattern).test(code)) {
          setGameState('failure')
          setError(`Wynik się zgadza, ale zadanie było inne: ${req.message}`)
        } else {
          setGameState('success')
        }
        return
      }

      if (result.commands.length === 0) {
        setGameState('failure')
        setError('Twój kod nie wydał żadnych komend. Użyj player.move() lub innych metod.')
        return
      }

      const outcome = await gameRef.current?.executeCommands(result.commands)
      if (outcome === 'win') {
        const req = currentLevel.requires
        if (req && !new RegExp(req.pattern).test(code)) {
          setGameState('failure')
          setError(`Gracz doszedł do celu, ale zadanie było inne: ${req.message}`)
          return
        }
        const expected = currentLevel.expectedOutput
        if (expected !== undefined && result.output.trim() !== expected) {
          setGameState('failure')
          setError(`Gracz doszedł do celu, ale w konsoli miało się wypisać:\n${expected}`)
          return
        }
      }
      setGameState(outcome === 'win' ? 'success' : 'failure')
      if (outcome === 'wall') {
        setError('Gracz uderzył w ścianę albo w krawędź planszy (mignął na czerwono). Sprawdź kierunek i liczbę kroków.')
      } else if (outcome === 'items') {
        setError('Gracz doszedł do celu, ale nie zebrał wszystkich skarbów. Pamiętaj o player.collect() na polu ze skarbem.')
      } else if (outcome === 'goal') {
        const moveCount = result.commands.filter(c => c.action === 'move').length
        setError(`Gracz przeszedł ${moveCount} pól, ale nie stanął na zielonym polu. Policz kroki jeszcze raz.`)
      }
    } catch (err) {
      setGameState('failure')
      setError(err instanceof Error ? err.message : 'Nieznany błąd')
    }
  }, [code, currentLevel, execute, isReady, isRunning, isWorkTask])

  const handleNextLevel = useCallback(() => {
    const nextIdx = currentLevelIdx + 1
    if (nextIdx >= levels.length) return
    setCurrentLevelIdx(nextIdx)
  }, [currentLevelIdx])

  const handleSelectLevel = useCallback((idx: number) => {
    setCurrentLevelIdx(idx)
  }, [])

  const handleShowSolution = useCallback(() => {
    setCode(currentLevel.solution)
    setShowingSolution(true)
  }, [currentLevel])

  const handleReset = useCallback(() => {
    setCode(currentLevel.starterCode)
    setGameState('idle')
    setError(null)
    setOutput('')
    setShowingSolution(false)
    setImage(null)
    setFolder(null)
    setOutbox([])
    setFetched([])
    gameRef.current?.resetLevel()
  }, [currentLevel])

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <header className="max-w-6xl mx-auto mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
              Py
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              PyLearn
            </h1>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isReady ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-700/50' : 'bg-amber-950/50 text-amber-400 border border-amber-700/50'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            {isReady ? 'Python gotowy' : 'Ładowanie Pythona...'}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {levels.map((l, i) => {
            return (
              <button
                key={l.id}
                onClick={() => handleSelectLevel(i)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  i === currentLevelIdx
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : i < currentLevelIdx
                      ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600/30'
                      : l.ai
                        ? 'bg-violet-950/60 text-violet-300 border border-violet-700/50'
                        : !l.grid
                          ? 'bg-amber-950/50 text-amber-300 border border-amber-700/50'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                }`}
                title={l.ai ? `🤖 ${l.title}` : !l.grid ? `💼 ${l.title}` : l.title}
              >
                {l.id}
              </button>
            )
          })}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <LevelPanel level={currentLevel} currentHint={hintCount} onShowHint={() => setHintCount((h) => Math.min(h + 1, currentLevel.hints.length))} onShowSolution={handleShowSolution} showingSolution={showingSolution} />
          <div className={isWorkTask ? 'hidden' : ''}>
            <GameCanvas ref={gameRef} />
          </div>
          {isWorkTask && (
            <div className="w-full aspect-[4/3] rounded-xl border border-slate-700/50 bg-slate-900/60 flex items-center justify-center overflow-hidden">
              {image ? (
                <img src={`data:image/png;base64,${image}`} alt="Wykres z twojego kodu" className="max-w-full max-h-full bg-white" />
              ) : currentLevel.pages ? (
                <div className="w-full h-full overflow-auto p-4 space-y-3 text-sm">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">🌐 Strony w (udawanym) internecie</div>
                  {Object.entries(currentLevel.pages).map(([url, page]) => (
                    <details key={url} className="bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <summary className="cursor-pointer px-3 py-2 font-mono text-sky-300 break-all">
                        {url}
                        {typeof page === 'object' && 'status' in page && <span className="text-red-400"> (błąd {page.status})</span>}
                      </summary>
                      <pre className="px-3 pb-3 text-xs text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-auto">
                        {typeof page === 'string' ? page : 'json' in page ? JSON.stringify(page.json, null, 2) : page.body}
                      </pre>
                    </details>
                  ))}
                  <div className="text-slate-500 text-xs">Kliknij adres, żeby zobaczyć źródło strony — tak jak „Zbadaj element” w przeglądarce.</div>
                  {fetched.length > 0 && (
                    <div>
                      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">📥 Twój kod pobrał</div>
                      {fetched.map((u, i) => (
                        <div key={i} className="font-mono text-xs text-slate-200 py-0.5 break-all">
                          {i + 1}. {u}
                          {!currentLevel.pages?.[u] && <span className="text-red-400"> → 404</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : currentLevel.files || currentLevel.expectedOutbox ? (
                <div className="w-full h-full overflow-auto p-4 space-y-4 font-mono text-sm">
                  {currentLevel.files && (
                    <div>
                      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 font-sans">
                        📁 Folder {folder ? 'po uruchomieniu' : 'przed uruchomieniem'}
                      </div>
                      {(folder ?? Object.keys(currentLevel.files).sort()).map((f) => (
                        <div key={f} className="text-slate-200 py-0.5">{f.includes('/') ? '📂 ' : '📄 '}{f}</div>
                      ))}
                      {(folder ?? Object.keys(currentLevel.files)).length === 0 && <div className="text-slate-500 italic">(pusty folder)</div>}
                    </div>
                  )}
                  {currentLevel.expectedOutbox && (
                    <div>
                      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 font-sans">📤 Wysłane maile</div>
                      {outbox.length === 0 ? (
                        <div className="text-slate-500 italic">(jeszcze nic nie wysłano)</div>
                      ) : (
                        outbox.map((m, i) => (
                          <div key={i} className="text-slate-200 py-1 border-b border-slate-800 break-all">✉️ {m}</div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : currentLevel.preview ? (
                <div className="w-full h-full overflow-auto p-4">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">📄 {currentLevel.preview.title}</div>
                  <table className="w-full text-sm font-mono border-collapse">
                    <thead>
                      <tr>
                        {currentLevel.preview.columns.map((c) => (
                          <th key={c} className="text-left text-amber-300 font-semibold border-b border-slate-600 px-2 py-1">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentLevel.preview.rows.map((row, i) => (
                        <tr key={i} className="odd:bg-slate-800/40">
                          {row.map((cell, j) => (
                            <td key={j} className="text-slate-200 px-2 py-1 whitespace-nowrap">{cell === '' ? <span className="text-slate-500 italic">(puste)</span> : cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {currentLevel.packages?.includes('matplotlib') && (
                    <div className="text-slate-500 text-xs mt-3">📊 Po uruchomieniu w tym miejscu pojawi się twój wykres.</div>
                  )}
                </div>
              ) : (
                <div className="text-center text-slate-500 text-sm px-6">
                  <div className="text-4xl mb-2">📊</div>
                  Tu pojawi się wykres, jeśli twój kod go narysuje.
                  <br />
                  Wynik liczb zobaczysz w konsoli pod edytorem.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <CodeEditor value={code} onChange={setCode} disabled={isRunning} />

          <div className="flex gap-3">
            <button
              onClick={handleRun}
              disabled={!isReady || isRunning}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
            >
              {isRunning ? 'Wykonuję...' : 'Uruchom kod'}
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors border border-slate-700/50"
            >
              Reset
            </button>
          </div>

          <FeedbackOverlay
            state={gameState}
            error={error}
            output={output}
            executionTime={executionTime}
            onNextLevel={handleNextLevel}
            isLastLevel={currentLevelIdx === levels.length - 1}
            slowFirstRun={!!currentLevel.packages?.length}
          />
        </div>
      </main>
    </div>
  )
}
