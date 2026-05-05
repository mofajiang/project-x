/** 页面容器 — 列表/内容页统一宽度 */
export const ADMIN_PAGE_WRAPPER = 'mx-auto w-full max-w-6xl'

/** 页面标题 */
export const ADMIN_PAGE_TITLE_CLASS = 'text-2xl sm:text-[2rem] font-bold leading-tight tracking-tight mb-5 sm:mb-6'

/** 卡片 */
export const ADMIN_CARD_CLASS = 'rounded-2xl p-4 sm:p-5'

export const ADMIN_SUBCARD_CLASS = 'rounded-xl p-3 sm:p-4'

/** 表格：统一 hover 效果（需配合 globals.css .x-admin-table） */
export const ADMIN_TABLE_CLASS = 'w-full text-sm x-admin-table'

/** 输入框：统一 focus 高亮（需配合 globals.css .x-admin-input） */
export const ADMIN_INPUT_CLASS = 'w-full rounded-xl px-3.5 py-2 text-sm outline-none x-admin-input'

/** 分段标题 */
export const ADMIN_SECTION_TITLE = 'text-lg font-bold'

/** 主按钮 — 颜色通过内联 style 设置 */
export const ADMIN_BTN_PRIMARY =
  'rounded-full px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-50'

/** 危险按钮 — 颜色通过内联 style 设置 */
export const ADMIN_BTN_DANGER = 'rounded-full px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80'

/** 次要按钮 — 颜色通过内联 style 设置 */
export const ADMIN_BTN_SECONDARY =
  'rounded-full px-4 py-2 text-sm font-medium transition-colors border border-[var(--border)]'

/** 幽灵按钮 — 小号无边框 */
export const ADMIN_BTN_GHOST = 'rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80'

/** 徽章 */
export const ADMIN_BADGE = 'rounded-full px-2 py-0.5 text-[11px] font-medium'

/** 空状态 / 加载容器 */
export const ADMIN_EMPTY_CLASS = 'py-20 text-center text-sm'
