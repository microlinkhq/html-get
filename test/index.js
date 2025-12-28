'use strict'

const { getBrowserContext } = require('@browserless/test')
const PCancelable = require('p-cancelable')
const cheerio = require('cheerio')
const test = require('ava')

const { runServer, prettyHtml } = require('./helpers')
const getHTML = require('..')

const wait = async (promise, prop) => {
  const res = await promise
  return prop ? res[prop] : res
}

test('throw an error if `getBrowserless` is not provided', async t => {
  const url = 'https://example.com'
  const error = await t.throwsAsync(getHTML(url))
  t.is(error.name, 'TypeError')
  t.is(
    error.message,
    "Need to provide a `getBrowserless` function. Try to pass `getBrowserless: require('browserless')`"
  )
})

test('promise is cancelable', async t => {
  const url = 'https://example.com'
  t.true(getHTML(url, { getBrowserless: () => {} }) instanceof PCancelable)
  t.true(
    getHTML.getContent(url, 'fetch', {
      getBrowserless: () => {}
    }) instanceof PCancelable
  )
})

test('reachable URL', async t => {
  const url = 'https://example.com'
  const [prerenderDisabled, prerenderEnabled] = await Promise.all([
    getHTML(url, {
      prerender: false,
      getBrowserless: () => getBrowserContext(t)
    }),
    getHTML(url, {
      prerender: true,
      getBrowserless: () => getBrowserContext(t),
      puppeteerOpts: { adblock: false }
    })
  ])

  t.is(
    await wait(
      getHTML(url, {
        prerender: false,
        getBrowserless: () => getBrowserContext(t)
      }),
      'statusCode'
    ),
    200
  )
  t.is(
    await wait(
      getHTML(url, {
        prerender: true,
        getBrowserless: () => getBrowserContext(t),
        puppeteerOpts: { adblock: false }
      }),
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

test('timeout URL', async t => {
  const url = 'https://test-timeout.vercel.app'

  const [prerenderDisabled, prerenderEnabled] = await Promise.all([
    getHTML(url, {
      prerender: false,
      getBrowserless: () => getBrowserContext(t),
      gotOpts: { timeout: 1000 }
    }),
    getHTML(url, {
      prerender: true,
      getBrowserless: () => getBrowserContext(t),
      puppeteerOpts: { timeout: 2000, adblock: false }
    })
  ])

  t.is(prerenderDisabled.url, prerenderEnabled.url)
  t.is(prerenderDisabled.html, prerenderEnabled.html)
  t.is(prerenderDisabled.statusCode, prerenderEnabled.statusCode)
  t.deepEqual(prerenderDisabled.headers, prerenderEnabled.headers)
})

test('unreachable URL', async t => {
  const url = 'https://notexisturl.dev'

  const [prerenderDisabled, prerenderEnabled] = await Promise.all([
    getHTML(url, {
      prerender: false,
      getBrowserless: () => getBrowserContext(t)
    }),
    getHTML(url, {
      prerender: true,
      getBrowserless: () => getBrowserContext(t),
      puppeteerOpts: { adblock: false }
    })
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
    getBrowserless: () => getBrowserContext(t),
    prerender: false
  })

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})

test('from image URL', async t => {
  const targetUrl = 'https://kikobeats.com/images/avatar.jpg'
  const { url, stats, html } = await getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t)
  })

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)

  const $ = cheerio.load(html)
  $('meta[name="date"]').remove()

  t.snapshot(prettyHtml($.html()))
})

test('from SVG image URL', async t => {
  const targetUrl = 'https://cdn.microlink.io/file-examples/sample.svg'
  const { stats } = await getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t)
  })
  t.true(stats.timing < 3000)
  t.is(stats.mode, 'fetch')
})

test('from big image URL', async t => {
  const targetUrl =
    'https://static.jutarnji.hr/images/live-multimedia/binary/2016/6/17/10/iStock_82744687_XXLARGE.jpg'
  const { stats } = await getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t)
  })
  t.true(stats.timing < 3000)
  t.is(stats.mode, 'fetch')
})

test('from URL with no content type', async t => {
  const targetUrl = await runServer(t, (_, res) => {
    res.end('<!doctype html><title>.</title>')
  })
  const { stats } = await getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t),
    prerender: false
  })
  t.is(stats.mode, 'fetch')
})

test('from image URL that returns HTML markup', async t => {
  const targetUrl =
    'https://www.europapress.es/chance/gente/%7B%7BrutaFoto%7D%7D%7B%7Bfechor%7D%7D_%7B%7BanchoFoto%7D%7D_%7B%7BaltoFoto%7D%7D%7B%7BversionFoto%7D%7D.jpg'
  const { stats } = await getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t)
  })
  t.true(stats.timing < 3000)
  t.is(stats.mode, 'fetch')
})

test('from video URL', async t => {
  const targetUrl = 'https://cdn.microlink.io/file-examples/sample.mp4'
  const { url, stats, html } = await getHTML(targetUrl, {
    prerender: false,
    getBrowserless: () => getBrowserContext(t)
  })

  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})

test('from bad SSL URL', async t => {
  const targetUrl = 'https://self-signed.badssl.com/'
  const { url, stats, html } = await getHTML(targetUrl, {
    prerender: false,
    getBrowserless: () => getBrowserContext(t),
    gotOpts: {
      https: { rejectUnauthorized: false }
    }
  })

  t.true(html.includes('background: red'))
  t.is(stats.mode, 'fetch')
  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
})
