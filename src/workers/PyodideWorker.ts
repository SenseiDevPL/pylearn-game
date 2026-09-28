/// <reference lib="webworker" />

import type { ExecutionResult, GameCommand, Level, WorkerMessage, WorkerResponse } from '../types/index.ts'
import levelsData from '../data/levels.json'
import bridgeSource from './bridge.py?raw'

declare const self: DedicatedWorkerGlobalScope

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/'
const EXECUTION_TIMEOUT_MS = 5000

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
}

let pyodide: PyodideInterface | null = null

function postMsg(msg: WorkerResponse) {
  self.postMessage(msg)
}

async function initPyodide() {
  try {
    const mod = await import(/* @vite-ignore */ `${PYODIDE_CDN}pyodide.mjs`)
    pyodide = await mod.loadPyodide({ indexURL: PYODIDE_CDN }) as PyodideInterface
    postMsg({ type: 'ready' })
  } catch (err) {
    postMsg({ type: 'error', message: `Nie udało się załadować Pyodide: ${err}` })
  }
}

const levels = levelsData as Level[]

// bridge.py defines `player` and simulates the board; it reads the level's
// grid from _LEVEL_JSON (a JSON string is also a valid Python string literal).
function buildPythonBridge(levelId: number): string {
  const grid = levels.find((l) => l.id === levelId)?.grid ?? levels[0].grid
  return `_LEVEL_JSON = ${JSON.stringify(JSON.stringify(grid))}\n_level_id = ${levelId}\n` + bridgeSource
}

const RESULT_EXTRACTOR = `
_json.dumps({
    "commands": _commands,
    "output": "\\n".join(_output_lines)
})
`

// Common Python errors, said plainly in Polish; the rest stays as-is.
function explainPythonError(raw: string, fallback: string): string {
  const last = raw.trim().split('\n').filter(Boolean).pop() ?? raw
  let m: RegExpMatchArray | null
  if ((m = last.match(/AttributeError: '_Player' object has no attribute '(\w+)'/)))
    return `Gracz nie zna komendy player.${m[1]}() — taka komenda nie istnieje. Dostępne: move, turn_left, turn_right, collect, say.`
  if ((m = last.match(/NameError: name '(\w+)' is not defined/)))
    return `Nie znam nazwy ${m[1]} — literówka albo zmienna nie została utworzona.`
  if (/_TOO_MANY_COMMANDS/.test(last))
    return 'Za dużo ruchów (ponad 1000) — prawdopodobnie pętla, która nigdy się nie kończy.'
  if (/IndentationError/.test(last))
    return 'Złe wcięcie — linijki w środku pętli, if albo funkcji muszą mieć tyle samo spacji na początku.'
  if (/SyntaxError/.test(last))
    return `Błąd pisowni kodu (sprawdź dwukropki, nawiasy i cudzysłowy). Python mówi: ${last}`
  if (/TypeError: 'NoneType'/.test(last))
    return 'Coś jest puste (None) — np. funkcja nie oddała wyniku przez return.'
  if ((m = last.match(/TypeError: (.*)/)))
    return `Zły typ danych: ${m[1]}`
  return fallback
}

async function executeCode(code: string, levelId: number): Promise<ExecutionResult> {
  if (!pyodide) throw new Error('Pyodide nie jest gotowe')

  const startTime = performance.now()
  const bridgeCode = buildPythonBridge(levelId)

  try {
    const fullCode = bridgeCode + `\n_run(${JSON.stringify(code)})\n` + RESULT_EXTRACTOR

    const resultPromise = pyodide.runPythonAsync(fullCode)

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT: Kod wykonywał się dłużej niż 5 sekund. Sprawdź pętle.')), EXECUTION_TIMEOUT_MS)
    )

    const rawResult = await Promise.race([resultPromise, timeoutPromise])
    const parsed = JSON.parse(rawResult as string) as {
      commands: GameCommand[]
      output: string
    }

    const executionTime = performance.now() - startTime

    return {
      success: true,
      output: parsed.output,
      error: null,
      commands: parsed.commands,
      executionTime,
    }
  } catch (err) {
    const executionTime = performance.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)

    const cleanError = errorMsg
      .split('\n')
      .filter((line) => !line.includes('_commands') && !line.includes('_Player'))
      .join('\n')

    return {
      success: false,
      output: '',
      error: explainPythonError(errorMsg, cleanError),
      commands: [],
      executionTime,
    }
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data

  if (msg.type === 'execute') {
    try {
      const result = await executeCode(msg.code, msg.levelId)
      postMsg({ type: 'result', data: result })
    } catch (err) {
      postMsg({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }
}

initPyodide()
