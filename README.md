# Jazz v0.0.1

Jazz is a framework for rapidly develping games and multimedia applications in HTML5 and JavaScript.

## About

Jazz assists with the following:
- Setting up 2D and WebGL canvases for drawing graphics.
- Handling and abstracting mouse, keyboard, and gamepad input.
- A sensible real-time update and render loop for games and simulations.
- Just enough code to get 3D WebGL graphics off the ground (matrices, vectors, shaders, .obj importing, etc.).
- Freedom to ignore all this anyway.

This framework trusts you, the developer, and therefore tries to be as hands-off as possible.
The core of the framework are the `game.js`, `scene.js`, and `thing.js` files, everything else are completely independent of each other and can be used context-free in other projects.
For instance, `webgl.js` may be used standalone in an instance where you may want a simple WebGL wrapper.

## Disclaimers

The framework is still in active, albeit slower, development. Things may still break and change somewhat.

Jazz is currently meant primarily for personal use, and is therefore somewhat undocumented. Feel free to use it, but do not operate under the assumption that it is production-ready.
