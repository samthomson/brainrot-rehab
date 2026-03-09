import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWriteStream } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import type { ResolvedClip } from './nostr.js'

async function download(urlString: string, dest: string): Promise<void> {
  const url = new URL(urlString)
  const get = url.protocol === 'https:' ? https.get : http.get
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    get(urlString, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          download(res.headers.location, dest).then(resolve).catch(reject)
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
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`))))
  })
}

/**
 * Download clips, trim each, concat into one mp4. Returns path to output file.
 * Caller must delete the workDir when done (or we could return buffer and cleanup here).
 */
export async function composeVideo(clips: ResolvedClip[], workDir: string): Promise<string> {
  const parts: string[] = []
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const ext = clip.source.includes('?') ? '.mp4' : (clip.source.split('.').pop()?.slice(0, 4) || 'mp4')
    const inputPath = join(workDir, `input_${i}${ext}`)
    await download(clip.source, inputPath)
    const duration = clip.end_s - clip.start_s
    const partPath = join(workDir, `part_${i}.mp4`)
    await runFfmpeg(
      [
        '-ss', String(clip.start_s),
        '-i', inputPath,
        '-t', String(duration),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        partPath
      ],
      workDir
    )
    parts.push(partPath)
  }
  const listPath = join(workDir, 'list.txt')
  await writeFile(listPath, parts.map((p) => `file '${p}'`).join('\n'))
  const outPath = join(workDir, 'out.mp4')
  await runFfmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'list.txt',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    'out.mp4'
  ], workDir)
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
