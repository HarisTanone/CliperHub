/**
 * Keyframe Baker — Deterministic animation sampling using @motionone/generators.
 *
 * Bakes Framer Motion–style animations into pre-computed frame arrays
 * that the backend can render without a browser engine.
 *
 * Key principles:
 * - NO requestAnimationFrame or wall-clock dependency
 * - Uses @motionone/generators spring solver for deterministic output
 * - Same params always produce byte-identical keyframe JSON
 */

import { spring as createSpring, pregenerateKeyframes } from '@motionone/generators'

/**
 * Deterministically bake an animation into frame-by-frame transform values.
 *
 * @param {Object} animationParams - Animation configuration
 * @param {string} animationParams.type - "spring" | "keyframes" | "easing"
 * @param {Object} animationParams.initial - Initial transform values { scale, opacity, x, y, rotation }
 * @param {Object} animationParams.target - Target transform values { scale, opacity, x, y, rotation }
 * @param {Object} [animationParams.spring] - Spring config { stiffness, damping, mass }
 * @param {number} [animationParams.duration] - Duration in ms (for easing/keyframes type)
 * @param {string} [animationParams.easing] - Easing function name (for easing type)
 * @param {number} [fps=30] - Frames per second for sampling
 * @returns {Array<Object>} Array of frame objects with frame index + transform properties
 */
export function bakeAnimation(animationParams, fps = 30) {
  const {
    type = 'spring',
    initial = {},
    target = {},
    spring: springConfig = { stiffness: 100, damping: 10, mass: 1 },
    duration: durationMs = 1000,
    easing = 'ease-out',
  } = animationParams

  const properties = ['scale', 'opacity', 'x', 'y', 'rotation']
  const initialValues = {
    scale: initial.scale ?? 1,
    opacity: initial.opacity ?? 1,
    x: initial.x ?? 0,
    y: initial.y ?? 0,
    rotation: initial.rotation ?? 0,
  }
  const targetValues = {
    scale: target.scale ?? 1,
    opacity: target.opacity ?? 1,
    x: target.x ?? 0,
    y: target.y ?? 0,
    rotation: target.rotation ?? 0,
  }

  const frameDurationMs = 1000 / fps
  const frames = []

  if (type === 'spring') {
    // Create a spring generator per property to compute each property's animation
    // The spring() generator takes from/to directly and returns a function(t) => state
    const generators = {}
    for (const prop of properties) {
      generators[prop] = createSpring({
        stiffness: springConfig.stiffness,
        damping: springConfig.damping,
        mass: springConfig.mass,
        from: initialValues[prop],
        to: targetValues[prop],
      })
    }

    // Determine the total animation duration by finding when ALL properties are done.
    // Use pregenerateKeyframes on a normalized 0→1 spring to find the duration.
    const durationGenerator = createSpring({
      stiffness: springConfig.stiffness,
      damping: springConfig.damping,
      mass: springConfig.mass,
      from: 0,
      to: 1,
    })
    const { duration: springDurationSec } = pregenerateKeyframes(durationGenerator)
    const totalDurationMs = springDurationSec * 1000
    const totalFrames = Math.ceil(totalDurationMs / frameDurationMs)

    // Sample each property at each frame timestamp
    for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex++) {
      const t = frameIndex * frameDurationMs
      const frameObj = { frame: frameIndex }

      for (const prop of properties) {
        const state = generators[prop](t)
        // When done, snap to target for precision
        frameObj[prop] = roundValue(state.done ? state.target : state.current)
      }
      frames.push(frameObj)
    }

    // Ensure last frame snaps to exact target values
    if (frames.length > 0) {
      const lastFrame = frames[frames.length - 1]
      for (const prop of properties) {
        lastFrame[prop] = roundValue(targetValues[prop])
      }
    }
  } else if (type === 'easing' || type === 'keyframes') {
    // For easing-based animations, use analytical easing function
    const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps))
    const easingFn = getEasingFunction(easing)

    for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex++) {
      const t = Math.min(frameIndex / totalFrames, 1)
      const progress = easingFn(t)

      const frameObj = { frame: frameIndex }
      for (const prop of properties) {
        const from = initialValues[prop]
        const to = targetValues[prop]
        frameObj[prop] = roundValue(from + (to - from) * progress)
      }
      frames.push(frameObj)
    }
  }

  return frames
}

/**
 * Compute a SHA-256 hash of animation parameters using Web Crypto API.
 * Produces canonical JSON (sorted keys) for deterministic output.
 *
 * @param {Object} params - Animation parameters to hash
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function computeParamsHash(params) {
  const canonical = canonicalJSON(params)
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Apply key-point reduction to remove redundant frames.
 * Removes frames where ALL properties are within threshold of linear interpolation
 * between their neighbors. Always keeps first and last frame.
 * Enforces a 300-frame cap — if input exceeds 300 frames, reduction is mandatory.
 *
 * @param {Array<Object>} frames - Array of frame objects
 * @param {number} [threshold=0.01] - Deviation threshold for removal
 * @returns {Array<Object>} Reduced array of frame objects
 */
export function applyKeyPointReduction(frames, threshold = 0.01) {
  if (!frames || frames.length <= 2) return frames

  const properties = ['scale', 'opacity', 'x', 'y', 'rotation']
  const mustReduce = frames.length > 300

  // Mark frames to keep — always keep first and last
  const keep = new Array(frames.length).fill(false)
  keep[0] = true
  keep[frames.length - 1] = true

  // For each intermediate frame, check if it deviates from linear interpolation
  for (let i = 1; i < frames.length - 1; i++) {
    const prev = frames[i - 1]
    const next = frames[i + 1]
    const curr = frames[i]

    let isSignificant = false
    for (const prop of properties) {
      if (curr[prop] === undefined) continue
      const prevVal = prev[prop] ?? 0
      const nextVal = next[prop] ?? 0
      // Linear interpolation position between prev and next
      const t = (curr.frame - prev.frame) / (next.frame - prev.frame)
      const interpolated = prevVal + (nextVal - prevVal) * t
      const deviation = Math.abs((curr[prop] ?? 0) - interpolated)

      if (deviation > threshold) {
        isSignificant = true
        break
      }
    }

    if (isSignificant) {
      keep[i] = true
    }
  }

  let result = frames.filter((_, i) => keep[i])

  // If still over 300 after threshold-based reduction, apply stricter thresholds
  if (mustReduce && result.length > 300) {
    let strictThreshold = threshold * 2
    while (result.length > 300 && strictThreshold < 10.0) {
      result = applyKeyPointReduction(result, strictThreshold)
      strictThreshold *= 2
    }
  }

  return result
}

/**
 * Export baked keyframes to the backend API.
 *
 * @param {string} name - Animation name
 * @param {number} fps - Frames per second
 * @param {Array<Object>} frames - Baked frame objects
 * @param {string} paramsHash - SHA-256 hash of animation params
 * @returns {Promise<void>}
 * @throws {Error} On network failure or non-2xx response
 */
export async function exportToBackend(name, fps, frames, paramsHash) {
  // Auto-detect which properties vary across frames
  const properties = detectVaryingProperties(frames)

  const body = {
    name,
    fps,
    duration_frames: frames.length,
    keyframes: frames,
    properties,
    transform_origin: 'center center',
    params_hash: paramsHash,
  }

  const token = localStorage.getItem('access_token')
  const response = await fetch('/api/v1/keyframes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.detail || `Export failed with status ${response.status}`
    )
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Round a value to 4 decimal places to avoid floating point noise
 * while preserving animation precision.
 */
function roundValue(val) {
  return Math.round(val * 10000) / 10000
}

/**
 * Produce canonical JSON with recursively sorted keys for deterministic hashing.
 */
function canonicalJSON(obj) {
  if (obj === null || obj === undefined) return JSON.stringify(obj)
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJSON(item)).join(',') + ']'
  }
  const sortedKeys = Object.keys(obj).sort()
  const entries = sortedKeys.map(
    (key) => JSON.stringify(key) + ':' + canonicalJSON(obj[key])
  )
  return '{' + entries.join(',') + '}'
}

/**
 * Detect which transform properties actually change across frames.
 */
function detectVaryingProperties(frames) {
  if (!frames || frames.length === 0) return []
  const properties = ['scale', 'opacity', 'x', 'y', 'rotation']
  const varying = []

  for (const prop of properties) {
    const firstVal = frames[0][prop]
    const hasVariation = frames.some((f) => f[prop] !== firstVal)
    if (hasVariation) {
      varying.push(prop)
    }
  }

  return varying
}

/**
 * Get an analytical easing function by name.
 * These are pure mathematical functions — no timing dependency.
 */
function getEasingFunction(name) {
  const easings = {
    linear: (t) => t,
    'ease-in': (t) => t * t,
    'ease-out': (t) => 1 - (1 - t) * (1 - t),
    'ease-in-out': (t) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    'ease-in-cubic': (t) => t * t * t,
    'ease-out-cubic': (t) => 1 - Math.pow(1 - t, 3),
    'ease-in-out-cubic': (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    'ease-in-quart': (t) => t * t * t * t,
    'ease-out-quart': (t) => 1 - Math.pow(1 - t, 4),
    'ease-in-out-quart': (t) =>
      t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
    'ease-out-back': (t) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    },
    'ease-out-elastic': (t) => {
      if (t === 0 || t === 1) return t
      return (
        Math.pow(2, -10 * t) *
          Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) +
        1
      )
    },
  }
  return easings[name] || easings['ease-out']
}
