import nodemailer from 'nodemailer'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '465')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

/** 替换标题中的变量，支持 {postTitle} {replierName} {commenterName} {toName} */
function renderSubject(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

/** 获取发件人显示名称，优先自定义，否则用域名 */
function getSenderName(customName?: string): string {
  if (customName?.trim()) return customName.trim()
  return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname : '博客'
}

export async function sendReplyNotification({
  toEmail,
  toName,
  replierName,
  postTitle,
  postUrl,
  replyContent,
  customSubject,
  senderName,
}: {
  toEmail: string
  toName: string
  replierName: string
  postTitle: string
  postUrl: string
  replyContent: string
  customSubject?: string
  senderName?: string
}) {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('[mailer] SMTP 未配置，跳过邮件发送')
    return
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@blog.com'
  const displayName = getSenderName(senderName)
  const defaultSubject = `${replierName} 回复了你的评论 — ${postTitle}`
  const subject = customSubject
    ? renderSubject(customSubject, { postTitle, replierName, toName })
    : defaultSubject

  await transporter.sendMail({
    from: `"${displayName}" <${from}>`,
    to: toEmail,
    subject,
    html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f1419">
  <div style="border-bottom:1px solid #eff3f4;padding-bottom:16px;margin-bottom:20px">
    <h2 style="margin:0;font-size:20px">💬 你有一条新回复</h2>
  </div>
  <p style="color:#536471;margin:0 0 8px">Hi <strong>${toName}</strong>，</p>
  <p style="color:#536471;margin:0 0 20px"><strong>${replierName}</strong> 在《${postTitle}》中回复了你的评论：</p>
  <blockquote style="margin:0 0 20px;padding:12px 16px;background:#f7f9f9;border-left:3px solid #1d9bf0;border-radius:4px;color:#0f1419">
    ${replyContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </blockquote>
  <a href="${postUrl}" style="display:inline-block;padding:10px 20px;background:#1d9bf0;color:#fff;border-radius:9999px;text-decoration:none;font-weight:700">查看回复</a>
  <p style="margin-top:24px;color:#8b98a5;font-size:12px">如不想再收到此类通知，请忽略此邮件。</p>
</div>
`,
  })
}

export async function sendNewCommentNotification({
  postTitle,
  postUrl,
  commenterName,
  content,
  customSubject,
  senderName,
}: {
  postTitle: string
  postUrl: string
  commenterName: string
  content: string
  customSubject?: string
  senderName?: string
}) {
  const transporter = getTransporter()
  if (!transporter) return

  const adminEmail = process.env.SMTP_USER
  if (!adminEmail) return

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@blog.com'
  const displayName = getSenderName(senderName)
  const adminUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') + '/admin/comments'
  const defaultSubject = `📬 新评论待审核 — ${postTitle}`
  const subject = customSubject
    ? renderSubject(customSubject, { postTitle, commenterName })
    : defaultSubject

  await transporter.sendMail({
    from: `"${displayName}" <${from}>`,
    to: adminEmail,
    subject,
    html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f1419">
  <div style="border-bottom:1px solid #eff3f4;padding-bottom:16px;margin-bottom:20px">
    <h2 style="margin:0;font-size:20px">📬 你有一条新评论待审核</h2>
  </div>
  <p style="color:#536471"><strong>${commenterName}</strong> 在《${postTitle}》下留言：</p>
  <blockquote style="margin:0 0 20px;padding:12px 16px;background:#f7f9f9;border-left:3px solid #1d9bf0;border-radius:4px;color:#0f1419">
    ${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </blockquote>
  <div style="display:flex;gap:12px">
    <a href="${adminUrl}" style="display:inline-block;padding:10px 20px;background:#1d9bf0;color:#fff;border-radius:9999px;text-decoration:none;font-weight:700">前往审核</a>
    <a href="${postUrl}" style="display:inline-block;padding:10px 20px;background:#eff3f4;color:#0f1419;border-radius:9999px;text-decoration:none;font-weight:700">查看文章</a>
  </div>
  <p style="margin-top:24px;color:#8b98a5;font-size:12px">此邮件由系统自动发送。</p>
</div>
`,
  })
}

export async function sendCommentApprovedNotification({
  toEmail,
  toName,
  postTitle,
  postUrl,
  content,
  customSubject,
  senderName,
}: {
  toEmail: string
  toName: string
  postTitle: string
  postUrl: string
  content: string
  customSubject?: string
  senderName?: string
}) {
  const transporter = getTransporter()
  if (!transporter) return

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@blog.com'
  const displayName = getSenderName(senderName)
  const defaultSubject = `你在《${postTitle}》的评论已通过审核`
  const subject = customSubject
    ? renderSubject(customSubject, { postTitle, toName })
    : defaultSubject

  await transporter.sendMail({
    from: `"${displayName}" <${from}>`,
    to: toEmail,
    subject,
    html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f1419">
  <div style="border-bottom:1px solid #eff3f4;padding-bottom:16px;margin-bottom:20px">
    <h2 style="margin:0;font-size:20px">✅ 评论已通过审核</h2>
  </div>
  <p style="color:#536471">Hi <strong>${toName}</strong>，你在《${postTitle}》的评论已通过审核并公开显示：</p>
  <blockquote style="margin:0 0 20px;padding:12px 16px;background:#f7f9f9;border-left:3px solid #1d9bf0;border-radius:4px;color:#0f1419">
    ${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </blockquote>
  <a href="${postUrl}" style="display:inline-block;padding:10px 20px;background:#1d9bf0;color:#fff;border-radius:9999px;text-decoration:none;font-weight:700">查看评论</a>
  <p style="margin-top:24px;color:#8b98a5;font-size:12px">如不想再收到此类通知，请忽略此邮件。</p>
</div>
`,
  })
}
