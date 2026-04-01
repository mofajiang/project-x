import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { execSync, spawnSync } from 'child_process'
import { revalidatePath } from 'next/cache'
import { rmSync } from 'fs'

const REPO = 'mofajiang/project-x'
const GH = `https://api.github.com/repos/${REPO}`
function ghHeaders() {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'x-blog-admin' }
  const token = process.env.GITHUB_TOKEN
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

function getLocalCommit(): string {
  try { return execSync('git rev-parse HEAD', { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' }).trim() }
  catch { return '' }
}

function getLocalBranch(): string {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' }).trim() }
  catch {
    return process.env.GIT_BRANCH
      || process.env.VERCEL_GIT_COMMIT_REF
      || 'main'
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const localCommit = getLocalCommit()
    const branch = getLocalBranch()

    // 获取远程最新 commit
    const branchRes = await fetch(`${GH}/branches/${branch}`, { headers: ghHeaders(), cache: 'no-store' })
    if (!branchRes.ok) throw new Error(`GitHub API ${branchRes.status}: ${await branchRes.text()}`)
    const branchData = await branchRes.json()
    const remoteCommit: string = branchData.commit?.sha ?? ''
    const hasUpdate = !!(remoteCommit && localCommit && remoteCommit !== localCommit)

    // 获取新 commits 列表
    let commits: { sha: string; message: string; date: string; author: string }[] = []
    if (hasUpdate) {
      // 用 compare API 精确获取两个 commit 之间的差异
      const compareRes = await fetch(`${GH}/compare/${localCommit}...${remoteCommit}`, { headers: ghHeaders(), cache: 'no-store' })
      if (compareRes.ok) {
        const cmp = await compareRes.json()
        commits = ((cmp.commits as { sha: string; commit: { message: string; committer: { date: string }; author: { name: string } } }[]) || [])
          .reverse() // 最新的在前
          .slice(0, 20)
          .map(c => ({
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
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

      try {
        const cwd = process.cwd()
        const branch = 'main'

        if (!process.env.DATABASE_URL) {
          send('⚠️ 未检测到 DATABASE_URL，继续执行更新流程')
        }

        // Step 1: git pull（尽量贴近手工更新命令）
        send('⏳ 正在拉取最新代码...')
        try {
          const pullOut = execSync(`git pull origin ${branch}`, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 60000 })
          send(`✅ git pull 完成\n${pullOut.trim()}`)
        } catch (e: any) {
          sendError(`❌ git pull 失败：${e.message}`)
          sendDone(false)
          return
        }

        // Step 2: npm run build（用 spawnSync 避免大输出 pipe buffer 死锁）
        send('⏳ 正在构建（npm run build）...')
        const buildResult = spawnSync('npm', ['run', 'build'], { cwd, encoding: 'utf8', timeout: 300000 })
        if (buildResult.status !== 0) {
          const errMsg = (buildResult.stderr || buildResult.stdout || '').slice(-2000)
          sendError(`❌ 构建失败（exit ${buildResult.status}）：\n${errMsg}`)
          sendDone(false)
          return
        }
        send('✅ 构建完成')

        // Step 3: pm2 restart
        send('⏳ 正在重启服务（pm2 restart）...')
        try {
          const pm2Name = process.env.PM2_APP_NAME || 'x-blog'
          const pm2Out = execSync(`pm2 restart ${pm2Name}`, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 30000 })
          send(`✅ 服务已重启\n${pm2Out.trim()}`)
        } catch {
          // pm2 可能不存在（本地开发环境），忽略
          send('⚠️ pm2 不可用，跳过重启（本地环境）')
        }

        // 重新验证页面缓存
        revalidatePath('/', 'layout')
        send('✅ 更新全部完成！页面将自动刷新。')
        sendDone(true)
      } catch (e: any) {
        sendError(`❌ 未知错误：${e.message}`)
        sendDone(false)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}