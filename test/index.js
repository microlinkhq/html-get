'use strict'

const cheerio = require('cheerio')
const test = require('ava')

const { prettyHtml } = require('./util')
const getHTML = require('..')

const wait = async (promise, prop) => {
  const res = await promise
  return prop ? res[prop] : res
}

test('reachable URL', async t => {
  const url = 'https://example.com'
  const [prerenderDisabled, prerenderEnabled] = await Promise.all([
    getHTML(url, { prerender: false }),
    getHTML(url, { prerender: true, puppeteerOpts: { adblock: false } })
  ])

  t.is(await wait(getHTML(url, { prerender: false }), 'statusCode'), 200)
  t.is(
    await wait(
      getHTML(url, { prerender: true, puppeteerOpts: { adblock: false } }),
      'statusCode'
    ),
    200
  )

  t.is(prerenderDisabled.statusCode, prerenderEnabled.statusCode)
  t.is(prerenderDisabled.statusCode, 200)

  t.true(Object.keys(prerenderDisabled.headers).length > 0)
  t.true(Object.keys(prerenderEnabled.headers).length > 0)
  t.is(typeof prerenderDisabled.headers, typeof prerenderEnabled.headers)

  t.true(prerenderDisabled.html.length > 0)
  t.true(prerenderEnabled.html.length > 0)
  t.is(typeof prerenderDisabled.html, typeof prerenderEnabled.html)
})

test('unreachable URL', async t => {
  const url = 'https://notexisturl.dev'

  const [prerenderDisabled, prerenderEnabled] = await Promise.all([
    getHTML(url, { prerender: false }),
    getHTML(url, { prerender: true, puppeteerOpts: { adblock: false } })
  ])

  t.is(prerenderDisabled.url, prerenderEnabled.url)
  t.is(prerenderDisabled.html, prerenderEnabled.html)
  t.is(prerenderDisabled.statusCode, prerenderEnabled.statusCode)
  t.deepEqual(prerenderDisabled.headers, prerenderEnabled.headers)
})

test('from audio URL', async t => {
  const targetUrl =
    'https://audiodemos.github.io/vctk_set0/embedadapt_100sample.wav'
  const { url, stats, html } = await getHTML(targetUrl, {
    prerender: false
  })

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})

test('from image URL', async t => {
  const targetUrl = 'https://kikobeats.com/images/avatar.jpg'
  const { url, stats, html } = await getHTML(targetUrl)

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)

  const $ = cheerio.load(html)
  $('meta[name="date"]').remove()

  t.snapshot(prettyHtml($.html()))
})

test('from video URL', async t => {
  const targetUrl = 'http://techslides.com/demos/sample-videos/small.mp4'
  const { url, stats, html } = await getHTML(targetUrl, {
    prerender: false
  })

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})

test('from bad SSL URL', async t => {
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
