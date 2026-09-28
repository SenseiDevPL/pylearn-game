/// <reference lib="webworker" />

import type { ExecutionResult, GameCommand, Level, WorkerMessage, WorkerResponse } from '../types/index.ts'
import levelsData from '../data/levels.json'
import bridgeSource from './bridge.py?raw'

declare const self: DedicatedWorkerGlobalScope

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/'
const EXECUTION_TIMEOUT_MS = 5000

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string[]) => Promise<unknown>
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

// "Python w pracy" tasks have no board; the bridge still needs one.
const NO_BOARD = { width: 1, height: 1, playerStart: { x: 0, y: 0 }, goal: { x: 0, y: 0 }, walls: [], items: [] }

// Importing pandas takes seconds in Pyodide; do it before the run timer starts.
const PACKAGE_IMPORTS: Record<string, string> = { pandas: 'import pandas', matplotlib: 'import matplotlib.pyplot' }
const loadedPackages = new Set<string>()

async function ensurePackages(names: string[]) {
  const missing = names.filter((n) => !loadedPackages.has(n))
  if (!pyodide || missing.length === 0) return
  await pyodide.loadPackage(missing)
  for (const n of missing) {
    await pyodide.runPythonAsync(`import os; os.environ["MPLBACKEND"] = "AGG"\n${PACKAGE_IMPORTS[n] ?? `import ${n}`}`)
    loadedPackages.add(n)
  }
}

// bridge.py defines `player` and simulates the board; it reads the level's
// grid from _LEVEL_JSON (a JSON string is also a valid Python string literal).
function buildPythonBridge(levelId: number): string {
  const grid = levels.find((l) => l.id === levelId)?.grid ?? NO_BOARD
  return `_LEVEL_JSON = ${JSON.stringify(JSON.stringify(grid))}\n_level_id = ${levelId}\n` + bridgeSource
}

const RESULT_EXTRACTOR = `
_image = ""
import sys as _sys
if "matplotlib.pyplot" in _sys.modules:
    import matplotlib.pyplot as _plt, io as _io, base64 as _b64
    if _plt.get_fignums():
        _buf = _io.BytesIO()
        _plt.savefig(_buf, format="png", dpi=90, bbox_inches="tight")
        _plt.close("all")
        _image = _b64.b64encode(_buf.getvalue()).decode()
_json.dumps({
    "commands": _commands,
    "output": "\\n".join(_output_lines),
    "image": _image
})
`

// Common Python errors, said plainly in Polish; the rest stays as-is.
function explainPythonError(raw: string, fallback: string): string {
  const last = raw.trim().split('\n').filter(Boolean).pop() ?? raw
  let m: RegExpMatchArray | null
  if ((m = last.match(/AttributeError: '_Player' object has no attribute '(\w+)'/)))
    return `Gracz nie zna komendy player.${m[1]}() — taka komenda nie istnieje. Dostępne: move, turn_left, turn_right, collect, say.`
  if ((m = last.match(/AttributeError: '(\w+)' object has no attribute '(\w+)'/)))
    return `${m[1]} nie ma czegoś takiego jak ${m[2]} — AI mogło to zmyślić albo pomylić z inną biblioteką. Sprawdź nazwę.`
  if ((m = last.match(/KeyError: '?(?:Column not found: )?([^']*)'?/)))
    return `Nie ma kolumny (ani klucza) o nazwie ${m[1]} — zajrzyj do danych i sprawdź nazwę litera po literze.`
  if ((m = last.match(/ValueError: could not convert string to float: '([^']*)'/)))
    return `Nie da się zamienić tekstu '${m[1]}' na liczbę — sprawdź dane (przecinek zamiast kropki? pusty wpis?).`
  if ((m = last.match(/NameError: name '(\w+)' is not defined/)))
    return `Nie znam nazwy ${m[1]} — literówka albo zmienna nie została utworzona.`
  if (/_TOO_MANY_COMMANDS/.test(last))
    return 'Za dużo ruchów (ponad 1000) — prawdopodobnie pętla, która nigdy się nie kończy.'
  if (/IndentationError/.test(last))
    return 'Złe wcięcie — linijki w środku pętli, if albo funkcji muszą mieć tyle samo spacji na początku.'
  if (/SyntaxError/.test(last))
    return `Błąd pisowni kodu (sprawdź dwukropki, nawiasy i cudzysłowy). Python mówi: ${last}`
  if (/TypeError: unsupported operand type\(s\) for \+: '(int|float)' and 'str'|can only concatenate str/.test(last))
    return 'Nie da się dodać liczby i tekstu — tekst trzeba najpierw zamienić na liczbę: float(...) albo int(...).'
  if (/TypeError: 'NoneType'/.test(last))
    return 'Coś jest puste (None) — np. funkcja nie oddała wyniku przez return.'
  if ((m = last.match(/TypeError: (.*)/)))
    return `Zły typ danych: ${m[1]}`
  return fallback
}

async function executeCode(code: string, levelId: number): Promise<ExecutionResult> {
  if (!pyodide) throw new Error('Pyodide nie jest gotowe')

  await ensurePackages(levels.find((l) => l.id === levelId)?.packages ?? [])
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
      image: string
    }

    const executionTime = performance.now() - startTime

    return {
      success: true,
      output: parsed.output,
      error: null,
      commands: parsed.commands,
      executionTime,
      image: parsed.image || undefined,
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
