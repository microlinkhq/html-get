'use strict'

const test = require('ava')

const getHTML = require('..')

const wait = async (promise, prop) => {
  const res = await promise
  return prop ? res[prop] : res
}

test('prerender by default', async t => {
  const url = 'https://example.com'
  const { stats } = await getHTML(url)
  t.is(stats.mode, 'prerender')
})

test('disable prerender explicitly', async t => {
  const url = 'https://example.com'
  const { stats } = await getHTML(url, { prerender: false })
  t.is(stats.mode, 'fetch')
})

test('prerender auto detection', async t => {
  const url = 'https://facebook.com'
  const { stats } = await getHTML(url)
  t.is(stats.mode, 'fetch')
})

test('follow redirect', async t => {
  const url = 'https://google.com'
  const redirectUrl = 'https://www.google.com/'

  t.is(await wait(getHTML(url, { prerender: false }), 'url'), redirectUrl)
  t.is(await wait(getHTML(url, { prerender: true }), 'url'), redirectUrl)
})

test.skip('prerender error fallback into fetch mode', async t => {
  const url =
    'https://www.sportsnet.ca/hockey/nhl/leafs-john-tavares-return-new-york-hope-positive/'
  const { stats, html } = await getHTML(url, { prerender: true })
  t.true(!!html)
  t.is(stats.mode, 'fetch')
})

test('unreachable urls', async t => {
  const url = 'https://notexisturl.dev'
  t.is(await wait(getHTML(url, { prerender: false }), 'html'), '')
  t.is(await wait(getHTML(url, { prerender: true }), 'html'), '')
})

test('decode base64 entities', async t => {
  const url =
    'https://gist.githubusercontent.com/Kikobeats/912a6c2158de3f3c30d0d7c7697af393/raw/d47d9df77696d9a42df192b7aedbf6cfd2ad393e/index.html'
  t.snapshot(await wait(getHTML(url, { prerender: true }), 'html'))
  t.snapshot(await wait(getHTML(url, { prerender: false }), 'html'))
})

test('unencoded URL', async t => {
  const url =
    'https://medium.com/@Acegikmo/the-ever-so-lovely-bézier-curve-eb27514da3bf'
  t.is(
    await wait(getHTML(url, { prerender: false }), 'url'),
    'https://medium.com/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  )
})

test('get html from audio url', async t => {
  const url = 'https://audiodemos.github.io/vctk_set0/embedadapt_100sample.wav'
  const { url: urlDetected, stats, html } = await getHTML(url, {
    prerender: false
  })

  t.true(!!html)
  t.is(stats.mode, 'fetch')
  t.is(url, urlDetected)
})

test('get html from image url', async t => {
  const url = 'https://kikobeats.com/images/avatar.jpg'
  const { url: urlDetected, stats, html } = await getHTML(url, {
    prerender: false
  })

  t.true(!!html)
  t.is(stats.mode, 'fetch')
  t.is(url, urlDetected)
})

test('get html from video url', async t => {
  const url = 'https://microlink.io/preview.mp4'
  const { url: urlDetected, stats, html } = await getHTML(url, {
    prerender: false
  })

  t.true(!!html)
  t.is(stats.mode, 'fetch')
  t.is(url, urlDetected)
})
