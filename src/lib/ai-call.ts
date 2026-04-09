/**
 * 统一 AI 调用工具
 * 支持按功能独立配置 provider + model，全局存储 API keys
 */
import { fetchWithTimeout } from '@/lib/fetch-utils'

export const GROQ_PRESET_MODELS = [
  { value: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant（最快，适合审核）' },
  { value: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile（更准确）' },
  { value: 'gemma2-9b-it', label: 'gemma2-9b-it（Google Gemma 2）' },
  { value: 'mixtral-8x7b-32768', label: 'mixtral-8x7b-32768（Mixtral，长上下文）' },
  { value: 'compound-beta', label: 'compound-beta（Groq Compound）' },
]

export type AiFunction = 'comment' | 'friendLink' | 'voicePolish' | 'postPolish'

export interface AiFullConfig {
  // 全局 API Keys（每个 provider 一个 key）
  groqApiKey: string
  openrouterApiKey: string
  aiModelBaseUrl: string // custom provider URL
  aiModelApiKey: string // custom (or legacy fallback)
  // 全局默认
  aiModelProvider: string
  aiModelName: string
  aiModelMaxTokens: number
  aiModelTimeout: number
  // 各功能独立配置（空字符串 = 使用全局）
  commentAiProvider: string
  commentAiModel: string
  friendLinkAiProvider: string
  friendLinkAiModel: string
  voicePolishAiProvider: string
  voicePolishAiModel: string
  postPolishAiProvider: string
  postPolishAiModel: string
}

interface AiCallParams {
  url: string
  headers: Record<string, string>
  model: string
  provider: string
}

/**
 * 解析指定功能的 AI 调用参数
 * 优先使用功能独立配置，回退到全局配置
 */
export function resolveAiParams(fn: AiFunction, cfg: AiFullConfig): AiCallParams {
  const providerMap: Record<AiFunction, keyof AiFullConfig> = {
    comment: 'commentAiProvider',
    friendLink: 'friendLinkAiProvider',
    voicePolish: 'voicePolishAiProvider',
    postPolish: 'postPolishAiProvider',
  }
  const modelMap: Record<AiFunction, keyof AiFullConfig> = {
    comment: 'commentAiModel',
    friendLink: 'friendLinkAiModel',
    voicePolish: 'voicePolishAiModel',
    postPolish: 'postPolishAiModel',
  }

  const provider = (cfg[providerMap[fn]] as string) || cfg.aiModelProvider || 'openrouter'
  const model = (cfg[modelMap[fn]] as string) || cfg.aiModelName || ''

  // 解析 API Key：优先使用 provider 专属 key，回退到全局 aiModelApiKey
  let apiKey: string
  if (provider === 'groq') {
    apiKey = cfg.groqApiKey || (cfg.aiModelProvider === 'groq' ? cfg.aiModelApiKey : '') || ''
  } else if (provider === 'openrouter') {
    apiKey = cfg.openrouterApiKey || (cfg.aiModelProvider === 'openrouter' ? cfg.aiModelApiKey : '') || ''
  } else {
    apiKey = cfg.aiModelApiKey || ''
  }

  // 构建请求参数
  let url: string
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions'
    headers['Authorization'] = `Bearer ${apiKey}`
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  } else if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions'
    headers['Authorization'] = `Bearer ${apiKey}`
  } else if (provider === 'ollama') {
    const base = (cfg.aiModelBaseUrl || 'http://localhost:11434').replace(/\/+$/, '')
    url = `${base}/api/chat`
    // ollama 不需要认证头
  } else {
    // custom
    const base = (cfg.aiModelBaseUrl || '').replace(/\/+$/, '')
    url = `${base}/v1/chat/completions`
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  }

  return { url, headers, model, provider }
}

/**
 * 统一 AI Chat 调用
 * 返回 assistant message content
 */
export async function callAi(
  fn: AiFunction,
  cfg: AiFullConfig,
  messages: { role: string; content: string }[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { url, headers, model, provider } = resolveAiParams(fn, cfg)
  const timeoutMs = (Number(cfg.aiModelTimeout) || 30) * 1000
  const maxTokens = options.maxTokens || Number(cfg.aiModelMaxTokens) || 2000
  const temperature = options.temperature ?? 0.4

  const isOllama = provider === 'ollama'
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...(isOllama ? { stream: false } : {}),
  }

  const response = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs)

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`AI API returned ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  if (isOllama) {
    return data.message?.content ?? ''
  }
  return data.choices?.[0]?.message?.content ?? ''
}

/**
 * 从数据库行构建完整配置对象
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToAiFullConfig(row: Record<string, any>): AiFullConfig {
  return {
    groqApiKey: row.groqApiKey || '',
    openrouterApiKey: row.openrouterApiKey || '',
    aiModelBaseUrl: row.aiModelBaseUrl || '',
    aiModelApiKey: row.aiModelApiKey || '',
    aiModelProvider: row.aiModelProvider || 'openrouter',
    aiModelName: row.aiModelName || '',
    aiModelMaxTokens: Number(row.aiModelMaxTokens) || 2000,
    aiModelTimeout: Number(row.aiModelTimeout) || 30,
    commentAiProvider: row.commentAiProvider || '',
    commentAiModel: row.commentAiModel || '',
    friendLinkAiProvider: row.friendLinkAiProvider || '',
    friendLinkAiModel: row.friendLinkAiModel || '',
    voicePolishAiProvider: row.voicePolishAiProvider || '',
    voicePolishAiModel: row.voicePolishAiModel || '',
    postPolishAiProvider: row.postPolishAiProvider || '',
    postPolishAiModel: row.postPolishAiModel || '',
  }
}

/** 加载 AI 完整配置的 SQL 字段列表 */
export const AI_CONFIG_SELECT = `
  groqApiKey, openrouterApiKey, aiModelBaseUrl, aiModelApiKey,
  aiModelProvider, aiModelName,
  COALESCE(aiModelMaxTokens, 2000) as aiModelMaxTokens,
  COALESCE(aiModelTimeout, 30) as aiModelTimeout,
  commentAiProvider, commentAiModel,
  friendLinkAiProvider, friendLinkAiModel,
  voicePolishAiProvider, voicePolishAiModel,
  postPolishAiProvider, postPolishAiModel
`
