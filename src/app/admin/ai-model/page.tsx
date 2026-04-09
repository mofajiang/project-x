'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { IMEInput } from '@/components/ui/IMEInput'

interface AiConfig {
  enableCustomAiModel: boolean
  aiModelName: string
  aiModelProvider: string
  aiModelBaseUrl: string
  aiModelApiKey: string
  aiModelMaxTokens: number
  aiModelTimeout: number
  enableAiDetection: boolean
  aiReviewStrength: string
  aiAutoApprove: boolean
  // 分 provider 的 API Keys
  groqApiKey: string
  openrouterApiKey: string
  // 各功能独立模型配置
  commentAiProvider: string
  commentAiModel: string
  friendLinkAiProvider: string
  friendLinkAiModel: string
  voicePolishAiProvider: string
  voicePolishAiModel: string
  postPolishAiProvider: string
  postPolishAiModel: string
}

const GROQ_PRESET_MODELS = [
  { value: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant（推荐，最快）' },
  { value: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile（更准确）' },
  { value: 'gemma2-9b-it', label: 'gemma2-9b-it（Google Gemma 2）' },
  { value: 'mixtral-8x7b-32768', label: 'mixtral-8x7b-32768' },
  { value: 'compound-beta', label: 'compound-beta（Groq 工具调用）' },
]

const PROVIDERS_FOR_FN = [
  { value: '', label: '跟随全局默认' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: '自定义接口' },
]

const FUNCTIONS = [
  { key: 'comment', label: '评论审核', providerKey: 'commentAiProvider', modelKey: 'commentAiModel' },
  { key: 'friendLink', label: '友链审核', providerKey: 'friendLinkAiProvider', modelKey: 'friendLinkAiModel' },
  { key: 'voicePolish', label: '语音润色', providerKey: 'voicePolishAiProvider', modelKey: 'voicePolishAiModel' },
  { key: 'postPolish', label: '文章润色', providerKey: 'postPolishAiProvider', modelKey: 'postPolishAiModel' },
] as const

export default function AdminAiModelPage() {
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings/ai-model', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      } else {
        const error = await res.json()
        toast.error(error.error || '加载配置失败')
      }
    } catch {
      toast.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const set = (field: keyof AiConfig, value: string | number | boolean) => {
    if (config) setConfig({ ...config, [field]: value })
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/ai-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setConfig(await res.json())
        toast.success('配置已保存')
      } else {
        const err = await res.json()
        toast.error(err?.error || '保存失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!config?.aiModelApiKey && !config?.groqApiKey && !config?.openrouterApiKey) {
      toast.error('请先填写 API Key')
      return
    }
    setTestingConnection(true)
    try {
      const res = await fetch('/api/admin/settings/ai-model/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.aiModelProvider,
          baseUrl: config.aiModelBaseUrl,
          apiKey:
            config.aiModelProvider === 'groq'
              ? config.groqApiKey || config.aiModelApiKey
              : config.aiModelProvider === 'openrouter'
                ? config.openrouterApiKey || config.aiModelApiKey
                : config.aiModelApiKey,
          model: config.aiModelName,
          timeout: config.aiModelTimeout,
        }),
      })
      const data = await res.json()
      if (res.ok) toast.success('连接成功！')
      else toast.error(data.error || '连接失败')
    } catch {
      toast.error('测试出错')
    } finally {
      setTestingConnection(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--text-secondary)' }}>加载中...</div>
  if (!config) return <div style={{ color: 'var(--text-secondary)' }}>无法加载配置</div>

  const cardStyle = { background: 'var(--bg-secondary)', borderColor: 'var(--border)' }
  const inputClass = 'w-full rounded-lg border bg-transparent px-4 py-2 outline-none'
  const inputStyle = { borderColor: 'var(--border)', color: 'var(--text-primary)' }
  const labelClass = 'mb-1 block text-sm font-medium'
  const labelStyle = { color: 'var(--text-secondary)' }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
        AI 模型管理
      </h1>

      <div className="space-y-8">
        {/* API 密钥 */}
        <div className="rounded-2xl border p-6" style={cardStyle}>
          <h2 className="mb-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            API 密钥
          </h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            按服务商填写密钥，下方各功能可选择要使用的服务商。
          </p>
          <div className="space-y-4">
            {/* Groq */}
            <div>
              <label className={labelClass} style={labelStyle}>
                Groq API Key
              </label>
              <IMEInput
                type="password"
                placeholder="gsk_..."
                value={config.groqApiKey}
                onValueChange={(v) => set('groqApiKey', v)}
                className={inputClass}
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary, var(--text-secondary))' }}>
                免费·极速 —{' '}
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline">
                  获取 Groq API Key →
                </a>
              </p>
            </div>
            {/* OpenRouter */}
            <div>
              <label className={labelClass} style={labelStyle}>
                OpenRouter API Key
              </label>
              <IMEInput
                type="password"
                placeholder="sk-or-..."
                value={config.openrouterApiKey || config.aiModelApiKey}
                onValueChange={(v) => set('openrouterApiKey', v)}
                className={inputClass}
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary, var(--text-secondary))' }}>
                <a
                  href="https://openrouter.ai/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  获取 OpenRouter API Key →
                </a>
              </p>
            </div>
            {/* Custom */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>
                  自定义接口地址
                </label>
                <IMEInput
                  type="url"
                  placeholder="http://localhost:11434"
                  value={config.aiModelBaseUrl}
                  onValueChange={(v) => set('aiModelBaseUrl', v)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>
                  自定义接口 API Key（可选）
                </label>
                <IMEInput
                  type="password"
                  placeholder="留空则不鉴权"
                  value={config.aiModelApiKey}
                  onValueChange={(v) => set('aiModelApiKey', v)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 默认模型 */}
        <div className="rounded-2xl border p-6" style={cardStyle}>
          <h2 className="mb-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            全局默认模型
          </h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            当各功能未单独指定服务商时，使用此默认配置。
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} style={labelStyle}>
                默认服务商
              </label>
              <select
                value={config.aiModelProvider}
                onChange={(e) => set('aiModelProvider', e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">自定义接口</option>
              </select>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                默认模型名称
              </label>
              {config.aiModelProvider === 'groq' ? (
                <>
                  <select
                    value={config.aiModelName}
                    onChange={(e) => set('aiModelName', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    {GROQ_PRESET_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                    {!GROQ_PRESET_MODELS.find((m) => m.value === config.aiModelName) && config.aiModelName && (
                      <option value={config.aiModelName}>{config.aiModelName}（自定义）</option>
                    )}
                  </select>
                  <IMEInput
                    type="text"
                    placeholder="或手动输入模型 ID"
                    value={config.aiModelName}
                    onValueChange={(v) => set('aiModelName', v)}
                    className={`mt-2 ${inputClass}`}
                    style={inputStyle}
                  />
                </>
              ) : (
                <IMEInput
                  type="text"
                  placeholder={config.aiModelProvider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' : 'llama2'}
                  value={config.aiModelName}
                  onValueChange={(v) => set('aiModelName', v)}
                  className={inputClass}
                  style={inputStyle}
                />
              )}
            </div>
          </div>
        </div>

        {/* 各功能独立配置 */}
        <div className="rounded-2xl border p-6" style={cardStyle}>
          <h2 className="mb-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            各功能模型配置
          </h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            可为每个功能单独选择服务商和模型。留空则使用全局默认。
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FUNCTIONS.map(({ label, providerKey, modelKey }) => {
              const provider = config[providerKey] as string
              const model = config[modelKey] as string
              return (
                <div key={providerKey} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="mb-3 font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {label}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass} style={labelStyle}>
                        服务商
                      </label>
                      <select
                        value={provider}
                        onChange={(e) => set(providerKey, e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                      >
                        {PROVIDERS_FOR_FN.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} style={labelStyle}>
                        模型
                      </label>
                      {provider === 'groq' ? (
                        <>
                          <select
                            value={model}
                            onChange={(e) => set(modelKey, e.target.value)}
                            className={inputClass}
                            style={inputStyle}
                          >
                            <option value="">（跟随全局默认）</option>
                            {GROQ_PRESET_MODELS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                            {!GROQ_PRESET_MODELS.find((m) => m.value === model) && model && (
                              <option value={model}>{model}（自定义）</option>
                            )}
                          </select>
                          <IMEInput
                            type="text"
                            placeholder="或手动输入 Groq 模型 ID"
                            value={model}
                            onValueChange={(v) => set(modelKey, v)}
                            className={`mt-2 ${inputClass}`}
                            style={inputStyle}
                          />
                        </>
                      ) : (
                        <IMEInput
                          type="text"
                          placeholder="留空则使用全局默认模型"
                          value={model}
                          onValueChange={(v) => set(modelKey, v)}
                          className={inputClass}
                          style={inputStyle}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 高级配置 */}
        <div className="rounded-2xl border p-6" style={cardStyle}>
          <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            高级配置
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} style={labelStyle}>
                最大 Token 数
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                value={isNaN(config.aiModelMaxTokens) ? '' : config.aiModelMaxTokens}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  set('aiModelMaxTokens', isNaN(v) ? 2000 : v)
                }}
                className={inputClass}
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                模型回应的最大长度限制
              </p>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                超时时间（秒）
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={isNaN(config.aiModelTimeout) ? '' : config.aiModelTimeout}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  set('aiModelTimeout', isNaN(v) ? 30 : v)
                }}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* AI 审核设置 */}
        <div className="rounded-2xl border p-6" style={cardStyle}>
          <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            AI 审核设置
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.enableAiDetection}
                onChange={(e) => set('enableAiDetection', e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>启用 AI 智能审核（用于评论和友链）</span>
            </label>

            {config.enableAiDetection && (
              <>
                <div>
                  <label className={labelClass} style={labelStyle}>
                    审核强度
                  </label>
                  <select
                    value={config.aiReviewStrength}
                    onChange={(e) => set('aiReviewStrength', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="lenient">宽松 - 较少拦截，可能漏过一些违规</option>
                    <option value="balanced">均衡 - 推荐使用</option>
                    <option value="strict">严格 - 较严格审核，可能误杀</option>
                  </select>
                </div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.aiAutoApprove}
                    onChange={(e) => set('aiAutoApprove', e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>AI 判断安全时自动批准（评论和友链）</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection || saving}
            className="rounded-lg px-6 py-3 font-bold transition-all"
            style={{
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              opacity: testingConnection || saving ? 0.5 : 1,
            }}
          >
            {testingConnection ? '测试中...' : '测试默认连接'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-8 py-3 font-bold text-white transition-all"
            style={{ background: 'var(--accent)', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
