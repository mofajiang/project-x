'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
const IconSettings = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const IconLoader = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="animate-spin"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

const IconTrash = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)
import toast from 'react-hot-toast'

type Props = {
  initialMode: string
  initialEndpoint: string
  initialKey: string
  initialMapSource?: string
  initialStatsDisplay?: string
}

export function AdminVisitorMapSettings({
  initialMode,
  initialEndpoint,
  initialKey,
  initialMapSource,
  initialStatsDisplay,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [updatingDb, setUpdatingDb] = useState(false)
  const [mode, setMode] = useState(initialMode || 'ip9')
  const [mapSource, setMapSource] = useState(initialMapSource || 'carto_positron')
  const defaultStatsOptions = [
    '总访问',
    '今日访问',
    '7 日访问',
    '14 日访问',
    '国家数',
    '精确坐标',
    '国家/省份落点',
    '最近时间',
  ]
  const [statsDisplay, setStatsDisplay] = useState<string[]>(() => {
    // 严格按 initialStatsDisplay 初始化
    if (!initialStatsDisplay) {
      // 第一次没有保存过配置时，显示为空（用户需要主动选择）
      return defaultStatsOptions
    }
    try {
      const parsed = JSON.parse(initialStatsDisplay)
      // 直接使用解析结果，即使为空数组；同时兼容旧的“7日访问”写法
      return Array.isArray(parsed)
        ? parsed.map((item: string) => (item === '7日访问' ? '7 日访问' : item))
        : defaultStatsOptions
    } catch {
      return defaultStatsOptions
    }
  })
  const customDefaultEndpoint = 'https://example.com/api/geo?ip={ip}'
  const [endpoint, setEndpoint] = useState(initialEndpoint || (initialMode === 'custom' ? customDefaultEndpoint : ''))
  const [key, setKey] = useState(initialKey || '')

  const statsOptions = defaultStatsOptions
  const saveEndpoint = mode === 'custom' ? endpoint : ''
  const saveKey = mode === 'custom' ? key : ''

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorGeoMode: mode,
          visitorGeoKey: saveKey,
          visitorGeoEndpoint: saveEndpoint,
          visitorMapSource: mapSource,
          visitorStatsDisplay: JSON.stringify(statsDisplay),
        }),
      })
      if (!res.ok) throw new Error('保存失败')
      toast.success('访客地图设置已保存')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const clearLogs = async () => {
    if (!confirm('确定清除所有访客日志？此操作不可恢复。')) return
    setClearing(true)
    try {
      const res = await fetch('/api/admin/visitors', { method: 'DELETE' })
      if (!res.ok) throw new Error('清除失败')
      toast.success('访客日志已清除')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('清除失败')
    } finally {
      setClearing(false)
    }
  }

  const updateOfflineDb = async () => {
    if (!confirm('确定更新离线数据库？这需要 MaxMind License Key（可用环境变量或下面输入框提供）。')) return
    setUpdatingDb(true)
    try {
      const res = await fetch('/api/admin/geoip/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key || undefined }),
      })
      if (!res.ok) throw new Error('更新失败')
      toast.success('离线数据库已更新')
    } catch {
      toast.error('离线数据库更新失败')
    } finally {
      setUpdatingDb(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        style={{ background: open ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-secondary)' }}
        title="访客地图设置"
      >
        <IconSettings size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-[9999] mt-2 w-[320px] max-w-[calc(100vw-1rem)] rounded-2xl p-4 shadow-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                访客地图设置
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                参考 IP9 的 GET 配置方式来配置内置接口，支持离线数据库、IP9 或自定义接口
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-xs"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            >
              关闭
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>地理来源</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="offline">离线数据库</option>
                <option value="ip9">IP9 公共接口</option>
                <option value="ipwho">ipwho.is</option>
                <option value="ipapi">ipapi.co</option>
                <option value="ipinfo">ipinfo.io</option>
                <option value="ip-api">ip-api.com</option>
                <option value="geolocation-db">geolocation-db.com</option>
                <option value="custom">自定义接口</option>
              </select>
            </label>

            {mode === 'custom' && (
              <label className="flex flex-col gap-1.5 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>API Key（可选）</span>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="可留空；填写后会自动加上 Authorization: Bearer"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>地图样式</span>
              <select
                value={mapSource}
                onChange={(e) => setMapSource(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="carto_positron">CARTO Positron（浅色）</option>
                <option value="carto_voyager">CARTO Voyager（详细）</option>
                <option value="arcgis_street">ArcGIS Street（街道）</option>
                <option value="arcgis_satellite">ArcGIS Satellite（卫星）</option>
                <option value="osm">OpenStreetMap（开放）</option>
              </select>
            </label>

            <div className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>统计数据框显示</span>
              <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
                {statsOptions.map((option) => (
                  <label key={option} className="relative flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={statsDisplay.includes(option)}
                      onChange={(e) =>
                        setStatsDisplay((prev) =>
                          e.target.checked
                            ? prev.includes(option)
                              ? prev
                              : [...prev, option]
                            : prev.filter((item) => item !== option)
                        )
                      }
                      className="h-4 w-4 flex-shrink-0 cursor-pointer appearance-none rounded transition-colors"
                      style={{
                        background: statsDisplay.includes(option) ? 'var(--accent)' : 'var(--bg-secondary)',
                        border: `2px solid ${statsDisplay.includes(option) ? 'var(--accent)' : 'var(--border)'}`,
                        boxSizing: 'border-box',
                      }}
                    />
                    {statsDisplay.includes(option) && (
                      <span
                        className="pointer-events-none absolute left-0.5 top-0 select-none leading-4 text-white"
                        style={{ fontSize: '11px', fontWeight: 'bold' }}
                      >
                        ✓
                      </span>
                    )}
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>GET 地址（支持 {'{ip}'}）</span>
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={customDefaultEndpoint}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                disabled={mode !== 'custom'}
                style={{
                  background: mode === 'custom' ? 'var(--bg-hover)' : 'var(--bg)',
                  color: 'var(--text-primary)',
                  opacity: mode === 'custom' ? 1 : 0.6,
                }}
              />
            </label>

            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              内置接口支持：IP9、ipwho.is、ipapi.co、ipinfo.io、ip-api.com、geolocation-db.com。自定义接口则支持 GET
              地址与 <span style={{ color: 'var(--text-primary)' }}>{'{ip}'}</span> 占位符，接口如果需要鉴权，可额外填写
              API Key。
            </p>

            <div
              className="rounded-2xl p-3"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    离线数据库更新
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    当前离线库：`geoip-lite` / MaxMind GeoLite2。更新需要 License Key，可在环境变量
                    `MAXMIND_LICENSE_KEY` 中配置。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={updateOfflineDb}
                disabled={updatingDb}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {updatingDb ? <IconLoader size={14} /> : null}
                更新离线数据库
              </button>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? <IconLoader size={14} /> : null}
              保存设置
            </button>

            <button
              type="button"
              onClick={clearLogs}
              disabled={clearing}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
            >
              {clearing ? <IconLoader size={14} /> : <IconTrash size={14} />}
              清除日志
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
