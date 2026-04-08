import { describe, it, expect } from 'vitest'
import { isPublicIp } from './request-ip'

describe('isPublicIp', () => {
  it('returns false for localhost IPv4', () => {
    expect(isPublicIp('127.0.0.1')).toBe(false)
  })

  it('returns false for localhost IPv6', () => {
    expect(isPublicIp('::1')).toBe(false)
  })

  it('returns false for 10.x.x.x private range', () => {
    expect(isPublicIp('10.0.0.1')).toBe(false)
    expect(isPublicIp('10.255.255.255')).toBe(false)
  })

  it('returns false for 192.168.x.x private range', () => {
    expect(isPublicIp('192.168.0.1')).toBe(false)
    expect(isPublicIp('192.168.1.100')).toBe(false)
  })

  it('returns false for 172.16-31.x.x private range', () => {
    expect(isPublicIp('172.16.0.1')).toBe(false)
    expect(isPublicIp('172.31.255.255')).toBe(false)
  })

  it('returns true for public IPs', () => {
    expect(isPublicIp('8.8.8.8')).toBe(true)
    expect(isPublicIp('1.1.1.1')).toBe(true)
    expect(isPublicIp('203.0.113.1')).toBe(true)
  })

  it('returns false for unknown', () => {
    expect(isPublicIp('unknown')).toBe(false)
  })

  it('strips IPv6-mapped IPv4 prefix', () => {
    expect(isPublicIp('::ffff:8.8.8.8')).toBe(true)
    expect(isPublicIp('::ffff:127.0.0.1')).toBe(false)
  })

  it('returns false for 172.15.x (not private) → true', () => {
    expect(isPublicIp('172.15.0.1')).toBe(true)
  })

  it('returns false for 172.32.x (not private) → true', () => {
    expect(isPublicIp('172.32.0.1')).toBe(true)
  })
})
