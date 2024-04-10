/** @module spatialhash */

/**
 * Class representing a spatial hash.
 * A spatial hash buckets objects with an associated position and bounding box into spaces on a grid.
 * This allows efficient lookup of what other objects may be in vicinity of a given object.
 */
class SpatialHash {
  /**
   * Create a SpatialHash. The isStrong variable determines if a Map
   * should be used internally instead of a WeakMap.
   */
  constructor (size = 64, isStrong = false) {
    this.size = size
    this.hash = {}

    // Maps from a object reference to a list of chunks where that object exists.
    // This is because a object can overlap multiple chunks at once.
    this.objects = isStrong ? new Map() : new WeakMap()

    // Maps from a object reference to the hitbox of that object.
    this.hitboxes = isStrong ? new Map() : new WeakMap()
  }

  /** Convert an x and y coordinate into a cell coordinate for the interal grid. */
  cellCoord (x, y) {
    return [
      Math.floor(x / this.size),
      Math.floor(y / this.size)
    ]
  }

  /**
   * Add an object with an associated x, y, width, and height to the spatial hash.
   * The x, y coordinate pair represent the top-left corner of the bounding box.
   */
  add (object, x, y, width, height) {
    this.hitboxes.set(object, [x, y, width, height])

    const start = this.cellCoord(x, y)
    const end = this.cellCoord(x + width, y + height)
    for (let x = start[0]; x <= end[0]; x++) {
      for (let y = start[1]; y <= end[1]; y++) {
        const key = [x, y]

        // Add this object to this chunk
        if (!this.hash[key]) this.hash[key] = []
        this.hash[key].push(object)

        // Add this chunk to the objects map
        if (!this.objects.has(object)) this.objects.set(object, [])
        this.objects.get(object).push(key)
      }
    }
  }

  /** Remove the object from this spatial hash. */
  remove (object) {
    if (!this.objects.has(object)) {
      console.error(`object ${object.constructor.name} is not in this spatial hash!`)
      return
    }

    for (const key of this.objects.get(object)) {
      this.hash[key].splice(this.hash[key].indexOf(object), 1)
      if (this.hash[key].length === 0) {
        delete this.hash[key]
      }
    }

    this.objects.delete(object)
    this.hitboxes.delete(object)
  }

  /** Get the object's hitbox from the spatial hash. */
  getHitbox (object) {
    return this.hitboxes.get(object)
  }

  /**
   * Update the object's associated bounding box in the spatial hash.
   * The x, y coordinate pair represent the top-left corner of the bounding box.
   */
  update (object, x, y, width, height) {
    this.remove(object)
    this.add(object, x, y, width, height)
  }

  /** Get all of the objects within this bounding box. */
  query (x, y, width, height) {
    const results = []
    const start = this.cellCoord(x, y)
    const end = this.cellCoord(x + width, y + height)
    for (let x = start[0]; x <= end[0]; x++) {
      for (let y = start[1]; y <= end[1]; y++) {
        results.push(...(this.hash[[x, y]] ?? []))
      }
    }
    return results
  }
}

export default SpatialHash
