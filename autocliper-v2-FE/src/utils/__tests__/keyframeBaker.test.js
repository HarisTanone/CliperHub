import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  bakeAnimation,
  computeParamsHash,
  applyKeyPointReduction,
  exportToBackend,
} from '../keyframeBaker.js'

describe('bakeAnimation', () => {
  it('produces expected frame count for easing animation at given duration/fps', () => {
    const frames = bakeAnimation({
      type: 'easing',
      initial: { scale: 0, opacity: 0, x: 0, y: -30, rotation: 0 },
      target: { scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
      duration: 1000,
      easing: 'ease-out',
    }, 30)

    // 1000ms at 30fps = 30 frames + 1 (frame 0 through frame 30)
    expect(frames.length).toBe(31)
    expect(frames[0].frame).toBe(0)
    expect(frames[30].frame).toBe(30)
  })

  it('spring animation produces frames and eventually settles', () => {
    const frames = bakeAnimation({
      type: 'spring',
      initial: { scale: 0, opacity: 0, x: 0, y: -30, rotation: 0 },
      target: { scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
      spring: { stiffness: 100, damping: 10, mass: 1 },
    }, 30)

    expect(frames.length).toBeGreaterThan(1)
    // First frame should match initial values
    expect(frames[0].scale).toBe(0)
    expect(frames[0].opacity).toBe(0)
    expect(frames[0].y).toBe(-30)

    // Last frame should match target values
    const last = frames[frames.length - 1]
    expect(last.scale).toBe(1)
    expect(last.opacity).toBe(1)
    expect(last.y).toBe(0)
  })

  it('produces deterministic output for same parameters', () => {
    const params = {
      type: 'spring',
      initial: { scale: 0, opacity: 0, x: 0, y: -20, rotation: 0 },
      target: { scale: 1.2, opacity: 1, x: 10, y: 0, rotation: 5 },
      spring: { stiffness: 150, damping: 12, mass: 1 },
    }
    const run1 = bakeAnimation(params, 30)
    const run2 = bakeAnimation(params, 30)

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2))
  })

  it('easing animation first frame is initial, last frame is target', () => {
    const frames = bakeAnimation({
      type: 'easing',
      initial: { scale: 0.5, opacity: 0, x: -50, y: 0, rotation: -10 },
      target: { scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
      duration: 500,
      easing: 'linear',
    }, 30)

    expect(frames[0].scale).toBe(0.5)
    expect(frames[0].opacity).toBe(0)
    expect(frames[0].x).toBe(-50)
    expect(frames[0].rotation).toBe(-10)

    const last = frames[frames.length - 1]
    expect(last.scale).toBe(1)
    expect(last.opacity).toBe(1)
    expect(last.x).toBe(0)
    expect(last.rotation).toBe(0)
  })

  it('each frame has a sequential frame index', () => {
    const frames = bakeAnimation({
      type: 'easing',
      initial: { scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 },
      target: { scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
      duration: 300,
      easing: 'linear',
    }, 30)

    for (let i = 0; i < frames.length; i++) {
      expect(frames[i].frame).toBe(i)
    }
  })

  it('does not use requestAnimationFrame', () => {
    // Define requestAnimationFrame so we can spy on it
    globalThis.requestAnimationFrame = vi.fn()
    const spy = vi.spyOn(globalThis, 'requestAnimationFrame')
    bakeAnimation({
      type: 'spring',
      initial: { scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 },
      target: { scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
      spring: { stiffness: 100, damping: 10, mass: 1 },
    }, 30)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    delete globalThis.requestAnimationFrame
  })
})

describe('computeParamsHash', () => {
  beforeEach(() => {
    // Web Crypto polyfill for Node test environment
    if (!globalThis.crypto?.subtle) {
      const { webcrypto } = require('crypto')
      globalThis.crypto = webcrypto
    }
  })

  it('same params produce same hash', async () => {
    const params = { type: 'spring', stiffness: 100, damping: 10 }
    const hash1 = await computeParamsHash(params)
    const hash2 = await computeParamsHash(params)
    expect(hash1).toBe(hash2)
  })

  it('different params produce different hash', async () => {
    const hash1 = await computeParamsHash({ type: 'spring', stiffness: 100 })
    const hash2 = await computeParamsHash({ type: 'spring', stiffness: 200 })
    expect(hash1).not.toBe(hash2)
  })

  it('key order does not affect hash (canonical JSON)', async () => {
    const hash1 = await computeParamsHash({ b: 2, a: 1 })
    const hash2 = await computeParamsHash({ a: 1, b: 2 })
    expect(hash1).toBe(hash2)
  })

  it('returns a 64-character hex string', async () => {
    const hash = await computeParamsHash({ test: true })
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('applyKeyPointReduction', () => {
  it('keeps first and last frame always', () => {
    const frames = [
      { frame: 0, scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 },
      { frame: 1, scale: 0.5, opacity: 0.5, x: 0, y: 0, rotation: 0 },
      { frame: 2, scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
    ]
    const reduced = applyKeyPointReduction(frames, 0.01)
    expect(reduced[0]).toEqual(frames[0])
    expect(reduced[reduced.length - 1]).toEqual(frames[2])
  })

  it('removes frames within threshold of linear interpolation', () => {
    // Create a perfectly linear animation — all middle frames should be removable
    const frames = []
    for (let i = 0; i <= 10; i++) {
      frames.push({
        frame: i,
        scale: i / 10,
        opacity: i / 10,
        x: i * 5,
        y: 0,
        rotation: 0,
      })
    }
    const reduced = applyKeyPointReduction(frames, 0.01)
    // Linear interpolation means middle frames are redundant
    expect(reduced.length).toBe(2) // Only first and last
  })

  it('keeps frames with significant deviation', () => {
    const frames = [
      { frame: 0, scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 },
      { frame: 1, scale: 1.5, opacity: 1, x: 0, y: 0, rotation: 0 }, // Overshoot
      { frame: 2, scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
    ]
    const reduced = applyKeyPointReduction(frames, 0.01)
    expect(reduced.length).toBe(3) // All kept — frame 1 deviates significantly
  })

  it('returns input unchanged when <= 2 frames', () => {
    const frames = [
      { frame: 0, scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 },
      { frame: 1, scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
    ]
    const reduced = applyKeyPointReduction(frames, 0.01)
    expect(reduced).toEqual(frames)
  })

  it('reduces below 300 when input exceeds 300 frames', () => {
    // Generate 400 frames with mostly linear motion but some overshoot
    const frames = []
    for (let i = 0; i <= 400; i++) {
      const t = i / 400
      frames.push({
        frame: i,
        scale: t,
        opacity: t,
        x: t * 100,
        y: 0,
        rotation: 0,
      })
    }
    const reduced = applyKeyPointReduction(frames, 0.01)
    expect(reduced.length).toBeLessThanOrEqual(300)
  })
})

describe('exportToBackend', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'test-token'),
    })
  })

  it('calls POST /api/v1/keyframes with correct body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const frames = [
      { frame: 0, scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 },
      { frame: 10, scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
    ]
    await exportToBackend('fade_in', 30, frames, 'abc123hash')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/keyframes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: expect.any(String),
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.name).toBe('fade_in')
    expect(body.fps).toBe(30)
    expect(body.duration_frames).toBe(2)
    expect(body.keyframes).toEqual(frames)
    expect(body.properties).toEqual(['scale', 'opacity'])
    expect(body.transform_origin).toBe('center center')
    expect(body.params_hash).toBe('abc123hash')
  })

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: 'Validation error' }),
    }))

    await expect(
      exportToBackend('test', 30, [], 'hash')
    ).rejects.toThrow('Validation error')
  })
})
