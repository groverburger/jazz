/** @module inputhandler */

/**
 * A class that makes it more convenient to unify inputListeners from
 * keyboard, mouse, and controllers.
 */
class InputHandler {
  #inputListeners = {}
  #active = {}
  #lastActive = {}

  constructor (data = {}) {
    for (const [name, listener] of Object.entries(data)) {
      this.addInput(name, listener)
    }
  }

  addInput (name, listener) {
    this.#inputListeners[name] = listener
  }

  update () {
    // Replace last active with active, and empty active
    for (const input in this.#lastActive) {
      delete this.#lastActive[input]
    }
    for (const input in this.#active) {
      this.#lastActive[input] = this.#active[input]
      delete this.#active[input]
    }

    for (const input in this.#inputListeners) {
      const listener = this.#inputListeners[input]
      this.#active[input] = listener()
    }
  }

  get (input) {
    return this.#active[input]
  }

  pressed (input) {
    return this.#active[input] && !this.#lastActive[input]
  }
}

export default InputHandler
