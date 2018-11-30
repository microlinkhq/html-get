'use strict'

const createBrowserless = require('browserless')
const reachableUrl = require('reachable-url')
const parseDomain = require('parse-domain')
const PCancelable = require('p-cancelable')
const debug = require('debug')('html-get')
const htmlEncode = require('html-encode')
const encodeUrl = require('encodeurl')
const timeSpan = require('time-span')
const pTimeout = require('p-timeout')
const got = require('got')
const mem = require('mem')
const he = require('he')

const autoDomains = require('./auto-domains')

const ONE_MIN_MS = 60 * 1000
const ONE_HOUR_MS = ONE_MIN_MS * 60
const ONE_DAY_MS = ONE_HOUR_MS * 24

// TODO: This is a soft timeout to ensure prerender mode
// doesn't take too much time an reach the global timeout.
// Currently puppeteer is not handling a global timeout,
// need to wait until 2.0 to setup `.defaultTimeout`
// https://github.com/GoogleChrome/puppeteer/issues/2079
const REQ_TIMEOUT = Number(process.env.REQ_TIMEOUT || 5000)
const REQ_TIMEOUT_REACHABLE = REQ_TIMEOUT * 0.25

// Puppeteer doesn't resolve redirection well.
// We need to ensure we have the right url.
const getUrl = mem(
  async targetUrl => {
    try {
      const { url } = await reachableUrl(targetUrl, {
        timeout: REQ_TIMEOUT_REACHABLE
      })
      return url
    } catch (err) {
      return targetUrl
    }
  },
  { maxAge: ONE_DAY_MS }
)

const getDomain = url => (parseDomain(url) || {}).domain

const getHtml = html => he.decode(html)

const fetch = (url, { toEncode, reflect = false, ...opts }) =>
  new PCancelable(async (resolve, reject, onCancel) => {
    const req = got(url, {
      encoding: null,
      timeout: reflect ? REQ_TIMEOUT / 2 : REQ_TIMEOUT,
      ...opts
    })

    onCancel(req.cancel.bind(req))

    try {
      const res = await req
      return resolve({
        url: res.url,
        html: getHtml(await toEncode(res.body, res.headers['content-type'])),
        mode: 'fetch'
      })
    } catch (err) {
      debug('fetch:error', err)
      debug('fetch:reflect', reflect)
      if (reflect) return resolve({ isRejected: true, err })
      else resolve({ url, html: '', mode: 'fetch' })
    }
  })

const prerender = async (
  targetUrl,
  { getBrowserless, gotOptions, toEncode, ...opts }
) => {
  let fetchReq
  let fetchDataProps = {}
  let isFetchRejected = false
  let html = ''
  let url

  try {
    debug(`getUrl:resolving`)
    url = await getUrl(targetUrl)
    debug(`getUrl:resolved ${targetUrl} → ${url}`)
    fetchReq = fetch(url, { reflect: true, toEncode, ...gotOptions })
    const browserless = await getBrowserless()
    html = await pTimeout(browserless.html(url, opts), REQ_TIMEOUT)

    await fetchReq.cancel()
    debug('prerender:success')
    return { url, html: getHtml(html), mode: 'prerender' }
  } catch (err) {
    debug('prerender:error', err)
    const { isRejected, ...dataProps } = await fetchReq
    debug('prerender:error:isRejected?', isRejected)
    isFetchRejected = isRejected
    fetchDataProps = dataProps
  }

  return isFetchRejected ? { url, html, mode: 'prerender' } : fetchDataProps
}

const FETCH_MODE = { fetch, prerender }

const getFetchMode = (url, { prerender }) => {
  if (prerender === false) return 'fetch'
  if (prerender !== 'auto') return 'prerender'
  return autoDomains.includes(getDomain(url)) ? 'fetch' : 'prerender'
}

module.exports = async (
  targetUrl,
  {
    getBrowserless = createBrowserless,
    encoding = 'utf-8',
    fetchMode = getFetchMode,
    gotOptions,
    prerender = 'auto',
    puppeteerOpts
  } = {}
) => {
  const encodedUrl = encodeUrl(targetUrl)
  const toEncode = htmlEncode(encoding)
  const targetFetchMode = fetchMode(encodedUrl, { prerender })
  const opts =
    targetFetchMode === 'fetch'
      ? { toEncode, ...gotOptions }
      : { toEncode, getBrowserless, gotOptions, ...puppeteerOpts }

  const time = timeSpan()
  const { url, html, mode } = await FETCH_MODE[targetFetchMode](
    encodedUrl,
    opts
  )
  return { url, html, stats: { mode, timing: time() } }
}

module.exports.createBrowserless = createBrowserless
