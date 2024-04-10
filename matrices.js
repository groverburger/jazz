/** @module matrices */

/** Returns a perspective projection matrix. */
export function getPerspective ({
  fov = 1.57,
  aspect = 1,
  near = 1,
  far = 100_000,
  rightHanded = false
} = {}) {
  const top = near * Math.tan(fov / 2)
  const bottom = -1 * top
  const right = top * aspect * (rightHanded ? 1 : -1)
  const left = -1 * right

  // Calculation from OpenGL's glFrustum function:
  // https://learn.microsoft.com/en-us/windows/win32/opengl/glfrustum?redirectedfrom=MSDN
  return [
    2 * near / (right - left),
    0,
    0,
    0,

    0,
    2 * near / (top - bottom),
    0,
    0,

    (right + left) / (right - left),
    (top + bottom) / (top - bottom),
    -1 * (far + near) / (far - near),
    -1,

    0,
    0,
    -2 * far * near / (far - near),
    0
  ]
}

/** Returns a transformation matrix. */
export function getTransformation ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1]
} = {}) {
  const matrix = getIdentity()

  // Position
  matrix[12] = position[0]
  matrix[13] = position[1]
  matrix[14] = position[2]

  // Rotation
  if (typeof rotation === 'number') {
    rotation = [0, 0, rotation]
  }
  const ca = Math.cos(rotation[2])
  const cb = Math.cos(rotation[1])
  const cc = Math.cos(rotation[0])
  const sa = Math.sin(rotation[2])
  const sb = Math.sin(rotation[1])
  const sc = Math.sin(rotation[0])

  matrix[0] = ca * cb
  matrix[1] = sa * cb
  matrix[2] = -sb
  matrix[4] = ca * sb * sc - sa * cc
  matrix[5] = sa * sb * sc + ca * cc
  matrix[6] = cb * sc
  matrix[8] = ca * sb * cc + sa * sc
  matrix[9] = sa * sb * cc - ca * sc
  matrix[10] = cb * cc

  // Scale
  if (typeof scale === 'number') {
    scale = [scale, scale, scale]
  }
  matrix[0] *= scale[0]
  matrix[1] *= scale[0]
  matrix[2] *= scale[0]
  matrix[4] *= scale[1]
  matrix[5] *= scale[1]
  matrix[6] *= scale[1]
  matrix[8] *= scale[2]
  matrix[9] *= scale[2]
  matrix[10] *= scale[2]

  return matrix
}

/** Returns a view matrix. */
export function getView ({
  position = [0, 0, 0],
  target = [1, 0, 0],
  up = [0, 0, 1]
} = {}) {
  const z = normalize([
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2]
  ])
  const x = normalize(crossProduct(up, z))
  const y = crossProduct(z, x)

  return [
    x[0],
    y[0],
    z[0],
    0,

    x[1],
    y[1],
    z[1],
    0,

    x[2],
    y[2],
    z[2],
    0,

    -1 * dotProduct(x, position),
    -1 * dotProduct(y, position),
    -1 * dotProduct(z, position),
    1
  ]
}

/** Returns an identity matrix. */
export function getIdentity () {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]
}

function normalize (vector) {
  const magnitude = Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2)

  // Prevent dividing by 0 and causing NaNs by ORing with 1
  return [
    vector[0] / (magnitude || 1),
    vector[1] / (magnitude || 1),
    vector[2] / (magnitude || 1)
  ]
}

function crossProduct (v1, v2) {
  return [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0]
  ]
}

function dotProduct (v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
}
