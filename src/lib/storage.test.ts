import { describe, it, expect } from 'vitest'
import { extOf, safeBaseName, safeName } from './storage'

describe('extOf', () => {
  it('extracts file extension', () => {
    expect(extOf('photo.jpg')).toBe('jpg')
    expect(extOf('document.PDF')).toBe('pdf')
    expect(extOf('archive.tar.gz')).toBe('gz')
  })

  it('returns empty string for no extension', () => {
    expect(extOf('README')).toBe('')
    expect(extOf('')).toBe('')
  })
})

describe('safeBaseName', () => {
  it('preserves normal filenames', () => {
    expect(safeBaseName('photo.jpg')).toBe('photo.jpg')
    expect(safeBaseName('my-file_2024.png')).toBe('my-file_2024.png')
  })

  it('replaces dangerous characters', () => {
    expect(safeBaseName('file\\path')).toBe('file-path')
    expect(safeBaseName('file:name')).toBe('file-name')
    expect(safeBaseName('file*name')).toBe('file-name')
    expect(safeBaseName('file?name')).toBe('file-name')
    expect(safeBaseName('file<name>')).toBe('file-name')
    expect(safeBaseName('file|name')).toBe('file-name')
  })

  it('prevents path traversal', () => {
    expect(safeBaseName('../../../etc/passwd')).toBe('etc-passwd')
    expect(safeBaseName('..\\..\\windows\\system32')).toBe('windows-system32')
  })

  it('returns empty for dot-only names', () => {
    expect(safeBaseName('.')).toBe('')
    expect(safeBaseName('..')).toBe('')
  })

  it('collapses multiple dashes', () => {
    expect(safeBaseName('a---b')).toBe('a-b')
  })

  it('trims leading/trailing dashes and dots', () => {
    expect(safeBaseName('--hello--')).toBe('hello')
    expect(safeBaseName('..hello..')).toBe('hello')
  })

  it('handles null/undefined via String()', () => {
    expect(safeBaseName('')).toBe('')
  })
})

describe('safeName', () => {
  it('decodes URL-encoded names', () => {
    expect(safeName('%E4%BD%A0%E5%A5%BD.png')).toBe('你好.png')
  })

  it('handles special characters after decoding', () => {
    expect(safeName('file%3Aname')).toBe('file-name')
  })
})
