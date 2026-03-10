import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWriteStream } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import type { ResolvedClip } from './nostr.js'
import { createLogger } from './log.js'

const log = createLogger('ffmpeg')

async function download(urlString: string, dest: string): Promise<void> {
  const url = new URL(urlString)
  const get = url.protocol === 'https:' ? https.get : http.get
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    get(urlString, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          log.info('Following redirect', { from: urlString, to: res.headers.location })
          download(res.headers.location, dest).then(resolve).catch(reject)
          return
        }
        if (res.statusCode && res.statusCode >= 400) {
          file.close()
          reject(new Error(`Download failed: HTTP ${res.statusCode} for ${urlString}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (err) => {
        file.close()
        rm(dest).catch(() => {})
        reject(err)
      })
  })
}

function runFfmpeg(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args], { cwd, stdio: 'pipe' })
    let stderr = ''
    proc.stderr?.on('data', (d) => { stderr += d })
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        log.error('ffmpeg exited with error', { code, stderrTail: stderr.slice(-500) })
        reject(new Error(stderr || `ffmpeg exit ${code}`))
      }
    })
  })
}

export async function composeVideo(clips: ResolvedClip[], workDir: string): Promise<string> {
  const inputs: string[] = []
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const ext = clip.source.includes('?') ? '.mp4' : (clip.source.split('.').pop()?.slice(0, 4) || 'mp4')
    const inputPath = join(workDir, `input_${i}${ext}`)
    log.info('Downloading clip', { index: i, url: clip.source, start: clip.start_s, end: clip.end_s })
    const t0 = Date.now()
    await download(clip.source, inputPath)
    log.info('Clip downloaded', { index: i, elapsedMs: Date.now() - t0 })
    inputs.push(inputPath)
  }

  const filterParts: string[] = []
  const concatInputs: string[] = []
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    filterParts.push(`[${i}:v]trim=start=${clip.start_s}:end=${clip.end_s},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`)
    filterParts.push(`[${i}:a]atrim=start=${clip.start_s}:end=${clip.end_s},asetpts=PTS-STARTPTS,aresample=44100[a${i}]`)
    concatInputs.push(`[v${i}][a${i}]`)
  }
  
  const filterComplex = [
    ...filterParts,
    `${concatInputs.join('')}concat=n=${clips.length}:v=1:a=1[outv][outa]`
  ].join(';')

  const ffmpegArgs = [
    ...inputs.flatMap(input => ['-i', input]),
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    'out.mp4'
  ]

  log.info('Running ffmpeg', { clipCount: clips.length })
  const t0 = Date.now()
  const outPath = join(workDir, 'out.mp4')
  await runFfmpeg(ffmpegArgs, workDir)
  log.info('ffmpeg complete', { elapsedMs: Date.now() - t0 })
  return outPath
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'dvm-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
