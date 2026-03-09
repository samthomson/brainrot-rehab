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
  // Download all clips
  const inputs: string[] = []
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const ext = clip.source.includes('?') ? '.mp4' : (clip.source.split('.').pop()?.slice(0, 4) || 'mp4')
    const inputPath = join(workDir, `input_${i}${ext}`)
    await download(clip.source, inputPath)
    inputs.push(inputPath)
  }

  // Build filter_complex for trimming, scaling, and concatenating all clips in one pass
  const filterParts: string[] = []
  const concatInputs: string[] = []
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    // Trim, scale to 720x1280 (9:16), and normalize each clip
    filterParts.push(`[${i}:v]trim=start=${clip.start_s}:end=${clip.end_s},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`)
    filterParts.push(`[${i}:a]atrim=start=${clip.start_s}:end=${clip.end_s},asetpts=PTS-STARTPTS,aresample=44100[a${i}]`)
    concatInputs.push(`[v${i}][a${i}]`)
  }
  
  // Concat all trimmed clips
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

  const outPath = join(workDir, 'out.mp4')
  await runFfmpeg(ffmpegArgs, workDir)
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
