'use strict'

const { deflateSync, crc32 } = require('zlib')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const cheerio = require('cheerio')
const path = require('path')
const fs = require('fs')
const os = require('os')

const { runServer, test } = require('./helpers')
const { MAX_IMAGE_PAGES } = require('../src/pdf/first-image')
const getHTML = require('..')

const mutool = getHTML.defaultMutool()
const withMutool = mutool ? test : test.skip
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-get-pdf-images-'))
const PDF_SIZE_TRESHOLD = 150 * 1024

const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])) >>> 0)
  return Buffer.concat([length, Buffer.from(type), data, crc])
}

const grayPng = (side, pixel) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(side, 0)
  header.writeUInt32BE(side, 4)
  header[8] = 8
  const rows = []
  for (let y = 0; y < side; y++) {
    const row = Buffer.alloc(side + 1)
    for (let x = 0; x < side; x++) row[x + 1] = pixel(x, y)
    rows.push(row)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const textPage = text => `%%Font F1 Helvetica\nBT /F1 18 Tf 72 720 Td (${text}) Tj ET\n`

const imagePage = (name, text) =>
  `%%Font F1 Helvetica\n%%Image Im1 ${name}\nq 300 0 0 300 72 300 cm /Im1 Do Q\n` +
  `BT /F1 12 Tf 72 200 Td (${text}) Tj ET\n`

const createPdf = (name, pages) => {
  const files = pages.map((content, index) => {
    const file = path.join(dir, `${name}-${index + 1}.txt`)
    fs.writeFileSync(file, content)
    return file
  })
  const output = path.join(dir, `${name}.pdf`)
  execFileSync(mutool ? 'mutool' : 'false', ['create', '-o', output, ...files], { cwd: dir })
  return fs.readFileSync(output)
}

const pdfs = {}

test.before(() => {
  if (!mutool) return
  fs.writeFileSync(
    path.join(dir, 'large.png'),
    grayPng(640, () => crypto.randomInt(256))
  )
  fs.writeFileSync(
    path.join(dir, 'small.png'),
    grayPng(100, (x, y) => (x * 7 + y * 3) % 256)
  )
  pdfs.largeImageOnPageTwo = createPdf('large-image', [
    textPage('Cover page'),
    imagePage('large.png', 'Figure page')
  ])
  pdfs.largeImageOnPageOne = createPdf('large-image-one', [imagePage('large.png', 'Figure page')])
  pdfs.described = createPdf('described', [
    '%%Font F1 Helvetica\n' +
      'BT /F1 18 Tf 72 720 Td (Cover page for the paper and the notes of the study.) Tj ET\n' +
      'BT /F1 12 Tf 72 680 Td (Ada Lovelace) Tj ET\n' +
      'BT /F1 11 Tf 72 640 Td (This summary explains the result of the work and why the measurement matters today.) Tj ET\n',
    imagePage('large.png', 'Figure page')
  ])
  pdfs.smallImageOnPageOne = createPdf('small-image', [imagePage('small.png', 'Logo page')])
  pdfs.threeTextPages = createPdf(
    'three-text',
    [1, 2, 3].map(page => textPage(`Page ${page}`))
  )
  pdfs.manyTextPages = createPdf(
    'many-text',
    Array.from({ length: MAX_IMAGE_PAGES + 5 }, (_, index) => textPage(`Page ${index + 1}`))
  )
})

test.after.always(() => fs.rmSync(dir, { recursive: true, force: true }))

const servePdf = async (t, body, name = 'doc.pdf') =>
  `${await runServer(t, (_, res) => {
    res.setHeader('content-type', 'application/pdf')
    res.setHeader('content-length', String(body.length))
    res.end(body)
  })}${name}`

const spyMutool = ({ fail } = {}) => {
  const calls = []
  const runner = (args, opts) => {
    calls.push(args)
    if (fail && fail(args)) return Promise.reject(new Error('mutool failed'))
    return mutool(args, opts)
  }
  const pageCalls = () =>
    calls.filter(args => /\s\d+$/.test(args)).map(args => Number(args.split(' ').pop()))
  return { runner, calls, pageCalls }
}

const serializeHtml = $ => ({ $ })

const ogImage = $ => $('meta[property="og:image"]').attr('content')

withMutool('the html is converted without the images mutool would inline', async t => {
  const url = await servePdf(t, pdfs.largeImageOnPageTwo)
  t.true(pdfs.largeImageOnPageTwo.length > PDF_SIZE_TRESHOLD)
  const spy = spyMutool()
  await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  const conversion = spy.calls.find(args => args.includes(' -o '))
  t.true(conversion.startsWith('-O preserve-images=no -o '))
})

withMutool('a small pdf is converted without images too', async t => {
  const url = await servePdf(t, pdfs.threeTextPages)
  t.true(pdfs.threeTextPages.length < PDF_SIZE_TRESHOLD)
  const spy = spyMutool()
  await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  t.true(spy.calls[0].startsWith('-O preserve-images=no '))
  t.false(spy.calls[0].includes(' -o '))
})

withMutool('a large image on the first page is recovered', async t => {
  const url = await servePdf(t, pdfs.largeImageOnPageOne)
  const spy = spyMutool()
  const { $ } = await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  t.regex(ogImage($), /^data:image\/[a-z]+;base64,[A-Za-z0-9+/]+=*$/)
  t.deepEqual(spy.pageCalls(), [1])
})

withMutool('a large image the pdf reader skips is found on a later page', async t => {
  const url = await servePdf(t, pdfs.largeImageOnPageTwo)
  const spy = spyMutool()
  const { $ } = await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  t.regex(ogImage($), /^data:image\/[a-z]+;base64,[A-Za-z0-9+/]+=*$/)
  t.deepEqual(spy.pageCalls(), [1, 2])
})

withMutool('the recovered image keeps the metadata the reader found', async t => {
  const url = await servePdf(t, pdfs.described, '2020/doc.pdf')
  const { $ } = await getHTML(url, { prerender: false, serializeHtml })
  t.regex(ogImage($), /^data:image\/[a-z]+;base64,/)
  t.is(
    $('meta[property="og:title"]').attr('content'),
    'Cover page for the paper and the notes of the study.'
  )
  t.is($('meta[name="author"]').attr('content'), 'Ada Lovelace')
  t.is($('meta[name="authors"]').attr('content'), 'Ada Lovelace')
  t.is(
    $('meta[name="description"]').attr('content'),
    'This summary explains the result of the work and why the measurement matters today.'
  )
  t.truthy($('meta[property="og:site_name"]').attr('content'))
  t.is($('meta[name="date"]').attr('content'), '2020-01-01T00:00:00.000Z')
  t.is($('html').attr('lang'), 'en')
  t.is($('meta[property="og:locale"]').attr('content'), 'en')
  t.true(
    $('meta[property="og:logo"]')
      .attr('content')
      .startsWith('https://www.google.com/s2/favicons?domain_url=')
  )
})

withMutool('an empty conversion does not search pages for an image', async t => {
  const url = await servePdf(t, pdfs.largeImageOnPageOne)
  const calls = []
  const runner = args => {
    calls.push(args)
    if (/\s\d+$/.test(args)) {
      return Promise.resolve({
        stdout: '<div id="page1"><img src="data:image/png;base64,aaaa"></div>'
      })
    }
    if (args.includes(' -o ')) fs.writeFileSync(args.split(' -o ')[1].split(' ')[0], '')
    return Promise.resolve({ stdout: '' })
  }
  const { $ } = await getHTML(url, { prerender: false, mutool: runner, serializeHtml })
  t.is(ogImage($), undefined)
  t.false(calls.some(args => /\s\d+$/.test(args)))
})

withMutool('the image is the one metadata readers picked from the inlined html', async t => {
  const url = await servePdf(t, pdfs.largeImageOnPageTwo)
  const { $ } = await getHTML(url, { prerender: false, serializeHtml })
  const inlined = cheerio.load((await mutool(path.join(dir, 'large-image.pdf'))).stdout)
  const picked = inlined('img[src]:not([aria-hidden="true"])').attr('src').replace(/\s+/g, '')
  t.is(ogImage($), picked)
})

withMutool('an image the pdf reader finds is kept, and no page is drawn again', async t => {
  const url = await servePdf(t, pdfs.smallImageOnPageOne)
  const spy = spyMutool()
  const { $ } = await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  t.regex(ogImage($), /^data:image\/png;base64,/)
  t.deepEqual(spy.pageCalls(), [])
})

withMutool('the search stops at the last page', async t => {
  const url = await servePdf(t, pdfs.threeTextPages)
  const spy = spyMutool()
  const { $ } = await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  t.is(ogImage($), undefined)
  t.deepEqual(spy.pageCalls(), [1, 2, 3, 4])
})

withMutool(`the search reads at most ${MAX_IMAGE_PAGES} pages`, async t => {
  const url = await servePdf(t, pdfs.manyTextPages)
  const spy = spyMutool()
  const { $ } = await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  t.is(ogImage($), undefined)
  t.deepEqual(
    spy.pageCalls(),
    Array.from({ length: MAX_IMAGE_PAGES }, (_, index) => index + 1)
  )
})

withMutool('a failed page keeps the converted html and adds no image', async t => {
  const url = await servePdf(t, pdfs.largeImageOnPageTwo)
  const spy = spyMutool({ fail: args => args.endsWith(' 1') })
  const { $ } = await getHTML(url, { prerender: false, mutool: spy.runner, serializeHtml })
  t.is(ogImage($), undefined)
  t.true($('body').text().includes('Cover page'))
  t.deepEqual(spy.pageCalls(), [1])
})

withMutool('canceling getHTML stops the page search', async t => {
  const url = await servePdf(t, pdfs.manyTextPages)
  let pages = 0
  const runner = (args, opts) => {
    if (!/\s\d+$/.test(args)) return mutool(args, opts)
    if (++pages === 2) promise.cancel()
    return Promise.resolve({ stdout: `<div id="page${pages}"></div>` })
  }
  const promise = getHTML(url, { prerender: false, mutool: runner })
  promise.catch(() => {})
  await t.throwsAsync(promise)
  await new Promise(resolve => setTimeout(resolve, 100))
  t.is(pages, 2)
})
