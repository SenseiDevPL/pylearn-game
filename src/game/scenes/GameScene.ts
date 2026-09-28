import Phaser from 'phaser'
import type { GameCommand, Level, RunOutcome } from '../../types/index.ts'

const COLORS = {
  floor: 0x1e293b,
  wall: 0x475569,
  goal: 0x22c55e,
  player: 0x3b82f6,
  gridLine: 0x334155,
  item: 0xfbbf24,
} as const

interface Direction {
  x: number
  y: number
}

const DIRECTIONS: Record<string, Direction> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

const TURN_ORDER = ['up', 'right', 'down', 'left']

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private goalTile!: Phaser.GameObjects.Rectangle
  private playerGridX = 0
  private playerGridY = 0
  private facing = 'right'
  private level: Level | null = null
  private isAnimating = false
  private directionIndicator!: Phaser.GameObjects.Triangle
  private itemSprites: Map<string, Phaser.GameObjects.Arc> = new Map()
  private collectedItems: Set<string> = new Set()
  private tile = 64

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a')
  }

  private itemKey(x: number, y: number) {
    return `${x},${y}`
  }

  loadLevel(level: Level) {
    this.level = level
    this.children.removeAll()
    this.tweens.killAll()
    this.facing = 'right'
    this.isAnimating = false
    this.itemSprites.clear()
    this.collectedItems.clear()

    const { grid } = level
    const maxTileW = Math.floor((this.cameras.main.width - 20) / grid.width)
    const maxTileH = Math.floor((this.cameras.main.height - 20) / grid.height)
    this.tile = Math.min(maxTileW, maxTileH, 64)
    const TILE = this.tile
    const offsetX = (this.cameras.main.width - grid.width * TILE) / 2
    const offsetY = (this.cameras.main.height - grid.height * TILE) / 2

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const px = offsetX + x * TILE + TILE / 2
        const py = offsetY + y * TILE + TILE / 2
        const isWall = grid.walls.some((w) => w.x === x && w.y === y)

        this.add
          .rectangle(px, py, TILE - 2, TILE - 2, isWall ? COLORS.wall : COLORS.floor)
          .setStrokeStyle(1, COLORS.gridLine)
      }
    }

    const goalPx = offsetX + grid.goal.x * TILE + TILE / 2
    const goalPy = offsetY + grid.goal.y * TILE + TILE / 2
    this.goalTile = this.add.rectangle(goalPx, goalPy, TILE - 2, TILE - 2, COLORS.goal).setAlpha(0.6)

    this.tweens.add({
      targets: this.goalTile,
      alpha: { from: 0.4, to: 0.8 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    })

    if (grid.items) {
      for (const item of grid.items) {
        const ix = offsetX + item.x * TILE + TILE / 2
        const iy = offsetY + item.y * TILE + TILE / 2
        const sprite = this.add.circle(ix, iy, Math.max(5, TILE * 0.15), COLORS.item).setDepth(5)
        this.tweens.add({
          targets: sprite,
          scale: { from: 0.8, to: 1.2 },
          duration: 600,
          yoyo: true,
          repeat: -1,
        })
        this.itemSprites.set(this.itemKey(item.x, item.y), sprite)
      }
    }

    this.playerGridX = grid.playerStart.x
    this.playerGridY = grid.playerStart.y
    const startPx = offsetX + this.playerGridX * TILE + TILE / 2
    const startPy = offsetY + this.playerGridY * TILE + TILE / 2

    const pSize = TILE - Math.max(8, Math.round(TILE * 0.2))
    this.player = this.add.rectangle(startPx, startPy, pSize, pSize, COLORS.player).setDepth(10)

    const aSize = Math.max(5, Math.round(TILE * 0.15))
    this.directionIndicator = this.add
      .triangle(startPx, startPy, aSize, 0, -aSize, -aSize * 1.2, -aSize, aSize * 1.2, 0xffffff)
      .setDepth(11)
      .setAlpha(0.8)
    this.updateDirectionIndicator()
  }

  private updateDirectionIndicator() {
    if (!this.directionIndicator || !this.player) return
    this.directionIndicator.setPosition(this.player.x, this.player.y)
    const angles: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 }
    this.directionIndicator.setAngle(angles[this.facing] ?? 0)
  }

  private getOffset(): { x: number; y: number } {
    if (!this.level) return { x: 0, y: 0 }
    const T = this.tile
    return {
      x: (this.cameras.main.width - this.level.grid.width * T) / 2,
      y: (this.cameras.main.height - this.level.grid.height * T) / 2,
    }
  }

  async executeCommands(commands: GameCommand[]): Promise<RunOutcome> {
    if (!this.level || this.isAnimating) return 'goal'
    this.isAnimating = true

    for (const cmd of commands) {
      if (cmd.action === 'move') {
        const moved = await this.animateMove()
        if (!moved) {
          this.flashPlayer(0xef4444)
          this.isAnimating = false
          return 'wall'
        }
      } else if (cmd.action === 'turn') {
        const dir = (cmd.args.direction as string) ?? 'right'
        this.turn(dir)
        await this.delay(200)
      } else if (cmd.action === 'say') {
        this.showSpeech(cmd.args.text as string)
        await this.delay(1000)
      } else if (cmd.action === 'collect') {
        this.collectItem()
        await this.delay(300)
      }
    }

    this.isAnimating = false

    const { goal, items } = this.level.grid
    const atGoal = this.playerGridX === goal.x && this.playerGridY === goal.y
    const allCollected = !items || items.length === 0 || this.collectedItems.size >= items.length

    if (atGoal && allCollected) {
      this.celebrateWin()
      return 'win'
    }
    return atGoal ? 'items' : 'goal'
  }

  private collectItem() {
    const key = this.itemKey(this.playerGridX, this.playerGridY)
    const sprite = this.itemSprites.get(key)
    if (sprite && !this.collectedItems.has(key)) {
      this.collectedItems.add(key)
      this.tweens.add({
        targets: sprite,
        scale: 2,
        alpha: 0,
        y: sprite.y - 30,
        duration: 400,
        onComplete: () => sprite.destroy(),
      })
      this.showSpeech('+1')
    }
  }

  private animateMove(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.level) return resolve(false)

      const dir = DIRECTIONS[this.facing]
      const newX = this.playerGridX + dir.x
      const newY = this.playerGridY + dir.y
      const { grid } = this.level

      if (newX < 0 || newX >= grid.width || newY < 0 || newY >= grid.height) return resolve(false)
      if (grid.walls.some((w) => w.x === newX && w.y === newY)) return resolve(false)

      this.playerGridX = newX
      this.playerGridY = newY

      const offset = this.getOffset()
      const T = this.tile
      const targetX = offset.x + newX * T + T / 2
      const targetY = offset.y + newY * T + T / 2

      this.tweens.add({
        targets: [this.player, this.directionIndicator],
        x: targetX,
        y: targetY,
        duration: 300,
        ease: 'Power2',
        onComplete: () => resolve(true),
      })
    })
  }

  private turn(direction: string) {
    const idx = TURN_ORDER.indexOf(this.facing)
    if (direction === 'right') {
      this.facing = TURN_ORDER[(idx + 1) % 4]
    } else {
      this.facing = TURN_ORDER[(idx + 3) % 4]
    }
    this.updateDirectionIndicator()
  }

  private flashPlayer(color: number) {
    const original = COLORS.player
    this.player.setFillStyle(color)
    this.time.delayedCall(400, () => this.player.setFillStyle(original))
  }

  private showSpeech(text: string) {
    const bubble = this.add
      .text(this.player.x, this.player.y - 40, text, {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#1e293b',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.tweens.add({
      targets: bubble,
      y: bubble.y - 20,
      alpha: 0,
      duration: 1500,
      onComplete: () => bubble.destroy(),
    })
  }

  private celebrateWin() {
    for (let i = 0; i < 12; i++) {
      const particle = this.add
        .rectangle(
          this.player.x + Phaser.Math.Between(-20, 20),
          this.player.y + Phaser.Math.Between(-20, 20),
          6,
          6,
          Phaser.Display.Color.RandomRGB().color
        )
        .setDepth(15)

      this.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-80, 80),
        y: particle.y + Phaser.Math.Between(-100, -20),
        alpha: 0,
        scale: 0,
        duration: 800,
        delay: i * 50,
        onComplete: () => particle.destroy(),
      })
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve))
  }

  resetLevel() {
    if (this.level) this.loadLevel(this.level)
  }
}
