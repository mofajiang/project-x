'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { IMEInput, IMETextarea } from '@/components/ui/IMEInput'
import ImageCropModal from '@/components/ui/ImageCropModal'
import { StorageImagePicker } from '@/components/admin/StorageImagePicker'
import { AdminUpdateChecker } from '@/components/admin/AdminUpdateChecker'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_LG_CLASS, ADMIN_SUBCARD_CLASS } from '@/components/admin/adminUi'
import {
  DEFAULT_NAV,
  DEFAULT_WIDGETS,
  DEFAULT_SITE_LOGO,
  isImageSource,
  parseNavItems,
  parseSiteLogo,
  parseWidgets,
  type NavItem,
  type RightPanelWidget as Widget,
  type SiteLogo,
} from '@/lib/config'

type WidgetType = 'search' | 'about' | 'tags' | 'hotPosts' | 'custom' | 'links' | 'carousel'
type FriendLink = { label: string; url: string; desc?: string; avatar?: string }
type CarouselSlideType = 'image' | 'text' | 'markdown'
type CarouselSlide = {
  slideType?: CarouselSlideType
  image?: string
  title?: string
  desc?: string
  link?: string
  markdown?: string
}
const SLIDE_TYPE_LABELS: Record<CarouselSlideType, string> = {
  image: '🖼 图片',
  text: '📝 文字/链接',
  markdown: '📄 Markdown',
}

const WIDGET_LABELS: Record<WidgetType, string> = {
  search: '🔍 搜索框',
  about: '👤 关于我',
  tags: '🏷️ 热门标签',
  hotPosts: '🔥 热门文章',
  custom: '📝 自定义文本',
  links: '🔗 友情链接',
  carousel: '🎠 轮播图',
}

const ICON_OPTIONS = [
  { value: 'home', label: '🏠 首页' },
  { value: 'archive', label: '📅 归档' },
  { value: 'tag', label: '🏷️ 标签' },
  { value: 'user', label: '👤 用户' },
]

const SITE_LOGO_TYPES: { value: SiteLogo['type']; label: string }[] = [
  { value: 'text', label: '文字' },
  { value: 'image', label: '图片' },
]

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  compact = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <label
          className="w-24 shrink-0 truncate text-[11px] font-medium leading-tight sm:text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
        <IMEInput
          type={type}
          value={value}
          onValueChange={onChange}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-2xl px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
        />
      </div>
    )
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <IMEInput
        type={type}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
      />
    </div>
  )
}

export default function SettingsPage() {
  const [config, setConfig] = useState({
    siteName: '',
    siteDesc: '',
    socialX: '',
    socialGithub: '',
    socialEmail: '',
    commentApproval: true,
    showCommentIp: false,
    copyright: '',
    emailSubjectNewComment: '',
    emailSubjectReply: '',
    emailSubjectApproved: '',
    emailSenderName: '',
    storageDriver: 'local',
    storageS3Endpoint: '',
    storageS3Region: 'auto',
    storageS3Bucket: '',
    storageS3AccessKeyId: '',
    storageS3SecretAccessKey: '',
    storageS3Prefix: 'uploads/',
    storageS3ForcePathStyle: false,
    storagePublicBaseUrl: '',
    storageSmmsToken: '',
  })
  const [defaultTheme, setDefaultTheme] = useState<'dark' | 'light'>('dark')
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV)
  const [profile, setProfile] = useState({ username: '', displayName: '', avatar: '', bio: '' })
  const [siteIcon, setSiteIcon] = useState('')
  const [siteLogo, setSiteLogo] = useState<SiteLogo>(DEFAULT_SITE_LOGO)
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS)
  const [saving, setSaving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [uploadingSiteLogo, setUploadingSiteLogo] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [savingDomain, setSavingDomain] = useState(false)
  const [licenseChecking, setLicenseChecking] = useState(true)
  const [licenseResult, setLicenseResult] = useState<{
    authorized: boolean
    domains: string[]
    currentHost?: string
    source?: string
  } | null>(null)
  const [smtp, setSmtp] = useState({ SMTP_HOST: '', SMTP_PORT: '465', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '' })
  const [smtpConfigured, setSmtpConfigured] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)
  const siteLogoInputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyConfigData = (data: Record<string, any>) => {
    setConfig({
      siteName: data.siteName || '',
      siteDesc: data.siteDesc || '',
      socialX: data.socialX || '',
      socialGithub: data.socialGithub || '',
      socialEmail: data.socialEmail || '',
      commentApproval: data.commentApproval ?? true,
      showCommentIp: data.showCommentIp ?? false,
      copyright: data.copyright || '',
      emailSubjectNewComment: data.emailSubjectNewComment || '',
      emailSubjectReply: data.emailSubjectReply || '',
      emailSubjectApproved: data.emailSubjectApproved || '',
      emailSenderName: data.emailSenderName || '',
      storageDriver: data.storageDriver || 'local',
      storageS3Endpoint: data.storageS3Endpoint || '',
      storageS3Region: data.storageS3Region || 'auto',
      storageS3Bucket: data.storageS3Bucket || '',
      storageS3AccessKeyId: data.storageS3AccessKeyId || '',
      storageS3SecretAccessKey: data.storageS3SecretAccessKey || '',
      storageS3Prefix: data.storageS3Prefix || 'uploads/',
      storageS3ForcePathStyle: !!data.storageS3ForcePathStyle,
      storagePublicBaseUrl: data.storagePublicBaseUrl || '',
      storageSmmsToken: data.storageSmmsToken || '',
    })
    setNavItems(parseNavItems(data.navItems || '[]'))
    setWidgets(parseWidgets(data.rightPanelWidgets || '[]'))
    setSiteLogo(parseSiteLogo(data.siteLogo || ''))
    setSiteIcon(data.siteIcon || '')
    setDefaultTheme(data.defaultTheme === 'light' ? 'light' : 'dark')
  }

  useEffect(() => {
    fetch('/api/admin/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          applyConfigData(data)
        }
      })
    fetch('/api/admin/profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data)
          setProfile({
            username: data.username || '',
            displayName: data.displayName || '',
            avatar: data.avatar || '',
            bio: data.bio || '',
          })
      })

    // 自动检测授权状态
    fetch('/api/admin/license-check', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setLicenseResult(data))
      .catch(() => setLicenseResult({ authorized: false, domains: [] }))
      .finally(() => setLicenseChecking(false))

    fetch('/api/admin/smtp', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setSmtp({
            SMTP_HOST: data.SMTP_HOST || '',
            SMTP_PORT: data.SMTP_PORT || '465',
            SMTP_USER: data.SMTP_USER || '',
            SMTP_PASS: data.SMTP_PASS || '',
            SMTP_FROM: data.SMTP_FROM || '',
          })
          setSmtpConfigured(data.configured || false)
          setTestEmail(data.SMTP_USER || '')
        }
      })
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        siteIcon,
        siteLogo: JSON.stringify(siteLogo),
        copyright: config.copyright,
        defaultTheme,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('站点设置已保存')
      // 重新加载配置确认持久化
      try {
        const freshData = await fetch('/api/admin/config', { cache: 'no-store' }).then((r) => r.json())
        if (freshData) {
          applyConfigData(freshData)
        }
      } catch {}
      return
    }
    let msg = '保存失败'
    try {
      const err = await res.json()
      if (err?.detail) msg = `保存失败：${err.detail}`
      else if (err?.error) msg = `保存失败：${err.error}`
    } catch {}
    toast.error(msg)
  }

  const uploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingIcon(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('fixedName', 'site-icon')
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

  const uploadSiteLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingSiteLogo(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploadingSiteLogo(false)
    if (data.url) {
      setSiteLogo({ type: 'image', value: data.url })
      toast.success('站点 Logo 已上传，记得保存设置')
    } else {
      toast.error('上传失败')
    }
  }

  const addNavItem = () => setNavItems((v) => [...v, { label: '新菜单', href: '/', icon: 'home' }])
  const removeNavItem = (i: number) => setNavItems((v) => v.filter((_, idx) => idx !== i))
  const moveNavItem = (i: number, dir: -1 | 1) => {
    const next = [...navItems]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setNavItems(next)
  }
  const updateNavItem = (i: number, field: keyof NavItem, val: string) =>
    setNavItems((v) => v.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)))

  const saveProfile = async () => {
    if (!profile.username.trim()) {
      toast.error('用户名不能为空')
      return
    }
    setSavingProfile(true)
    const res = await fetch('/api/admin/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile), // 鍖呭惈 displayName
    })
    const data = await res.json()
    setSavingProfile(false)
    if (res.ok) {
      setProfile({
        username: data.username || '',
        displayName: data.displayName || '',
        avatar: data.avatar || '',
        bio: data.bio || '',
      })
      toast.success('个人资料已保存')
    } else {
      toast.error(data.error || '保存失败')
    }
  }

  const saveSmtp = async () => {
    setSmtpSaving(true)
    const res = await fetch('/api/admin/smtp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(smtp),
    })
    setSmtpSaving(false)
    if (res.ok) {
      toast.success('SMTP 配置已保存，重启服务后生效')
      setSmtpConfigured(!!(smtp.SMTP_HOST && smtp.SMTP_USER && smtp.SMTP_PASS))
    } else {
      const data = await res.json()
      toast.error(data.error || '保存失败')
    }
  }

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('请填写收件人邮箱')
      return
    }
    setSmtpTesting(true)
    const res = await fetch('/api/admin/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail }),
    })
    setSmtpTesting(false)
    if (res.ok) toast.success('测试邮件已发送，请检查收件箱')
    else {
      const data = await res.json()
      toast.error(data.error || '发送失败')
    }
  }

  const uploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 重置 input，允许重复选同一文件
    e.target.value = ''
    const url = URL.createObjectURL(file)
    setCropSrc(url)
  }

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropSrc(null)
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        setProfile((p) => ({ ...p, avatar: data.url }))
        toast.success('头像已上传，记得保存')
      } else {
        toast.error(data.error || '上传失败')
      }
    } finally {
      setUploadingAvatar(false)
    }
  }, [])

  const handleCropCancel = useCallback(() => {
    setCropSrc(null)
  }, [])

  const sectionTitleClass = 'text-base sm:text-lg font-bold leading-tight tracking-tight'
  const sectionHintClass = 'text-[10px] sm:text-xs leading-relaxed text-balance'
  const mobileCardClass = 'rounded-2xl p-2.5 sm:p-4'
  const mobileSubCardClass = 'rounded-xl p-2 sm:p-4'

  return (
    <div>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={1}
          outputSize={400}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      <div
        className="sticky top-0 z-20 -mx-1 mb-4 flex items-center justify-end gap-3 rounded-2xl px-3 py-2"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        <button
          onClick={save}
          disabled={saving}
          className="min-h-9 shrink-0 rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-2">
        {/* 左列 */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* 授权状态 */}
          <div
            className={`${mobileCardClass} flex flex-row items-center gap-2 sm:gap-4`}
            style={{
              background: licenseChecking
                ? 'var(--bg-secondary)'
                : licenseResult?.authorized
                  ? 'rgba(0,186,124,0.08)'
                  : 'rgba(244,33,46,0.08)',
              border: `1px solid ${licenseChecking ? 'var(--border)' : licenseResult?.authorized ? '#00ba7c' : '#F4212E'}`,
            }}
          >
            <div className="flex-shrink-0 text-xl leading-none sm:text-3xl">
              {licenseChecking ? '⏳' : licenseResult?.authorized ? '✅' : '❌'}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-bold leading-tight sm:text-base"
                style={{
                  color: licenseChecking ? 'var(--text-primary)' : licenseResult?.authorized ? '#00ba7c' : '#F4212E',
                }}
              >
                {licenseChecking
                  ? '正在验证授权...'
                  : `${licenseResult?.authorized ? '授权有效' : '未授权'}${licenseResult?.currentHost ? ` · ${licenseResult.currentHost}` : ''}`}
              </p>
            </div>
            <button
              onClick={() => {
                setLicenseChecking(true)
                setLicenseResult(null)
                fetch('/api/admin/license-check')
                  .then((r) => r.json())
                  .then((data) => setLicenseResult(data))
                  .catch(() => setLicenseResult({ authorized: false, domains: [] }))
                  .finally(() => setLicenseChecking(false))
              }}
              disabled={licenseChecking}
              className="ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 sm:h-8 sm:w-8"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
              title="重新检测"
            >
              ↻
            </button>
          </div>

          {/* 系统更新 */}
          <div className={`${mobileCardClass} flex flex-col gap-2.5`} style={{ background: 'var(--bg-secondary)' }}>
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              🔄 系统更新
            </h2>
            <AdminUpdateChecker />
          </div>

          {/* 个人资料 */}
          <div
            className={`${mobileCardClass} flex flex-col gap-2.5 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              👤 个人资料
            </h2>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div
                className="relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-full"
                style={{ background: 'var(--bg-hover)' }}
                onClick={() => avatarInputRef.current?.click()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {profile.avatar ? (
                  <img src={profile.avatar} alt="头像" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
                )}
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  <span className="text-xs text-white">更换</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <StorageImagePicker
                  onSelect={(url) => {
                    setProfile((p) => ({ ...p, avatar: url }))
                    toast.success('已选择云存储头像，记得保存')
                  }}
                  onLocalClick={() => avatarInputRef.current?.click()}
                  localLoading={uploadingAvatar}
                  localButtonText="更换头像"
                />
                <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                  支持 JPG、PNG、GIF，建议 200x200
                </p>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </div>
            <Field
              compact
              label="显示名称"
              value={profile.displayName}
              onChange={(v) => setProfile((p) => ({ ...p, displayName: v }))}
              placeholder="我的博客"
            />
            <Field
              compact
              label="账号 @handle（用于登录）"
              value={profile.username}
              onChange={(v) => setProfile((p) => ({ ...p, username: v }))}
              placeholder="admin"
            />
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                个人简介
              </label>
              <IMETextarea
                value={profile.bio}
                onValueChange={(v) => setProfile((p) => ({ ...p, bio: v }))}
                rows={3}
                placeholder="一句话介绍自己..."
                className="w-full resize-none rounded-2xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
              />
            </div>
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="self-stretch rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:self-start"
              style={{ background: 'var(--accent)' }}
            >
              {savingProfile ? '保存中...' : '保存个人资料'}
            </button>
          </div>

          {/* 站点选项 */}
          <div
            className={`${mobileCardClass} flex flex-col gap-2.5 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              🌐 站点选项
            </h2>
            <Field
              compact
              label="博客名称"
              value={config.siteName}
              onChange={(v) => setConfig((c) => ({ ...c, siteName: v }))}
              placeholder="我的博客"
            />
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                博客简介（支持 Markdown）
              </label>
              <IMETextarea
                value={config.siteDesc}
                onValueChange={(v) => setConfig((c) => ({ ...c, siteDesc: v }))}
                rows={4}
                placeholder="用 Markdown 写一段博客简介..."
                className="w-full resize-none rounded-2xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
              />
            </div>
            <Field
              compact
              label="邮箱"
              value={config.socialEmail}
              onChange={(v) => setConfig((c) => ({ ...c, socialEmail: v }))}
              placeholder="you@example.com"
            />
          </div>

          {/* 社交账号 */}
          <div
            className={`${mobileCardClass} flex flex-col gap-2.5 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              🔗 社交账号
            </h2>
            <Field
              compact
              label="X (Twitter) 用户名"
              value={config.socialX}
              onChange={(v) => setConfig((c) => ({ ...c, socialX: v }))}
              placeholder="yourusername"
            />
            <Field
              compact
              label="GitHub 用户名"
              value={config.socialGithub}
              onChange={(v) => setConfig((c) => ({ ...c, socialGithub: v }))}
              placeholder="yourusername"
            />
          </div>

          {/* 评论设置 */}
          <div className={mobileCardClass} style={{ background: 'var(--bg-secondary)' }}>
            <h2 className={`${sectionTitleClass} mb-3`} style={{ color: 'var(--text-primary)' }}>
              💬 评论设置
            </h2>
            <label className="flex cursor-pointer items-start gap-3 sm:items-center">
              <input
                type="checkbox"
                checked={config.commentApproval}
                onChange={(e) => setConfig((c) => ({ ...c, commentApproval: e.target.checked }))}
                className="h-4 w-4"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                  评论需审核后显示
                </p>
                <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                  关闭后评论立即公开显示
                </p>
              </div>
            </label>
            <label
              className="mt-3 flex cursor-pointer items-start gap-3 pt-3 sm:items-center"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <input
                type="checkbox"
                checked={config.showCommentIp}
                onChange={(e) => setConfig((c) => ({ ...c, showCommentIp: e.target.checked }))}
                className="h-4 w-4"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                  前台显示评论 IP
                </p>
                <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                  默认只在后台可见，开启后前台也会显示
                </p>
              </div>
            </label>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              🤖 AI 审核相关设置已移至{' '}
              <a href="/admin/ai-model" className="underline" style={{ color: 'var(--accent)' }}>
                AI 模型管理
              </a>{' '}
              页面
            </p>
          </div>

          {/* 版权信息 */}
          <div
            className={`${mobileCardClass} flex flex-col gap-2.5 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              © 版权信息
            </h2>
            <p className={`${sectionHintClass} hidden sm:block`} style={{ color: 'var(--text-secondary)' }}>
              显示在右侧栏底部，支持 HTML
            </p>
            {/* 模板快捷按钮 */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: '简洁版',
                  text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}. All rights reserved.`,
                },
                {
                  label: 'CC BY 4.0',
                  text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}\n本站内容采用 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> 协议授权。`,
                },
                {
                  label: 'CC BY-NC-SA',
                  text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}\n本站内容采用 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> 协议授权，转载请注明出处。`,
                },
                {
                  label: '保留所有权利',
                  text: `© ${new Date().getFullYear()} ${config.siteName || '我的博客'}\n未经授权，禁止转载或商业使用。`,
                },
              ].map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, copyright: tpl.text }))}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors sm:text-center"
                  style={{ background: 'var(--bg-hover)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (
                    (e.currentTarget.style.background = 'var(--accent)'),
                    (e.currentTarget.style.color = '#fff')
                  )}
                  onMouseLeave={(e) => (
                    (e.currentTarget.style.background = 'var(--bg-hover)'),
                    (e.currentTarget.style.color = 'var(--accent)')
                  )}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
            <IMETextarea
              value={config.copyright}
              onValueChange={(v) => setConfig((c) => ({ ...c, copyright: v }))}
              rows={4}
              placeholder="© 2024 我的博客"
              className="w-full resize-none rounded-2xl px-3 py-2 font-mono text-sm outline-none"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
            />
          </div>
        </div>

        {/* 右列 */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* 网站图标 */}
          <div
            className={`${mobileCardClass} flex flex-col gap-2.5 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              🖼 网站图标
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl"
                  style={{ background: 'var(--bg-hover)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {siteIcon ? (
                    <img
                      src={siteIcon}
                      alt="网站图标"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl">🌐</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <StorageImagePicker
                    onSelect={(url) => {
                      setSiteIcon(url)
                      toast.success('已选择云存储图标，记得保存设置')
                    }}
                    onLocalClick={() => iconInputRef.current?.click()}
                    localLoading={uploadingIcon}
                    localButtonText="上传图标"
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                      建议 32x32 或 64x64 PNG/ICO
                    </p>
                    {siteIcon && (
                      <button onClick={() => setSiteIcon('')} className="shrink-0 text-xs" style={{ color: '#F4212E' }}>
                        移除
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <input ref={iconInputRef} type="file" accept="image/*,.ico" className="hidden" onChange={uploadIcon} />
              {siteIcon && (
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    路径：
                  </span>
                  <span
                    className="truncate rounded px-2 py-0.5 font-mono text-xs"
                    style={{ background: 'var(--bg)', color: 'var(--accent)' }}
                  >
                    {siteIcon}
                  </span>
                </div>
              )}
            </div>
            <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
              上传后点击底部「保存设置」生效
            </p>
          </div>

          {/* 站点 Logo */}
          <div
            className={`${mobileCardClass} flex flex-col gap-2.5 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              🪪 站点 Logo
            </h2>
            <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
              控制桌面侧栏和手机侧边栏顶部显示的文字或图片，不影响站点图标。
            </p>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-wrap gap-2">
                {SITE_LOGO_TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSiteLogo((v) => ({ ...v, type: item.value }))}
                    className="rounded-full px-3 py-2 text-sm font-medium transition-colors"
                    style={{
                      background: siteLogo.type === item.value ? 'var(--accent)' : 'var(--bg-hover)',
                      color: siteLogo.type === item.value ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <Field
                label={siteLogo.type === 'text' ? '显示文字' : '图片地址'}
                value={siteLogo.value}
                onChange={(v) => setSiteLogo((s) => ({ ...s, value: v }))}
                placeholder={siteLogo.type === 'text' ? '例如：我的博客' : '例如：/uploads/logo.png'}
                compact
              />

              {siteLogo.type === 'image' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <StorageImagePicker
                    onSelect={(url) => {
                      setSiteLogo((s) => ({ ...s, type: 'image', value: url }))
                      toast.success('已选择云存储 Logo，记得保存设置')
                    }}
                    onLocalClick={() => siteLogoInputRef.current?.click()}
                    localLoading={uploadingSiteLogo}
                    localButtonText="上传图片"
                  />
                  <button
                    type="button"
                    onClick={() => setSiteLogo((s) => ({ ...s, value: '' }))}
                    className="w-full rounded-full px-4 py-2 text-sm font-medium sm:w-auto"
                    style={{ background: 'var(--bg-hover)', color: '#F4212E' }}
                  >
                    清空
                  </button>
                  <input
                    ref={siteLogoInputRef}
                    type="file"
                    accept="image/*,.ico"
                    className="hidden"
                    onChange={uploadSiteLogo}
                  />
                </div>
              )}

              <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--bg-hover)' }}>
                <div
                  className={
                    siteLogo.type === 'image' && isImageSource(siteLogo.value)
                      ? 'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full px-1.5'
                      : 'flex h-12 min-w-[3rem] shrink-0 items-center justify-center overflow-hidden rounded-full px-3'
                  }
                  style={{ background: 'var(--bg)' }}
                >
                  {siteLogo.type === 'image' && isImageSource(siteLogo.value) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={siteLogo.value} alt="站点 Logo" className="h-[20px] w-[20px] flex-none object-contain" />
                  ) : (
                    <span
                      className={
                        siteLogo.type === 'text' ? 'text-[18px] font-black leading-none' : 'text-[22px] leading-none'
                      }
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {siteLogo.value || DEFAULT_SITE_LOGO.value}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                    预览
                  </p>
                  <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                    会显示在桌面侧栏顶部和手机侧边栏顶部
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 默认主题 */}
          <div
            className={`${mobileCardClass} flex flex-col gap-2.5 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h2 className={`${sectionTitleClass} mb-1`} style={{ color: 'var(--text-primary)' }}>
              🌙 默认主题
            </h2>
            <p className={`${sectionHintClass} hidden sm:block`} style={{ color: 'var(--text-secondary)' }}>
              访客首次访问时使用的主题
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDefaultTheme(t)}
                  className="flex w-full items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 transition-colors"
                  style={{
                    background: defaultTheme === t ? 'var(--bg-hover)' : 'transparent',
                    borderColor: defaultTheme === t ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <span className="flex-shrink-0 text-xl">{t === 'dark' ? '🌙' : '☀️'}</span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {t === 'dark' ? '深色' : '浅色'}
                    </p>
                    <p className="hidden text-xs sm:block" style={{ color: 'var(--text-secondary)' }}>
                      {t === 'dark' ? '黑色背景' : '白色背景'}
                    </p>
                  </div>
                  {defaultTheme === t && (
                    <span className="ml-auto shrink-0 text-xs font-bold" style={{ color: 'var(--accent)' }}>
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 邮件通知 */}
          <div
            className={`${mobileCardClass} flex flex-col gap-3 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <div className="flex flex-col gap-1.5">
              <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
                📧 邮件通知
              </h2>
              <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                SMTP 配置与测试邮件现在合并到站点设置中。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  SMTP 服务器
                </label>
                <IMEInput
                  type="text"
                  value={smtp.SMTP_HOST}
                  onValueChange={(v) => setSmtp((s) => ({ ...s, SMTP_HOST: v }))}
                  placeholder="smtp.example.com"
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  端口
                </label>
                <IMEInput
                  type="text"
                  value={smtp.SMTP_PORT}
                  onValueChange={(v) => setSmtp((s) => ({ ...s, SMTP_PORT: v }))}
                  placeholder="465"
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  用户名
                </label>
                <IMEInput
                  type="text"
                  value={smtp.SMTP_USER}
                  onValueChange={(v) => setSmtp((s) => ({ ...s, SMTP_USER: v }))}
                  placeholder="your-email@example.com"
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  密码
                </label>
                <IMEInput
                  type="password"
                  value={smtp.SMTP_PASS}
                  onValueChange={(v) => setSmtp((s) => ({ ...s, SMTP_PASS: v }))}
                  placeholder="your-password"
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  发件人邮箱
                </label>
                <IMEInput
                  type="text"
                  value={smtp.SMTP_FROM}
                  onValueChange={(v) => setSmtp((s) => ({ ...s, SMTP_FROM: v }))}
                  placeholder="noreply@example.com"
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
              </div>{' '}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  发件人名称
                </label>
                <IMEInput
                  type="text"
                  value={config.emailSenderName}
                  onValueChange={(v) => setConfig((c) => ({ ...c, emailSenderName: v }))}
                  placeholder="不填则使用站点域名，如：我的博客"
                  className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  收件人看到的发件人显示名称，不填则自动使用域名
                </p>
              </div>{' '}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={saveSmtp}
                disabled={smtpSaving}
                className="w-full rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
                style={{ background: 'var(--accent)' }}
              >
                {smtpSaving ? '保存中...' : '保存配置'}
              </button>
              {smtpConfigured && (
                <span
                  className="self-start rounded-full px-3 py-2 text-xs font-medium sm:self-center"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
                >
                  已配置
                </span>
              )}
            </div>
            {smtpConfigured && (
              <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <h3 className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  测试邮件
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <IMEInput
                    value={testEmail}
                    onValueChange={setTestEmail}
                    placeholder="收件人邮箱"
                    className="flex-1 rounded-2xl px-3 py-2.5 text-sm outline-none"
                    style={{
                      background: 'var(--bg-hover)',
                      color: 'var(--text-primary)',
                      border: '1px solid transparent',
                    }}
                  />
                  <button
                    onClick={sendTestEmail}
                    disabled={smtpTesting}
                    className="w-full rounded-full px-4 py-3 text-sm font-medium disabled:opacity-50 sm:w-auto"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {smtpTesting ? '发送中...' : '发送测试'}
                  </button>
                </div>
              </div>
            )}
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                自定义邮件标题
              </h3>
              <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                可用变量：
                <code style={{ background: 'rgba(0,0,0,0.15)', padding: '1px 4px', borderRadius: '4px' }}>
                  {'{postTitle}'}
                </code>
                &nbsp;
                <code style={{ background: 'rgba(0,0,0,0.15)', padding: '1px 4px', borderRadius: '4px' }}>
                  {'{commenterName}'}
                </code>
                &nbsp;
                <code style={{ background: 'rgba(0,0,0,0.15)', padding: '1px 4px', borderRadius: '4px' }}>
                  {'{replierName}'}
                </code>
                &nbsp;
                <code style={{ background: 'rgba(0,0,0,0.15)', padding: '1px 4px', borderRadius: '4px' }}>
                  {'{toName}'}
                </code>
                ，留空为默认
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    📬 新评论待审核（管理员收到）— 默认: 📬 新评论待审核 — {'{postTitle}'}
                  </label>
                  <IMEInput
                    value={config.emailSubjectNewComment}
                    onValueChange={(v) => setConfig((c) => ({ ...c, emailSubjectNewComment: v }))}
                    placeholder="📬 新评论待审核 — {postTitle}"
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={{
                      background: 'var(--bg-hover)',
                      color: 'var(--text-primary)',
                      border: '1px solid transparent',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    &#128172; 回复通知（被回复者收到）— 默认: {'{replierName}'} 回复了你的评论 — {'{postTitle}'}
                  </label>
                  <IMEInput
                    value={config.emailSubjectReply}
                    onValueChange={(v) => setConfig((c) => ({ ...c, emailSubjectReply: v }))}
                    placeholder="{replierName} 回复了你的评论 — {postTitle}"
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={{
                      background: 'var(--bg-hover)',
                      color: 'var(--text-primary)',
                      border: '1px solid transparent',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    &#9989; 审核通过（评论者收到）— 默认: 你在《{'{postTitle}'}》的评论已通过审核
                  </label>
                  <IMEInput
                    value={config.emailSubjectApproved}
                    onValueChange={(v) => setConfig((c) => ({ ...c, emailSubjectApproved: v }))}
                    placeholder="你在《{postTitle}》的评论已通过审核"
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={{
                      background: 'var(--bg-hover)',
                      color: 'var(--text-primary)',
                      border: '1px solid transparent',
                    }}
                  />
                </div>
              </div>
            </div>{' '}
          </div>

          {/* 导航与组件（已移至独立页面） */}
          <div
            className={`${mobileCardClass} hidden flex-col gap-3 sm:gap-4`}
            style={{ background: 'var(--bg-secondary)' }}
          >
            <div className="flex flex-col gap-1.5">
              <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
                🧭 导航与组件
              </h2>
              <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                把前台导航和右侧栏放在同一组里统一管理
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2.5 sm:gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    导航菜单
                  </h3>
                  <button
                    onClick={addNavItem}
                    className="min-h-10 w-full rounded-full px-3 py-2 text-sm font-medium sm:w-auto"
                    style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                  >
                    + 添加
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:gap-3">
                  {navItems.map((item, i) => (
                    <div
                      key={i}
                      className={`${mobileSubCardClass} flex flex-col gap-2 sm:gap-3`}
                      style={{ background: 'var(--bg-hover)' }}
                    >
                      <div className="flex items-center gap-1 self-start sm:flex-col sm:gap-0.5">
                        <button
                          onClick={() => moveNavItem(i, -1)}
                          disabled={i === 0}
                          className="flex h-8 w-8 items-center justify-center rounded text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveNavItem(i, 1)}
                          disabled={i === navItems.length - 1}
                          className="flex h-8 w-8 items-center justify-center rounded text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          ↓
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <select
                          value={item.icon}
                          onChange={(e) => updateNavItem(i, 'icon', e.target.value)}
                          className="w-full rounded-lg px-2 py-2 text-sm outline-none"
                          style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            minWidth: 90,
                          }}
                        >
                          {ICON_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <IMEInput
                          value={item.label}
                          onValueChange={(v) => updateNavItem(i, 'label', v)}
                          placeholder="标签"
                          className="w-full flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                          style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                          }}
                        />
                        <IMEInput
                          value={item.href}
                          onValueChange={(v) => updateNavItem(i, 'href', v)}
                          placeholder="/about"
                          className="w-full flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                          style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                          }}
                        />
                        <button
                          onClick={() => removeNavItem(i)}
                          className="flex h-10 w-full items-center justify-center rounded-full sm:h-7 sm:w-7"
                          style={{ color: '#F4212E' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,33,46,0.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    右侧栏组件
                  </h3>
                  <button
                    onClick={() => setWidgets((v) => [...v, { type: 'custom', enabled: true, title: '', content: '' }])}
                    className="min-h-10 w-full rounded-full px-3 py-2 text-sm font-medium sm:w-auto"
                    style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                  >
                    + 添加
                  </button>
                </div>
                <p className={`${sectionHintClass} mt-1`} style={{ color: 'var(--text-secondary)' }}>
                  配置前台右侧栏显示的组件
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:gap-3">
                  {widgets.map((w, i) => (
                    <div
                      key={i}
                      className={`${mobileSubCardClass} relative flex flex-col gap-2 sm:gap-3`}
                      style={{ background: 'var(--bg-hover)' }}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:pr-10">
                        <div className="flex flex-shrink-0 items-center gap-1 self-start sm:flex-col sm:gap-0.5">
                          <button
                            onClick={() => {
                              const a = [...widgets]
                              if (i > 0) {
                                ;[a[i - 1], a[i]] = [a[i], a[i - 1]]
                                setWidgets(a)
                              }
                            }}
                            disabled={i === 0}
                            className="flex h-8 w-8 items-center justify-center text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => {
                              const a = [...widgets]
                              if (i < a.length - 1) {
                                ;[a[i], a[i + 1]] = [a[i + 1], a[i]]
                                setWidgets(a)
                              }
                            }}
                            disabled={i === widgets.length - 1}
                            className="flex h-8 w-8 items-center justify-center text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            ↓
                          </button>
                        </div>
                        <input
                          type="checkbox"
                          checked={w.enabled}
                          onChange={(e) =>
                            setWidgets((v) => v.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))
                          }
                          className="h-4 w-4 flex-shrink-0"
                        />
                        <select
                          value={w.type}
                          onChange={(e) =>
                            setWidgets((v) =>
                              v.map((x, j) => (j === i ? { ...x, type: e.target.value as WidgetType } : x))
                            )
                          }
                          className="w-full flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                          style={{
                            background: 'var(--bg-hover)',
                            color: 'var(--text-primary)',
                            border: '1px solid transparent',
                          }}
                        >
                          {(Object.keys(WIDGET_LABELS) as WidgetType[]).map((t) => (
                            <option key={t} value={t}>
                              {WIDGET_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => setWidgets((v) => v.filter((_, j) => j !== i))}
                        className="absolute right-2 top-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ color: '#F4212E' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,33,46,0.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        ×
                      </button>
                      <IMEInput
                        value={w.title || ''}
                        onValueChange={(v) =>
                          setWidgets((arr) => arr.map((x, j) => (j === i ? { ...x, title: v } : x)))
                        }
                        placeholder={'标题（留空用默认）'}
                        className="w-full rounded-lg px-2 py-2 text-sm outline-none"
                        style={{
                          background: 'var(--bg-hover)',
                          color: 'var(--text-primary)',
                          border: '1px solid transparent',
                        }}
                      />
                      {w.type === 'custom' && (
                        <IMETextarea
                          value={w.content || ''}
                          onValueChange={(v) =>
                            setWidgets((arr) => arr.map((x, j) => (j === i ? { ...x, content: v } : x)))
                          }
                          placeholder="自定义内容"
                          rows={3}
                          className="w-full resize-none rounded-lg px-2 py-2 text-sm outline-none"
                          style={{
                            background: 'var(--bg-hover)',
                            color: 'var(--text-primary)',
                            border: '1px solid transparent',
                          }}
                        />
                      )}
                      {w.type === 'carousel' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-2 rounded-xl p-2.5 sm:flex-row sm:items-center sm:gap-2 sm:rounded-none sm:p-0">
                            <div className="flex items-center gap-2 sm:flex-1">
                              <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                自动切换
                              </span>
                              <input
                                type="number"
                                min={500}
                                max={30000}
                                step={500}
                                value={w.interval || 3000}
                                onChange={(e) =>
                                  setWidgets((arr) =>
                                    arr.map((x, j) => (j === i ? { ...x, interval: Number(e.target.value) } : x))
                                  )
                                }
                                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                style={{
                                  background: 'var(--bg-hover)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid transparent',
                                }}
                              />
                            </div>
                            <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                              单位毫秒，建议 3000 以上
                            </p>
                          </div>

                          {(w.slides || []).map((sl, si) => {
                            const stype = sl.slideType || 'image'
                            return (
                              <div
                                key={si}
                                className="flex flex-col gap-2 rounded-xl p-3"
                                style={{ background: 'var(--bg-secondary)' }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className="shrink-0 text-xs font-bold"
                                      style={{ color: 'var(--text-secondary)' }}
                                    >
                                      幻灯片 #{si + 1}
                                    </span>
                                    <span
                                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                                      style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}
                                    >
                                      {SLIDE_TYPE_LABELS[stype]}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() =>
                                      setWidgets((arr) =>
                                        arr.map((x, j) => {
                                          if (j !== i) return x
                                          return { ...x, slides: (x.slides || []).filter((_, k) => k !== si) }
                                        })
                                      )
                                    }
                                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs"
                                    style={{ color: '#F4212E', background: 'rgba(244,33,46,0.1)' }}
                                  >
                                    ×
                                  </button>
                                </div>

                                <select
                                  value={stype}
                                  onChange={(e) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ss = [...(x.slides || [])]
                                        ss[si] = { ...ss[si], slideType: e.target.value as CarouselSlideType }
                                        return { ...x, slides: ss }
                                      })
                                    )
                                  }
                                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                >
                                  {(Object.keys(SLIDE_TYPE_LABELS) as CarouselSlideType[]).map((t) => (
                                    <option key={t} value={t}>
                                      {SLIDE_TYPE_LABELS[t]}
                                    </option>
                                  ))}
                                </select>

                                {stype === 'image' && (
                                  <IMEInput
                                    value={sl.image || ''}
                                    onValueChange={(v) =>
                                      setWidgets((arr) =>
                                        arr.map((x, j) => {
                                          if (j !== i) return x
                                          const ss = [...(x.slides || [])]
                                          ss[si] = { ...ss[si], image: v }
                                          return { ...x, slides: ss }
                                        })
                                      )
                                    }
                                    placeholder="图片 URL（必填）"
                                    className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                    style={{
                                      background: 'var(--bg-hover)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid transparent',
                                    }}
                                  />
                                )}
                                {(stype === 'image' || stype === 'text') && (
                                  <IMEInput
                                    value={sl.title || ''}
                                    onValueChange={(v) =>
                                      setWidgets((arr) =>
                                        arr.map((x, j) => {
                                          if (j !== i) return x
                                          const ss = [...(x.slides || [])]
                                          ss[si] = { ...ss[si], title: v }
                                          return { ...x, slides: ss }
                                        })
                                      )
                                    }
                                    placeholder="标题（可选）"
                                    className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                    style={{
                                      background: 'var(--bg-hover)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid transparent',
                                    }}
                                  />
                                )}
                                {stype === 'text' && (
                                  <IMETextarea
                                    value={sl.desc || ''}
                                    onValueChange={(v) =>
                                      setWidgets((arr) =>
                                        arr.map((x, j) => {
                                          if (j !== i) return x
                                          const ss = [...(x.slides || [])]
                                          ss[si] = { ...ss[si], desc: v }
                                          return { ...x, slides: ss }
                                        })
                                      )
                                    }
                                    placeholder="正文内容"
                                    rows={3}
                                    className="w-full resize-none rounded-lg px-2.5 py-2 text-sm outline-none"
                                    style={{
                                      background: 'var(--bg-hover)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid transparent',
                                    }}
                                  />
                                )}
                                {stype === 'markdown' && (
                                  <IMETextarea
                                    value={sl.markdown || ''}
                                    onValueChange={(v) =>
                                      setWidgets((arr) =>
                                        arr.map((x, j) => {
                                          if (j !== i) return x
                                          const ss = [...(x.slides || [])]
                                          ss[si] = { ...ss[si], markdown: v }
                                          return { ...x, slides: ss }
                                        })
                                      )
                                    }
                                    placeholder="# 标题&#10;正文内容，支持 Markdown 格式"
                                    rows={5}
                                    className="w-full resize-none rounded-lg px-2.5 py-2 font-mono text-sm outline-none"
                                    style={{
                                      background: 'var(--bg-hover)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid transparent',
                                    }}
                                  />
                                )}
                                {(stype === 'image' || stype === 'text') && (
                                  <IMEInput
                                    value={sl.link || ''}
                                    onValueChange={(v) =>
                                      setWidgets((arr) =>
                                        arr.map((x, j) => {
                                          if (j !== i) return x
                                          const ss = [...(x.slides || [])]
                                          ss[si] = { ...ss[si], link: v }
                                          return { ...x, slides: ss }
                                        })
                                      )
                                    }
                                    placeholder="跳转链接（可选）"
                                    className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                    style={{
                                      background: 'var(--bg-hover)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid transparent',
                                    }}
                                  />
                                )}
                              </div>
                            )
                          })}
                          <button
                            onClick={() =>
                              setWidgets((arr) =>
                                arr.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        slides: [
                                          ...(x.slides || []),
                                          { slideType: 'image', image: '', title: '', desc: '', link: '' },
                                        ],
                                      }
                                    : x
                                )
                              )
                            }
                            className="min-h-10 self-stretch rounded-full px-3 py-2 text-xs"
                            style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                          >
                            + 添加幻灯片
                          </button>
                        </div>
                      )}
                      {w.type === 'links' && (
                        <div className="flex flex-col gap-2">
                          {(w.links || []).map((lk, li) => (
                            <div
                              key={li}
                              className="flex flex-col gap-2 rounded-xl p-3"
                              style={{ background: 'var(--bg-secondary)' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                  友链 #{li + 1}
                                </span>
                                <button
                                  onClick={() =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        return { ...x, links: (x.links || []).filter((_, k) => k !== li) }
                                      })
                                    )
                                  }
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs"
                                  style={{ color: '#F4212E', background: 'rgba(244,33,46,0.1)' }}
                                >
                                  ×
                                </button>
                              </div>
                              <IMEInput
                                value={lk.label}
                                onValueChange={(v) =>
                                  setWidgets((arr) =>
                                    arr.map((x, j) => {
                                      if (j !== i) return x
                                      const ls = [...(x.links || [])]
                                      ls[li] = { ...ls[li], label: v }
                                      return { ...x, links: ls }
                                    })
                                  )
                                }
                                placeholder="名称"
                                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                style={{
                                  background: 'var(--bg-hover)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid transparent',
                                }}
                              />
                              <IMEInput
                                value={lk.url}
                                onValueChange={(v) =>
                                  setWidgets((arr) =>
                                    arr.map((x, j) => {
                                      if (j !== i) return x
                                      const ls = [...(x.links || [])]
                                      ls[li] = { ...ls[li], url: v }
                                      return { ...x, links: ls }
                                    })
                                  )
                                }
                                placeholder="https://"
                                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                style={{
                                  background: 'var(--bg-hover)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid transparent',
                                }}
                              />
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <IMEInput
                                  value={lk.desc || ''}
                                  onValueChange={(v) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ls = [...(x.links || [])]
                                        ls[li] = { ...ls[li], desc: v }
                                        return { ...x, links: ls }
                                      })
                                    )
                                  }
                                  placeholder="简介（可选）"
                                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                />
                                <IMEInput
                                  value={lk.avatar || ''}
                                  onValueChange={(v) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ls = [...(x.links || [])]
                                        ls[li] = { ...ls[li], avatar: v }
                                        return { ...x, links: ls }
                                      })
                                    )
                                  }
                                  placeholder="头像URL（可选）"
                                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              setWidgets((arr) =>
                                arr.map((x, j) =>
                                  j === i ? { ...x, links: [...(x.links || []), { label: '', url: '' }] } : x
                                )
                              )
                            }
                            className="min-h-10 self-stretch rounded-full px-3 py-2 text-xs"
                            style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                          >
                            + 添加链接
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                  修改后点击底部「保存设置」生效
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="min-h-11 w-full rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50 sm:w-auto"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  )
}
