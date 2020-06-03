'use strict'

const test = require('ava')

const getHTML = require('../src')

test('`{ prerender: true }`', async t => {
  const url = 'https://example.com'
  const { stats } = await getHTML(url)
  t.is(stats.mode, 'prerender')
})

test('`{ prerender: false }`', async t => {
  const url = 'https://example.com'
  const { stats } = await getHTML(url, { prerender: false })
  t.is(stats.mode, 'fetch')
})

test("`{ prerender: 'auto' }`", async t => {
  const url = 'https://facebook.com'
  const { stats } = await getHTML(url, {
    puppeteerOpts: { adblock: false }
  })
  t.is(stats.mode, 'fetch')
})

test.skip('prerender error fallback into fetch mode', async t => {
  const url =
    'https://www.sportsnet.ca/hockey/nhl/leafs-john-tavares-return-new-york-hope-positive/'
  const { stats, html } = await getHTML(url, {
    prerender: true,
    puppeteerOpts: { adblock: false }
  })
  t.true(!!html)
  t.is(stats.mode, 'fetch')
})
