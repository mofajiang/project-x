import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSiteConfig } from './config'

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

type S3Config = {
  endpoint?: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  keyPrefix: string
  publicBaseUrl?: string
}

type SmmsConfig = {
  token: string
}

export type StorageFileMeta = {
  name: string
  size: number
  updatedAt: string
  url: string
  ext: string
}

type SaveInput = {
  buffer: Buffer
  originalName: string
  fileName?: string
  fixedName?: string
  ensureUnique?: boolean
  overwrite?: boolean
}

type ReadOutput = {
  data: Buffer
  ext: string
}

export interface StorageProvider {
  listFiles(): Promise<StorageFileMeta[]>
  saveFile(input: SaveInput): Promise<StorageFileMeta>
  readFile(name: string): Promise<ReadOutput>
  renameFile(oldName: string, newName: string): Promise<StorageFileMeta>
  deleteFile(name: string): Promise<void>
}

export type StorageDriver = 'local' | 's3' | 'smms'

export type StorageCapabilities = {
  upload: boolean
  list: boolean
  download: boolean
  rename: boolean
  delete: boolean
}

export type StorageStatus = {
  configuredDriver: StorageDriver
  activeDriver: StorageDriver
  fallbackReason?: 's3_config_incomplete' | 'smms_config_incomplete'
  capabilities: StorageCapabilities
}

export function extOf(filename: string) {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : ''
}

export function safeBaseName(input: string) {
  const cleaned = String(input || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') return ''
  return cleaned
}

export function safeName(input: string) {
  const decoded = decodeURIComponent(String(input || ''))
  return safeBaseName(decoded)
}

async function ensureUploadDir() {
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
}

async function nextAvailableName(name: string) {
  const ext = extOf(name)
  const base = ext ? name.slice(0, -1 * (ext.length + 1)) : name
  let candidate = name
  let index = 1
  while (true) {
    try {
      await stat(path.join(LOCAL_UPLOAD_DIR, candidate))
      candidate = ext ? `${base}-${index}.${ext}` : `${base}-${index}`
      index += 1
    } catch {
      return candidate
    }
  }
}

async function existsInLocal(name: string) {
  try {
    await stat(path.join(LOCAL_UPLOAD_DIR, name))
    return true
  } catch {
    return false
  }
}

function buildPublicUrl(publicBaseUrl: string | undefined, key: string) {
  if (!publicBaseUrl) return ''
  const base = publicBaseUrl.replace(/\/+$/, '')
  const encodedKey = key.split('/').map(part => encodeURIComponent(part)).join('/')
  return `${base}/${encodedKey}`
}

function parseBooleanLoose(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' || typeof value === 'bigint') return Number(value) !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  }
  return fallback
}

type StorageRuntimeConfig = {
  driver: StorageDriver
  s3: S3Config | null
  smms: SmmsConfig | null
}

const STORAGE_CAPABILITIES: Record<StorageDriver, StorageCapabilities> = {
  local: { upload: true, list: true, download: true, rename: true, delete: true },
  s3: { upload: true, list: true, download: true, rename: true, delete: true },
  smms: { upload: true, list: false, download: false, rename: false, delete: false },
}

function resolveS3ConfigFromMixed(raw: Record<string, unknown>): S3Config | null {
  const bucket = String(raw.storageS3Bucket || raw.STORAGE_S3_BUCKET || '').trim()
  const accessKeyId = String(raw.storageS3AccessKeyId || raw.STORAGE_S3_ACCESS_KEY_ID || '').trim()
  const secretAccessKey = String(raw.storageS3SecretAccessKey || raw.STORAGE_S3_SECRET_ACCESS_KEY || '').trim()
  const publicBaseUrl = String(raw.storagePublicBaseUrl || raw.STORAGE_PUBLIC_BASE_URL || '').trim()
  if (!bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return null

  const keyPrefixRaw = String(raw.storageS3Prefix || raw.STORAGE_S3_PREFIX || 'uploads/').trim()
  const keyPrefix = keyPrefixRaw ? keyPrefixRaw.replace(/^\/+/, '').replace(/\/+$/, '') + '/' : ''

  return {
    endpoint: String(raw.storageS3Endpoint || raw.STORAGE_S3_ENDPOINT || '').trim() || undefined,
    region: String(raw.storageS3Region || raw.STORAGE_S3_REGION || 'auto').trim(),
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: parseBooleanLoose(raw.storageS3ForcePathStyle ?? raw.STORAGE_S3_FORCE_PATH_STYLE, false),
    keyPrefix,
    publicBaseUrl,
  }
}

function resolveSmmsConfigFromMixed(raw: Record<string, unknown>): SmmsConfig | null {
  const token = String(raw.storageSmmsToken || raw.STORAGE_SMMS_TOKEN || '').trim()
  if (!token) return null
  return { token }
}

async function resolveStorageRuntimeConfig(): Promise<StorageRuntimeConfig> {
  const dbConfig = await getSiteConfig().catch(() => null)
  const raw: Record<string, unknown> = {
    ...(process.env as Record<string, unknown>),
    ...(dbConfig as Record<string, unknown> | null || {}),
  }

  const driverRaw = String(raw.storageDriver || raw.STORAGE_DRIVER || 'local').trim().toLowerCase()
  const driver = driverRaw === 's3' || driverRaw === 'smms' ? driverRaw : 'local'

  return {
    driver,
    s3: resolveS3ConfigFromMixed(raw),
    smms: resolveSmmsConfigFromMixed(raw),
  }
}

function resolveStorageStatus(runtime: StorageRuntimeConfig): StorageStatus {
  if (runtime.driver === 's3') {
    if (runtime.s3) {
      return {
        configuredDriver: 's3',
        activeDriver: 's3',
        capabilities: STORAGE_CAPABILITIES.s3,
      }
    }
    return {
      configuredDriver: 's3',
      activeDriver: 'local',
      fallbackReason: 's3_config_incomplete',
      capabilities: STORAGE_CAPABILITIES.local,
    }
  }

  if (runtime.driver === 'smms') {
    if (runtime.smms) {
      return {
        configuredDriver: 'smms',
        activeDriver: 'smms',
        capabilities: STORAGE_CAPABILITIES.smms,
      }
    }
    return {
      configuredDriver: 'smms',
      activeDriver: 'local',
      fallbackReason: 'smms_config_incomplete',
      capabilities: STORAGE_CAPABILITIES.local,
    }
  }

  return {
    configuredDriver: 'local',
    activeDriver: 'local',
    capabilities: STORAGE_CAPABILITIES.local,
  }
}

class LocalStorageProvider implements StorageProvider {
  async listFiles() {
    await ensureUploadDir()
    const names = await readdir(LOCAL_UPLOAD_DIR)
    const rows = await Promise.all(names.map(async (name) => {
      const st = await stat(path.join(LOCAL_UPLOAD_DIR, name))
      return {
        name,
        size: st.size,
        updatedAt: st.mtime.toISOString(),
        url: `/uploads/${encodeURIComponent(name)}`,
        ext: extOf(name),
      }
    }))
    rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return rows
  }

  async saveFile(input: SaveInput) {
    const ensureUnique = input.ensureUnique !== false
    await ensureUploadDir()

    const originalExt = extOf(input.originalName)
    if (!originalExt) throw new Error('INVALID_EXT')

    let targetName = ''
    if (input.fixedName) {
      const fixed = safeBaseName(input.fixedName)
      if (!fixed) throw new Error('INVALID_NAME')
      targetName = `${fixed}.${originalExt}`
    } else if (input.fileName) {
      const cleaned = safeBaseName(input.fileName)
      if (!cleaned) throw new Error('INVALID_NAME')
      const customExt = extOf(cleaned)
      targetName = customExt ? cleaned : `${cleaned}.${originalExt}`
    } else {
      const base = safeBaseName(input.originalName.replace(/\.[^.]+$/, '')) || `${Date.now()}`
      targetName = `${base}.${originalExt}`
    }

    if (!input.overwrite) {
      if (ensureUnique) {
        targetName = await nextAvailableName(targetName)
      } else {
        const exists = await existsInLocal(targetName)
        if (exists) {
          throw new Error('FILE_EXISTS')
        }
      }
    }

    await writeFile(path.join(LOCAL_UPLOAD_DIR, targetName), input.buffer)

    const st = await stat(path.join(LOCAL_UPLOAD_DIR, targetName))
    return {
      name: targetName,
      size: st.size,
      updatedAt: st.mtime.toISOString(),
      url: `/uploads/${encodeURIComponent(targetName)}`,
      ext: extOf(targetName),
    }
  }

  async readFile(name: string) {
    const safe = safeName(name)
    if (!safe) throw new Error('INVALID_NAME')
    const data = await readFile(path.join(LOCAL_UPLOAD_DIR, safe))
    return { data, ext: extOf(safe) }
  }

  async renameFile(oldName: string, newName: string) {
    const oldSafe = safeName(oldName)
    let newSafe = safeName(newName)
    if (!oldSafe || !newSafe) throw new Error('INVALID_NAME')

    const oldExt = extOf(oldSafe)
    const newExt = extOf(newSafe)
    if (!newExt && oldExt) newSafe = `${newSafe}.${oldExt}`

    const oldPath = path.join(LOCAL_UPLOAD_DIR, oldSafe)
    const newPath = path.join(LOCAL_UPLOAD_DIR, newSafe)
    await stat(oldPath)
    const exists = await existsInLocal(newSafe)
    if (exists) {
      throw new Error('FILE_EXISTS')
    }

    await rename(oldPath, newPath)
    const st = await stat(newPath)
    return {
      name: newSafe,
      size: st.size,
      updatedAt: st.mtime.toISOString(),
      url: `/uploads/${encodeURIComponent(newSafe)}`,
      ext: extOf(newSafe),
    }
  }

  async deleteFile(name: string) {
    const safe = safeName(name)
    if (!safe) throw new Error('INVALID_NAME')
    await rm(path.join(LOCAL_UPLOAD_DIR, safe), { force: false })
  }
}

class S3StorageProvider implements StorageProvider {
  constructor(private readonly config: S3Config, private readonly client: S3Client) {}

  private keyOf(name: string) {
    return `${this.config.keyPrefix}${name}`
  }

  private nameFromKey(key: string) {
    const p = this.config.keyPrefix
    if (p && key.startsWith(p)) return key.slice(p.length)
    return key
  }

  private toMeta(name: string, size: number, updatedAt: Date | string) {
    const key = this.keyOf(name)
    return {
      name,
      size,
      updatedAt: new Date(updatedAt).toISOString(),
      url: buildPublicUrl(this.config.publicBaseUrl, key),
      ext: extOf(name),
    }
  }

  private async exists(name: string) {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: this.keyOf(name),
      }))
      return true
    } catch {
      return false
    }
  }

  async listFiles() {
    const out = await this.client.send(new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: this.config.keyPrefix || undefined,
    }))

    const rows = (out.Contents || [])
      .filter(item => !!item.Key && !!item.LastModified)
      .map(item => {
        const key = String(item.Key)
        const name = this.nameFromKey(key)
        return this.toMeta(name, Number(item.Size || 0), item.LastModified as Date)
      })
      .filter(item => !!item.name)

    rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return rows
  }

  async saveFile(input: SaveInput) {
    const ensureUnique = input.ensureUnique !== false
    const originalExt = extOf(input.originalName)
    if (!originalExt) throw new Error('INVALID_EXT')

    let targetName = ''
    if (input.fixedName) {
      const fixed = safeBaseName(input.fixedName)
      if (!fixed) throw new Error('INVALID_NAME')
      targetName = `${fixed}.${originalExt}`
    } else if (input.fileName) {
      const cleaned = safeBaseName(input.fileName)
      if (!cleaned) throw new Error('INVALID_NAME')
      const customExt = extOf(cleaned)
      targetName = customExt ? cleaned : `${cleaned}.${originalExt}`
    } else {
      const base = safeBaseName(input.originalName.replace(/\.[^.]+$/, '')) || `${Date.now()}`
      targetName = `${base}.${originalExt}`
    }

    if (!input.overwrite) {
      if (ensureUnique) {
        const ext = extOf(targetName)
        const base = ext ? targetName.slice(0, -1 * (ext.length + 1)) : targetName
        let candidate = targetName
        let index = 1
        while (await this.exists(candidate)) {
          candidate = ext ? `${base}-${index}.${ext}` : `${base}-${index}`
          index += 1
        }
        targetName = candidate
      } else if (await this.exists(targetName)) {
        throw new Error('FILE_EXISTS')
      }
    }

    const key = this.keyOf(targetName)
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: input.buffer,
    }))

    return this.toMeta(targetName, input.buffer.byteLength, new Date())
  }

  async readFile(name: string) {
    const safe = safeName(name)
    if (!safe) throw new Error('INVALID_NAME')

    const out = await this.client.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: this.keyOf(safe),
    }))

    if (!out.Body) throw new Error('NOT_FOUND')
    const bytes = await out.Body.transformToByteArray()
    return {
      data: Buffer.from(bytes),
      ext: extOf(safe),
    }
  }

  async renameFile(oldName: string, newName: string) {
    const oldSafe = safeName(oldName)
    let newSafe = safeName(newName)
    if (!oldSafe || !newSafe) throw new Error('INVALID_NAME')

    const oldExt = extOf(oldSafe)
    const newExt = extOf(newSafe)
    if (!newExt && oldExt) newSafe = `${newSafe}.${oldExt}`

    if (await this.exists(newSafe)) {
      throw new Error('FILE_EXISTS')
    }

    const oldKey = this.keyOf(oldSafe)
    const newKey = this.keyOf(newSafe)
    const encodedOldKey = oldKey.split('/').map(segment => encodeURIComponent(segment)).join('/')
    await this.client.send(new CopyObjectCommand({
      Bucket: this.config.bucket,
      Key: newKey,
      CopySource: `${this.config.bucket}/${encodedOldKey}`,
    }))
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: oldKey,
    }))

    return this.toMeta(newSafe, 0, new Date())
  }

  async deleteFile(name: string) {
    const safe = safeName(name)
    if (!safe) throw new Error('INVALID_NAME')
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: this.keyOf(safe),
    }))
  }
}

class SmmsStorageProvider implements StorageProvider {
  constructor(private readonly config: SmmsConfig) {}

  async listFiles(): Promise<StorageFileMeta[]> {
    throw new Error('NOT_SUPPORTED')
  }

  async saveFile(input: SaveInput) {
    const formData = new FormData()
    formData.append('smfile', new Blob([new Uint8Array(input.buffer)]), input.originalName)

    const resp = await fetch('https://sm.ms/api/v2/upload', {
      method: 'POST',
      headers: {
        Authorization: this.config.token,
      },
      body: formData,
      cache: 'no-store',
    })

    const data = await resp.json().catch(() => ({})) as any
    if (!resp.ok || (data?.success !== true && data?.code !== 'image_repeated')) {
      throw new Error(data?.message || 'SMMS_UPLOAD_FAILED')
    }

    const row = data?.data || {}
    const url = String(row.url || row.data || '').trim()
    if (!url) throw new Error('SMMS_UPLOAD_FAILED')

    const name = String(row.filename || row.hash || input.originalName)
    return {
      name,
      size: input.buffer.byteLength,
      updatedAt: new Date().toISOString(),
      url,
      ext: extOf(name) || extOf(input.originalName),
    }
  }

  async readFile(_name: string): Promise<ReadOutput> {
    throw new Error('NOT_SUPPORTED')
  }

  async renameFile(_oldName: string, _newName: string): Promise<StorageFileMeta> {
    throw new Error('NOT_SUPPORTED')
  }

  async deleteFile(_name: string): Promise<void> {
    throw new Error('NOT_SUPPORTED')
  }
}

const localProvider = new LocalStorageProvider()
let s3Provider: S3StorageProvider | null = null
let smmsProvider: SmmsStorageProvider | null = null
let s3ProviderKey = ''
let smmsProviderKey = ''

function getS3ProviderWithConfig(config: S3Config | null) {
  if (!config) return null
  const key = JSON.stringify(config)
  if (s3Provider && s3ProviderKey === key) return s3Provider

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  s3Provider = new S3StorageProvider(config, client)
  s3ProviderKey = key
  return s3Provider
}

function getSmmsProviderWithConfig(config: SmmsConfig | null) {
  if (!config) return null
  const key = JSON.stringify(config)
  if (smmsProvider && smmsProviderKey === key) return smmsProvider
  smmsProvider = new SmmsStorageProvider(config)
  smmsProviderKey = key
  return smmsProvider
}

export async function getStorageProvider(): Promise<StorageProvider> {
  const runtime = await resolveStorageRuntimeConfig()
  const status = resolveStorageStatus(runtime)
  if (status.activeDriver === 's3') {
    const s3 = getS3ProviderWithConfig(runtime.s3)
    if (s3) return s3
  }
  if (status.activeDriver === 'smms') {
    const smms = getSmmsProviderWithConfig(runtime.smms)
    if (smms) return smms
  }
  return localProvider
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const runtime = await resolveStorageRuntimeConfig()
  return resolveStorageStatus(runtime)
}
