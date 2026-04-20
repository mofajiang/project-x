import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { execSync, spawnSync } from 'child_process'
import { revalidatePath } from 'next/cache'
import { getRequestIp, logAdminAudit } from '@/lib/admin-audit'
import { getErrorMessage } from '@/lib/converters'

const REPO = 'mofajiang/project-x'
const GH = `https://api.github.com/repos/${REPO}`

function ghHeaders() {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'x-blog-admin' }
  const token = process.env.GITHUB_TOKEN
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

function gitEnv() {
  return { ...process.env, GIT_TERMINAL_PROMPT: '0' }
}

function getLocalCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd(), timeout: 5000, encoding: 'utf8', env: gitEnv() }).trim()
  } catch {
    return ''
  }
}

function getLocalBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: process.cwd(),
      timeout: 5000,
      encoding: 'utf8',
      env: gitEnv(),
    }).trim()
  } catch {
    return process.env.GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main'
  }
}

async function ghFetch(url: string) {
  const res = await fetch(url, { headers: ghHeaders(), cache: 'no-store' })

  if (res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining')
    const reset = res.headers.get('X-RateLimit-Reset')
    if (remaining === '0' && reset) {
      const resetTime = parseInt(reset) * 1000
      const waitMs = Math.max(resetTime - Date.now(), 0)
      if (waitMs < 3600000) {
        await new Promise((r) => setTimeout(r, waitMs + 1000))
        return ghFetch(url)
      }
    }
  }

  return res
}

async function waitForServiceReady(baseUrl: string, maxWaitMs = 30000) {
  const startTime = Date.now()
  const healthUrl = `${baseUrl}/api/health`

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      })
      if (res.ok) return true
    } catch {
      // 服务还未就绪，继续等待
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const localCommit = getLocalCommit()
    const branch = getLocalBranch()

    const branchRes = await ghFetch(`${GH}/branches/${branch}`)
    if (!branchRes.ok) throw new Error(`GitHub API ${branchRes.status}: ${await branchRes.text()}`)
    const branchData = await branchRes.json()
    const remoteCommit: string = branchData.commit?.sha ?? ''
    const hasUpdate = !!(remoteCommit && localCommit && remoteCommit !== localCommit)

    let commits: { sha: string; message: string; date: string; author: string }[] = []
    if (hasUpdate) {
      const compareRes = await ghFetch(`${GH}/compare/${localCommit}...${remoteCommit}`)
      if (compareRes.ok) {
        const cmp = await compareRes.json()

        if (cmp.status === 'diverged') {
          throw new Error('代码已分叉，请手动合并后再尝试更新')
        }

        commits = (
          (cmp.commits as {
            sha: string
            commit: { message: string; committer: { date: string }; author: { name: string } }
          }[]) || []
        )
          .reverse()
          .slice(0, 20)
          .map((c) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split('\n')[0],
            date: c.commit.committer?.date ?? '',
            author: c.commit.author?.name ?? '',
          }))
      }
    }

    return NextResponse.json({
      hasUpdate,
      localCommit: localCommit.slice(0, 7),
      remoteCommit: remoteCommit.slice(0, 7),
      branch,
      commits,
      checkedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), hasUpdate: false }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestIp = getRequestIp(req)
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let auditLogged = false
      const send = (msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg })}\n\n`))
      }
      const sendError = (msg: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg, error: true })}\n\n`))
      }
      const sendDone = (success: boolean) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, success })}\n\n`))
        controller.close()
      }
      const recordAudit = async (status: 'success' | 'failed', summary: string, metadata?: Record<string, unknown>) => {
        if (auditLogged) return
        auditLogged = true
        await logAdminAudit({
          action: 'system.updated',
          summary,
          riskLevel: 'critical',
          status,
          targetType: 'branch',
          targetId: 'main',
          actor: session,
          ip: requestIp,
          metadata,
        })
      }

      try {
        const cwd = process.cwd()
        const branch = getLocalBranch()

        if (!process.env.DATABASE_URL) {
          send('⚠️ 未检测到 DATABASE_URL，继续执行更新流程')
        }

        send('⏳ 正在拉取最新代码...')
        try {
          execSync(`git pull origin ${branch}`, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 60000, env: gitEnv() })
          send('✅ git pull 完成')
        } catch (e: unknown) {
          const errMsg = getErrorMessage(e) || 'git pull failed'
          await recordAudit('failed', '执行系统更新失败：git pull 未完成', { stage: 'git-pull', error: errMsg })
          sendError(`❌ git pull 失败：${errMsg}`)
          sendDone(false)
          return
        }

        send('⏳ 正在构建（npm run build）...')
        const buildResult = spawnSync('npm', ['run', 'build'], {
          cwd,
          encoding: 'utf8',
          timeout: 300000,
          env: gitEnv(),
        })
        if (buildResult.status !== 0) {
          const stdout = buildResult.stdout || ''
          const stderr = buildResult.stderr || ''
          const combined = stderr + stdout
          const errMsg = combined.length > 3000 ? `...\n${combined.slice(-3000)}` : combined
          await recordAudit('failed', '执行系统更新失败：构建未通过', {
            stage: 'build',
            exitCode: buildResult.status,
            error: errMsg,
          })
          sendError(`❌ 构建失败（exit ${buildResult.status}）：\n${errMsg}`)
          sendDone(false)
          return
        }
        send('✅ 构建完成')

        send('⏳ 正在重启服务（pm2 restart）...')
        const pm2Name = process.env.PM2_APP_NAME || 'x-blog'
        try {
          execSync(`pm2 restart ${pm2Name}`, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 30000, env: gitEnv() })

          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          send('⏳ 等待服务启动...')
          const ready = await waitForServiceReady(baseUrl)

          if (ready) {
            send('✅ 服务已启动')
          } else {
            send('⚠️ 服务启动超时，请手动检查')
          }
        } catch {
          send('⚠️ pm2 不可用，跳过重启（本地环境）')
        }

        revalidatePath('/', 'layout')
        await recordAudit('success', '执行系统更新完成', { branch })
        send('✅ 更新全部完成！页面将自动刷新。')
        sendDone(true)
      } catch (e: unknown) {
        await recordAudit('failed', '执行系统更新失败：出现未知错误', {
          stage: 'unknown',
          error: getErrorMessage(e) || 'unknown error',
        })
        sendError(`❌ 未知错误：${getErrorMessage(e)}`)
        sendDone(false)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
