import { describe, it, expect } from 'vitest'
import { slugify, formatViews, formatSize, formatTime } from './utils'

describe('slugify', () => {
  it('converts text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Hello! @World#')).toBe('hello-world')
  })

  it('preserves Chinese characters', () => {
    expect(slugify('你好世界')).toBe('你好世界')
  })

  it('preserves Japanese characters', () => {
    expect(slugify('こんにちは')).toBe('こんにちは')
  })

  it('preserves Korean characters', () => {
    expect(slugify('안녕하세요')).toBe('안녕하세요')
  })

  it('handles mixed content', () => {
    expect(slugify('My 博客 Post')).toBe('my-博客-post')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('collapses multiple spaces to single dash', () => {
    expect(slugify('hello   world')).toBe('hello-world')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })
})

describe('formatViews', () => {
  it('returns raw number for small values', () => {
    expect(formatViews(0)).toBe('0')
    expect(formatViews(1)).toBe('1')
    expect(formatViews(999)).toBe('999')
  })

  it('uses k for thousands', () => {
    expect(formatViews(1000)).toBe('1.0k')
    expect(formatViews(1500)).toBe('1.5k')
    expect(formatViews(9999)).toBe('10.0k')
  })

  it('uses 万 for ten-thousands', () => {
    expect(formatViews(10000)).toBe('1.0万')
    expect(formatViews(15000)).toBe('1.5万')
    expect(formatViews(100000)).toBe('10.0万')
  })
})

describe('formatSize', () => {
  it('formats bytes', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(1023)).toBe('1023 B')
  })

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatSize(5.5 * 1024 * 1024)).toBe('5.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })
})

describe('formatTime', () => {
  it('returns dash for null', () => {
    expect(formatTime(null)).toBe('-')
  })

  it('returns original string for invalid date', () => {
    expect(formatTime('not-a-date')).toBe('not-a-date')
  })

  it('formats valid date string', () => {
    const result = formatTime('2024-01-15T10:30:00Z')
    expect(result).toMatch(/2024/)
  })

  it('formats Date object', () => {
    const result = formatTime(new Date('2024-06-01T12:00:00Z'))
    expect(result).toMatch(/2024/)
  })
})
