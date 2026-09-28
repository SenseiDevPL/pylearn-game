/// <reference lib="webworker" />

import type { ExecutionResult, GameCommand, Level, WorkerMessage, WorkerResponse } from '../types/index.ts'
import levelsData from '../data/levels.json'
import bridgeSource from './bridge.py?raw'
import officeSource from './office.py?raw'

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
const PACKAGE_IMPORTS: Record<string, string> = {
  pandas: 'import pandas',
  matplotlib: 'import matplotlib.pyplot',
  beautifulsoup4: 'import bs4',
}
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
  const level = levels.find((l) => l.id === levelId)
  const setup = {
    ...(level?.files && { files: level.files }),
    env: level?.env ?? {},
    ...(level?.expectedFiles && { expectedFiles: level.expectedFiles }),
    expectedFileContents: level?.expectedFileContents ?? {},
    ...(level?.expectedOutbox && { expectedOutbox: level.expectedOutbox }),
    ...(level?.pages && { pages: level.pages }),
    ...(level?.expectedRequests && { expectedRequests: level.expectedRequests }),
  }
  return (
    `_LEVEL_JSON = ${JSON.stringify(JSON.stringify(level?.grid ?? NO_BOARD))}\n_level_id = ${levelId}\n` +
    `_SETUP_JSON = ${JSON.stringify(JSON.stringify(setup))}\n_WORKDIR = "/home/pyodide/praca"\n` +
    bridgeSource +
    '\n' +
    officeSource
  )
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
    "image": _image,
    "files": _workspace_files(),
    "outbox": [_mail_line(m) for m in _outbox],
    "requests": _requests_log,
    "problems": _verify()
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
    return `Nie ma kolumny (ani klucza) o nazwie '${m[1]}' — zajrzyj do danych i sprawdź nazwę litera po literze (też spacje!).`
  if ((m = last.match(/ValueError: could not convert string to float: '([^']*)'/)))
    return `Nie da się zamienić tekstu '${m[1]}' na liczbę — usuń z niego spacje i „zł”, a przecinek zamień na kropkę (albo to pusty wpis).`
  if ((m = last.match(/NameError: name '(\w+)' is not defined/)))
    return `Nie znam nazwy ${m[1]} — literówka albo zmienna nie została utworzona.`
  if (/_TOO_MANY_COMMANDS/.test(last))
    return 'Za dużo ruchów (ponad 1000) — prawdopodobnie pętla, która nigdy się nie kończy.'
  if ((m = last.match(/AssertionError:?\s*(.*)/)))
    return `Test nie przeszedł${m[1] ? `: ${m[1]}` : ''} — funkcja oddaje inny wynik, niż test się spodziewa.`
  if (/day is out of range for month|must be in range \S+ for month/.test(last))
    return 'Taki dzień nie istnieje w tym miesiącu (np. 43 września). Do dat dodaje się dni przez timedelta(days=...).'
  if (/Invalid isoformat string|does not match format/.test(last))
    return 'Data jest zapisana inaczej, niż kod zakłada (np. 20.09.2026 zamiast 2026-09-20). Polskie daty czyta się przez datetime.strptime(tekst, "%d.%m.%Y").'
  if ((m = last.match(/HTTPError: (\d+)/)))
    return `Strona odpowiedziała błędem ${m[1]} — nie działa albo nie ma jej pod tym adresem.`
  if (/(min|max)\(\) (arg is an empty sequence|iterable argument is empty)/.test(last))
    return 'Szukasz najmniejszej/największej wartości w PUSTEJ liście — kod niczego nie znalazł na stronie. Sprawdź, czego szukasz.'
  if (/SMTPAuthenticationError/.test(last))
    return 'Serwer poczty odrzucił login albo hasło — hasło jest złe albo nieaktualne.'
  if ((m = last.match(/FileNotFoundError: .*?'([^']+)'/)))
    return `Nie ma takiego pliku ani folderu: ${m[1]} — sprawdź nazwę i to, gdzie on leży.`
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
      files: string[] | null
      outbox: string[]
      requests: string[]
      problems: string[]
    }

    const executionTime = performance.now() - startTime

    return {
      success: true,
      output: parsed.output,
      error: null,
      commands: parsed.commands,
      executionTime,
      image: parsed.image || undefined,
      files: parsed.files,
      outbox: parsed.outbox,
      requests: parsed.requests,
      problems: parsed.problems,
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
