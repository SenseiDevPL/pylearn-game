import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCanvas, type GameCanvasHandle } from './components/GameCanvas.tsx'
import { CodeEditor } from './components/CodeEditor.tsx'
import { LevelPanel } from './components/LevelPanel.tsx'
import { FeedbackOverlay } from './components/FeedbackOverlay.tsx'
import { LoginGate } from './components/LoginGate.tsx'
import { usePyodide } from './hooks/usePyodide.ts'
import levelsData from './data/levels.json'
import type { GameState, Level } from './types/index.ts'

const levels = levelsData as Level[]
const FREE_LEVELS = 5

function getStoredEmail(): string | null {
  return localStorage.getItem('pylearn_email')
}

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
  const [showLoginGate, setShowLoginGate] = useState(false)
  const [unlocked, setUnlocked] = useState(() => !!getStoredEmail())
  const [showingSolution, setShowingSolution] = useState(false)

  const currentLevel = levels[currentLevelIdx]

  useEffect(() => {
    gameRef.current?.loadLevel(currentLevel)
    setCode(currentLevel.starterCode)
    setGameState('idle')
    setError(null)
    setOutput('')
    setExecutionTime(null)
    setHintCount(0)
    setShowingSolution(false)
  }, [currentLevel])

  const handleRun = useCallback(async () => {
    if (!isReady || isRunning) return

    setGameState('running')
    setError(null)
    setOutput('')
    gameRef.current?.resetLevel()

    try {
      const result = await execute(code, currentLevel.id)

      if (!result.success) {
        setGameState('failure')
        setError(result.error)
        setOutput(result.output)
        setExecutionTime(result.executionTime)
        return
      }

      setOutput(result.output)
      setExecutionTime(result.executionTime)

      if (result.commands.length === 0) {
        setGameState('failure')
        setError('Twój kod nie wydał żadnych komend. Użyj player.move() lub innych metod.')
        return
      }

      const won = await gameRef.current?.executeCommands(result.commands)
      setGameState(won ? 'success' : 'failure')
      if (!won) {
        const moveCount = result.commands.filter(c => c.action === 'move').length
        setError(`Gracz przeszedł ${moveCount} pól ale nie dotarł do celu. Może potrzebujesz więcej player.move()?`)
      }
    } catch (err) {
      setGameState('failure')
      setError(err instanceof Error ? err.message : 'Nieznany błąd')
    }
  }, [code, currentLevel, execute, isReady, isRunning])

  const handleNextLevel = useCallback(() => {
    const nextIdx = currentLevelIdx + 1
    if (nextIdx >= levels.length) return

    if (nextIdx >= FREE_LEVELS && !unlocked) {
      setShowLoginGate(true)
      return
    }

    setCurrentLevelIdx(nextIdx)
  }, [currentLevelIdx, unlocked])

  const handleLogin = useCallback((email: string) => {
    localStorage.setItem('pylearn_email', email)
    setUnlocked(true)
    setShowLoginGate(false)
    setCurrentLevelIdx(FREE_LEVELS)
  }, [])

  const handleSelectLevel = useCallback((idx: number) => {
    if (idx >= FREE_LEVELS && !unlocked) {
      setShowLoginGate(true)
      return
    }
    setCurrentLevelIdx(idx)
  }, [unlocked])

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
    gameRef.current?.resetLevel()
  }, [currentLevel])

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      {showLoginGate && <LoginGate onLogin={handleLogin} onClose={() => setShowLoginGate(false)} />}

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
            const isLocked = i >= FREE_LEVELS && !unlocked
            return (
              <button
                key={l.id}
                onClick={() => handleSelectLevel(i)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  isLocked
                    ? 'bg-slate-800/50 text-slate-600 border border-slate-700/30 cursor-pointer'
                    : i === currentLevelIdx
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : i < currentLevelIdx
                        ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                }`}
                title={isLocked ? 'Zaloguj się aby odblokować' : l.title}
              >
                {isLocked ? '\u{1F512}' : l.id}
              </button>
            )
          })}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <LevelPanel level={currentLevel} currentHint={hintCount} onShowHint={() => setHintCount((h) => Math.min(h + 1, currentLevel.hints.length))} onShowSolution={handleShowSolution} showingSolution={showingSolution} />
          <GameCanvas ref={gameRef} />
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
          />
        </div>
      </main>
    </div>
  )
}
