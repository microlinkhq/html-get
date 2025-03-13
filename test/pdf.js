'use strict'

const cheerio = require('cheerio')
const test = require('ava')

const { initBrowserless, prettyHtml } = require('./helpers')
const getHTML = require('..')

const getBrowserless = initBrowserless(test)

const PDF_OVER_TRESHOLD = 'https://cdn.microlink.io/file-examples/sample.pdf'
const PDF_UNDER_TRESHOLD = 'https://pdfobject.com/pdf/sample.pdf'

test('disable if `mutool` is not installed', async t => {
  const targetUrl = 'https://cdn.microlink.io/file-examples/sample.pdf'
  const { url, stats, html } = await getHTML(targetUrl, {
    mutool: false,
    getBrowserless
  })

  const $ = cheerio.load(html)
  $('meta[name="date"]').remove()

  t.is(url, targetUrl)
  t.snapshot(prettyHtml($.html()))
  t.is(stats.mode, 'fetch')
})

test('turn PDF into HTML markup over the treshold', async t => {
  const targetUrl = PDF_OVER_TRESHOLD
  const { url, stats, html } = await getHTML(targetUrl, {
    getBrowserless
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
    getBrowserless
  })
  const $ = cheerio.load(html)
  t.is(url, targetUrl)
  t.is($('p').eq(1).text(), 'This is a simple PDF file. Fun fun fun.')
  t.is(stats.mode, 'fetch')
})
