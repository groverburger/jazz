/** @module thing */

import * as u from './utils.js'
import * as game from './game.js'

/**
 * Things make up the functionality of a scene. They can be either
 * concrete such as a duck, enemy, or player, or abstract such as a
 * score keeper.
 */
export default class Thing {
  sprite = null
  rotation = 0
  scale = [1, 1]
  depth = 0 // Drawn in ascending depth order
  position = [0, 0]
  velocity = [0, 0]
  aabb = [-32, -32, 32, 32]
  contactDirections = {
    left: false,
    right: false,
    up: false,
    down: false
  }

  isOverlapEnabled = true
  isSolid = false
  animations = {
    idle: { frames: [0], speed: 0, frameSize: 64 }
  }

  animation = 'idle'
  #lastAnimation = 'idle'
  animationIndex = 0
  #timers = {}
  isPersistent = false
  isDead = false
  isPaused = false

  update () {
    this.updateTimers()
    this.move()
    this.animate()
  }

  preDraw () {}

  draw () {
    this.drawSprite()
  }

  postDraw () {}

  onDeath () {}

  onUnload () {}

  setTimer (time, action, name = crypto.randomUUID()) {
    this.#timers[name] = { time, start: time, action }
  }

  getTimerStartingTime (name) {
    if (!this.#timers[name]) return Infinity
    return this.#timers[name].start
  }

  getTimerAction (name) {
    if (!this.#timers[name]) return null
    return this.#timers[name].action
  }

  isTimerActive (name) {
    return name in this.#timers
  }

  getTimerFrames (name) {
    if (!this.#timers[name]) return 0
    return this.#timers[name].start - this.#timers[name].time
  }

  getTimer (name) {
    if (!this.#timers[name]) return 0
    return 1 - this.#timers[name].time / this.#timers[name].start
  }

  cancelTimer (name) {
    if (this.#timers[name]) {
      delete this.#timers[name]
      return true
    }
    return false
  }

  updateTimers () {
    for (const [name, value] of Object.entries(this.#timers)) {
      value.time -= 1

      // Execute action after deleting timer, in case of timer restart
      if (value.time <= 0) {
        delete this.#timers[name]
        if (typeof value.action === 'function') {
          value.action()
        }
      }
    }
  }

  animate () {
    const anim = this.animations[this.animation] || this.animations.idle

    // Option to restart the animation on change
    if (this.animation !== this.#lastAnimation && anim.restart) {
      this.animationIndex = 0
    }
    this.#lastAnimation = this.animation

    this.animationIndex += anim.speed ?? 0

    // Option to not repeat the animation
    if (anim.noRepeat) {
      this.animationIndex = Math.min(this.animationIndex, anim.frames.length - 1)
    } else {
      this.animationIndex %= anim.frames.length
    }
  }

  drawSprite (x = this.position[0], y = this.position[1], xOffset = 0, yOffset = 0) {
    const anim = this.animations[this.animation] || this.animations.idle || { frames: [0] }
    const frame = anim.frames[Math.floor(this.animationIndex) % anim.frames.length]
    const { ctx } = game

    ctx.save()
    ctx.translate(x, y)
    if (typeof this.scale === 'number') {
      ctx.scale(this.scale, this.scale)
    } else {
      ctx.scale(...this.scale)
    }
    ctx.rotate(this.rotation)
    ctx.translate(xOffset, yOffset)
    this.drawSpriteFrame(this.sprite, frame, anim.frameSize || 64)
    ctx.restore()
  }

  drawSpriteFrame (sprite, frame = 0, frameSize = 64) {
    if (!sprite) return
    const { ctx } = game
    if (typeof sprite === 'string') {
      sprite = game.assets.images[sprite]
    }
    ctx.translate(-frameSize / 2, -frameSize / 2)
    const framePosition = frame * frameSize
    ctx.drawImage(
      sprite,
      framePosition % sprite.width,
      Math.floor(framePosition / sprite.width) * frameSize,
      frameSize,
      frameSize,
      0,
      0,
      frameSize,
      frameSize
    )
  }

  move (dx = this.velocity[0], dy = this.velocity[1], stepSize = 1) {
    for (const key in this.contactDirections) {
      this.contactDirections[key] = false
    }

    const { sign } = u
    const movementPushback = 0.0001

    while (Math.round(dx * 1000)) {
      const step = sign(dx) * Math.min(Math.abs(dx), stepSize)
      if (this.checkCollision(this.position[0] + step, this.position[1])) {
        this.velocity[0] = 0
        this.position[0] = (
          Math.round(this.position[0]) - sign(dx) * movementPushback
        )
        if (sign(dx) > 0) this.contactDirections.right = true
        if (sign(dx) < 0) this.contactDirections.left = true
        break
      }
      this.position[0] += step
      dx -= step
    }

    while (Math.round(dy * 1000)) {
      const step = sign(dy) * Math.min(Math.abs(dy), stepSize)
      if (this.checkCollision(this.position[0], this.position[1] + step)) {
        this.velocity[1] = 0
        this.position[1] = (
          Math.round(this.position[1]) - sign(dy) * movementPushback
        )
        if (sign(dy) > 0) this.contactDirections.down = true
        if (sign(dy) < 0) this.contactDirections.up = true
        break
      }
      this.position[1] += step
      dy -= step
    }
  }

  isOverlapping (thing, x = this.position[0], y = this.position[1], z = this.position[2]) {
    return (
      thing &&
      thing !== this &&
      thing.isOverlapEnabled &&
      !thing.isDead &&
      u.checkAabbIntersection(
        this.aabb,
        thing.aabb,
        [x, y, z],
        thing.position
      )
    )
  }

  getFirstOverlap (x = this.position[0], y = this.position[1], z = this.position[2]) {
    return (
      game.getThingsNearXywh(
        x + this.aabb[0],
        y + this.aabb[1],
        this.aabb[2] - this.aabb[0],
        this.aabb[3] - this.aabb[1]
      ).find(thing => this.isOverlapping(thing, x, y, z))
    )
  }

  getAllOverlaps (x = this.position[0], y = this.position[1], z = this.position[2]) {
    return (
      game.getThingsNearXywh(
        x + this.aabb[0],
        y + this.aabb[1],
        this.aabb[2] - this.aabb[0],
        this.aabb[3] - this.aabb[1]
      ).filter(thing => this.isOverlapping(thing, x, y, z))
    )
  }

  checkCollision (x = this.position[0], y = this.position[1], z = this.position[2]) {
    for (const thing of this.getAllOverlaps(x, y, z)) {
      if (thing.isSolid) {
        return true
      }
    }
    return false
  }
}
