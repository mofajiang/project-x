// Authorization verification module

// Encoded configuration (runtime-assembled, not plain text)
const _a = (s: number[]) => s.map(c => String.fromCharCode(c)).join('')
const _b = (s: string) => Buffer.from(s, 'base64').toString()

// LICENSE_SERVER_URL segments (assembled at runtime)
const _s1 = _a([104,116,116,112,115,58,47,47])
const _s2 = _b('cHJvamVjdC14')
const _s3 = _a([46,104,97,116,104,115,46,110,101,116])
const _DEFAULT_SERVER = _s1 + _s2 + _s3

// LICENSE_SECRET (XOR encoded, decoded at runtime)
// encoded[i] = original[i] ^ xorKey[i]
const _k  = [122, 53, 78, 63,118, 95, 44,101,111,118, 90, 83,114, 87]
const _xk = [ 42, 71, 33, 85, 19, 60, 88, 72, 55, 91, 24, 63, 29, 48]
const _DEFAULT_SECRET = _a(_k.map((c, i) => c ^ _xk[i]))

const LICENSE_SERVER = process.env.LICENSE_SERVER_URL || _DEFAULT_SERVER
const LICENSE_SECRET = process.env.LICENSE_SECRET || _DEFAULT_SECRET
const CACHE_TTL = 60 * 60 * 1000

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
  // 本地/localhost 跳过（纯本地开发，无域名无法授权）
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
      // 严格模式：授权服务器返回非 2xx，拒绝访问，短暂缓存避免频繁请求
      cache.set(host, { valid: false, token: '', exp: Date.now() + 2 * 60 * 1000 })
      return false
    }
    const data = await res.json()
    const valid: boolean = data.valid === true
    cache.set(host, { valid, token: data.token || '', exp: Date.now() + CACHE_TTL })
    return valid
  } catch {
    // 严格模式：网络异常（授权服务器不可达），拒绝访问，短暂缓存 2 分钟
    cache.set(host, { valid: false, token: '', exp: Date.now() + 2 * 60 * 1000 })
    return false
  }
}
