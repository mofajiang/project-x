import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rateLimit } from './rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    // Use fake timers to control Date.now()
    vi.useFakeTimers()
  })

  it('allows requests within limit', () => {
    const key = 'test-allow-' + Math.random()
    expect(rateLimit(key, { max: 3, windowMs: 60000 })).toBe(true)
    expect(rateLimit(key, { max: 3, windowMs: 60000 })).toBe(true)
    expect(rateLimit(key, { max: 3, windowMs: 60000 })).toBe(true)
  })

  it('blocks requests exceeding limit', () => {
    const key = 'test-block-' + Math.random()
    rateLimit(key, { max: 2, windowMs: 60000 })
    rateLimit(key, { max: 2, windowMs: 60000 })
    expect(rateLimit(key, { max: 2, windowMs: 60000 })).toBe(false)
  })

  it('allows requests after window expires', () => {
    const key = 'test-expire-' + Math.random()
    rateLimit(key, { max: 1, windowMs: 1000 })
    expect(rateLimit(key, { max: 1, windowMs: 1000 })).toBe(false)

    // Advance time past window
    vi.advanceTimersByTime(1001)
    expect(rateLimit(key, { max: 1, windowMs: 1000 })).toBe(true)
  })

  it('tracks different keys independently', () => {
    const key1 = 'test-key1-' + Math.random()
    const key2 = 'test-key2-' + Math.random()
    rateLimit(key1, { max: 1, windowMs: 60000 })
    expect(rateLimit(key1, { max: 1, windowMs: 60000 })).toBe(false)
    expect(rateLimit(key2, { max: 1, windowMs: 60000 })).toBe(true)
  })
})
