import { describe, it, expect } from 'vitest'
import { buildSlugCandidates } from './slug'

describe('buildSlugCandidates', () => {
  it('returns empty array for empty input', () => {
    expect(buildSlugCandidates('')).toEqual([])
    expect(buildSlugCandidates('  ')).toEqual([])
  })

  it('includes raw input', () => {
    const result = buildSlugCandidates('hello-world')
    expect(result).toContain('hello-world')
  })

  it('includes decoded and encoded variants', () => {
    const encoded = encodeURIComponent('你好')
    const result = buildSlugCandidates(encoded)
    expect(result).toContain(encoded)
    expect(result).toContain('你好')
  })

  it('includes NFC and NFD normalized forms', () => {
    const nfc = '\u00e9' // é (single codepoint)
    const nfd = '\u0065\u0301' // é (e + combining accent)
    const result = buildSlugCandidates(nfc)
    expect(result).toContain(nfc)
    expect(result).toContain(nfd)
  })

  it('deduplicates results', () => {
    const result = buildSlugCandidates('abc')
    const unique = new Set(result)
    expect(result.length).toBe(unique.size)
  })

  it('handles already decoded Unicode input', () => {
    const result = buildSlugCandidates('博客文章')
    expect(result).toContain('博客文章')
    expect(result).toContain(encodeURIComponent('博客文章'))
  })

  it('filters out empty strings', () => {
    const result = buildSlugCandidates('test')
    expect(result.every(Boolean)).toBe(true)
  })
})
