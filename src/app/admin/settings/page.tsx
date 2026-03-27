'use client'
import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { IMEInput, IMETextarea } from '@/components/ui/IMEInput'

type NavItem = { label: string; href: string; icon: string }
type WidgetType = 'search' | 'about' | 'tags' | 'hotPosts' | 'custom' | 'links'
type FriendLink = { label: string; url: string; desc?: string; avatar?: string }
type Widget = { type: WidgetType; enabled: boolean; title?: string; content?: string; links?: FriendLink[] }

const WIDGET_LABELS: Record<WidgetType, string> = {
  search: '🔍 搜索框',
  about: '👤 关于我',
  tags: '🏷️ 热门标签',
  hotPosts: '🔥 热门文章',
  custom: '📝 自定义文本',
  links: '🔗 友情链接',
}

const DEFAULT_WIDGETS: Widget[] = [
  { type: 'search', enabled: true },
  { type: 'about', enabled: true },
  { type: 'tags', enabled: true },
  { type: 'hotPosts', enabled: true },
]

const ICON_OPTIONS = [
  { value: 'home', label: '🏠 首页' },
  { value: 'archive', label: '📅 归档' },
  { value: 'tag', label: '🏷️ 标签' },
  { value: 'user', label: '👤 用户' },
]

export default function SettingsPage() {
  const [config, setConfig] = useState({
    siteName: '', siteDesc: '', socialX: '', socialGithub: '', socialEmail: '', commentApproval: true, copyright: '',
  })
  const [defaultTheme, setDefaultTheme] = useState<'dark' | 'light'>('dark')
  const [navItems, setNavItems] = useState<NavItem[]>([
    { label: '首页', href: '/', icon: 'home' },
    { label: '归档', href: '/archive', icon: 'archive' },
    { label: '标签', href: '/tags', icon: 'tag' },
    { label: '关于', href: '/about', icon: 'user' },
  ])
  const [profile, setProfile] = useState({ username: '', displayName: '', avatar: '', bio: '' })
  const [siteIcon, setSiteIcon] = useState('')
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS)
  const [saving, setSaving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [licenseChecking, setLicenseChecking] = useState(false)
  const [licenseResult, setLicenseResult] = useState<{ authorized: boolean; domains: string[] } | null>(null)



  const avatarInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(data => {
      if (data) {
        setConfig({
          siteName: data.siteName || '',
          siteDesc: data.siteDesc || '',
          socialX: data.socialX || '',
          socialGithub: data.socialGithub || '',
          socialEmail: data.socialEmail || '',
          commentApproval: data.commentApproval ?? true,
          copyright: data.copyright || '',
        })
        try {
          const nav = JSON.parse(data.navItems || '[]')
          if (Array.isArray(nav) && nav.length > 0) setNavItems(nav)
        } catch {}
        setSiteIcon(data.siteIcon || '')
        setDefaultTheme(data.defaultTheme === 'light' ? 'light' : 'dark')
        try {
          const w = JSON.parse(data.rightPanelWidgets || '[]')
          if (Array.isArray(w) && w.length > 0) setWidgets(w)
        } catch {}
      }
    })
    fetch('/api/admin/profile').then(r => r.json()).then(data => {
      if (data) setProfile({
        username: data.username || '',
        displayName: data.displayName || '',
        avatar: data.avatar || '',
        bio: data.bio || '',
      })
    })

  }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, navItems, siteIcon, rightPanelWidgets: widgets, copyright: config.copyright, defaultTheme }),
    })
    setSaving(false)
    if (res.ok) toast.success('站点设置已保存')
    else toast.error('保存失败')
  }

  const uploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingIcon(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploadingIcon(false)
    if (data.url) {
      setSiteIcon(data.url)
      toast.success('图标已上传，记得保存设置')
    } else {
      toast.error('上传失败')
    }
  }

  const addNavItem = () => setNavItems(v => [...v, { label: '新菜单', href: '/', icon: 'home' }])
  const removeNavItem = (i: number) => setNavItems(v => v.filter((_, idx) => idx !== i))
  const moveNavItem = (i: number, dir: -1 | 1) => {
    const next = [...navItems]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setNavItems(next)
  }
  const updateNavItem = (i: number, field: keyof NavItem, val: string) =>
    setNavItems(v => v.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const saveProfile = async () => {
    if (!profile.username.trim()) { toast.error('用户名不能为空'); return }
    setSavingProfile(true)
    const res = await fetch('/api/admin/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),  // 鍖呭惈 displayName
    })
    const data = await res.json()
    setSavingProfile(false)
    if (res.ok) {
      setProfile(p => ({ ...p, username: data.username }))
      toast.success('个人资料已保存')
    } else {
      toast.error(data.error || '保存失败')
    }
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploadingAvatar(false)
    if (data.url) {
      setProfile(p => ({ ...p, avatar: data.url }))
      toast.success('头像已上传，记得保存')
    } else {
      toast.error('上传失败')
    }
  }

  const Field = ({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <IMEInput type={type} value={value} onValueChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-2xl text-sm outline-none"
        style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} />
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>⚙️ 站点设置</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* 左列 */}
        <div className="flex flex-col gap-6">

          {/* 个人资料 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>👤 个人资料</h2>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 cursor-pointer" style={{ background: 'var(--bg-hover)' }} onClick={() => avatarInputRef.current?.click()}>
                {profile.avatar ? <Image src={profile.avatar} alt="头像" fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}><span className="text-white text-xs">更换</span></div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>{uploadingAvatar ? '上传中...' : '更换头像'}</button>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>支持 JPG、PNG、GIF，建议 200x200</p>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </div>
            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>显示名称</label><IMEInput type="text" value={profile.displayName} onValueChange={v => setProfile(p => ({ ...p, displayName: v }))} placeholder="我的博客" className="w-full px-3 py-2 rounded-2xl text-sm outline-none" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} /></div>
            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>账号 @handle（用于登录）</label><IMEInput type="text" value={profile.username} onValueChange={v => setProfile(p => ({ ...p, username: v }))} placeholder="admin" className="w-full px-3 py-2 rounded-2xl text-sm outline-none" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} /></div>
            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>个人简介</label><IMETextarea value={profile.bio} onValueChange={v => setProfile(p => ({ ...p, bio: v }))} rows={3} placeholder="一句话介绍自己..." className="w-full px-3 py-2 rounded-2xl text-sm outline-none resize-none" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} /></div>
            <button onClick={saveProfile} disabled={savingProfile} className="self-start px-6 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>{savingProfile ? '保存中...' : '保存个人资料'}</button>
          </div>

          {/* 基本信息 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>🌐 基本信息</h2>
            <Field label="博客名称" value={config.siteName} onChange={v => setConfig(c => ({ ...c, siteName: v }))} placeholder="我的博客" />
            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>博客简介</label><IMETextarea value={config.siteDesc} onValueChange={v => setConfig(c => ({ ...c, siteDesc: v }))} rows={3} placeholder="一句话介绍自己..." className="w-full px-3 py-2 rounded-2xl text-sm outline-none resize-none" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} /></div>
          </div>

          {/* 社交账号 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>🔗 社交账号</h2>
            <Field label="X (Twitter) 用户名" value={config.socialX} onChange={v => setConfig(c => ({ ...c, socialX: v }))} placeholder="yourusername" />
            <Field label="GitHub 用户名" value={config.socialGithub} onChange={v => setConfig(c => ({ ...c, socialGithub: v }))} placeholder="yourusername" />
            <Field label="邮箱" value={config.socialEmail} onChange={v => setConfig(c => ({ ...c, socialEmail: v }))} placeholder="you@example.com" />
          </div>

          {/* 评论设置 */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>💬 评论设置</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={config.commentApproval} onChange={e => setConfig(c => ({ ...c, commentApproval: e.target.checked }))} className="w-4 h-4" />
              <div><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>评论需审核后显示</p><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>关闭后评论立即公开显示</p></div>
            </label>
          </div>

          {/* 版权信息 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>© 版权信息</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>显示在右侧栏底部，支持 HTML</p>
            {/* 模板快捷按钮 */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: '简洁版', text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}. All rights reserved.` },
                { label: 'CC BY 4.0', text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}\n本站内容采用 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank">CC BY 4.0</a> 协议授权。` },
                { label: 'CC BY-NC-SA', text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}\n本站内容采用 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank">CC BY-NC-SA 4.0</a> 协议授权，转载请注明出处。` },
                { label: '保留所有权利', text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}\n未经授权，禁止转载或商业使用。` },
              ].map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, copyright: tpl.text }))}
                  className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)', e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)', e.currentTarget.style.color = 'var(--accent)')}
                >{tpl.label}</button>
              ))}
            </div>
            <IMETextarea value={config.copyright} onValueChange={v => setConfig(c => ({ ...c, copyright: v }))} rows={4} placeholder="© 2024 我的博客" className="w-full px-3 py-2 rounded-2xl text-sm outline-none resize-none font-mono" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} />
          </div>

        </div>

        {/* 右列 */}
        <div className="flex flex-col gap-6">

          {/* 网站图标 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>🖼 网站图标</h2>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {siteIcon ? <img src={siteIcon} alt="网站图标" className="w-full h-full object-contain" /> : <span className="text-3xl">🌐</span>}
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon} className="px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>{uploadingIcon ? '上传中...' : '上传图标'}</button>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>建议 32x32 或 64x64 PNG/ICO</p>
                {siteIcon && <button onClick={() => setSiteIcon('')} className="text-xs self-start" style={{ color: '#F4212E' }}>移除图标</button>}
              </div>
              <input ref={iconInputRef} type="file" accept="image/*,.ico" className="hidden" onChange={uploadIcon} />
            </div>
            {siteIcon && <div className="flex items-center gap-2"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>路径：</span><span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>{siteIcon}</span></div>}
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>上传后点击底部「保存设置」生效</p>
          </div>

          {/* 默认主题 */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>🌙 默认主题</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>访客首次访问时使用的主题</p>
            <div className="flex gap-3">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} onClick={() => setDefaultTheme(t)} className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-colors" style={{ background: defaultTheme === t ? 'var(--bg-hover)' : 'transparent', borderColor: defaultTheme === t ? 'var(--accent)' : 'var(--border)' }}>
                  <span className="text-xl">{t === 'dark' ? '🌙' : '☀️'}</span>
                  <div className="text-left"><p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t === 'dark' ? '深色' : '浅色'}</p><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t === 'dark' ? '黑色背景' : '白色背景'}</p></div>
                  {defaultTheme === t && <span className="ml-auto text-xs font-bold" style={{ color: 'var(--accent)' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 导航菜单 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>🧭 导航菜单</h2>
              <button onClick={addNavItem} className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}>+ 添加</button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>自定义前台导航栏菜单项</p>
            <div className="flex flex-col gap-2">
              {navItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveNavItem(i, -1)} disabled={i === 0} className="w-5 h-5 flex items-center justify-center rounded text-xs disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>↑</button>
                    <button onClick={() => moveNavItem(i, 1)} disabled={i === navItems.length - 1} className="w-5 h-5 flex items-center justify-center rounded text-xs disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>↓</button>
                  </div>
                  <select value={item.icon} onChange={e => updateNavItem(i, 'icon', e.target.value)} className="px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', minWidth: 90 }}>
                    {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <IMEInput value={item.label} onValueChange={v => updateNavItem(i, 'label', v)} placeholder="标签" className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', minWidth: 60 }} />
                  <IMEInput value={item.href} onValueChange={v => updateNavItem(i, 'href', v)} placeholder="/about" className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', minWidth: 80 }} />
                  <button onClick={() => removeNavItem(i)} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ color: '#F4212E' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,33,46,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>×</button>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>修改后点击底部「保存设置」生效</p>
          </div>

          {/* 右侧栏组件 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>📌 右侧栏组件</h2>
              <button onClick={() => setWidgets(v => [...v, { type: 'custom', enabled: true, title: '', content: '' }])} className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}>+ 添加</button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>配置前台右侧栏显示的组件</p>
            <div className="flex flex-col gap-2">
              {widgets.map((w, i) => (
                <div key={i} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--bg-hover)' }}>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => { const a = [...widgets]; if (i > 0) { [a[i-1],a[i]]=[a[i],a[i-1]]; setWidgets(a); } }} disabled={i === 0} className="w-5 h-5 flex items-center justify-center text-xs disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>↑</button>
                      <button onClick={() => { const a = [...widgets]; if (i < a.length-1) { [a[i],a[i+1]]=[a[i+1],a[i]]; setWidgets(a); } }} disabled={i === widgets.length - 1} className="w-5 h-5 flex items-center justify-center text-xs disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>↓</button>
                    </div>
                    <input type="checkbox" checked={w.enabled} onChange={e => setWidgets(v => v.map((x,j) => j===i ? {...x, enabled: e.target.checked} : x))} className="w-4 h-4 flex-shrink-0" />
                    <select value={w.type} onChange={e => setWidgets(v => v.map((x,j) => j===i ? {...x, type: e.target.value} : x))} className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}>
                      {Object.keys(WIDGET_LABELS).map(t => <option key={t} value={t}>{WIDGET_LABELS[t]}</option>)}
                    </select>
                    <button onClick={() => setWidgets(v => v.filter((_,j) => j !== i))} className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0" style={{ color: '#F4212E' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,33,46,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>×</button>
                  </div>
                  <IMEInput value={w.title || ''} onValueChange={v => setWidgets(arr => arr.map((x,j) => j===i ? {...x, title: v} : x))} placeholder={'标题（留空用默认）'} className="w-full px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} />
                  {w.type === 'custom' && <IMETextarea value={w.content || ''} onValueChange={v => setWidgets(arr => arr.map((x,j) => j===i ? {...x, content: v} : x))} placeholder="自定义内容" rows={3} className="w-full px-2 py-1.5 rounded-lg text-sm outline-none resize-none" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} />}
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>修改后点击底部「保存设置」生效</p>
          </div>

          {/* 安全管理 */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>🔒 安全管理</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>检查本站的授权状态，连接至授权服务器验证已授权域名。</p>
            <button
              onClick={async () => {
                setLicenseChecking(true)
                setLicenseResult(null)
                try {
                  const res = await fetch('/api/admin/license-check')
                  const data = await res.json()
                  setLicenseResult(data)
                } catch {
                  setLicenseResult({ authorized: false, domains: [] })
                } finally {
                  setLicenseChecking(false)
                }
              }}
              disabled={licenseChecking}
              className="self-start px-5 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {licenseChecking ? '检查中...' : '检查授权状态'}
            </button>
            {licenseResult && (
              <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-hover)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{licenseResult.authorized ? '✅' : '❌'}</span>
                  <span className="font-semibold text-sm" style={{ color: licenseResult.authorized ? '#00ba7c' : '#F4212E' }}>
                    {licenseResult.authorized ? '授权有效' : '未授权'}
                  </span>
                </div>
                {licenseResult.authorized && licenseResult.domains.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>已授权域名：</p>
                    {licenseResult.domains.map((d: string) => (
                      <div key={d} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                        <span className="text-xs" style={{ color: '#00ba7c' }}>✓</span>
                        <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                          已授权给 <a href={`https://${d}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>https://{d}</a>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!licenseResult.authorized && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>当前域名未在授权服务器中登记，请联系管理员。</p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      <button onClick={save} disabled={saving} className="px-6 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50 mt-6" style={{ background: 'var(--accent)' }}>{saving ? '保存中...' : '保存设置'}</button>
    </div>
  )
}
