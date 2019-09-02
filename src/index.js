'use strict'

const { isMediaUrl } = require('@metascraper/helpers')
const { getDomainWithoutSuffix } = require('tldts')
const debug = require('debug-logfmt')('html-get')
const requireOneOf = require('require-one-of')
const PCancelable = require('p-cancelable')
const htmlEncode = require('html-encode')
const timeSpan = require('time-span')
const got = require('got')
const he = require('he')

const autoDomains = require('./auto-domains')
const pingUrl = require('./ping-url')
const addHtml = require('./html')

const REQ_TIMEOUT = 8000
const REQ_TIMEOUT_REACHABLE = REQ_TIMEOUT * (1 / 3)

const getHtml = html => he.decode(html)

const fetch = (url, { toEncode, reflect = false, headers, ...opts }) =>
  new PCancelable(async (resolve, reject, onCancel) => {
    const req = got(url, {
      encoding: null,
      retry: 0,
      timeout: reflect ? REQ_TIMEOUT / 2 : REQ_TIMEOUT,
      headers,
      ...opts
    })

    onCancel.shouldReject = false
    onCancel(() => req.cancel && req.cancel())

    try {
      const res = await req
      return resolve({
        url: res.url,
        html: getHtml(await toEncode(res.body, res.headers['content-type'])),
        mode: 'fetch'
      })
    } catch (err) {
      debug.error('fetch', { message: err.message || err })
      debug('fetch', { reflect })
      if (reflect) return resolve({ isRejected: true, err })
      else resolve({ url, html: '', mode: 'fetch' })
    }
  })

const prerender = async (
  url,
  { getBrowserless, toEncode, headers, gotOptions, ...opts }
) => {
  let fetchReq
  let fetchDataProps = {}
  let isFetchRejected = false
  let html = ''

  try {
    fetchReq = fetch(url, { reflect: true, toEncode, ...gotOptions })
    const browserless = await getBrowserless()

    html = await browserless.html(url, {
      headers: headers,
      timeout: REQ_TIMEOUT,
      ...opts
    })
    await fetchReq.cancel()
    debug('prerender', { state: 'success' })
    return { url, html: getHtml(html), mode: 'prerender' }
  } catch (err) {
    const { isRejected, ...dataProps } = await fetchReq
    debug.error('prerender', { isRejected, message: err.message || err })
    isFetchRejected = isRejected
    fetchDataProps = dataProps
  }

  return isFetchRejected ? { url, html, mode: 'prerender' } : fetchDataProps
}

const modes = { fetch, prerender }

const isFetchMode = url => autoDomains.includes(getDomainWithoutSuffix(url))

const determinateMode = (url, { prerender }) => {
  if (prerender === false) return 'fetch'
  if (prerender !== 'auto') return 'prerender'
  if (isMediaUrl(url)) return 'fetch'
  return isFetchMode(url) ? 'fetch' : 'prerender'
}
const getContent = async (encodedUrl, mode, opts) => {
  let url = encodedUrl
  let headers = {}

  const { isFulfilled, value: res } = await pingUrl(encodedUrl, {
    ...opts,
    timeout: REQ_TIMEOUT_REACHABLE
  })

  if (isFulfilled) {
    url = res.url
    headers = res.headers
  }

  debug('getUrl', encodedUrl === url ? url : `${encodedUrl} → ${url}`)
  const content = await modes[mode](url, opts)

  return { ...content, html: addHtml({ ...content, headers }) }
}

module.exports = async (
  targetUrl,
  {
    getBrowserless = requireOneOf(['@browserless/pool', 'browserless']),
    encoding = 'utf-8',
    getMode = determinateMode,
    gotOptions,
    prerender = 'auto',
    puppeteerOpts
  } = {}
) => {
  const toEncode = htmlEncode(encoding)
  const reqMode = getMode(targetUrl, { prerender })

  const opts =
    reqMode === 'fetch'
      ? { toEncode, ...gotOptions }
      : { toEncode, getBrowserless, gotOptions, ...puppeteerOpts }
  const time = timeSpan()
  const { url, html, mode } = await getContent(targetUrl, reqMode, opts)
  return { url, html, stats: { mode, timing: time() } }
}

module.exports.pingUrl = pingUrl
module.exports.REQ_TIMEOUT_REACHABLE = REQ_TIMEOUT_REACHABLE
module.exports.REQ_TIMEOUT = REQ_TIMEOUT
