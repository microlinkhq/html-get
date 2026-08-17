'use strict'

const { getBrowserContext, runServer, test } = require('./helpers')

const getHTML = require('../src')

test('`{ prerender: true }`', async t => {
  const url = 'https://example.com'
  const { stats } = await getHTML(url, {
    getBrowserless: () => getBrowserContext(t)
  })
  t.is(stats.mode, 'prerender')
})

test('`{ prerender: false }`', async t => {
  const url = 'https://example.com'
  const { stats } = await getHTML(url, {
    prerender: false,
    getBrowserless: () => getBrowserContext(t)
  })
  t.is(stats.mode, 'fetch')
})

test("`{ prerender: 'auto' }`", async t => {
  const url = 'https://google.com'
  const { stats } = await getHTML(url, {
    getBrowserless: () => getBrowserContext(t),
    puppeteerOpts: { adblock: false }
  })
  t.is(stats.mode, 'fetch')
})

test('prerender 4xx falls back to a successful fetch', async t => {
  const url = await runServer(t, (_, res) => {
    res.setHeader('content-type', 'text/html')
    res.end('<!doctype html><title>About Us</title>')
  })

  const blockedBrowserless = () => ({
    evaluate: () => async () => ({
      headers: { 'content-type': 'text/html' },
      html: '<html><title>ERROR: The request could not be satisfied</title></html>',
      mode: 'prerender',
      url: String(url),
      statusCode: 403,
      redirects: []
    })
  })

  const { stats, html, statusCode } = await getHTML(String(url), {
    prerender: true,
    getBrowserless: blockedBrowserless
  })

  t.is(stats.mode, 'fetch')
  t.is(statusCode, 200)
  t.true(html.includes('About Us'))
})

test('prerender 4xx is kept when fetch is also unsuccessful', async t => {
  const url = await runServer(t, (_, res) => {
    res.statusCode = 403
    res.setHeader('content-type', 'text/html')
    res.end('<!doctype html><title>blocked</title>')
  })

  const blockedBrowserless = () => ({
    evaluate: () => async () => ({
      headers: { 'content-type': 'text/html' },
      html: '<html><title>ERROR: The request could not be satisfied</title></html>',
      mode: 'prerender',
      url: String(url),
      statusCode: 403,
      redirects: []
    })
  })

  const { stats, html, statusCode } = await getHTML(String(url), {
    prerender: true,
    getBrowserless: blockedBrowserless
  })

  t.is(stats.mode, 'prerender')
  t.is(statusCode, 403)
  t.true(html.includes('The request could not be satisfied'))
})

test.skip('prerender error fallback into fetch mode', async t => {
  const url =
    'https://www.sportsnet.ca/hockey/nhl/leafs-john-tavares-return-new-york-hope-positive/'
  const { stats, html } = await getHTML(url, {
    prerender: true,
    getBrowserless: () => getBrowserContext(t),
    puppeteerOpts: { adblock: false }
  })
  t.true(!!html)
  t.is(stats.mode, 'fetch')
})
