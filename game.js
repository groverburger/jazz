/* global requestAnimationFrame, Image, Audio */
/** @module game */

import Scene from './scene.js'
import * as u from './utils.js'
import * as soundmanager from './soundmanager.js'
import * as gfx from './webgl.js'

export const globals = {}
export const assets = {}

export const gamepads = []
export const keysDown = {}
export const lastKeysDown = {}
export const keysPressed = {}

export const mouse = {
  position: [0, 0],
  delta: [0, 0], // In canvas pixel units
  rawDelta: [0, 0], // In screen pixel units, good for 3D games
  scrollDelta: [0, 0],
  leftButton: false,
  leftClick: false,
  middleButton: false,
  middleClick: false,
  rightButton: false,
  rightClick: false,

  lock () {
    const canvas = document.querySelector('#canvas2D')
    canvas.requestPointerLock({ unadjustedMovement: true })
  },

  unlock () {
    document.exitPointerLock()
  },

  isLocked () {
    return Boolean(document.pointerLockElement)
  },

  setStyle (style = 'default') {
    document.body.style.cursor = style
  },

  getStyle () {
    return document.body.style.cursor
  },

  reset () {
    this.position[0] = 0
    this.position[1] = 0
    this.delta[0] = 0
    this.delta[1] = 0
    this.rawDelta[0] = 0
    this.rawDelta[1] = 0
    this.scrollDelta[0] = 0
    this.scrollDelta[1] = 0
    this.leftButton = false
    this.middleButton = false
    this.rightButton = false
    this.leftClick = false
    this.middleClick = false
    this.rightClick = false
  }
}

/** Core internal variables */
let scene
let nextScene
let lastScene
let previousFrameTime = null
let accumulator = 0.99
let frameCount = 0
let isFocused = true
let requestedAnimationFrame = false
let frameRate = 0
let updateSpeed = 1
let impactFrameCount = 0
let gameTime = 0
let startGameTime
let width = 1280
let height = 720
let preventLeave = false
let isFramerateUncapped = false
let isCanvasStyleManipulated = true
const canvasStyle = `
position: absolute;
object-fit: contain;
image-rendering: pixelated;
width: 100vw;
height: 100vh;
`

/**
 * The game's 2D canvas. This canvas is layered on top of the 3D
 * canvas. It is recommended to use the `ctx` variable exported from
 * `game` to draw using HTML's 2D canvas API.
 */
export let canvas2D
export let ctx

/**
 * The game's 3D canvas. This canvas renders all WebGL calls and is
 * layered behind the 2D canvas. It is recommended to use the `webgl`
 * module to draw graphics to this canvas.
 */
export let canvas3D

export function setCanvas2D (canvas) {
  canvas2D = canvas
  ctx = canvas2D.getContext('2d')
  ctx.imageSmoothingEnabled = false

  // Now we can add the mousemove event
  canvas2D.onmousemove = event => {
    const aspect = Math.min(
      canvas2D.offsetWidth / width,
      canvas2D.offsetHeight / height
    )
    mouse.position[0] = u.map(
      event.offsetX,
      canvas2D.offsetWidth / 2 - aspect * width / 2,
      canvas2D.offsetWidth / 2 + aspect * width / 2,
      0,
      width,
      true
    )
    mouse.position[1] = u.map(
      event.offsetY,
      canvas2D.offsetHeight / 2 - aspect * height / 2,
      canvas2D.offsetHeight / 2 + aspect * height / 2,
      0,
      height,
      true
    )
    mouse.rawDelta[0] += event.movementX
    mouse.rawDelta[1] += event.movementY
    mouse.delta[0] += event.movementX / aspect
    mouse.delta[1] += event.movementY / aspect
  }

  return canvas
}

export function setCanvas3D (canvas, glOptions = {}) {
  canvas3D = canvas
  gfx.setGlContext(
    canvas3D.getContext('webgl2', {
      ...{ antialias: false, alpha: false },
      ...glOptions
    })
  )
  return canvas
}

export function createCanvas2D (options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.id = 'canvas2D'
  canvas.style = canvasStyle
  ;(options.parent || document.body).appendChild(canvas)
  if (options.setCanvas ?? true) {
    setCanvas2D(canvas)
  }
  return canvas
}

export function createCanvas3D (options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.id = 'canvas3D'
  canvas.style = canvasStyle
  ;(options.parent || document.body).appendChild(canvas)
  if (options.setCanvas ?? true) {
    setCanvas3D(canvas, options)
  }
  return canvas
}

/** Create and set up the 2D and 3D canvases */
export function createCanvases () {
  if (!canvas3D) createCanvas3D()
  if (!canvas2D) createCanvas2D()
}

function frame (frameTime) {
  // Calculate delta time in seconds
  let delta = (
    previousFrameTime === null
    ? 0
    : (frameTime - previousFrameTime) / 1000
  )

  // Fuzzy delta time to account for monitors not always being 60Hz
  delta *= 60
  if (delta >= 0.98 && delta <= 1.02) {
    //delta = 1
  }
  delta *= updateSpeed

  // Keep track of the previous frame time, as we have to calculate
  // delta time ourselves
  previousFrameTime = frameTime
  if (!startGameTime) {
    startGameTime = frameTime
  }

  // Bypass adding to the accumulator during impact frames
  // so objects don't interpolate weirdly during impacts
  if (impactFrameCount > 0) {
    impactFrameCount -= delta
  } else {
    accumulator += delta
  }

  // Fixed update system so the simulation code can assume we always
  // run at 60 FPS and not have to account for delta time
  let times = 0
  let rerender = false
  while (accumulator >= 1 && times < 5) {
    rerender = updateHandler() || rerender
    gameTime = frameTime
    accumulator -= 1
    times += 1
  }
  accumulator %= 1

  // Render only if we updated
  if (rerender || isFramerateUncapped) {
    if (document.hasFocus()) {
      draw()
    }
    mouse.rawDelta[0] = 0
    mouse.rawDelta[1] = 0
    frameCount += 1
  }

  // Update the last keys down
  if (rerender) {
    for (const key in lastKeysDown) delete lastKeysDown[key]
    for (const key in keysDown) lastKeysDown[key] = true
    mouse.leftClick = false
    mouse.middleClick = false
    mouse.rightClick = false
    mouse.delta[0] = 0
    mouse.delta[1] = 0
    mouse.scrollDelta[0] = 0
    mouse.scrollDelta[1] = 0
  }

  requestAnimationFrame(frame)
}

function updateHandler () {
  handleCanvasResize()
  handleTabbingInAndOut()
  handleSceneChange()

  if (!isFocused) {
    return
  }

  // Update keys pressed
  for (const key in keysPressed) delete keysPressed[key]
  for (const key in keysDown) {
    if (!lastKeysDown[key]) keysPressed[key] = true
  }

  if (navigator?.getGamepads) {
    for (const [i, gamepad] of Object.entries(navigator.getGamepads())) {
      gamepads[i] = gamepad
    }
  }

  if (scene) {
    clearScreen()
    update()
  }
  soundmanager.update()

  // Successfully updated, we should rerender
  return true
}

function update () {
  scene?.update()
}

function draw () {
  scene?.draw()
}

function clearScreen () {
  if (document.querySelector('#canvas3D')) {
    // Webgl is enabled, so fill color on the webgl canvas instead of
    // the 2d canvas
    gfx.clearScreen()

    // Clear the 2d canvas
    ctx.clearRect(0, 0, width, height)
  } else {
    // No webgl, fill the 2d canvas with background color
    ctx.fillStyle = '#4488ff'
    ctx.fillRect(0, 0, width, height)
  }
}

function loseFocus () {
  for (const key in keysDown) delete keysDown[key]
  for (const sound of Object.values(assets.sounds || {})) {
    sound.wasPlayingWhenFocused = !sound.paused
    sound.pause()
  }
  mouse.reset()
}

function gainFocus () {
  accumulator = 0.99
  for (const sound of Object.values(assets.sounds || {})) {
    if (sound.wasPlayingWhenFocused) {
      sound.play()
    }
  }
  mouse.reset()
}

// Handle tabbing in / out of the game
// Pause the game and all sound effects when tabbed out
function handleTabbingInAndOut () {
  const focused = document.hasFocus()
  if (!focused && isFocused) {
    loseFocus()
  }
  if (focused && !isFocused) {
    gainFocus()
  }
  isFocused = focused
}

function handleSceneChange () {
  if (!nextScene) return
  if (scene) {
    scene.onUnload()
    const persistent = scene.things.filter(thing => thing.isPersistent)
    const persistentNames = (
      Object.fromEntries(
        Object.entries(scene.namedThings)
          .filter(([_name, thing]) => thing.isPersistent)
      )
    )
    scene = new Scene()
    persistent.forEach(addThing)
    for (const name in persistentNames) {
      scene.namedThings[name] = persistentNames[name]
    }
  } else {
    scene = new Scene()
  }
  nextScene()
  if (document.querySelector('#canvas3D')) {
    getCamera3D().setUniforms()
  }
  lastScene = nextScene
  nextScene = null
  accumulator = 0.99
}

// Update canvas dimensions if they don't match the internal variables
function handleCanvasResize () {
  // NOTE: Canvases with the object fit contain style will stay
  // letterboxed to the same resolution as the previous width/height,
  // even when it changes! This is never the desired behavior, so its
  // style needs to be switched to fill on the frame it is changed and
  // switched back to contain on the next frame. This also seems to
  // only matter for the 3D canvas
  if (width !== canvas2D.width || height !== canvas2D.height) {
    accumulator = 0.99
    canvas2D.width = width
    canvas2D.height = height
    if (canvas3D) {
      if (isCanvasStyleManipulated) {
        canvas3D.style.objectFit = 'fill'
      }
      canvas3D.width = width
      canvas3D.height = height
    }
    const gl = gfx.getGlContext()
    if (gl) {
      gl.viewport(0, 0, width, height)
    }
  } else if (
    isCanvasStyleManipulated &&
    canvas3D &&
    canvas3D.style.objectFit === 'fill'
  ) {
    canvas3D.style.objectFit = 'contain'
  }
}

/******************************************************************************
    Input handling
 ******************************************************************************/

document.addEventListener('keydown', event => {
  keysDown[event.code] = true
  if (preventLeave) {
    event.preventDefault()
    return false
  }
  return true
})

document.addEventListener('keyup', (event) => {
  delete keysDown[event.code]
  if (preventLeave) {
    event.preventDefault()
    return false
  }
  return true
})

document.addEventListener('mouseup', (event) => {
  mouse.leftButton = event.buttons & 1
  mouse.rightButton = event.buttons & 2
  mouse.middleButton = event.buttons & 4
})

document.addEventListener('mousedown', (event) => {
  mouse.leftButton = event.buttons & 1
  mouse.leftClick = event.buttons & 1
  mouse.rightButton = event.buttons & 2
  mouse.rightClick = event.buttons & 2
  mouse.middleButton = event.buttons & 4
  mouse.middleClick = event.buttons & 4
})

document.addEventListener('wheel', (event) => {
  event.preventDefault()
  mouse.scrollDelta[0] += event.deltaX
  mouse.scrollDelta[1] += event.deltaY
}, { passive: false })

window.onbeforeunload = (event) => {
  if (preventLeave) {
    event.preventDefault()

    // Chrome requires returnValue to be set
    event.returnValue = 'Really want to quit the game?'
  }
}

window.oncontextmenu = (event) => {
  event.preventDefault()
}

// Add CTRL-R reload ability when in NWJS
try {
  // Try to focus the NWJS window, so that this event listener only
  // gets registered when in NWJS
  const win = nw.Window.get()
  win.focus()

  document.addEventListener('keydown', event => {
    if (event.code === 'KeyR' && event.ctrlKey) {
      window.location.reload()
    }
  })
} catch (e) { }

/******************************************************************************
    Scene management
 ******************************************************************************/

/**
 * Starts the game if it hasn't already been started. Creates a new
 * new Scene object, and initializes it with the given initialization
 * function. If there was a previously active Scene, it will be
 * swapped out with the new one between this frame and the next frame.
 */
export function setScene (initFunction) {
  // Start the game loop if it hasn't already been started, and create
  // the canvases
  if (!requestedAnimationFrame) {
    requestedAnimationFrame = true

    // The 2D canvas is required to exist, as lots of assumptions rely
    // on it
    if (!canvas2D) { createCanvas2D() }

    handleCanvasResize()
    requestAnimationFrame(frame)
    setInterval(() => {
      frameRate = frameCount
      frameCount = 0
    }, 1000)
  }

  if (!initFunction) {
    throw new Error('No function given to setScene!')
  }

  nextScene = initFunction
}

/**
 * Creates a new new Scene object, and initializes it with last given
 * initialization function. If there was a previously active Scene, it
 * will be swapped out with the new one between this frame and the
 * next frame.
 */
export function resetScene () {
  if (!lastScene) {
    throw new Error('No scene has been set yet!')
  }

  nextScene = lastScene
}

/******************************************************************************
    Asset loaders
 ******************************************************************************/

/**
 * Given an object of [name, file path] pairs, load as HTML5 Images
 */
export async function loadImages (locations) {
  const imageLoader = (location) => {
    if (location[0] === '#') {
      return document.querySelector(location)
    }
    const image = new Image()
    image.src = location
    return image
  }

  const locationList = Object.entries(locations)
  const images = locationList.map(([name, location]) => [
    name,
    imageLoader(location)
  ])
  const promises = images.map(([_, image]) => {
    return new Promise(resolve => {
      if (image.complete) resolve()
      image.onload = () => resolve()
    })
  })
  await Promise.all(promises)
  return Object.fromEntries(images)
}

/**
 * Given an object of [name, file path] pairs, load as HTML5 Audios
 */
export async function loadAudio (locations) {
  const audioLoader = (location) => {
    if (location[0] === '#') {
      return document.querySelector(location)
    }
    const audio = new Audio()
    audio.src = location
    return audio
  }

  const locationList = Object.entries(locations)
  const audios = locationList.map(([name, location]) => [
    name,
    audioLoader(location)
  ])
  const promises = audios.map(([_, audio]) => {
    return new Promise(resolve => {
      if (audio.complete) resolve()
      audio.oncanplay = () => resolve()
    })
  })
  await Promise.all(promises)
  return Object.fromEntries(audios)
}

/**
 * Given an object of [name, file path] pairs, load as plain text
 */
export async function loadText (locations) {
  const results = []
  for (const [name, location] of Object.entries(locations)) {
    results.push([
      name,
      location[0] === '#'
      ? document.querySelector(location).innerHTML
      : (await (await fetch(location)).text())
    ])
  }
  return Object.fromEntries(results)
}

export function loadTexturesFromImages (textures, filter = '') {
  return Object.fromEntries(
    Object.entries(textures).map(([name, image]) => (
      [name, gfx.createTexture(image, filter)]
    ))
  )
}

/******************************************************************************
    Getters / setters
 ******************************************************************************/

export function getWidth () {
  return width
}

export function setWidth (w) {
  width = w
  return width
}

export function getHeight () {
  return height
}

export function setHeight (h) {
  height = h
  return height
}

export function getFramerateUncapped () {
  return isFramerateUncapped
}

export function setFramerateUncapped (uncap) {
  isFramerateUncapped = uncap
  return isFramerateUncapped
}

export function getPreventLeave () {
  return preventLeave
}

export function setPreventLeave (pl) {
  preventLeave = pl
  return preventLeave
}

export function getIsCanvasStyleManipulated () {
  return isCanvasStyleManipulated
}

export function setIsCanvasStyleManipulated (manipulated) {
  isCanvasStyleManipulated = manipulated
  return isCanvasStyleManipulated
}

/*
export function setCustomUpdateFunction (func) {
  if (func) {
    update = func
  }
  return update
}

export function setCustomDrawFunction (func) {
  if (func) {
    draw = func
  }
  return draw
}
*/

/******************************************************************************
    Thing management
 ******************************************************************************/

/** Gets a reference to the Thing in the Scene with the given name. */
export function getThing (name) {
  return scene.namedThings[name]
}

/** Gets the name of the given Thing in the Scene. */
export function getNameOfThing (thing) {
  for (const [name, check] of Object.entries(scene.namedThings)) {
    if (thing === check) {
      return name
    }
  }
}

/**
 * Sets the name of the given Thing to the provided name.
 */
export function setThingName (thing, name) {
  scene.namedThings[name] = thing
}

/**
 * Given a bounding box in the format of x, y, width, height,
 * get a list of all Things near it (not necessarily inside it).
 */
export function getThingsNearXywh (x, y, w, h) {
  return scene.spatialHash.query(x, y, w, h)
}

/** Get a list of all things near point x, y inside a given radius r */
export function getThingsNear (x, y, r = 64) {
  return scene.spatialHash.query(x - r, y - r, 2 * r, 2 * r)
}

/** Given a 2D or 3D axis-aligned bounding box and a 2D or 3D
  * position, get a list of all Things inside it. */
export function getThingsInAabb (aabb, position = [0, 0, 0]) {
  return (
    getThingsNearXywh(...u.aabbToXywh(u.aabb2D(aabb), position))
      .filter(thing => (
        u.checkAabbIntersection(aabb, thing.aabb, position, thing.position)
      ))
  )
}

/** Get a list of all Things in the current Scene. */
export function getThings () {
  return scene.things
}

/** Add a Thing to the current Scene. */
export function addThing (thing) {
  return scene.addThing(thing)
}

/******************************************************************************
    Getters
 ******************************************************************************/

export function getCamera2D () {
  return scene.camera2D
}

export function getCamera3D () {
  return scene.camera3D
}

export function getFramerate () {
  return frameRate
}

/**
 * Get a fraction between zero and one representing time between this
 * update and the next update. If the value is 0.75, that means the
 * game's last update was 75% of a frame ago.
 *
 * Only works when isFramerateUncapped = true. This function is
 * used for interpolated rendering at high framerates.
 */
export function getInterpolation () {
  return (
    isFramerateUncapped
    ? u.clamp(accumulator % 1, 0, 1)
    : 1
  )
}

export function getTime () {
  return (gameTime - startGameTime) / 1000
}

/******************************************************************************
    Juice
 ******************************************************************************/

export function setUpdateSpeed (speed = 1) {
  updateSpeed = speed
}

export function setScreenShake (amount = 6, strength = 2) {
  scene.screenShakes.push({
    vector: [0, 0],
    amount,
    strength
  })
}

export function setImpactFrames (frames = 1) {
  impactFrameCount = frames
}
