import { Hono } from 'hono'
import { transcribe } from '../lib/whisper.ts'
import { comparePinyin } from '../lib/tone-compare.ts'
import { getCached, setCached } from '../lib/whisper-cache.ts'

const app = new Hono()

app.post('/', async (c) => {
  const body = await c.req.parseBody()
  const audioFile = body['audio']
  const targetPinyin = (body['targetPinyin'] as string)?.trim()

  if (!audioFile || typeof audioFile === 'string') {
    return c.json({ error: 'No audio file provided' }, 400)
  }
  if (!targetPinyin) {
    return c.json({ error: 'No targetPinyin provided' }, 400)
  }

  const audioBuffer = Buffer.from(await (audioFile as File).arrayBuffer())

  const cached = getCached(audioBuffer, targetPinyin)
  if (cached) {
    return c.json({ result: cached, cached: true })
  }

  try {
    const transcription = await transcribe(audioBuffer)
    const result = comparePinyin(transcription, targetPinyin)
    setCached(audioBuffer, targetPinyin, result)
    return c.json({ result, transcription, cached: false })
  } catch (e) {
    const msg = (e as Error).message
    const isTimeout = msg.includes('abort') || msg.includes('timeout')
    return c.json(
      { error: isTimeout ? 'Whisper backend timed out' : msg },
      isTimeout ? 504 : 502,
    )
  }
})

export default app
