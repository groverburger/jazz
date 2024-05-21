/** @module webgl */

let currentShader
let currentFramebuffer = null
const currentTexture = []
let glContext

/** Default vertex format used for OBJ files */
const defaultVertexFormat = [
  {
    name: 'vertexPosition',
    count: 3
  },

  {
    name: 'vertexTexture',
    count: 2
  },

  {
    name: 'vertexNormal',
    count: 3
  }
]

export const defaultVertSource = `
precision mediump float;

attribute vec4 vertexPosition;
attribute vec2 vertexTexture;
attribute vec3 vertexNormal;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

varying vec2 uv;
varying vec3 normal;
varying vec4 worldPosition;
varying vec4 viewPosition;

void main() {
  normal = vertexNormal;
  uv = vertexTexture;
  worldPosition = modelMatrix * vertexPosition;
  viewPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * viewPosition;
}
`

export const defaultFragSource = `
precision mediump float;

uniform sampler2D texture;
uniform vec4 color;

varying vec2 uv;

void main() {
  vec4 result = texture2D(texture, uv) * color;
  if (result.a == 0.0) { discard; }
  gl_FragColor = result;
}
`

export const shadedDefaultFragSource = `
precision mediump float;

uniform sampler2D texture;
uniform vec4 color;

varying vec2 uv;
varying vec3 normal;

void main() {
  vec4 result = texture2D(texture, uv) * color;
  if (result.a == 0.0) { discard; }
  result.rgb *= mix(0.25, 1.0, normal.z / 2.0 + 0.5);
  result.rgb *= mix(1.0, 0.25, max(normal.x, 0.0));
  gl_FragColor = result;
}
`

export const billboardVertSource = `
attribute vec4 vertexPosition;
attribute vec2 vertexTexture;
attribute vec3 vertexNormal;

uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;

varying vec2 uv;
varying vec3 normal;

void main() {
  normal = (modelMatrix * vec4(vertexNormal.xyz, 1.0)).xyz;
  uv = vertexTexture;

  vec4 position = vertexPosition;
  position += (vertexTexture.x*-2.0 +1.0) * vec4(viewMatrix[0].x, viewMatrix[1].x, viewMatrix[2].x, 0.0) * vertexNormal.x;
  position += (vertexTexture.y*-2.0 +1.0) * vec4(viewMatrix[0].y, viewMatrix[1].y, viewMatrix[2].y, 0.0) * vertexNormal.x;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * position;
}
`

export let defaultShader
export let shadedDefaultShader
export let billboardShader

export let defaultTexture

export async function setGlContext (gl) {
  glContext = gl
  defaultShader ||= createShader(
    defaultVertSource,
    defaultFragSource
  )
  shadedDefaultShader ||= createShader(
    defaultVertSource,
    shadedDefaultFragSource
  )
  billboardShader ||= createShader(
    billboardVertSource,
    defaultFragSource
  )
  defaultTexture ||= createTexture(await createBlankImage())
  setShader()
  setTexture()
}

export function getGlContext () {
  return glContext
}

/**
 * Returns how many bytes there are in a form based off of what data
 * type the form is.
 */
function byteOffset (form) {
  const gl = getGlContext()
  let bytes = 1
  if (!form.what) form.what = gl.FLOAT
  if (form.what === gl.FLOAT) {
    bytes = 4
  }
  return form.count * bytes
}

/******************************************************************************
   Set and draw graphics primitives
 ******************************************************************************/

/** Sets the value of a uniform variable in the current shader program. */
export function set (name, value, kind = 'float') {
  const gl = getGlContext()
  const uniformLocation = gl.getUniformLocation(
    currentShader,
    name
  )

  if (Array.isArray(value)) {
    if (value.length === 16) {
      gl.uniformMatrix4fv(uniformLocation, false, value)
      return
    }

    if (value.length === 4) {
      gl.uniform4fv(uniformLocation, value)
      return
    }

    if (value.length === 3) {
      gl.uniform3fv(uniformLocation, value)
      return
    }

    if (value.length === 2) {
      gl.uniform2fv(uniformLocation, value)
      return
    }
  }

  if (kind === 'int') {
    gl.uniform1i(uniformLocation, value)
    return
  }

  gl.uniform1f(uniformLocation, value)
}

export function setShader (shader = defaultShader, skipUniforms = false) {
  const gl = getGlContext()
  const changedShader = currentShader !== shader
  currentShader = shader
  gl.useProgram(shader)
  if (changedShader && !skipUniforms) {
    set('color', [1, 1, 1, 1])
    set('viewMatrix', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    set('projectionMatrix', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    set('modelMatrix', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  }
}

export function getShader () {
  return currentShader
}

export function setTexture (texture = null, index = 0) {
  const gl = getGlContext()
  texture = texture || defaultTexture
  gl.activeTexture(gl['TEXTURE' + index])
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.activeTexture(gl.TEXTURE0)
  currentTexture[index] = texture
}

export function getTexture (index = 0) {
  return currentTexture[index]
}

export function setFramebuffer (fb = null) {
  const gl = getGlContext()
  gl.bindFramebuffer(
    gl.FRAMEBUFFER,
    fb?.framebuffer ? fb.framebuffer : fb
  )
  currentFramebuffer = fb
}

export function getFramebuffer () {
  return currentFramebuffer
}

export function drawMesh (mesh, drawType = 'triangles') {
  const gl = getGlContext()
  const {
    buffer,
    format,
    verts
  } = mesh
  const shader = currentShader
  let offset = 0

  // Count how much data is in one vertex
  let byteStride = 0
  let stride = 0
  for (const form of format) {
    byteStride += byteOffset(form)
    stride += form.count
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  for (const form of format) {
    const location = gl.getAttribLocation(shader, form.name)

    // Don't set up a pointer if it points to nothing
    if (location !== -1) {
      gl.vertexAttribPointer(
        location,
        form.count,
        form.what,
        false, // Do not normalize
        byteStride,
        offset
      )
      gl.enableVertexAttribArray(location)
    }

    offset += byteOffset(form)
  }

  gl.drawArrays(gl[drawType.toUpperCase()], 0, verts.length / stride)
}

let billboardMesh
const triVerts = [
  0, 0, 0, 0, 0, 1, 0, 0,
  0, 0, 1, 0, 1, 1, 0, 0,
  1, 0, 0, 1, 0, 1, 0, 0
]
let triMesh
const quadVerts = [
  0, 0, 0, 0, 0, 1, 0, 0,
  0, 0, 1, 0, 1, 1, 0, 0,
  1, 0, 0, 1, 0, 1, 0, 0,
  1, 0, 1, 1, 1, 1, 0, 0
]
let quadMesh

export function drawBillboard () {
  billboardMesh = billboardMesh || createMesh([
    0, 0, 0, 1, 1, 1, 0, 0,
    0, 0, 0, 1, 0, 1, 0, 0,
    0, 0, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 1, 0, 0
  ])
  drawMesh(billboardMesh, 'triangle_strip')
}

/**
 * Draws a triangle using the current shader program in x, y, z, u, v,
 * nx, ny, nz format.
 */
export function drawTri (...points) {
  triMesh = triMesh || createMesh(triVerts, { isStreamed: true })
  if (Array.isArray(points[0])) {
    points = points.flat()
  }
  if (points) {
    let i = 0
    for (let p = 0; p < points.length; p += 3) {
      triVerts[i] = points[p]
      triVerts[i + 1] = points[p + 1]
      triVerts[i + 2] = points[p + 2]
      i += 8
    }
    modifyMesh(triMesh, triVerts)
  }
  drawMesh(triMesh)
}

/**
 * Draws a quad using the current shader program in x, y, z, u, v, nx,
 * ny, nz format.
 */
export function drawQuad (...points) {
  quadMesh = quadMesh || createMesh(quadVerts, { isStreamed: true })
  if (Array.isArray(points[0])) {
    points = points.flat()
  }
  if (points) {
    let i = 0
    for (let p = 0; p < points.length; p += 3) {
      quadVerts[i] = points[p]
      quadVerts[i + 1] = points[p + 1]
      quadVerts[i + 2] = points[p + 2]
      i += 8
    }
    modifyMesh(quadMesh, quadVerts)
  }
  drawMesh(quadMesh, 'triangle_strip')
}

/**
 * Draws a line between two points with a specified width.
 */
  /*
export function drawLine (p1, p2, w = 1) {
  const vector = vec3.normalize(vec3.subtract(p1, p2))
  const cross = vec3.normalize(
    vec3.crossProduct(vector, game.getCamera3D().lookVector)
  )
  cross[0] *= w
  cross[1] *= w
  cross[2] *= w

  drawQuad(
    p1[0] - cross[0], p1[1] - cross[1], p1[2] - cross[2],
    p1[0] + cross[0], p1[1] + cross[1], p1[2] + cross[2],
    p2[0] - cross[0], p2[1] - cross[1], p2[2] - cross[2],
    p2[0] + cross[0], p2[1] + cross[1], p2[2] + cross[2]
  )

  return cross
}
  */

/******************************************************************************
   Graphics primitives creation functions
 ******************************************************************************/

/**
 * Compiles and links a shader program from the specified vertex and
 * fragment shader sources.
 */
export function createShader (vsSource, fsSource) {
  // To make it easier to write simple fragment shaders, this allows
  // you to pass in a single argument instead
  if (vsSource && !fsSource) {
    fsSource = vsSource
    vsSource = defaultVertSource
  }

  if (typeof vsSource !== 'string' || typeof fsSource !== 'string') {
    throw new Error('Shader source is not a string!')
  }

  const gl = getGlContext()
  function compileShader (what, source) {
    const shader = gl.createShader(what)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader))
    }

    return shader
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource)
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource)

  // Create the shader program
  const shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    const errorInfo = gl.getProgramInfoLog(shaderProgram)
    throw new Error('Unable to initialize the shader program: ' + errorInfo)
  }

  return shaderProgram
}

/**
 * Creates a new texture object and initializes it with the specified
 * image. Filter can be either a string, or an object specifying which
 * filter to use for min and mag.
 */
export function createTexture (image, filter = 'nearest', edgeClamp = false) {
  const gl = getGlContext()
  if (typeof filter === 'string') {
    filter = {
      min: filter,
      mag: filter
    }
  }
  if (Array.isArray(filter)) {
    filter = {
      min: filter[0],
      mag: filter[1]
    }
  }

  if (!image) console.error(`No image provided! Got ${image} instead!`)
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)

  const level = 0
  const internalFormat = gl.RGBA
  const srcFormat = gl.RGBA
  const srcType = gl.UNSIGNED_BYTE
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    srcFormat,
    srcType,
    image
  )
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl[filter.min.toUpperCase()]
  )
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    gl[filter.mag.toUpperCase()]
  )
  if (edgeClamp) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  return texture
}

/**
 * Creates a new mesh object and initializes it with the specified vertices.
 */
export function createMesh (
  verts = [
    0, 0, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 1, 1, 0, 0,
    1, 0, 0, 1, 0, 1, 0, 0
  ],
  {
    isStreamed = false,
    format = defaultVertexFormat
  } = {}
) {
  const gl = getGlContext()
  if (typeof verts === 'string') {
    verts = loadObj(verts, { combine: true })
  }

  // Make sure verts is a Float32Array
  verts = (
    verts.constructor === Float32Array
    ? verts
    : new Float32Array(verts)
  )

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    verts,
    isStreamed ? gl.STREAM_DRAW : gl.STATIC_DRAW
  )

  return {
    buffer,
    format,
    verts,
    isStreamed
  }
}

/**
 * Modifies the specified mesh object with the specified vertices.
 */
export function modifyMesh (mesh, verts) {
  const gl = getGlContext()
  verts = (
    verts.constructor === Float32Array
    ? verts
    : new Float32Array(verts)
  )
  mesh.verts = verts

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    verts,
    mesh.isStreamed ? gl.STREAM_DRAW : gl.STATIC_DRAW
  )
}

/**
 * Creates a framebuffer object.
 */
export function createFramebuffer (width, height) {
  const gl = getGlContext()

  // Create the texture that the framebuffer renders to
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  // Create the renderbuffer which stores depth and stencil information
  const renderbuffer = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height)

  // Create the framebuffer, bind the texture and renderbuffer to it
  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  )
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_STENCIL_ATTACHMENT,
    gl.RENDERBUFFER,
    renderbuffer
  )
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return {
    framebuffer,
    renderbuffer,
    texture
  }
}

export function clearFramebuffer (framebuffer = null) {
  const lastFramebuffer = getFramebuffer()
  setFramebuffer(framebuffer)
  clearScreen()
  setFramebuffer(lastFramebuffer)
}

export function clearScreen (color = [0.25, 0.5, 1, 1]) {
  const gl = getGlContext()
  gl.clearColor(...color)
  gl.clearDepth(1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendEquation(gl.FUNC_ADD)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
}

/**
 * Loads an object from a file string.
 *
 * @param {string} fileString - The file string to load the object from.
 * @param {Object} [options={}] - The options object.
 * @param {boolean} [options.xFlip=false] - Whether to flip the x-axis.
 * @param {boolean} [options.yFlip=false] - Whether to flip the y-axis.
 * @param {boolean} [options.zFlip=false] - Whether to flip the z-axis.
 * @param {boolean} [options.combine=false] - Whether to combine all objects into one.
 * @returns {(Object|Array)} The loaded object or array of vertices.
 */
export function loadObj (fileString, options = {}) {
  const positions = []
  const uvs = []
  const normals = []
  const objects = {}
  let currentObject

  const makeObject = (name) => {
    objects[name] = {
      verts: [],
      positions: [],
      uvs: [],
      normals: [],
      lines: [],
      name
    }
    currentObject = objects[name]
  }
  makeObject('default')

  for (const line of fileString.split(/\r?\n/)) {
    const words = line.split(/ +/)

    if (words[0] === 'o') {
      makeObject(words[1])
      continue
    }

    if (words[0] === 'usemtl') {
      currentObject.material = words[1]
    }

    if (words[0] === 'f') {
      const verts = words.slice(1) // list of v/vt/vn triplets

      // simple convex triangulation
      for (let i = 2; i < verts.length; i++) {
        for (let vert of [verts[0], verts[i - 1], verts[i]]) {
          vert = vert.split('/').map(x => Number(x) - 1)
          currentObject.verts.push(
            ...positions[vert[0]],
            ...uvs[vert[1]],
            ...normals[vert[2]]
          )
        }
      }
      continue
    }

    const value = words.slice(1).map(Number)

    if (words[0] === 'l') {
      currentObject.lines.push(value.map(i => positions[i]))
      continue
    }

    if (words[0] === 'v') {
      if (options.xFlip) {
        value[0] *= -1
      }
      if (options.yFlip) {
        value[1] *= -1
      }
      if (options.zFlip) {
        value[2] *= -1
      }
      positions.push(value)
      currentObject.positions.push(value)
      continue
    }

    if (words[0] === 'vt') {
      uvs.push(value)
      currentObject.uvs.push(value)
      continue
    }

    if (words[0] === 'vn') {
      normals.push(value)
      currentObject.normals.push(value)
      continue
    }
  }

  if (options.combine) {
    const result = []
    for (const name in objects) {
      result.push(...objects[name].verts)
    }
    return result
  }

  return objects
}

async function createBlankImage () {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, 16, 16)
  const image = new Image()
  image.src = canvas.toDataURL('image/png')
  await new Promise(resolve => {
    image.onload = resolve
  })
  return image
}
