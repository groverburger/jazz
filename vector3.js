/** @module vector3 */

/******************************************************************************
    Math
 ******************************************************************************/

export function equals (v1, v2) {
  return (
    v1[0] === v2[0] &&
    v1[1] === v2[1] &&
    v1[2] === v2[2]
  )
}

export function crossProduct (v1, v2) {
  return [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0]
  ]
}

export function dotProduct (v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
}

export function add (v1, v2) {
  return [
    v1[0] + v2[0],
    v1[1] + v2[1],
    v1[2] + v2[2]
  ]
}

export function subtract (v1, v2) {
  return [
    v1[0] - v2[0],
    v1[1] - v2[1],
    v1[2] - v2[2]
  ]
}

export function scale (vector, scalar) {
  return [
    vector[0] * scalar,
    vector[1] * scalar,
    vector[2] * scalar
  ]
}

export function invert (vector) {
  return [
    vector[0] * -1,
    vector[1] * -1,
    vector[2] * -1
  ]
}

export function normalize (vector) {
  const magnitude = Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2)

  // Prevent dividing by 0 and causing NaNs by ORing with 1
  return [
    vector[0] / (magnitude || 1),
    vector[1] / (magnitude || 1),
    vector[2] / (magnitude || 1)
  ]
}

export function toMagnitude (vector, length) {
  const magnitude = Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2)

  // Prevent dividing by 0 and causing NaNs by ORing with 1
  return [
    vector[0] * length / (magnitude || 1),
    vector[1] * length / (magnitude || 1),
    vector[2] * length / (magnitude || 1)
  ]
}

export function magnitude (vector) {
  return Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2)
}

export function distance (v1, v2) {
  return Math.sqrt(
    (v1[0] - v2[0]) ** 2 + (v1[1] - v2[1]) ** 2 + (v1[2] - v2[2]) ** 2
  )
}

export function lerp (v1, v2, t) {
  return [
    (1 - t) * v1[0] + t * v2[0],
    (1 - t) * v1[1] + t * v2[1],
    (1 - t) * v1[2] + t * v2[2]
  ]
}

/******************************************************************************
    Angles
 ******************************************************************************/

export function anglesToVector (yaw, pitch, length = 1) {
  return toMagnitude([
    Math.cos(yaw) * Math.max(Math.cos(pitch), 0.001),
    Math.sin(yaw) * Math.max(Math.cos(pitch), 0.001),
    Math.sin(pitch)
  ], length)
}

export function vectorToAngles (vector) {
  return [
    Math.atan2(vector[1], vector[0]),
    Math.asin(vector[2]),
    0
  ]
}

/******************************************************************************
    Triangles
 ******************************************************************************/

export function getNormalOf (v1, v2, v3) {
  return normalize(crossProduct(
    subtract(v2, v1),
    subtract(v3, v2)
  ))
}

export function areaOfTriangle (v1, v2, v3) {
  return 0.5 * magnitude(crossProduct(
    subtract(v2, v1),
    subtract(v3, v2)
  ))
}

function triEdge (p1, p2, position, normal) {
  const s1x = p2[0] - p1[0]
  const s1y = p2[1] - p1[1]
  const s1z = p2[2] - p1[2]
  const s2x = position[0] - p1[0]
  const s2y = position[1] - p1[1]
  const s2z = position[2] - p1[2]
  const ex = s1y * s2z - s1z * s2y
  const ey = s1z * s2x - s1x * s2z
  const ez = s1x * s2y - s1y * s2x
  return ex * normal[0] + ey * normal[1] + ez * normal[2]
}

export function isInsideTriangle (p1, p2, p3, normal, position) {
  const e1 = triEdge(p1, p2, position, normal)
  const e2 = triEdge(p2, p3, position, normal)
  const e3 = triEdge(p3, p1, position, normal)
  return (e1 >= 0 && e2 >= 0 && e3 >= 0) || (e1 < 0 && e2 < 0 && e3 < 0)
}

export function distanceToTriangle (p1, normal, position) {
  return dotProduct(position, normal) - dotProduct(p1, normal)
}

export function getPointOnPlane (r1, rayDir, p1, normal) {
  const dist = distanceToTriangle(p1, normal, r1)
  const dot = dotProduct(rayDir, normal)

  // don't divide by zero!
  if (dot >= 0) {
    return null
  }

  return add(r1, scale(rayDir, Math.abs(dist / dot)))
}

export function rayTriangleIntersection (r1, rayDir, p1, p2, p3, normal) {
  const point = getPointOnPlane(r1, rayDir, p1, normal)
  if (!point) return point
  return isInsideTriangle(p1, p2, p3, normal, point) ? point : null
}

export function raySphere (ray, sphere, radius) {
  const sphereProjection = dotProduct(ray, sphere)
  const testPoint = [
    ray[0] + sphereProjection,
    ray[1] + sphereProjection,
    ray[2] + sphereProjection
  ]

  const dist = distance(testPoint, sphere)
  if (dist < radius) {
    return testPoint
  }
}

/******************************************************************************
    Misc.
 ******************************************************************************/

export function findMostSimilarVector (mainVector, list) {
  let bestDot = -1 * Infinity
  let bestVector = null

  for (const thing of list) {
    const dot = dotProduct(thing, mainVector)
    if (dot > bestDot) {
      bestDot = dot
      bestVector = thing
    }
  }

  return bestVector
}
