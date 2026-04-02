import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { getSiteConfig } from '@/lib/config'
import { AdminVisitorMapSettings } from './AdminVisitorMapSettings'

type VisitorRow = {
  id: string
  ip: string
  country: string | null
  countryCode: string | null
  region: string | null
  city: string | null
  lat: number | null
  lon: number | null
  createdAt: string
}

type CountryGroup = {
  label: string
  count: number
  latestAt: string
  visitors: VisitorRow[]
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toPoint(lat: number, lon: number) {
  return {
    left: `${((lon + 180) / 360) * 100}%`,
    top: `${((90 - lat) / 180) * 100}%`,
  }
}

export async function AdminVisitorMap() {
  await runMigrations()
  const [visitors, total] = await Promise.all([
    prisma.$queryRawUnsafe<VisitorRow[]>(`
      SELECT
        id,
        ip,
        country,
        countryCode,
        region,
        city,
        lat,
        lon,
        CASE
          WHEN typeof(createdAt) = 'integer' THEN datetime(createdAt / 1000, 'unixepoch')
          ELSE createdAt
        END AS createdAt
      FROM Visitor
      ORDER BY
        CASE
          WHEN typeof(createdAt) = 'integer' THEN createdAt
          ELSE CAST(strftime('%s', createdAt) AS INTEGER) * 1000
        END DESC
      LIMIT 180
    `),
    prisma.visitor.count(),
  ])
  const config = await getSiteConfig()
  const sourceLabel = config.visitorGeoMode === 'custom' ? '自定义接口' : config.visitorGeoMode === 'offline' ? '离线数据库' : '腾讯内置接口'
  const latestVisitorAt = visitors[0]?.createdAt || ''

  const withCoords = visitors.filter(v => typeof v.lat === 'number' && typeof v.lon === 'number')
  const countryMap = new Map<string, CountryGroup>()
  visitors.forEach(v => {
    const label = v.country || v.countryCode || '未知'
    const current = countryMap.get(label) || { label, count: 0, latestAt: v.createdAt, visitors: [] }
    current.count += 1
    current.visitors.push(v)
    if (!current.latestAt || new Date(v.createdAt).getTime() > new Date(current.latestAt).getTime()) {
      current.latestAt = v.createdAt
    }
    countryMap.set(label, current)
  })
  const topCountries = Array.from(countryMap.entries())
    .map(([, group]) => group)
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
    .slice(0, 4)

  const stats = [
    { label: '总访问', value: total },
    { label: '国家数', value: countryMap.size },
    { label: '可定位', value: withCoords.length },
    { label: '最近时间', value: latestVisitorAt ? formatTime(latestVisitorAt) : '暂无' },
  ]

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg" style={{ color: 'var(--text-primary)' }}>🗺 访客地图</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>按访问 IP 记录地理位置，当前来源：{sourceLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{total}</p>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>总访问</p>
          </div>
          <AdminVisitorMapSettings initialMode={config.visitorGeoMode} initialEndpoint={config.visitorGeoEndpoint} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-hover)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>{stat.label}</p>
            <p className="mt-1 text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)] gap-4">
        <div className="relative min-h-[260px] sm:min-h-[320px] overflow-hidden rounded-3xl" style={{ background: 'linear-gradient(180deg, rgba(29,155,240,0.10), rgba(29,155,240,0.02))', border: '1px solid var(--border)' }}>
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.02) 40%, transparent 100%)' }} />
          <div className="absolute inset-0 p-4 sm:p-5">
            <div className="absolute inset-4 rounded-[28px] border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.10)' }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[86%] h-[70%] rounded-[42%] border border-[rgba(255,255,255,0.06)]" />
            </div>
            {withCoords.map((visitor, index) => {
              const point = toPoint(visitor.lat!, visitor.lon!)
              return (
                <div
                  key={visitor.id}
                  className="absolute"
                  style={{ left: point.left, top: point.top, transform: 'translate(-50%, -50%)' }}
                  title={`${visitor.city || visitor.region || visitor.country || '未知'} · ${visitor.ip}`}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="absolute w-6 h-6 rounded-full animate-ping" style={{ background: 'rgba(29,155,240,0.18)' }} />
                    <span className="absolute w-3 h-3 rounded-full" style={{ background: 'rgba(29,155,240,0.35)' }} />
                    <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  </div>
                </div>
              )
            })}
            {withCoords.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-center px-6" style={{ color: 'var(--text-secondary)' }}>
                <div>
                  <p className="text-sm font-medium">暂无地理坐标数据</p>
                  <p className="text-xs mt-1">新访问记录会在这里显示为地图标记</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-hover)' }}>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>最近访问国家</p>
            <div className="mt-3 flex flex-col gap-2">
              {topCountries.length > 0 ? topCountries.map(group => (
                <details key={group.label} className="rounded-2xl px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{group.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}>▼</span>
                    </span>
                    <span className="text-sm font-mono shrink-0" style={{ color: 'var(--accent)' }}>{group.count}</span>
                  </summary>
                  <div className="mt-3 flex flex-col gap-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    {group.visitors.map(visitor => (
                      <div key={visitor.id} className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="truncate" style={{ color: 'var(--text-primary)' }}>{visitor.ip}</span>
                        <span className="shrink-0" style={{ color: 'var(--text-secondary)' }}>{formatTime(visitor.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )) : (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>暂无数据</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-hover)' }}>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>最近访问</p>
            <div className="mt-3 flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {visitors.slice(0, 8).map(visitor => (
                <div key={visitor.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate" style={{ color: 'var(--text-primary)' }}>
                    {visitor.city || visitor.region || visitor.country || '未解析到真实地址'}
                  </span>
                  <span className="shrink-0 text-right" style={{ color: 'var(--text-secondary)' }}>
                    <span className="block">{visitor.ip}</span>
                    <span className="block text-[10px] mt-0.5">{formatTime(visitor.createdAt)}</span>
                  </span>
                </div>
              ))}
              {visitors.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>暂无访问记录</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
