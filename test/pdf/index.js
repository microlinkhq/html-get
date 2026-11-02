'use strict'

const { inflateSync } = require('node:zlib')

const { extractPdf, extractPdfSafe, isPdf, isPdfLink, pdfToHtml } = require('../..')
const { runServer, test } = require('../helpers')
const { createPdf } = require('./helpers')
const { scrapePdf } = require('./scrape')

const PAPER = createPdf(
  [
    { text: 'Attention Is All You Need', size: 18 },
    { text: 'Ashish Vaswani  Noam Shazeer  Niki Parmar', size: 11 },
    { text: 'Google Brain', size: 11 },
    { text: 'avaswani@google.com', size: 9 },
    { text: 'Abstract', size: 11 },
    {
      text: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
      size: 9
    },
    {
      text: 'We propose the Transformer, based solely on attention mechanisms.',
      size: 9
    }
  ],
  { info: { Title: '', Author: '', Creator: 'LaTeX with hyperref' } }
)

const WORKING_PAPER = createPdf(
  [
    { text: 'NBER WORKING PAPER SERIES', size: 12 },
    { text: 'GENERATIVE AI AT WORK', size: 12 },
    { text: 'Erik Brynjolfsson', size: 12 },
    { text: 'Danielle Li', size: 12 },
    { text: 'Working Paper 31161', size: 12 },
    { text: 'Abstract', size: 10 },
    {
      text: 'We study the staggered introduction of a generative AI assistant among customer support agents.',
      size: 10
    }
  ],
  { info: { Title: 'printmgr file' } }
)

const JOURNAL = createPdf([
  { text: 'Frontiers in Psychology | Volume 10 | Article 1', size: 7 },
  {
    text: 'Institutional Violence Against Users of the Family Law Courts',
    size: 16
  },
  { text: 'Miguel Clemente, Dolores Padilla-Racero', size: 10 },
  { text: 'Abstract', size: 10 },
  {
    text: 'This work analyses the psychological consequences of institutional violence in family law courts.',
    size: 9
  }
])

const JOURNAL_URL = 'https://journals.plos.org/plosone/article/file?id=10.1371/x&type=printable'
const FIGURE_SIDE = 32
const FIGURE_COLOR = [200, 30, 60]
const PNG_COLOR_TYPE_RGBA = 6

const decodePng = dataUri => {
  const png = Buffer.from(dataUri.replace('data:image/png;base64,', ''), 'base64')
  const idatLength = png.readUInt32BE(33)
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png[25],
    scanlines: inflateSync(png.subarray(41, 41 + idatLength))
  }
}

const PNG_FILTER_NONE = 0
const OPAQUE = 255

const solidScanlines = (side, color) => {
  const row = [PNG_FILTER_NONE]
  for (let column = 0; column < side; column++) row.push(...color, OPAQUE)
  return Buffer.from(Array.from({ length: side }, () => row).flat())
}

const paperWith = image =>
  createPdf([{ text: 'Figures of a paper', size: 14 }], {
    images: [{ width: FIGURE_SIDE, height: FIGURE_SIDE, ...image }]
  })

test('a picture painted on the first page is the image and the logo, as RGBA', async t => {
  const { image, logo } = await extractPdf({
    url: JOURNAL_URL,
    pdf: paperWith({ color: FIGURE_COLOR })
  })

  t.is(logo, image)
  t.deepEqual(decodePng(image), {
    width: FIGURE_SIDE,
    height: FIGURE_SIDE,
    colorType: PNG_COLOR_TYPE_RGBA,
    scanlines: solidScanlines(FIGURE_SIDE, FIGURE_COLOR)
  })
})

test('an image mask is neither the image nor the logo', async t => {
  const { image, logo } = await extractPdf({ url: JOURNAL_URL, pdf: paperWith({ mask: true }) })

  t.is(image, null)
  t.is(
    logo,
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(JOURNAL_URL)}&sz=128`
  )
})

test('isPdfLink only accepts a PDF url', t => {
  t.true(isPdfLink('https://arxiv.org/pdf/1706.03762v7'))
  t.true(isPdfLink('https://example.com/paper.pdf'))
  t.true(isPdfLink('https://journals.plos.org/plosone/article/file?id=10.1371/x&type=printable'))
  t.true(isPdfLink('https://www.frontiersin.org/articles/10.3389/fpsyg.2019.00001/pdf'))
  t.false(isPdfLink('https://arxiv.org/abs/1706.03762'))
  t.false(isPdfLink('https://example.com'))
  t.false(isPdfLink())
})

test('reads the metadata of a paper', async t => {
  const metadata = await scrapePdf(PAPER, 'https://arxiv.org/pdf/1706.03762v7')

  t.is(metadata.title, 'Attention Is All You Need')
  t.is(metadata.author, 'Ashish Vaswani')
  t.is(metadata.publisher, 'arXiv')
  t.is(metadata.date, '2017-06-01T00:00:00.000Z')
  t.is(metadata.lang, 'en')
  t.is(
    metadata.logo,
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(
      'https://arxiv.org/pdf/1706.03762v7'
    )}&sz=128`
  )
  t.true(metadata.description.startsWith('The dominant sequence transduction models'))
})

test('reads a PDF with leading junk or an ArrayBuffer', async t => {
  const url = 'https://arxiv.org/pdf/1706.03762v7'
  const junk = Buffer.concat([Buffer.from('\0\0'), PAPER])
  t.is((await scrapePdf(junk, url)).title, 'Attention Is All You Need')

  const copy = Uint8Array.from(PAPER)
  t.is((await scrapePdf(copy.buffer, url)).title, 'Attention Is All You Need')
})

test('skips the banner a working paper prints above its title', async t => {
  const metadata = await scrapePdf(
    WORKING_PAPER,
    'https://www.nber.org/system/files/working_papers/w31161/w31161.pdf'
  )

  t.is(metadata.title, 'GENERATIVE AI AT WORK')
  t.is(metadata.author, 'Erik Brynjolfsson')
  t.is(metadata.publisher, 'NBER')
  t.is(metadata.lang, 'en')
})

test('reads the journal out of the running header', async t => {
  const metadata = await scrapePdf(
    JOURNAL,
    'https://www.frontiersin.org/articles/10.3389/fpsyg.2019.00001/pdf'
  )

  t.is(metadata.publisher, 'Frontiers in Psychology')
  t.is(metadata.author, 'Miguel Clemente')
  t.is(metadata.title, 'Institutional Violence Against Users of the Family Law Courts')
})

test('stamped tags scrape after a PDF fetch', async t => {
  const origin = await runServer(t, (_, res) => {
    res.setHeader('content-type', 'application/pdf')
    res.end(PAPER)
  })
  const getHTML = require('../..')
  const { html } = await getHTML(new URL('paper.pdf', origin).href, {
    prerender: false,
    mutool: false
  })
  const metadata = await require('./scrape').metascraper({
    url: 'https://arxiv.org/pdf/1706.03762v7',
    html
  })
  t.is(metadata.title, 'Attention Is All You Need')
  t.is(metadata.author, 'Ashish Vaswani')
})

test('mutool HTML is not a PDF', t => {
  const html = '<!DOCTYPE html><html><body><p>Attention Is All You Need</p></body></html>'
  t.false(isPdf(Buffer.from(html)))
})

test('extract skips bytes that are not a PDF', async t => {
  const html = '<!DOCTYPE html><html><body><p>Attention Is All You Need</p></body></html>'
  t.is(await extractPdfSafe(Buffer.from(html), 'https://arxiv.org/pdf/1706.03762v7'), undefined)
})

test('pdfToHtml is empty markup when the bytes are not a PDF', async t => {
  const html = await pdfToHtml(Buffer.from('<html></html>'), 'https://example.com/paper.pdf')
  t.true(html.includes('<title>paper.pdf</title>'))
  t.false(html.includes('og:title'))
})
