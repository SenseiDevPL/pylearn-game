export interface Level {
  id: number
  title: string
  description: string
  objective: string
  starterCode: string
  solution: string
  expectedCommands: string[]
  hints: string[]
  /** "Check the AI's code" mission: the starter code is an AI's buggy attempt. */
  ai?: boolean
  /** Reaching the goal isn't enough: the code must also use this (regex source). */
  requires?: { pattern: string; message: string }
  /** What print() must output, line by line (trimmed). */
  expectedOutput?: string
  /** Python-libraries this level needs, loaded on demand (e.g. pandas, matplotlib). */
  packages?: string[]
  /** Missing grid = a "Python w pracy" task: no board, judged by console output. */
  grid?: {
    width: number
    height: number
    playerStart: { x: number; y: number }
    goal: { x: number; y: number }
    walls: { x: number; y: number }[]
    items: { x: number; y: number }[]
  }
}

export interface ExecutionResult {
  success: boolean
  output: string
  error: string | null
  commands: GameCommand[]
  executionTime: number
  /** PNG (base64) of a matplotlib chart the code drew, if any. */
  image?: string
}

export interface GameCommand {
  action: string
  args: Record<string, unknown>
}

export type WorkerMessage =
  | { type: 'execute'; code: string; levelId: number }
  | { type: 'ready' }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; data: ExecutionResult }
  | { type: 'error'; message: string }

/** Why a run ended: reached the goal with everything collected, or what went wrong. */
export type RunOutcome = 'win' | 'wall' | 'items' | 'goal'

export type GameState = 'idle' | 'running' | 'success' | 'failure'
