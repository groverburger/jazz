/** @module scene */

import SpatialHash from './spatialhash.js'
import Thing from './thing.js'
import * as game from './game.js'
import * as gfx from './webgl.js'
import * as u from './utils.js'
import * as vec2 from './vector2.js'
import * as mat from './matrices.js'
import * as vec3 from './vector3.js'

/**
 * Class representing a game Scene.
 * Scenes manage all the currently active Things in the game.
 * Scenes should never be directly created or managed by the user, only through the game module.
 */
export default class Scene {
  things = []
  layers = {}
  layerOrder = []
  depthMemory = new WeakMap()

  camera2D = {
    position: [game.getWidth() / 2, game.getHeight() / 2],
    rotation: 0,
    scale: [1, 1]
  }

  camera3D = {
    position: [0, 0, 0],
    fov: Math.PI / 2,
    near: 1,
    far: 100_000,
    lookVector: [1, 0, 0],
    upVector: [0, 0, 1],
    rightHanded: false,
    viewMatrix: mat.getView(),
    projectionMatrix: mat.getPerspective(),
    setUniforms () {
      gfx.set('viewMatrix', this.viewMatrix)
      gfx.set('projectionMatrix', this.projectionMatrix)
    },
    updateMatrices () {
      this.projectionMatrix = mat.getPerspective({
        aspect: game.getWidth() / game.getHeight(),
        fov: this.fov,
        near: this.near,
        far: this.far,
        rightHanded: this.rightHanded
      })
      this.viewMatrix = mat.getView({
        position: this.position,
        target: vec3.add(this.position, this.lookVector),
        up: this.upVector
      })
      this.setUniforms()
    }
  }

  spatialHash = new SpatialHash()
  screenShakes = []

  /** Things can assign themselves to this object so that other things
   * in the scene can reference them by name things are automatically
   * culled from this object when they die */
  namedThings = {}

  update () {
    // update all things in the scene
    let i = 0
    while (i < this.things.length) {
      const thing = this.things[i]

      if (!thing.isDead && !thing.isPaused) {
        thing.update()
      }

      if (thing.isDead) {
        // This thing died, so remove it from depth layers, spatial hash, and list
        thing.onDeath()
        const layer = this.layers[Math.round(this.depthMemory.get(thing)) || 0]
        if (layer) layer.splice(layer.indexOf(thing), 1)
        this.spatialHash.remove(thing)
        this.depthMemory.delete(thing)

        // We don't have to increment the index, as the other things "fall into"
        // this thing's current slot
        this.things.splice(i, 1)
      } else {
        // If depth changed, update render order
        if (this.depthMemory.get(thing) !== thing.depth) {
          this.updateDepth(thing)
        }

        // If position changed, update Thing's hitbox in spatial hash
        const [xLast, yLast] = this.spatialHash.getHitbox(thing)
        if (xLast !== thing.position[0] + thing.aabb[0] || yLast !== thing.position[1] + thing.aabb[1]) {
          this.spatialHash.update(thing, ...u.aabbToXywh(u.aabb2D(thing.aabb), thing.position))
        }

        i += 1
      }
    }

    // Make sure all named things are still alive
    // otherwise remove them from the object
    for (const name in this.namedThings) {
      if (this.namedThings[name].isDead) {
        delete this.namedThings[name]
      }
    }

    // Handle screenshake
    i = 0
    while (i < this.screenShakes.length) {
      const shake = this.screenShakes[i]
      if (shake.amount) {
        shake.vector = vec2.angleToVector(u.random(0, Math.PI * 2), shake.strength)
        shake.amount -= 1
        i += 1
      } else {
        this.screenShakes.splice(i, 1)
      }
    }
  }

  draw () {
    const { ctx } = game
    ctx.save()

    // Draw screenshakes, and black offscreen border to cover up gaps
    let xShake = 0
    let yShake = 0
    for (const shake of this.screenShakes) {
      xShake += shake.vector[0]
      yShake += shake.vector[1]
    }
    if (xShake !== 0 || yShake !== 0) {
      ctx.translate(Math.round(xShake), Math.round(yShake))
    }

    for (const layer of this.layerOrder) {
      for (const thing of this.layers[layer]) {
        thing.preDraw()
      }
    }

    const camera = this.camera2D
    const width = game.getWidth()
    const height = game.getHeight()
    ctx.save()

    ctx.translate(width / 2, height / 2)
    ctx.scale(...camera.scale)
    ctx.rotate(camera.rotation)
    ctx.translate(-Math.round(camera.position[0]), -Math.round(camera.position[1]))

    for (const layer of this.layerOrder) {
      for (const thing of this.layers[layer]) {
        thing.draw()
      }
    }

    ctx.restore()

    for (const layer of this.layerOrder) {
      for (const thing of this.layers[layer]) {
        thing.postDraw()
      }
    }

    // Draw black bars around screen from screenshake
    ctx.save()
    ctx.fillStyle = 'black'
    const s = Math.abs(xShake) + Math.abs(yShake) + 4
    ctx.fillRect(-s, -s, width + s * 2, s)
    ctx.fillRect(-s, height, width + s * 2, s)
    ctx.fillRect(-s, 0, s, height)
    ctx.fillRect(width, 0, s, height)
    ctx.restore()

    ctx.restore()
  }

  clearScreen () {
    const width = game.getWidth()
    const height = game.getHeight()
    const { ctx } = game
    if (document.querySelector('#canvas3D')) {
      // Webgl is enabled, so fill color on the webgl canvas instead of the 2d canvas
      gfx.clearScreen()

      // Clear the 2d canvas
      ctx.clearRect(0, 0, width, height)
    } else {
      // No webgl, fill the 2d canvas with background color
      ctx.fillStyle = '#4488ff'
      ctx.fillRect(0, 0, width, height)
    }
  }

  // Adds the given object instance to the thing list
  addThing(thing) {
    if (!(thing instanceof Thing)) {
      throw new Error('Trying to add non-Thing!')
    }
    this.things.push(thing)
    this.spatialHash.add(thing, ...u.aabbToXywh(u.aabb2D(thing.aabb), thing.position))
    this.updateDepth(thing, 0)
    return thing
  }

  // Update the depth of a thing from one layer to another
  updateDepth (thing) {
    const depth = Math.round(thing.depth) || 0
    const previousDepth = Math.round(this.depthMemory.get(thing))
    if (previousDepth === depth) return
    this.depthMemory.set(thing, depth)

    this.layers[previousDepth] = this.layers[previousDepth] || []
    this.layers[previousDepth].splice(this.layers[previousDepth].indexOf(thing), 1)
    if (this.layers[previousDepth].length === 0) {
      delete this.layers[previousDepth]
    }
    this.layers[depth] = this.layers[depth] || []
    this.layers[depth].push(thing)
    this.layerOrder = Object.keys(this.layers).map(Number).sort((a, b) => a - b)
  }

  onUnload () {
    for (const thing of this.things) {
      thing.onUnload()
    }
  }
}
