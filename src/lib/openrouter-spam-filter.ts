/**
 * OpenRouter AI 垃圾评论检测
 * 使用 Claude 模型进行内容分析
 */

interface SpamAnalysisResult {
  isSpam: boolean // 是否判定为垃圾
  riskScore: number // 风险得分 0-100
  riskReasons: string[] // 风险原因列表
  confidence: number // 置信度 0-1
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * 调用 OpenRouter API 分析评论内容
 * 返回垃圾评论判定和风险评分
 */
export async function analyzeCommentWithAI(
  content: string,
  apiKey: string,
  model: string,
  authorName?: string,
  authorEmail?: string,
  authorWebsite?: string,
): Promise<SpamAnalysisResult> {
  console.log('[analyzeCommentWithAI] 开始调用，参数检查:', { hasApiKey: !!apiKey, model, contentLength: content.length })
  
  if (!apiKey) {
    console.error('[spam-filter] ❌ OpenRouter API 密钥未配置（为空），跳过 AI 检测')
    return {
      isSpam: false,
      riskScore: 0,
      riskReasons: ['API 密钥未配置'],
      confidence: 0,
    }
  }
  
  if (!model) {
    console.error('[spam-filter] ❌ AI 模型 ID 未配置（为空）')
    return {
      isSpam: false,
      riskScore: 0,
      riskReasons: ['模型未配置'],
      confidence: 0,
    }
  }

  try {
    console.log('[openrouter] 准备发送请求到:', OPENROUTER_API_URL)
    console.log('[openrouter] 使用模型:', model)
    
    const prompt: string = `你是一个评论垃圾检测系统。请分析以下博客评论内容，判断其是否为垃圾评论或低质量评论。

评论信息：
- 内容: ${content}
${authorName ? `- 账户名: ${authorName}` : ''}
${authorEmail ? `- 邮箱: ${authorEmail}` : ''}
${authorWebsite ? `- 网站: ${authorWebsite}` : ''}

请从以下方面进行评分（0-100）：
1. 垃圾广告指数 (包含明显商业链接、推销内容)
2. 骚扰/人身攻击指数 (包含辱骂、威胁等)
3. 链接重复/机器生成指数 (包含大量外链、重复内容、看起来是自动生成)
4. 与主题关联度 (与文章内容完全无关)
5. 语言质量 (明显的低质量拼写错误、无意义文字)

然后给出结论（JSON格式）：
{
  "isSpam": boolean,
  "riskScore": number,
  "riskReasons": [reason1, reason2, ...],
  "confidence": number
}

注意：
- riskScore 0-20: 正常评论，可自动通过
- riskScore 21-50: 可疑评论，需要人工审核
- riskScore 51-100: 高危评论，建议直接删除或隐藏

只返回 JSON，不要返回其他内容。`

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Blog Comment Spam Filter',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    })

    console.log('[openrouter] API 响应状态:', response.status, response.statusText)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[openrouter] ❌ API 错误状态 ' + response.status + ':', JSON.stringify(errorData))
      return {
        isSpam: false,
        riskScore: 0,
        riskReasons: [`API 错误: ${response.status} ${response.statusText}`],
        confidence: 0,
      }
    }

    const data = await response.json()
    console.log('[openrouter] 原始响应体 (前300字):', JSON.stringify(data).substring(0, 300))
    
    let responseContent = data.choices?.[0]?.message?.content?.trim()
    
    // 如果 content 为空，尝试从 reasoning 字段提取（某些模型如 reasoning 会用这个格式）
    if (!responseContent && data.choices?.[0]?.message?.reasoning) {
      console.log('[openrouter] ⚠️  content 为空，尝试从 reasoning 字段提取...')
      responseContent = data.choices[0].message.reasoning?.trim()
    }

    if (!responseContent) {
      console.error('[openrouter] ❌ 响应内容为空，完整响应:', JSON.stringify(data))
      return {
        isSpam: false,
        riskScore: 0,
        riskReasons: ['API 响应为空'],
        confidence: 0,
      }
    }
    
    console.log('[openrouter] ✅ 收到响应内容长度:', responseContent.length, '字')
    console.log('[openrouter] 完整响应内容:', responseContent)

    // 解析 JSON（可能被包裹在 markdown ``` 中）
    let jsonStr = responseContent.trim()
    
    // 首先尝试移除 markdown 代码块标记
    if (jsonStr.startsWith('```')) {
      // 移除开头的 ```json 或 ```
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    
    // 如果仍然失败，尝试提取第一个 { 到最后一个 }
    let result: any = null
    try {
      console.log('[openrouter] 尝试直接解析 JSON...')
      result = JSON.parse(jsonStr.trim())
    } catch (parseErr: any) {
      console.log('[openrouter] 直接解析失败，尝试提取 JSON 对象...')
      const start = jsonStr.indexOf('{')
      const end = jsonStr.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) {
        try {
          jsonStr = jsonStr.substring(start, end + 1)
          console.log('[openrouter] 提取的 JSON:', jsonStr.substring(0, 100), '...')
          result = JSON.parse(jsonStr)
        } catch (extractErr: any) {
          console.error('[openrouter] ❌ JSON 提取和解析都失败:', {
            originalError: parseErr.message,
            extractError: extractErr.message,
            failedContent: jsonStr.substring(0, 200)
          })
          throw new Error(`JSON 解析失败: ${extractErr.message}`)
        }
      } else {
        console.error('[openrouter] ❌ 未找到有效的 JSON 对象')
        throw parseErr
      }
    }

    console.log('[openrouter] ✅ JSON 解析成功:', { riskScore: result.riskScore, isSpam: result.isSpam })

    // 验证和归一化结果
    const normalized = {
      isSpam: Boolean(result.isSpam),
      riskScore: Math.min(100, Math.max(0, Number(result.riskScore) || 0)),
      riskReasons: Array.isArray(result.riskReasons) ? result.riskReasons : [],
      confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)),
    }
    console.log('[openrouter] ✅ 最终返回结果:', normalized)
    return normalized
  } catch (error: any) {
    console.error('[spam-filter] ❌ AI 分析异常:', error?.message || error)
    return {
      isSpam: false,
      riskScore: 0,
      riskReasons: [error?.message || 'AI 分析异常'],
      confidence: 0,
    }
  }
}

/**
 * 快速检查（本地规则）— 在调用 AI 前过筛
 * 返回初步风险评分，高于阈值才调用 AI
 */
export function quickSpamCheck(
  content: string,
  authorEmail?: string,
): { shouldAnalyze: boolean; localRiskScore: number } {
  let localRiskScore = 0
  const checks = []

  // 1. 链接数量
  const linkCount = (content.match(/https?:\/\//g) || []).length
  if (linkCount >= 3) {
    localRiskScore += 20
    checks.push(`包含 ${linkCount} 个链接`)
  } else if (linkCount >= 1) {
    localRiskScore += 10
    checks.push('包含外链')
  }

  // 2. 内容长度异常
  if (content.length > 5000) {
    localRiskScore += 15
    checks.push('内容过长')
  }
  if (content.length < 3) {
    localRiskScore += 20
    checks.push('内容过短')
  }

  // 3. 重复字符/词
  const charRepeats = (content.match(/(.)\1{4,}/g) || []).length
  if (charRepeats > 0) {
    localRiskScore += charRepeats * 10
    checks.push(`重复字符 ${charRepeats} 处`)
  }

  // 4. 常见垃圾词（区分中英文）
  const spamKeywords = [
    'viagra', 'cialis', 'casino', 'poker', 'lottery',
    '博彩', '赌场', '彩票', '代孕', '黑客',
    'bitcoin', 'crypto', 'forex', 'investment',
  ]
  const hasSpamKeyword = spamKeywords.some(kw =>
    content.toLowerCase().includes(kw.toLowerCase())
  )
  if (hasSpamKeyword) {
    localRiskScore += 30
    checks.push('包含垃圾关键词')
  }

  // 5. 邮箱风险
  if (authorEmail?.includes('+')) {
    localRiskScore += 5
    checks.push('可疑邮箱格式')
  }

  // 6. 全大写内容
  const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length
  if (uppercaseRatio > 0.5) {
    localRiskScore += 15
    checks.push('全大写内容')
  }

  return {
    shouldAnalyze: localRiskScore >= 20, // 只有本地风险 >= 20 才调用 AI
    localRiskScore: Math.min(40, localRiskScore), // 本地检查最多贡献 40 分
  }
}

/**
 * 获取风险等级标签
 */
export function getRiskLevel(score: number): 'safe' | 'warning' | 'danger' {
  if (score < 20) return 'safe'
  if (score < 60) return 'warning'
  return 'danger'
}

/**
 * 获取风险等级颜色
 */
export function getRiskLevelColor(score: number): string {
  const level = getRiskLevel(score)
  if (level === 'safe') return '#00ba7c' // 绿色
  if (level === 'warning') return '#ffa500' // 橙色
  return '#f91880' // 红色
}
