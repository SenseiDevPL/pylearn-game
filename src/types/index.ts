export interface Level {
  id: number
  title: string
  description: string
  objective: string
  starterCode: string
  solution: string
  expectedCommands: string[]
  hints: string[]
  grid: {
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

export type GameState = 'idle' | 'running' | 'success' | 'failure'
