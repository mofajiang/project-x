import { prisma } from '@/lib/prisma'
import { runMigrations } from '@/lib/db-migrate'
import { getSiteConfig } from '@/lib/config'
import { AdminVisitorMapSettings } from './AdminVisitorMapSettings'
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'

const worldCountriesTopo = require('world-atlas/countries-110m.json')

const MAP_WIDTH = 1200
const MAP_HEIGHT = 600
const worldProjection = geoEquirectangular().scale(MAP_WIDTH / (2 * Math.PI)).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])
const worldPath = geoPath(worldProjection)
const worldGraticule = worldPath(geoGraticule10()) || ''
const worldCountries = feature(worldCountriesTopo, worldCountriesTopo.objects.countries) as any

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

type MapMarker = {
  key: string
  label: string
  count: number
  latestAt: string
  lat: number
  lon: number
  visitors: VisitorRow[]
  kind: 'exact' | 'approx'
}

type Point = {
  lat: number
  lon: number
}

type WorldRegion = 'northAmerica' | 'southAmerica' | 'europe' | 'africa' | 'asia' | 'oceania' | 'middleEast' | 'fallback'

const CHINA_PROVINCE_POINTS: Record<string, Point> = {
  '北京市': { lat: 39.9042, lon: 116.4074 },
  '天津市': { lat: 39.3434, lon: 117.3616 },
  '上海市': { lat: 31.2304, lon: 121.4737 },
  '重庆市': { lat: 29.563, lon: 106.5516 },
  '河北省': { lat: 38.0428, lon: 114.5149 },
  '山西省': { lat: 37.8734, lon: 112.5627 },
  '辽宁省': { lat: 41.8057, lon: 123.4315 },
  '吉林省': { lat: 43.8171, lon: 125.3235 },
  '黑龙江省': { lat: 45.75, lon: 126.6424 },
  '江苏省': { lat: 32.0603, lon: 118.7969 },
  '浙江省': { lat: 30.2741, lon: 120.1551 },
  '安徽省': { lat: 31.8206, lon: 117.2272 },
  '福建省': { lat: 26.0745, lon: 119.2965 },
  '江西省': { lat: 28.682, lon: 115.8579 },
  '山东省': { lat: 36.6758, lon: 117.0009 },
  '河南省': { lat: 34.7466, lon: 113.6254 },
  '湖北省': { lat: 30.5928, lon: 114.3055 },
  '湖南省': { lat: 28.2282, lon: 112.9388 },
  '广东省': { lat: 23.1291, lon: 113.2644 },
  '海南省': { lat: 20.0458, lon: 110.3312 },
  '四川省': { lat: 30.5728, lon: 104.0668 },
  '贵州省': { lat: 26.647, lon: 106.6302 },
  '云南省': { lat: 25.0389, lon: 102.7183 },
  '陕西省': { lat: 34.3416, lon: 108.9398 },
  '甘肃省': { lat: 36.0611, lon: 103.8343 },
  '青海省': { lat: 36.6209, lon: 101.7801 },
  '台湾省': { lat: 25.0329, lon: 121.5654 },
  '内蒙古自治区': { lat: 40.8174, lon: 111.7663 },
  '广西壮族自治区': { lat: 23.4768, lon: 108.3275 },
  '西藏自治区': { lat: 29.652, lon: 91.1721 },
  '宁夏回族自治区': { lat: 38.4872, lon: 106.2309 },
  '新疆维吾尔自治区': { lat: 43.8256, lon: 87.6168 },
  '香港特别行政区': { lat: 22.3193, lon: 114.1694 },
  '澳门特别行政区': { lat: 22.1987, lon: 113.5439 },
}

const CHINA_PROVINCE_ALIASES: Array<[string, string]> = [
  ['北京', '北京市'], ['天津', '天津市'], ['上海', '上海市'], ['重庆', '重庆市'],
  ['河北', '河北省'], ['山西', '山西省'], ['辽宁', '辽宁省'], ['吉林', '吉林省'],
  ['黑龙江', '黑龙江省'], ['江苏', '江苏省'], ['浙江', '浙江省'], ['安徽', '安徽省'],
  ['福建', '福建省'], ['江西', '江西省'], ['山东', '山东省'], ['河南', '河南省'],
  ['湖北', '湖北省'], ['湖南', '湖南省'], ['广东', '广东省'], ['海南', '海南省'],
  ['四川', '四川省'], ['贵州', '贵州省'], ['云南', '云南省'], ['陕西', '陕西省'],
  ['甘肃', '甘肃省'], ['青海', '青海省'], ['台湾', '台湾省'], ['内蒙古', '内蒙古自治区'],
  ['广西', '广西壮族自治区'], ['西藏', '西藏自治区'], ['宁夏', '宁夏回族自治区'],
  ['新疆', '新疆维吾尔自治区'], ['香港', '香港特别行政区'], ['澳门', '澳门特别行政区'],
]

const WORLD_REGION_POINTS: Record<WorldRegion, Point> = {
  northAmerica: { lat: 40.0, lon: -100.0 },
  southAmerica: { lat: -15.0, lon: -60.0 },
  europe: { lat: 50.0, lon: 10.0 },
  africa: { lat: 5.0, lon: 20.0 },
  asia: { lat: 34.0, lon: 100.0 },
  oceania: { lat: -25.0, lon: 135.0 },
  middleEast: { lat: 31.0, lon: 45.0 },
  fallback: { lat: 20.0, lon: 0.0 },
}

const COUNTRY_HINTS: Array<{ region: WorldRegion; keywords: string[] }> = [
  { region: 'northAmerica', keywords: ['美国', '加拿大', '墨西哥', '北美', '格陵兰', '百慕大', '阿拉斯加'] },
  { region: 'southAmerica', keywords: ['巴西', '阿根廷', '智利', '秘鲁', '哥伦比亚', '厄瓜多尔', '委内瑞拉', '乌拉圭', '巴拉圭', '玻利维亚', '南美'] },
  { region: 'europe', keywords: ['英国', '法国', '德国', '意大利', '西班牙', '荷兰', '比利时', '瑞士', '奥地利', '瑞典', '挪威', '芬兰', '丹麦', '波兰', '捷克', '匈牙利', '罗马尼亚', '希腊', '葡萄牙', '爱尔兰', '冰岛', '俄罗斯', '乌克兰', '欧洲'] },
  { region: 'africa', keywords: ['非洲', '埃及', '南非', '尼日利亚', '肯尼亚', '摩洛哥', '阿尔及利亚', '埃塞俄比亚', '加纳', '坦桑尼亚', '乌干达'] },
  { region: 'asia', keywords: ['亚洲', '日本', '韩国', '朝鲜', '新加坡', '马来西亚', '泰国', '越南', '菲律宾', '印度', '印度尼西亚', '巴基斯坦', '孟加拉', '柬埔寨', '老挝', '缅甸'] },
  { region: 'oceania', keywords: ['澳大利亚', '新西兰', '大洋洲', '悉尼', '墨尔本', '堪培拉'] },
  { region: 'middleEast', keywords: ['中东', '阿联酋', '沙特', '以色列', '伊朗', '伊拉克', '土耳其', '卡塔尔', '科威特', '约旦', '黎巴嫩'] },
]

function cleanText(value: string) {
  return value.replace(/\s+/g, '').trim()
}

function hashToOffset(seed: string) {
  let hash = 0
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }

  return {
    latDelta: ((hash % 2000) / 2000) * 8 - 4,
    lonDelta: (((hash / 2000) % 2000) / 2000) * 8 - 4,
  }
}

function pickWorldRegion(text: string): WorldRegion {
  const normalized = cleanText(text)
  for (const item of COUNTRY_HINTS) {
    if (item.keywords.some(keyword => normalized.includes(cleanText(keyword)))) {
      return item.region
    }
  }
  return 'fallback'
}

function getRegionPoint(region: WorldRegion, seed: string): Point {
  const base = WORLD_REGION_POINTS[region]
  const offset = hashToOffset(seed)
  return {
    lat: Math.max(-60, Math.min(75, base.lat + offset.latDelta)),
    lon: Math.max(-180, Math.min(180, base.lon + offset.lonDelta)),
  }
}

function resolveChinaProvince(region: string, city: string) {
  const candidates = [region, city].map(cleanText).filter(Boolean)
  for (const candidate of candidates) {
    for (const [alias, label] of CHINA_PROVINCE_ALIASES) {
      if (candidate.includes(alias)) {
        return { label, point: CHINA_PROVINCE_POINTS[label] }
      }
    }
    for (const [label, point] of Object.entries(CHINA_PROVINCE_POINTS)) {
      const short = label.replace(/(省|市|自治区|特别行政区)/g, '')
      if (candidate.includes(short)) {
        return { label, point }
      }
    }
  }
  return null
}

function resolveApproxLocation(visitor: VisitorRow) {
  const country = (visitor.country || visitor.countryCode || '').trim()
  const region = (visitor.region || '').trim()
  const city = (visitor.city || '').trim()
  const isChina = /中国/.test(country) || visitor.countryCode === 'CN' || /中国/.test(region)

  if (isChina) {
    const province = resolveChinaProvince(region, city)
    if (province) {
      return {
        label: province.label,
        point: province.point,
      }
    }
    return {
      label: '中国',
      point: { lat: 35.8617, lon: 104.1954 },
    }
  }

  const label = country || region || city || '未知'
  const regionKey = pickWorldRegion(`${country} ${region} ${city}`)
  return {
    label,
    point: getRegionPoint(regionKey, label),
  }
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
  const sourceLabelMap: Record<string, string> = {
    offline: '离线数据库',
    ip9: 'IP9 公共接口',
    uapis: 'Uapis 查询我的 IP',
    custom: '自定义接口',
  }
  const sourceLabel = sourceLabelMap[config.visitorGeoMode] || '自定义接口'
  const latestVisitorAt = visitors[0]?.createdAt || ''

  const exactMarkers: MapMarker[] = visitors
    .filter(v => typeof v.lat === 'number' && typeof v.lon === 'number')
    .map(v => ({
      key: `exact-${v.id}`,
      label: v.city || v.region || v.country || '未知',
      count: 1,
      latestAt: v.createdAt,
      lat: v.lat!,
      lon: v.lon!,
      visitors: [v],
      kind: 'exact' as const,
    }))

  const approxGroups = new Map<string, MapMarker>()
  visitors
    .filter(v => typeof v.lat !== 'number' || typeof v.lon !== 'number')
    .forEach(v => {
      const resolved = resolveApproxLocation(v)
      const current = approxGroups.get(resolved.label) || {
        key: `approx-${resolved.label}`,
        label: resolved.label,
        count: 0,
        latestAt: v.createdAt,
        lat: resolved.point.lat,
        lon: resolved.point.lon,
        visitors: [],
        kind: 'approx' as const,
      }
      current.count += 1
      current.visitors.push(v)
      current.lat = resolved.point.lat
      current.lon = resolved.point.lon
      if (!current.latestAt || new Date(v.createdAt).getTime() > new Date(current.latestAt).getTime()) {
        current.latestAt = v.createdAt
      }
      approxGroups.set(resolved.label, current)
    })

  const approxMarkers = Array.from(approxGroups.values())
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())

  const mapMarkers = [...exactMarkers, ...approxMarkers]
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
    { label: '精确坐标', value: exactMarkers.length },
    { label: '国家/省份落点', value: approxMarkers.length },
    { label: '最近时间', value: latestVisitorAt ? formatTime(latestVisitorAt) : '暂无' },
  ]

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg" style={{ color: 'var(--text-primary)' }}>🗺 访客地图</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>按访问 IP 记录地理位置，当前来源：{sourceLabel}，无精确坐标时会按国家或省份生成落点</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{total}</p>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>总访问</p>
          </div>
          <AdminVisitorMapSettings initialMode={config.visitorGeoMode} initialEndpoint={config.visitorGeoEndpoint} initialKey={config.visitorGeoKey} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-hover)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-secondary)' }}>{stat.label}</p>
            <p className="mt-1 text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)] gap-4">
        <div className="relative min-h-[260px] sm:min-h-[320px] overflow-hidden rounded-3xl" style={{ background: 'linear-gradient(180deg, var(--visitor-map-frame-start), var(--visitor-map-frame-end))', border: '1px solid var(--border)' }}>
          <div className="absolute inset-0 opacity-100" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--visitor-map-grid) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.02) 42%, transparent 100%)' }} />
          <div className="absolute inset-0 p-4 sm:p-5">
            <svg
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              preserveAspectRatio="none"
              className="visitor-world-map absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="world-map-ocean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--visitor-map-ocean-top)" />
                  <stop offset="100%" stopColor="var(--visitor-map-ocean-bottom)" />
                </linearGradient>
              </defs>
              <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx={32} fill="url(#world-map-ocean)" />
              <path d={worldGraticule} fill="none" stroke="var(--visitor-map-grid)" strokeWidth={1} />
              {worldCountries.features.map((country: any) => (
                <path
                  key={country.id}
                  d={worldPath(country) || undefined}
                  fill="var(--visitor-map-land-fill)"
                  stroke="var(--visitor-map-land-stroke)"
                  strokeWidth={0.8}
                />
              ))}
            </svg>
            {mapMarkers.map(marker => {
              const point = toPoint(marker.lat, marker.lon)
              return (
                <div
                  key={marker.key}
                  className="absolute"
                  style={{ left: point.left, top: point.top, transform: 'translate(-50%, -50%)' }}
                  title={`${marker.label} · ${marker.count} 条访问 · ${formatTime(marker.latestAt)}`}
                >
                  {marker.kind === 'exact' ? (
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-6 h-6 rounded-full animate-ping" style={{ background: 'rgba(29,155,240,0.18)' }} />
                      <span className="absolute w-3 h-3 rounded-full" style={{ background: 'rgba(29,155,240,0.35)' }} />
                      <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-8 h-8 rounded-full border animate-pulse" style={{ borderColor: 'rgba(29,155,240,0.28)', background: 'rgba(29,155,240,0.08)' }} />
                      <span className="absolute w-5 h-5 rounded-full" style={{ background: 'rgba(29,155,240,0.24)' }} />
                      <span className="relative px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{marker.count}</span>
                    </div>
                  )}
                </div>
              )
            })}
            {mapMarkers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-center px-6" style={{ color: 'var(--text-secondary)' }}>
                <div>
                  <p className="text-sm font-medium">暂无可显示的访问点位</p>
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
