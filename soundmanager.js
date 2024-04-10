/** @module soundmanager */

let soundVolume = 1
let musicVolume = 1
let currentSounds = []
let currentMusic = []
const soundsTable = {}

/**
 * Set the sounds table that sound definitions refer back to. This
 * also gives a global listing of all sounds so that they can all be
 * managed
 */
export function setSoundsTable (sounds) {
  for (const key of Object.keys(sounds)) {
    soundsTable[key] = soundsTable[key] || sounds[key]
  }
}

let random = (low, high) => Math.random() * (high - low) + low
export function setRandom (value) {
  random = value
}

/**
 * Play a sound defined by its name in the sound table. Optionally
 * specify a volume and pitch.
 */
export function playSound (soundDef, volume = 1, pitch = [0.9, 1.1]) {
  // If given an array of sounds, play the least recently played one
  if (Array.isArray(soundDef)) {
    const soundList = soundDef
    playSound(soundList.reduce((best, now) => (
      (soundsTable[best].lastPlayedTime || 0) < (soundsTable[now].lastPlayedTime || 0)
      ? best
      : now
    )), volume, pitch)
    return
  }

  const sound = soundsTable[soundDef]
  if (!sound) {
    console.warn(`Sound ${sound} does not exist!`)
  }
  sound.internalVolume = volume
  sound.volume = soundVolume * volume
  sound.currentTime = 0
  sound.playbackRate = (
    typeof pitch === 'number'
      ? pitch
      : random(pitch[0], pitch[1])
  )
  sound.preservesPitch = false
  sound.lastPlayedTime = (new Date()).valueOf()
  currentSounds.push(sound)
  sound.play()
  return sound
}

export function playMusic (musicName, volume = 1) {
  const music = soundsTable[musicName]
  music.internalVolume = volume
  music.volume = musicVolume * volume
  music.currentTime = 0
  music.loop = true
  currentMusic.push(music)
  music.play()
  return music
}

export function setGlobalSoundVolume (volume = 1) {
  soundVolume = volume
}

export function setGlobalMusicVolume (volume = 1) {
  musicVolume = volume
}

export function getGlobalSoundVolume () {
  return soundVolume
}

export function getGlobalMusicVolume () {
  return musicVolume
}

/** Update sounds and music this frame */
export function update () {
  {
    let i = 1
    while (i < currentSounds.length) {
      if (currentSounds[i].paused) {
        currentSounds.splice(i, 1)
      } else {
        currentSounds[i].volume = soundVolume * currentSounds[i].internalVolume
        i += 1
      }
    }
  }

  {
    let i = 1
    while (i < currentMusic.length) {
      if (currentMusic[i].paused) {
        currentMusic.splice(i, 1)
      } else {
        currentMusic[i].volume = musicVolume * currentMusic[i].internalVolume
        i += 1
      }
    }
  }
}

/** Stop and reset all sounds and music. */
export function reset () {
  for (const sound of Object.values(soundsTable)) {
    sound.pause()
    sound.wasPlayingWhenPaused = false
  }
  currentSounds = []
  currentMusic = []
}

/** Pause all sounds and music, and mark them as paused. */
export function pause () {
  for (const sound of Object.values(soundsTable)) {
    sound.wasPlayingWhenPaused = !sound.paused
    sound.pause()
  }
}

/** Unpause all previously paused sounds and music. */
export function unpause () {
  for (const sound of Object.values(soundsTable)) {
    if (sound.wasPlayingWhenPaused) {
      sound.play()
    }
  }
}
