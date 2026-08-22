'use strict'

const { extractPdfSafe, isPdf, isPdfLink, pdfToHtml } = require('../..')
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
