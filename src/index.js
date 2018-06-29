'use strict'

const parseDomain = require('parse-domain')
const browserless = require('browserless')
const htmlEncode = require('html-encode')
const timeSpan = require('time-span')
const got = require('got')

const autoDomains = require('./auto-domains')

const PUPPETEER_CONFIG = {
  ignoreHTTPSErrors: true,
  args: [
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-offer-upload-credit-cards',
    '--disable-setuid-sandbox',
    '--enable-async-dns',
    '--enable-simple-cache-backend',
    '--enable-tcp-fast-open',
    '--media-cache-size=33554432',
    '--no-default-browser-check',
    '--no-pings',
    '--no-sandbox',
    '--no-zygote',
    '--prerender-from-omnibox=disabled',
    '--single-process'
  ]
}

const createBrowserless = () => browserless(PUPPETEER_CONFIG)

const fetch = async (url, { toEncode, ...opts }) => {
  const res = await got(url, { encoding: null, ...opts })
  return toEncode(res.body, res.headers['content-type'])
}

const prerender = async (
  url,
  { getBrowserless = createBrowserless, gotOptions, toEncode, ...opts }
) => {
  const fetchData = fetch(url, { toEncode, ...gotOptions })
  let html

  try {
    html = await browserless.getHTML(url, opts)
    fetchData.cancel()
  } catch (err) {
    html = await fetchData
  }

  return html
}

const FETCH_MODE = { fetch, prerender }

const getFetchMode = (url, { prerender }) => {
  if (prerender === false) return 'fetch'
  if (prerender !== 'auto') return 'prerender'
  return autoDomains.includes(parseDomain(url).domain) ? 'fetch' : 'prerender'
}

module.exports = async (
  url,
  {
    browserless,
    encoding = 'utf-8',
    fetchMode = getFetchMode,
    gotOptions,
    prerender = 'auto',
    puppeteerOpts
  } = {}
) => {
  const toEncode = htmlEncode(encoding)
  const mode = fetchMode(url, { prerender })
  const opts =
    mode === 'fetch'
      ? { toEncode, ...gotOptions }
      : { toEncode, browserless, gotOptions, ...puppeteerOpts }
  const time = timeSpan()
  const html = await FETCH_MODE[mode](url, opts)
  return { html, stats: { mode, timing: time() } }
}

module.exports.createBrowserless = createBrowserless
