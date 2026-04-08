/**
 * 简单内存滑动窗口限流
 * 每 windowMs 内最多允许 max 次请求
 */
const hits = new Map<string, number[]>()

// 定期清理过期条目
setInterval(() => {
  const now = Date.now()
  hits.forEach((timestamps, key) => {
    const valid = timestamps.filter(t => now - t < 120_000)
    if (valid.length === 0) hits.delete(key)
    else hits.set(key, valid)
  })
}, 60_000)

export function rateLimit(key: string, { max, windowMs }: { max: number; windowMs: number }): boolean {
  const now = Date.now()
  const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs)
  if (timestamps.length >= max) return false
  timestamps.push(now)
  hits.set(key, timestamps)
  return true
}
