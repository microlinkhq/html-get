'use strict'

const cheerio = require('cheerio')
const { getBrowserContext, prettyHtml, runServer, test } = require('./helpers')
const getHTML = require('..')

const PDF_OVER_TRESHOLD = 'https://cdn.microlink.io/file-examples/sample.pdf'
const PDF_UNDER_TRESHOLD = 'https://pdfobject.com/pdf/sample.pdf'

test('disable if `mutool` is not installed', async t => {
  const targetUrl = 'https://cdn.microlink.io/file-examples/sample.pdf'
  const { url, stats, html } = await getHTML(targetUrl, {
    mutool: false,
    getBrowserless: () => getBrowserContext(t)
  })

  t.is(url, targetUrl)
  t.snapshot(prettyHtml(html))
  t.is(stats.mode, 'fetch')
})

test('falls back when mutool throws after a successful fetch', async t => {
  const pdf = Buffer.from('%PDF-1.4 mutool-fallback-fixture')
  const base = await runServer(t, (_, res) => {
    res.setHeader('content-type', 'application/pdf')
    res.setHeader('content-length', String(pdf.length))
    res.end(pdf)
  })

  const targetUrl = String(base)
  const { stats, headers, statusCode } = await getHTML(targetUrl, {
    prerender: false,
    mutool: async () => {
      throw new Error('mutool failed')
    }
  })

  t.is(stats.mode, 'fetch')
  t.is(statusCode, 200)
  t.is(headers['content-type'], 'application/pdf')
})

test('turn PDF into HTML markup over the treshold', async t => {
  const targetUrl = PDF_OVER_TRESHOLD
  const { url, stats, html } = await getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t)
  })

  const $ = cheerio.load(html)
  t.is(url, targetUrl)
  t.is(
    $('p').first().text(),
    'Instructions for Adding Your Logo & Address to AAO-HNSF Patient Handouts'
  )
  t.is(stats.mode, 'fetch')
})

test('turn PDF into HTML markup under the treshold', async t => {
  const targetUrl = PDF_UNDER_TRESHOLD
  const { url, stats, html } = await getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t)
  })
  const $ = cheerio.load(html)
  t.is(url, targetUrl)
  t.is($('p').eq(1).text(), 'This is a simple PDF file. Fun fun fun.')
  t.is(stats.mode, 'fetch')
})
