import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.ts'
import { GameScene } from './scenes/GameScene.ts'

export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 480,
    height: 360,
    parent,
    backgroundColor: '#0f172a',
    scene: [BootScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    input: {
      touch: {
        capture: false,
      },
    },
  }

  return new Phaser.Game(config)
}
