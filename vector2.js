/** @module vector2 */

/******************************************************************************
    Math
 ******************************************************************************/

export function equals (a, b) {
  return a[0] === b[0] && a[1] === b[1]
}

export function dotProduct (a, b) {
  return a[0] * b[0] + a[1] * b[1]
}

export function add (a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1]
  ]
}

export function subtract (a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1]
  ]
}

export function scale (vector, scale) {
  return [
    vector[0] * scale,
    vector[1] * scale
  ]
}

export function invert (vector) {
  return [
    vector[0] * -1,
    vector[1] * -1
  ]
}

export function normalize (vector) {
  const magnitude = Math.sqrt(vector[0] ** 2 + vector[1] ** 2)

  // Prevent dividing by 0 and causing NaNs by ORing with 1
  return [
    vector[0] / (magnitude || 1),
    vector[1] / (magnitude || 1)
  ]
}

export function toMagnitude (vector, length) {
  return scale(vector, length / (magnitude(vector) || 1))
}

export function magnitude (vector) {
  return Math.sqrt(vector[0] ** 2 + vector[1] ** 2)
}

export function distance (a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

export function lerp (v1, v2, t) {
  return [
    (1 - t) * v1[0] + t * v2[0],
    (1 - t) * v1[1] + t * v2[1]
  ]
}

/******************************************************************************
    Angles
 ******************************************************************************/

export function rotate (vector, angle) {
  return [
    Math.cos(angle) * vector[0] - Math.sin(angle) * vector[1],
    Math.sin(angle) * vector[0] + Math.cos(angle) * vector[1]
  ]
}

export function angleToVector (angle, length = 1) {
  return toMagnitude([Math.cos(angle), Math.sin(angle)], length)
}

export function vectorToAngle (vector) {
  return Math.atan2(vector[1], vector[0])
}

export function angleTowards ([x1, y1], [x2, y2]) {
  return Math.atan2(y2 - y1, x2 - x1)
}
