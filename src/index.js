'use strict'

const createBrowserless = require('browserless')
const parseDomain = require('parse-domain')
const PCancelable = require('p-cancelable')
const htmlEncode = require('html-encode')
const timeSpan = require('time-span')
const pTimeout = require('p-timeout')
const got = require('got')

const autoDomains = require('./auto-domains')

// TODO: This is a hard timeout to ensure prerender mode
// doesn't take too much time an reach the global timeout.
// Currently puppeteer is not handling a global timeout,
// need to wait until 2.0 to setup `.defaultTimeout`
// https://github.com/GoogleChrome/puppeteer/issues/2079

const PRERENDER_TIMEOUT = 5000

const fetch = (url, { toEncode, ...opts }) =>
  new PCancelable((resolve, reject, onCancel) => {
    const req = got(url, { encoding: null, ...opts })
    onCancel(() => req.cancel())
    req.catch(reject)
    req.then(async res =>
      resolve({
        html: await toEncode(res.body, res.headers['content-type']),
        mode: 'fetch'
      })
    )
  })

const prerender = async (
  url,
  { getBrowserless, gotOptions, toEncode, ...opts }
) => {
  const fetchData = fetch(url, { toEncode, ...gotOptions })

  try {
    const browserless = await getBrowserless()
    const html = await pTimeout(browserless.html(url, opts), PRERENDER_TIMEOUT)
    const res = { html: html, mode: 'prerender' }
    fetchData.cancel()
    return res
  } catch (err) {
    return fetchData
  }
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
    getBrowserless = createBrowserless,
    encoding = 'utf-8',
    fetchMode = getFetchMode,
    gotOptions,
    prerender = 'auto',
    puppeteerOpts
  } = {}
) => {
  const toEncode = htmlEncode(encoding)
  const targetFetchMode = fetchMode(url, { prerender })
  const opts =
    targetFetchMode === 'fetch'
      ? { toEncode, ...gotOptions }
      : { toEncode, getBrowserless, gotOptions, ...puppeteerOpts }

  const time = timeSpan()
  const { html, mode } = await FETCH_MODE[targetFetchMode](url, opts)
  return { html, stats: { mode, timing: time() } }
}

module.exports.createBrowserless = createBrowserless
