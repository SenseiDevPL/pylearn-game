import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type Phaser from 'phaser'
import { createGame } from '../game/PhaserGame.ts'
import { GameScene } from '../game/scenes/GameScene.ts'
import type { GameCommand, Level } from '../types/index.ts'

export interface GameCanvasHandle {
  loadLevel: (level: Level) => void
  executeCommands: (commands: GameCommand[]) => Promise<boolean>
  resetLevel: () => void
}

export const GameCanvas = forwardRef<GameCanvasHandle>(function GameCanvas(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<GameScene | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const game = createGame(containerRef.current)
    gameRef.current = game

    game.events.on('ready', () => {
      sceneRef.current = game.scene.getScene('GameScene') as GameScene
    })

    return () => {
      game.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    loadLevel(level: Level) {
      const tryLoad = () => {
        const scene = gameRef.current?.scene.getScene('GameScene') as GameScene | undefined
        if (scene?.scene.isActive()) {
          sceneRef.current = scene
          scene.loadLevel(level)
        } else {
          setTimeout(tryLoad, 100)
        }
      }
      tryLoad()
    },
    async executeCommands(commands: GameCommand[]) {
      if (!sceneRef.current) return false
      return sceneRef.current.executeCommands(commands)
    },
    resetLevel() {
      sceneRef.current?.resetLevel()
    },
  }))

  return (
    <div
      ref={containerRef}
      className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-blue-500/5 touch-pan-y"
    />
  )
})
