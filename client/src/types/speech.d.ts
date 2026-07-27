/**
 * Ambient declarations for the recognition half of the Web Speech API.
 *
 * TypeScript 6.0's `lib.dom.d.ts` already ships `SpeechRecognitionAlternative`,
 * `SpeechRecognitionResult`, `SpeechRecognitionResultList`,
 * `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` and
 * `SpeechRecognitionErrorCode`. What it does NOT ship is the `SpeechRecognition`
 * interface itself, its constructor, or the vendor-prefixed
 * `webkitSpeechRecognition` global that Chrome, Edge and Opera actually expose.
 *
 * Only those missing pieces are declared here — redeclaring the ones the DOM lib
 * already provides would collide with it rather than augment it.
 */

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onaudiostart: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onspeechstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => unknown) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}
