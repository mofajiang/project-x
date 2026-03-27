/**
 * 授权验证模块
 * 向授权服务器验证当前域名是否在白名单中
 * 验证结果缓存在内存中，避免每次请求都调用授权服务器
 */

const LICENSE_SERVER = process.env.LICENSE_SERVER_URL || 'https://license.yourdomain.com'
const LICENSE_SECRET = process.env.LICENSE_SECRET || ''
const CACHE_TTL = 60 * 60 * 1000 // 1小时缓存

interface LicenseCache {
  valid: boolean
  token: string
  exp: number // 过期时间戳
}

// 内存缓存（Node.js 进程级别）
const cache = new Map<string, LicenseCache>()

function hmacSign(data: string, secret: string): string {
  const crypto = require('crypto')
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

export function verifyToken(token: string): { valid: boolean; domain?: string } {
  try {
    const crypto = require('crypto')
    // token 格式: base64(domain|exp|sig)
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const parts = decoded.split('|')
    if (parts.length !== 3) return { valid: false }
    const [domain, exp, sig] = parts
    // 验证过期
    if (Date.now() > parseInt(exp)) return { valid: false }
    // 验证签名
    const expected = hmacSign(`${domain}|${exp}`, LICENSE_SECRET)
    const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    return { valid, domain }
  } catch {
    return { valid: false }
  }
}

export async function checkLicense(host: string): Promise<boolean> {
  // 开发环境跳过验证
  if (!LICENSE_SECRET || process.env.NODE_ENV === 'development') return true
  // 本地/localhost 跳过
  if (host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('192.168.')) return true

  const cached = cache.get(host)
  if (cached && Date.now() < cached.exp) return cached.valid

  try {
    const timestamp = Date.now().toString()
    const sig = hmacSign(`${host}|${timestamp}`, LICENSE_SECRET)
    const res = await fetch(`${LICENSE_SERVER}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: host, timestamp, sig }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      // 授权服务器不可达时，允许通过（避免服务器宕机影响用户）
      cache.set(host, { valid: true, token: '', exp: Date.now() + 5 * 60 * 1000 })
      return true
    }
    const data = await res.json()
    const valid: boolean = data.valid === true
    cache.set(host, { valid, token: data.token || '', exp: Date.now() + CACHE_TTL })
    return valid
  } catch {
    // 网络错误时允许通过，避免误伤正常用户
    return true
  }
}
