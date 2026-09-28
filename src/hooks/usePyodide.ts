import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExecutionResult, WorkerResponse } from '../types/index.ts'

export function usePyodide() {
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const resolveRef = useRef<((result: ExecutionResult) => void) | null>(null)
  const rejectRef = useRef<((err: Error) => void) | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../workers/PyodideWorker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data

      if (msg.type === 'ready') {
        setIsReady(true)
      } else if (msg.type === 'result') {
        setIsRunning(false)
        resolveRef.current?.(msg.data)
        resolveRef.current = null
        rejectRef.current = null
      } else if (msg.type === 'error') {
        setIsRunning(false)
        rejectRef.current?.(new Error(msg.message))
        resolveRef.current = null
        rejectRef.current = null
      }
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
    }
  }, [])

  const execute = useCallback(
    (code: string, levelId: number): Promise<ExecutionResult> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current || !isReady) {
          reject(new Error('Pyodide nie jest jeszcze gotowe'))
          return
        }
        setIsRunning(true)
        resolveRef.current = resolve
        rejectRef.current = reject
        workerRef.current.postMessage({ type: 'execute', code, levelId })
      })
    },
    [isReady]
  )

  return { execute, isReady, isRunning }
}
