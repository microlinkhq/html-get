'use strict'

const cheerio = require('cheerio')
const path = require('path')
const fs = require('fs')

const { getBrowserContext, runServer, test } = require('./helpers')
const { getOfficeFormat, isOfficeUrl } = require('../src/office')
const getHTML = require('..')

const CONTENT_TYPE = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  epub: 'application/epub+zip'
}

const officeFixture = name =>
  fs.readFileSync(path.join(__dirname, 'fixtures', 'office', name))

// --- unit: format detection ---

test('getOfficeFormat resolves by content-type', t => {
  t.is(getOfficeFormat({ contentType: CONTENT_TYPE.docx }), 'docx')
  t.is(getOfficeFormat({ contentType: CONTENT_TYPE.xlsx }), 'xlsx')
  t.is(getOfficeFormat({ contentType: CONTENT_TYPE.pptx }), 'pptx')
  t.is(getOfficeFormat({ contentType: 'application/epub+zip' }), 'epub')
  t.is(getOfficeFormat({ contentType: 'text/html' }), undefined)
})

test('getOfficeFormat falls back to the url extension', t => {
  t.is(getOfficeFormat({ url: 'https://x.com/a.docx' }), 'docx')
  t.is(
    getOfficeFormat({
      contentType: 'application/octet-stream',
      url: 'https://x.com/a.xlsx?v=1'
    }),
    'xlsx'
  )
  t.is(getOfficeFormat({ url: 'https://x.com/page' }), undefined)
  t.is(getOfficeFormat({ url: 'https://example.com' }), undefined)
})

test('isOfficeUrl matches only office extensions', t => {
  t.true(isOfficeUrl('https://x.com/a.docx'))
  t.true(isOfficeUrl('https://x.com/a.PPTX'))
  t.true(isOfficeUrl('https://x.com/a.epub#chapter'))
  t.false(isOfficeUrl('https://x.com/a.pdf'))
  t.false(isOfficeUrl('https://example.com/'))
})

test('detection tolerates a URL object as input', t => {
  // getHTML may receive a WHATWG URL instance, not a string
  t.is(getOfficeFormat({ url: new URL('https://x.com/a.docx') }), 'docx')
  t.true(isOfficeUrl(new URL('https://x.com/a.pptx')))
  t.false(isOfficeUrl(new URL('https://x.com/page')))
})

test('legacy and unsupported formats are not detected', t => {
  // OLE binaries (.doc/.xls/.ppt) and ODF spreadsheet/presentation (.ods/.odp)
  // need a headless LibreOffice that Pandoc alone can't provide.
  for (const ext of ['doc', 'xls', 'ppt', 'ods', 'odp']) {
    t.false(isOfficeUrl(`https://x.com/a.${ext}`), ext)
    t.is(getOfficeFormat({ url: `https://x.com/a.${ext}` }), undefined, ext)
  }
})

// --- integration: fetch + convert through the pipeline ---

const serveOffice = (t, file, contentType) =>
  runServer(t, (_, res) => {
    res.setHeader('content-type', contentType)
    res.end(officeFixture(file))
  })

const convert = async (t, { file, contentType, opts } = {}) => {
  const baseUrl = await serveOffice(t, file, contentType)
  // keep the office extension on the path so `getMode` routes to fetch
  const targetUrl = `${baseUrl}${file}`
  return getHTML(targetUrl, {
    getBrowserless: () => getBrowserContext(t),
    ...opts
  })
}

test('docx is converted to HTML', async t => {
  const { html, stats } = await convert(t, {
    file: 'sample.docx',
    contentType: CONTENT_TYPE.docx
  })
  const $ = cheerio.load(html)
  t.is(stats.mode, 'fetch')
  t.true($('h1').first().text().includes('Lorem ipsum'))
})

test('xlsx becomes an HTML table', async t => {
  const { html } = await convert(t, {
    file: 'sample.xlsx',
    contentType: CONTENT_TYPE.xlsx
  })
  const $ = cheerio.load(html)
  t.true($('table').length > 0)
  t.true($.text().includes('Dulce'))
})

test('pptx is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.pptx',
    contentType: CONTENT_TYPE.pptx
  })
  t.true(cheerio.load(html).text().includes('Slide One'))
})

test('odt is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.odt',
    contentType: CONTENT_TYPE.odt
  })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test('rtf is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.rtf',
    contentType: CONTENT_TYPE.rtf
  })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test('epub is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.epub',
    contentType: CONTENT_TYPE.epub
  })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test('detects format by extension when content-type is generic', async t => {
  const { html, stats } = await convert(t, {
    file: 'sample.docx',
    contentType: 'application/octet-stream'
  })
  t.is(stats.mode, 'fetch')
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test('detects format by content-type when the url has no extension', async t => {
  const baseUrl = await serveOffice(t, 'sample.docx', CONTENT_TYPE.docx)
  // no extension on the url: fetch mode is forced, content-type drives detection
  const { html } = await getHTML(baseUrl.toString(), { prerender: false })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test('disable if `pandoc` is not installed', async t => {
  const { html } = await convert(t, {
    file: 'sample.docx',
    contentType: CONTENT_TYPE.docx,
    opts: { pandoc: false }
  })
  // without pandoc the binary bytes are never turned into readable HTML
  t.false(cheerio.load(html).text().includes('Lorem ipsum'))
})
