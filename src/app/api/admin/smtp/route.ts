import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env')

function readEnv(): Record<string, string> {
  const result: Record<string, string> = {}
  if (!fs.existsSync(ENV_PATH)) return result
  const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const val = match[2].trim().replace(/^"|"$/g, '')
    result[key] = val
  }
  return result
}

function writeEnv(vars: Record<string, string>) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : ''
  for (const [key, value] of Object.entries(vars)) {
    const escaped = value.includes(' ') || value.includes('#') ? `"${value}"` : value
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${escaped}`)
    } else {
      content = content.trimEnd() + `\n${key}=${escaped}\n`
    }
  }
  fs.writeFileSync(ENV_PATH, content, 'utf-8')
}

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const env = readEnv()
  return NextResponse.json({
    SMTP_HOST: env.SMTP_HOST || '',
    SMTP_PORT: env.SMTP_PORT || '465',
    SMTP_USER: env.SMTP_USER || '',
    SMTP_PASS: env.SMTP_PASS ? '••••••••' : '',  // 密码打码回显
    SMTP_FROM: env.SMTP_FROM || '',
    configured: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const toWrite: Record<string, string> = {}

  for (const key of SMTP_KEYS) {
    if (key === 'SMTP_PASS' && body[key] === '••••••••') continue  // 跳过未修改的密码
    if (body[key] !== undefined) toWrite[key] = body[key]
  }

  try {
    writeEnv(toWrite)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // 发送测试邮件
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to } = await req.json()
  if (!to) return NextResponse.json({ error: '请填写收件人邮箱' }, { status: 400 })

  const env = readEnv()
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return NextResponse.json({ error: 'SMTP 未配置，请先保存配置' }, { status: 400 })
  }

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: env.SMTP_HOST,
      port: parseInt(env.SMTP_PORT || '465'),
      secure: parseInt(env.SMTP_PORT || '465') === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
    const from = env.SMTP_FROM || env.SMTP_USER
    await transporter.sendMail({
      from: `"博客通知" <${from}>`,
      to,
      subject: '✅ SMTP 配置测试成功',
      html: '<p>恭喜！你的博客邮件通知功能已配置成功。</p>',
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
