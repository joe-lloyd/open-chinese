import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ReaderCover from './ReaderCover'

test('fallback is deterministic and retains semantic HTML titles', () => {
  const html = renderToStaticMarkup(
    <ReaderCover readerId="quiet-birthday" hskLevel={2}>
      <h2>安静的生日</h2>
      <p>The Quiet Birthday</p>
      <span>1 / 3 chapters</span>
    </ReaderCover>
  )
  const repeated = renderToStaticMarkup(
    <ReaderCover readerId="quiet-birthday" hskLevel={2} />
  )
  const otherLevel = renderToStaticMarkup(
    <ReaderCover readerId="quiet-birthday" hskLevel={3} />
  )
  const signature = html.match(/data-cover-fallback="([^"]+)"/)?.[1]
  assert.equal(signature, repeated.match(/data-cover-fallback="([^"]+)"/)?.[1])
  assert.notEqual(signature, otherLevel.match(/data-cover-fallback="([^"]+)"/)?.[1])
  assert.match(html, /data-cover-fallback="2-/)
  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /安静的生日/)
  assert.match(html, /The Quiet Birthday/)
  assert.match(html, /1 \/ 3 chapters/)
  assert.doesNotMatch(html, /<img/)
})

test('declared artwork emits responsive lazy image attributes and keeps title in HTML', () => {
  const html = renderToStaticMarkup(
    <ReaderCover
      readerId="cat-at-school"
      hskLevel={1}
      cover={{
        image: 'reader-covers/cat-at-school',
        alt: 'A small cat listens beside a classroom door.',
        focalPosition: '50% 42%',
        accent: '#C45B43',
      }}
    >
      <h2>学校里的猫</h2>
    </ReaderCover>
  )
  assert.match(html, /src="\/reader-covers\/cat-at-school-480.webp"/)
  assert.match(html, /srcSet="\/reader-covers\/cat-at-school-480.webp 480w, \/reader-covers\/cat-at-school-960.webp 960w"/)
  assert.match(html, /width="480"/)
  assert.match(html, /height="720"/)
  assert.match(html, /loading="lazy"/)
  assert.match(html, /object-position:50% 42%/)
  assert.match(html, /alt="A small cat listens beside a classroom door\."/)
  assert.match(html, /学校里的猫/)
})
