'use strict'

const { existsSync, readFileSync } = require('fs')
const { readFile } = require('fs/promises')
const { resolve } = require('path')
const test = require('ava').default

const { scrapePdf } = require('./scrape')

const FIXTURES = resolve(__dirname, 'fixtures')
const skipReason = existsSync(resolve(FIXTURES, '1.pdf'))
  ? null
  : 'PDF fixtures missing; run test/pdf/fixtures/download.sh'

const urls = existsSync(resolve(FIXTURES, 'urls.txt'))
  ? readFileSync(resolve(FIXTURES, 'urls.txt'), 'utf8').trim().split('\n')
  : []

const summarize = metadata => {
  const compact = value =>
    typeof value === 'string' && value.startsWith('data:')
      ? `${value.slice(0, 21)}…${value.length}`
      : value
  return {
    ...metadata,
    image: compact(metadata.image),
    logo: compact(metadata.logo)
  }
}

const run = skipReason ? test.skip : test

for (const url of urls) {
  run(url, async t => {
    const index = urls.indexOf(url)
    const pdf = await readFile(resolve(FIXTURES, `${index + 1}.pdf`))
    t.snapshot(summarize(await scrapePdf(pdf, url)))
  })
}
