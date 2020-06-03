'use strict'

const cheerio = require('cheerio')
const test = require('ava')

const { prettyHtml } = require('./util')
const getHTML = require('..')

const wait = async (promise, prop) => {
  const res = await promise
  return prop ? res[prop] : res
}

test('get headers', async t => {
  const url = 'https://example.com'
  t.true(
    typeof (await wait(getHTML(url, { prerender: false }), 'headers')) ===
      'object'
  )
  t.true(
    typeof (await wait(
      getHTML(url, { prerender: true, puppeteerOpts: { adblock: false } }),
      'headers'
    )) === 'object'
  )
})

test('get status code', async t => {
  const url = 'https://example.com'
  t.is(await wait(getHTML(url, { prerender: false }), 'statusCode'), 200)
  t.is(
    await wait(
      getHTML(url, { prerender: true, puppeteerOpts: { adblock: false } }),
      'statusCode'
    ),
    200
  )
})

test('handle unrecheable urls', async t => {
  const url = 'https://notexisturl.dev'

  const prerenderDisabled = prettyHtml(
    await wait(getHTML(url, { prerender: false }), 'html')
  )

  const prerenderEnabled = prettyHtml(
    await wait(
      getHTML(url, { prerender: true, puppeteerOpts: { adblock: false } }),
      'html'
    )
  )

  t.deepEqual(prerenderDisabled, prerenderEnabled)
  t.snapshot(prerenderEnabled)
})

test('get html from an audio URL', async t => {
  const targetUrl =
    'https://audiodemos.github.io/vctk_set0/embedadapt_100sample.wav'
  const { url, stats, html } = await getHTML(targetUrl, {
    prerender: false
  })

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})

test('get html from an image URL', async t => {
  const targetUrl = 'https://kikobeats.com/images/avatar.jpg'
  const { url, stats, html } = await getHTML(targetUrl)

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)

  const $ = cheerio.load(html)
  $('meta[name="date"]').remove()

  t.snapshot(prettyHtml($.html()))
})

test('get html from a video URL', async t => {
  const targetUrl = 'http://techslides.com/demos/sample-videos/small.mp4'
  const { url, stats, html } = await getHTML(targetUrl, {
    prerender: false
  })

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})

test('get html from bad SSL urls', async t => {
  const targetUrl = 'https://self-signed.badssl.com/'
  const { url, stats, html } = await getHTML(targetUrl, {
    prerender: false,
    gotOpts: {
      https: { rejectUnauthorized: false }
    }
  })

  t.true(html.includes('background: red'))
  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})
