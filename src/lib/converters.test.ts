import { describe, it, expect } from 'vitest'
import { toSafeNumber, toSafeBoolean, toJsonSafe, getErrorMessage } from './converters'

describe('toSafeNumber', () => {
  it('returns number for valid number input', () => {
    expect(toSafeNumber(42, 0)).toBe(42)
    expect(toSafeNumber(0, 10)).toBe(0)
    expect(toSafeNumber(-3.14, 0)).toBe(-3.14)
  })

  it('returns fallback for NaN/Infinity', () => {
    expect(toSafeNumber(NaN, 5)).toBe(5)
    expect(toSafeNumber(Infinity, 5)).toBe(5)
    expect(toSafeNumber(-Infinity, 5)).toBe(5)
  })

  it('converts BigInt to number', () => {
    expect(toSafeNumber(BigInt(100), 0)).toBe(100)
    expect(toSafeNumber(BigInt(-50), 0)).toBe(-50)
  })

  it('parses string numbers', () => {
    expect(toSafeNumber('42', 0)).toBe(42)
    expect(toSafeNumber('3.14', 0)).toBe(3.14)
    expect(toSafeNumber('', 10)).toBe(0) // Number('') === 0, which is finite
    expect(toSafeNumber('abc', 10)).toBe(10)
  })

  it('returns fallback for other types', () => {
    expect(toSafeNumber(null, 7)).toBe(7)
    expect(toSafeNumber(undefined, 7)).toBe(7)
    expect(toSafeNumber(true, 7)).toBe(7)
    expect(toSafeNumber({}, 7)).toBe(7)
    expect(toSafeNumber([], 7)).toBe(7)
  })
})

describe('toSafeBoolean', () => {
  it('returns boolean values directly', () => {
    expect(toSafeBoolean(true)).toBe(true)
    expect(toSafeBoolean(false)).toBe(false)
  })

  it('converts numbers', () => {
    expect(toSafeBoolean(1)).toBe(true)
    expect(toSafeBoolean(0)).toBe(false)
    expect(toSafeBoolean(-1)).toBe(true)
    expect(toSafeBoolean(42)).toBe(true)
  })

  it('converts BigInt', () => {
    expect(toSafeBoolean(BigInt(1))).toBe(true)
    expect(toSafeBoolean(BigInt(0))).toBe(false)
  })

  it('parses truthy strings', () => {
    expect(toSafeBoolean('1')).toBe(true)
    expect(toSafeBoolean('true')).toBe(true)
    expect(toSafeBoolean('True')).toBe(true)
    expect(toSafeBoolean('TRUE')).toBe(true)
    expect(toSafeBoolean('yes')).toBe(true)
    expect(toSafeBoolean('on')).toBe(true)
    expect(toSafeBoolean(' true ')).toBe(true)
  })

  it('parses falsy strings', () => {
    expect(toSafeBoolean('0')).toBe(false)
    expect(toSafeBoolean('false')).toBe(false)
    expect(toSafeBoolean('False')).toBe(false)
    expect(toSafeBoolean('no')).toBe(false)
    expect(toSafeBoolean('off')).toBe(false)
  })

  it('returns fallback for unrecognized strings', () => {
    expect(toSafeBoolean('maybe', true)).toBe(true)
    expect(toSafeBoolean('', false)).toBe(false)
  })

  it('returns fallback for null/undefined/object', () => {
    expect(toSafeBoolean(null, true)).toBe(true)
    expect(toSafeBoolean(undefined, false)).toBe(false)
    expect(toSafeBoolean({}, true)).toBe(true)
  })
})

describe('toJsonSafe', () => {
  it('passes through normal values', () => {
    expect(toJsonSafe({ a: 1, b: 'hello' })).toEqual({ a: 1, b: 'hello' })
    expect(toJsonSafe([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('converts BigInt to number when safe', () => {
    expect(toJsonSafe({ count: BigInt(42) })).toEqual({ count: 42 })
    expect(toJsonSafe({ count: BigInt(0) })).toEqual({ count: 0 })
  })

  it('converts large BigInt to string', () => {
    const big = BigInt('9999999999999999999')
    const result = toJsonSafe({ value: big })
    expect(result.value).toBe('9999999999999999999')
  })

  it('handles nested structures', () => {
    const input = { a: { b: BigInt(7), c: [BigInt(3)] } }
    const result = toJsonSafe(input)
    expect(result).toEqual({ a: { b: 7, c: [3] } })
  })
})

describe('getErrorMessage', () => {
  it('extracts message from Error', () => {
    expect(getErrorMessage(new Error('test error'))).toBe('test error')
  })

  it('converts string to itself', () => {
    expect(getErrorMessage('something went wrong')).toBe('something went wrong')
  })

  it('converts number to string', () => {
    expect(getErrorMessage(404)).toBe('404')
  })

  it('returns empty string for null/undefined', () => {
    expect(getErrorMessage(null)).toBe('')
    expect(getErrorMessage(undefined)).toBe('')
  })
})
