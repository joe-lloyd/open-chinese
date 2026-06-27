import { spawn } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TIMEOUT_MS = 10_000

export async function transcribe(audioBuffer: Buffer): Promise<string> {
  const backend = process.env.WHISPER_BACKEND ?? 'api'

  if (backend === 'local') {
    return transcribeLocal(audioBuffer)
  }

  return transcribeAPI(audioBuffer)
}

async function transcribeAPI(audioBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const blob = new Blob([audioBuffer], { type: 'audio/wav' })
  const form = new FormData()
  form.append('file', blob, 'audio.wav')
  form.append('model', 'whisper-1')
  form.append('language', 'zh')
  form.append('response_format', 'text')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`Whisper API error: ${res.status}`)
    return (await res.text()).trim()
  } finally {
    clearTimeout(timer)
  }
}

async function transcribeLocal(audioBuffer: Buffer): Promise<string> {
  const tmpPath = join(tmpdir(), `oc-${randomUUID()}.wav`)
  await writeFile(tmpPath, audioBuffer)

  try {
    return await new Promise<string>((resolve, reject) => {
      const proc = spawn('whisper', [tmpPath, '--language', 'zh', '--output_format', 'txt'], {
        timeout: TIMEOUT_MS,
      })

      let output = ''
      proc.stdout.on('data', (d: Buffer) => (output += d.toString()))
      proc.on('close', (code) => {
        if (code === 0) resolve(output.trim())
        else reject(new Error(`whisper exited with code ${code}`))
      })
      proc.on('error', reject)
    })
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}
