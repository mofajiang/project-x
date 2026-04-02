import type { NextRequest } from 'next/server'

function cleanIp(ip: string) {
  return ip.replace(/^::ffff:/i, '').trim()
}

function isPrivateIp(ip: string) {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  )
}

export function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || ''
  const raw = forwarded.split(',')[0] || req.ip || ''
  const ip = cleanIp(raw)
  return ip || 'unknown'
}

export function isPublicIp(ip: string) {
  const value = cleanIp(ip)
  return value !== 'unknown' && !isPrivateIp(value)
}
