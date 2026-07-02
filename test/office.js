'use strict'

const cheerio = require('cheerio')
const path = require('path')
const fs = require('fs')
const os = require('os')

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

// intentionally excluded: OLE binaries (.doc/.xls/.ppt) and ODF
// spreadsheet/presentation (.ods/.odp) need a headless LibreOffice that Pandoc
// alone can't provide
const UNSUPPORTED = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation'
}

const officeFixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', 'office', name))

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

test('an explicit web content-type is not overridden by the url extension', t => {
  // HTML/media served at a .docx vanity URL stays a web page, not an office doc
  t.is(getOfficeFormat({ contentType: 'text/html', url: 'https://x.com/a.docx' }), undefined)
  t.is(getOfficeFormat({ contentType: 'image/png', url: 'https://x.com/a.xlsx' }), undefined)
})

test('a mislabeled binary content-type still resolves by extension', t => {
  // a .docx wrongly served as application/pdf is an office doc, not a PDF
  t.is(
    getOfficeFormat({
      contentType: 'application/pdf',
      url: 'https://x.com/a.docx'
    }),
    'docx'
  )
})

test('getOfficeFormat tries each url candidate in order', t => {
  // extension only on the original url survives a redirect to an extensionless target
  t.is(
    getOfficeFormat({
      contentType: 'application/octet-stream',
      url: ['https://cdn.com/download', 'https://x.com/a.docx']
    }),
    'docx'
  )
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
  // excluded both by content-type and by extension
  for (const [ext, contentType] of Object.entries(UNSUPPORTED)) {
    t.false(isOfficeUrl(`https://x.com/a.${ext}`), ext)
    t.is(getOfficeFormat({ url: `https://x.com/a.${ext}` }), undefined, ext)
    t.is(
      getOfficeFormat({ contentType, url: `https://x.com/a.${ext}` }),
      undefined,
      `${ext} via content-type`
    )
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

test.serial('docx is converted to HTML', async t => {
  const { html, stats } = await convert(t, {
    file: 'sample.docx',
    contentType: CONTENT_TYPE.docx
  })
  const $ = cheerio.load(html)
  t.is(stats.mode, 'fetch')
  t.true($('h1').first().text().includes('Lorem ipsum'))
})

test.serial('xlsx becomes an HTML table', async t => {
  const { html } = await convert(t, {
    file: 'sample.xlsx',
    contentType: CONTENT_TYPE.xlsx
  })
  const $ = cheerio.load(html)
  t.true($('table').length > 0)
  t.true($.text().includes('Dulce'))
})

test.serial('pptx is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.pptx',
    contentType: CONTENT_TYPE.pptx
  })
  t.true(cheerio.load(html).text().includes('Slide One'))
})

test.serial('odt is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.odt',
    contentType: CONTENT_TYPE.odt
  })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('rtf is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.rtf',
    contentType: CONTENT_TYPE.rtf
  })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('epub is converted to HTML', async t => {
  const { html } = await convert(t, {
    file: 'sample.epub',
    contentType: CONTENT_TYPE.epub
  })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('detects format by extension when content-type is generic', async t => {
  const { html, stats } = await convert(t, {
    file: 'sample.docx',
    contentType: 'application/octet-stream'
  })
  t.is(stats.mode, 'fetch')
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('extension fallback uses the final url after a redirect', async t => {
  // octet-stream + extension only on the redirected URL: detection must look at
  // res.url, not the original request url
  const base = await runServer(t, (req, res) => {
    if (req.url.endsWith('.docx')) {
      res.setHeader('content-type', 'application/octet-stream')
      return res.end(officeFixture('sample.docx'))
    }
    res.writeHead(302, { location: '/redirected.docx' })
    res.end()
  })

  const { html, stats } = await getHTML(`${base}download`, {
    prerender: false
  })
  t.is(stats.mode, 'fetch')
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('extension fallback survives redirect to an extensionless target', async t => {
  // original url has the .docx extension, redirect target is extensionless
  // octet-stream: detection must fall back to the original request url
  const base = await runServer(t, (req, res) => {
    if (req.url.includes('download')) {
      res.setHeader('content-type', 'application/octet-stream')
      return res.end(officeFixture('sample.docx'))
    }
    res.writeHead(302, { location: '/download' })
    res.end()
  })

  const { html, stats } = await getHTML(`${base}sample.docx`, {
    getBrowserless: () => getBrowserContext(t)
  })
  t.is(stats.mode, 'fetch')
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('office file mislabeled as application/pdf is converted by pandoc', async t => {
  const { html, stats } = await convert(t, {
    file: 'sample.docx',
    contentType: 'application/pdf'
  })
  t.is(stats.mode, 'fetch')
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('detects format by content-type when the url has no extension', async t => {
  const baseUrl = await serveOffice(t, 'sample.docx', CONTENT_TYPE.docx)
  // no extension on the url: fetch mode is forced, content-type drives detection
  const { html } = await getHTML(baseUrl.toString(), { prerender: false })
  t.true(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('falls back when pandoc returns empty output', async t => {
  const { html } = await convert(t, {
    file: 'sample.docx',
    contentType: CONTENT_TYPE.docx,
    opts: {
      pandoc: async () => ''
    }
  })
  t.false(cheerio.load(html).text().includes('Lorem ipsum'))
  t.false(html.includes('name="generator" content="pandoc"'))
  t.true(html.length > 0)
})

test.serial('falls back when pandoc does not support the format', async t => {
  const { html } = await convert(t, {
    file: 'sample.xlsx',
    contentType: CONTENT_TYPE.xlsx,
    opts: {
      pandoc: async format => {
        t.is(format, 'xlsx')
      }
    }
  })
  t.false(html.includes('name="generator" content="pandoc"'))
  t.true(html.length > 0)
})

test.serial('defaultPandoc skips formats the installed pandoc cannot read', async t => {
  // exercises the real `--list-input-formats` probe, which the mock-injection
  // tests above bypass
  const pandoc = getHTML.defaultPandoc()
  if (!pandoc) return t.pass('pandoc not installed in this environment')

  const file = path.join(__dirname, 'fixtures', 'office', 'sample.docx')

  // a supported format is converted
  const html = await pandoc('docx', file)
  t.true(typeof html === 'string' && html.includes('Lorem ipsum'))

  // a format the installed pandoc cannot read (legacy OLE .doc) is skipped,
  // returning undefined instead of empty/garbage output, and never throws
  t.is(await pandoc('doc', file), undefined)
})

test.serial('defaultPandoc probes the binary once', async t => {
  // memoized: repeated calls return the same runner rather than re-spawning
  t.is(getHTML.defaultPandoc(), getHTML.defaultPandoc())
})

for (const [bin, accessor] of [
  ['pandoc', 'getPandocPath'],
  ['mutool', 'getMutoolPath']
]) {
  test.serial(`${accessor} exposes the resolved ${bin} path`, t => {
    let expected
    try {
      expected = require('child_process')
        .execFileSync('which', [bin], { stdio: ['pipe', 'pipe', 'ignore'] })
        .toString()
        .trim()
    } catch (_) {} // binary not installed -> undefined, must match
    t.is(getHTML[accessor](), expected)
  })
}

test.serial('a broken pandoc probe disables conversion instead of throwing', t => {
  // pandoc is on PATH but `--list-input-formats` fails: the probe must swallow
  // it and disable conversion, not throw out of the default-parameter evaluation
  // and break every getHTML call
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pandoc-probe-'))
  fs.writeFileSync(path.join(dir, 'pandoc'), '#!/bin/sh\nexit 1\n', {
    mode: 0o755
  })

  const originalPath = process.env.PATH
  process.env.PATH = dir + path.delimiter + originalPath

  // fresh module so memoizeOne re-probes with the broken pandoc on PATH
  delete require.cache[require.resolve('..')]
  const fresh = require('..')

  try {
    t.is(fresh.defaultPandoc(), undefined)
  } finally {
    process.env.PATH = originalPath
    delete require.cache[require.resolve('..')]
  }
})

test.serial('disable if `pandoc` is not installed', async t => {
  const { html } = await convert(t, {
    file: 'sample.docx',
    contentType: CONTENT_TYPE.docx,
    opts: { pandoc: false }
  })
  // without pandoc the binary bytes are never turned into readable HTML
  t.false(cheerio.load(html).text().includes('Lorem ipsum'))
})

test.serial('unsupported office formats pass through without conversion or crashing', async t => {
  // real demo files for legacy (.doc/.xls/.ppt) and ODF sheet/presentation
  // (.ods/.odp): Pandoc can't read them, so they must be left untouched, not
  // fed to pandoc and not throw
  for (const [ext, contentType] of Object.entries(UNSUPPORTED)) {
    const baseUrl = await serveOffice(t, `sample.${ext}`, contentType)
    const { html, stats } = await getHTML(`${baseUrl}sample.${ext}`, {
      prerender: false
    })
    t.is(stats.mode, 'fetch', ext)
    t.is(typeof html, 'string', ext)
    // pandoc's standalone output carries this marker; its absence proves the
    // file was never converted
    t.false(html.includes('name="generator" content="pandoc"'), ext)
  }
})
