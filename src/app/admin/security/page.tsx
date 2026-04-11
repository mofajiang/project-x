'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_LG_CLASS } from '@/components/admin/adminUi'

export default function SecurityPage() {
  const [config, setConfig] = useState({
    loginPath: '/admin-login',
    loginMode: 'path',
    secretClicks: 5,
  })
  const [newPassword, setNewPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [saving, setSaving] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyConfigData = (data: Record<string, any>) => {
    setConfig({
      loginPath: data.loginPath || '/admin-login',
      loginMode: data.loginMode || 'path',
      secretClicks: data.secretClicks ?? 5,
    })
  }

  useEffect(() => {
    fetch('/api/admin/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data) applyConfigData(data)
      })
  }, [])

  const saveConfig = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      applyConfigData(data)
      toast.success('安全设置已保存')
    } else {
      toast.error('保存失败')
    }
  }

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('新密码至少8位')
      return
    }
    const res = await fetch('/api/admin/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    })
    if (res.ok) {
      toast.success('密码已修改')
      setOldPassword('')
      setNewPassword('')
    } else toast.error('旧密码错误')
  }

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {/* 登录入口配置 */}
      <div className={ADMIN_CARD_LG_CLASS} style={{ background: 'var(--bg-secondary)' }}>
        <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          登录入口配置
        </h2>

        {/* 登录模式 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            入口模式
          </label>
          <div className="flex flex-col gap-2">
            {[
              { value: 'path', label: '自定义URL路径', desc: '只有访问指定路径才能看到登录表单' },
              { value: 'secret-click', label: '隐藏彩蛋', desc: '在首页连续点击Logo N次触发登录' },
              { value: 'both', label: '两者都启用', desc: '路径 + 彩蛋双重方式' },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                style={{ background: config.loginMode === opt.value ? 'var(--bg-hover)' : 'transparent' }}
              >
                <input
                  type="radio"
                  name="loginMode"
                  value={opt.value}
                  checked={config.loginMode === opt.value}
                  onChange={(e) => setConfig((c) => ({ ...c, loginMode: e.target.value }))}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {opt.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {opt.desc}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 自定义路径 */}
        {(config.loginMode === 'path' || config.loginMode === 'both') && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              登录路径
            </label>
            <input
              type="text"
              value={config.loginPath}
              onChange={(e) => setConfig((c) => ({ ...c, loginPath: e.target.value }))}
              placeholder="/your-secret-path"
              className="x-admin-input w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              当前登录地址：
              <span style={{ color: 'var(--accent)' }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}
                {config.loginPath}
              </span>
            </p>
          </div>
        )}

        {/* 彩蛋点击次数 */}
        {(config.loginMode === 'secret-click' || config.loginMode === 'both') && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              点击次数触发登录
            </label>
            <input
              type="number"
              min={3}
              max={20}
              value={config.secretClicks}
              onChange={(e) => setConfig((c) => ({ ...c, secretClicks: Number(e.target.value) }))}
              className="x-admin-input w-28 rounded-xl px-3 py-2 text-sm outline-none sm:w-24"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
            />
          </div>
        )}

        <button
          onClick={saveConfig}
          disabled={saving}
          className="w-full rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      {/* 修改密码 */}
      <div className={ADMIN_CARD_LG_CLASS} style={{ background: 'var(--bg-secondary)' }}>
        <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          修改密码
        </h2>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="旧密码"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="x-admin-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
          />
          <input
            type="password"
            placeholder="新密码（至少8位）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="x-admin-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
          />
          <button
            onClick={changePassword}
            className="w-full rounded-full px-6 py-3 text-sm font-bold text-white sm:w-fit"
            style={{ background: 'var(--accent)' }}
          >
            修改密码
          </button>
        </div>
      </div>
    </div>
  )
}
