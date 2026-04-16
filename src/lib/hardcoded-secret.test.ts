/**
 * Tests that verify hardcoded-secret mitigations:
 *
 * 1. LICENSE_SECRET / LICENSE_SERVER must come from env vars — no obfuscated
 *    fallback values exist in source.
 * 2. JWT_SECRET must be set; auth.ts throws at module load time if it is absent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// 1. Source-level check: no obfuscated byte arrays in middleware.ts
// ---------------------------------------------------------------------------
describe('middleware.ts — no hardcoded secret bytes', () => {
  const middlewarePath = path.resolve(__dirname, '../middleware.ts')
  let source: string

  beforeEach(() => {
    source = fs.readFileSync(middlewarePath, 'utf8')
  })

  it('does not contain the XOR key array (_k)', () => {
    // The original obfuscated key started with [122, 53, 78, 63, ...]
    expect(source).not.toMatch(/\[122,\s*53,\s*78,\s*63/)
  })

  it('does not contain the XOR mask array (_xk)', () => {
    expect(source).not.toMatch(/\[\s*42,\s*71,\s*33,\s*85/)
  })

  it('does not contain the base64-encoded license server fragment', () => {
    // atob('cHJvamVjdC14') === 'project-x'
    expect(source).not.toContain('cHJvamVjdC14')
  })

  it('does not contain a charCode-based string builder for the license server URL', () => {
    // The original encoded 'https://' as [104,116,116,112,115,58,47,47]
    expect(source).not.toMatch(/\[104,\s*116,\s*116,\s*112/)
  })

  it('reads LICENSE_SECRET exclusively from process.env', () => {
    expect(source).toMatch(/LICENSE_SECRET\s*=\s*process\.env\.LICENSE_SECRET/)
  })

  it('reads LICENSE_SERVER exclusively from process.env', () => {
    expect(source).toMatch(/LICENSE_SERVER\s*=\s*process\.env\.LICENSE_SERVER_URL/)
  })
})

// ---------------------------------------------------------------------------
// 2. auth.ts — throws when JWT_SECRET is absent
// ---------------------------------------------------------------------------
describe('auth.ts — JWT_SECRET must be set', () => {
  const originalSecret = process.env.JWT_SECRET

  afterEach(() => {
    // Restore env and clear module cache so subsequent imports are fresh
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET
    } else {
      process.env.JWT_SECRET = originalSecret
    }
    vi.resetModules()
  })

  it('throws at import time when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET
    await expect(() => import('./auth')).rejects.toThrow('JWT_SECRET environment variable is not set')
  })

  it('does not throw when JWT_SECRET is set', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough'
    await expect(import('./auth')).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 3. middleware behaviour — license check skipped when env vars are absent
// ---------------------------------------------------------------------------
describe('middleware.ts — license check skipped without config', () => {
  it('LICENSE_SERVER defaults to empty string (no fallback URL)', () => {
    // Verify the compiled constant resolves to '' when env var is unset.
    // We read the source and confirm the fallback is ?? '' not || <obfuscated>
    const middlewarePath = path.resolve(__dirname, '../middleware.ts')
    const source = fs.readFileSync(middlewarePath, 'utf8')
    expect(source).toMatch(/LICENSE_SERVER\s*=\s*process\.env\.LICENSE_SERVER_URL\s*\?\?\s*['"]['"]/)
  })

  it('LICENSE_SECRET defaults to empty string (no fallback secret)', () => {
    const middlewarePath = path.resolve(__dirname, '../middleware.ts')
    const source = fs.readFileSync(middlewarePath, 'utf8')
    expect(source).toMatch(/LICENSE_SECRET\s*=\s*process\.env\.LICENSE_SECRET\s*\?\?\s*['"]['"]/)
  })

  it('license check is guarded by both LICENSE_SERVER and LICENSE_SECRET being truthy', () => {
    const middlewarePath = path.resolve(__dirname, '../middleware.ts')
    const source = fs.readFileSync(middlewarePath, 'utf8')
    // The condition must gate on both vars
    expect(source).toMatch(/!skipLicense\s*&&\s*LICENSE_SERVER\s*&&\s*LICENSE_SECRET/)
  })
})
