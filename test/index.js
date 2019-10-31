'use strict'

const test = require('ava')

const { prettyHtml } = require('./util')
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

test.skip('prerender error fallback into fetch mode', async t => {
  const url =
    'https://www.sportsnet.ca/hockey/nhl/leafs-john-tavares-return-new-york-hope-positive/'
  const { stats, html } = await getHTML(url, { prerender: true })
  t.true(!!html)
  t.is(stats.mode, 'fetch')
})

test('unreachable urls', async t => {
  const url = 'https://notexisturl.dev'
  const html = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
      <title>notexisturl.dev</title>
      <meta property="og:site_name" content="notexisturl.dev">
      <meta property="og:locale" content="en">
      <meta property="og:url" content="https://notexisturl.dev">
      <link rel="canonical" href="https://notexisturl.dev">
    </head>
    <body>
    </body>
  </html>
  `

  t.deepEqual(
    prettyHtml(await wait(getHTML(url, { prerender: false }), 'html')),
    prettyHtml(html)
  )
  t.deepEqual(
    prettyHtml(await wait(getHTML(url, { prerender: true }), 'html')),
    prettyHtml(html)
  )
})

test('decode base64 entities', async t => {
  const url =
    'https://gist.githubusercontent.com/Kikobeats/912a6c2158de3f3c30d0d7c7697af393/raw/d47d9df77696d9a42df192b7aedbf6cfd2ad393e/index.html'

  const fetch = prettyHtml(
    await wait(getHTML(url, { prerender: false }), 'html')
  )

  t.true(
    fetch.includes(
      '<meta property="og:site_name" content="githubusercontent.com">'
    )
  )
  t.true(fetch.includes('<meta property="article:published_time"'))
  t.true(fetch.includes('<meta property="article:expiration_time"'))
  t.true(fetch.includes('<meta property="og:locale" content="en">'))
  t.true(
    fetch.includes(
      '<meta property="og:url" content="https://gist.githubusercontent.com/Kikobeats/912a6c2158de3f3c30d0d7c7697af393/raw/d47d9df77696d9a42df192b7aedbf6cfd2ad393e/index.html">'
    )
  )
  t.true(
    fetch.includes(
      '<link rel="canonical" href="https://gist.githubusercontent.com/Kikobeats/912a6c2158de3f3c30d0d7c7697af393/raw/d47d9df77696d9a42df192b7aedbf6cfd2ad393e/index.html">'
    )
  )

  const prerender = prettyHtml(
    await wait(getHTML(url, { prerender: true }), 'html')
  )
  t.true(
    prerender.includes(
      '<meta property="og:site_name" content="githubusercontent.com">'
    )
  )
  t.true(prerender.includes('<meta property="article:published_time"'))
  t.true(prerender.includes('<meta property="article:expiration_time"'))
  t.true(prerender.includes('<meta property="og:locale" content="en">'))
  t.true(
    prerender.includes(
      '<meta property="og:url" content="https://gist.githubusercontent.com/Kikobeats/912a6c2158de3f3c30d0d7c7697af393/raw/d47d9df77696d9a42df192b7aedbf6cfd2ad393e/index.html">'
    )
  )
  t.true(
    prerender.includes(
      '<link rel="canonical" href="https://gist.githubusercontent.com/Kikobeats/912a6c2158de3f3c30d0d7c7697af393/raw/d47d9df77696d9a42df192b7aedbf6cfd2ad393e/index.html">'
    )
  )
})

test('get html from audio url', async t => {
  const url = 'https://audiodemos.github.io/vctk_set0/embedadapt_100sample.wav'
  const { url: urlDetected, stats, html } = await getHTML(url, {
    prerender: false
  })

  t.true(html.includes('<audio src'))
  t.is(stats.mode, 'fetch')
  t.is(url, urlDetected)
})

test('get html from image url', async t => {
  const url = 'https://kikobeats.com/images/avatar.jpg'
  const { url: urlDetected, stats, html } = await getHTML(url, {
    prerender: false
  })

  t.true(html.includes('<img src'))
  t.is(stats.mode, 'fetch')
  t.is(url, urlDetected)
})

test('get html from video url', async t => {
  const url = 'http://techslides.com/demos/sample-videos/small.mp4'
  const { url: urlDetected, stats, html } = await getHTML(url, {
    prerender: false
  })

  t.true(html.includes('<video src'))
  t.is(stats.mode, 'fetch')
  t.is(url, urlDetected)
})
