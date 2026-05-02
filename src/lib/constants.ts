export const AI_DEFAULTS = {
  TIMEOUT_SECONDS: 30,
  MAX_TOKENS: 2000,
} as const

export const GEO_TIMEOUT_MS = 3000

/** AI 审核评分阈值：按强度统一应用于评论和友链 */
export const AI_REVIEW_THRESHOLDS = {
  lenient: { autoApprove: 30, autoReject: 80 },
  balanced: { autoApprove: 20, autoReject: 70 },
  strict: { autoApprove: 10, autoReject: 60 },
} as const

export type AiReviewStrength = keyof typeof AI_REVIEW_THRESHOLDS
