'use strict'

const { getDomain, getPublicSuffix } = require('tldts')
const { isMediaUrl } = require('@metascraper/helpers')
const requireOneOf = require('require-one-of')
const reachableUrl = require('reachable-url')
const PCancelable = require('p-cancelable')
const debug = require('debug')('html-get')
const htmlEncode = require('html-encode')
const timeSpan = require('time-span')

const { URL } = require('url')
const got = require('got')
const mem = require('mem')
const he = require('he')

const autoDomains = require('./auto-domains')
const addHtml = require('./html')

const ONE_MIN_MS = 60 * 1000
const ONE_HOUR_MS = ONE_MIN_MS * 60
const ONE_DAY_MS = ONE_HOUR_MS * 24

// TODO: This is a soft timeout to ensure prerender mode
// doesn't take too much time an reach the global timeout.
// Currently puppeteer is not handling a global timeout,
// need to wait until 2.0 to setup `.defaultTimeout`
// https://github.com/GoogleChrome/puppeteer/issues/2079
const REQ_TIMEOUT = Number(process.env.REQ_TIMEOUT || 6000)
const REQ_TIMEOUT_REACHABLE = REQ_TIMEOUT * 0.25

// Puppeteer doesn't resolve redirection well.
// We need to ensure we have the right url.
const getUrl = mem(
  async (targetUrl, opts) => {
    try {
      const res = await reachableUrl(targetUrl, {
        timeout: REQ_TIMEOUT_REACHABLE,
        ...opts
      })
      return res
    } catch (err) {
      return { url: targetUrl, headers: {} }
    }
  },
  { maxAge: ONE_DAY_MS }
)

const getHtml = html => he.decode(html)

const fetch = (url, { toEncode, reflect = false, ...opts }) =>
  new PCancelable(async (resolve, reject, onCancel) => {
    const req = got(url, {
      encoding: null,
      retry: 0,
      timeout: reflect ? REQ_TIMEOUT / 2 : REQ_TIMEOUT,
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
      debug('fetch:error', err)
      debug('fetch:reflect', reflect)
      if (reflect) return resolve({ isRejected: true, err })
      else resolve({ url, html: '', mode: 'fetch' })
    }
  })

const prerender = async (url, { getBrowserless, gotOptions, toEncode, ...opts }) => {
  let fetchReq
  let fetchDataProps = {}
  let isFetchRejected = false
  let html = ''

  try {
    fetchReq = fetch(url, { reflect: true, toEncode, ...gotOptions })
    const browserless = await getBrowserless()
    html = await browserless.html(url, { timeout: REQ_TIMEOUT, ...opts })
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

const modes = { fetch, prerender }

const isFetchMode = mem(url => {
  const suffix = getPublicSuffix(url)
  const domain = getDomain(url)
  return autoDomains.includes(suffix ? domain.replace(`.${suffix}`, '') : domain)
})

const determinateMode = (url, { prerender }) => {
  if (prerender === false) return 'fetch'
  if (prerender !== 'auto') return 'prerender'
  if (isMediaUrl(url)) return 'fetch'
  return isFetchMode(url) ? 'fetch' : 'prerender'
}

const getContent = async (encodedUrl, mode, opts) => {
  const { url, headers } = await getUrl(encodedUrl, opts)
  debug(`getUrl ${encodedUrl === url ? url : `${encodedUrl} → ${url}`}`)
  const content = await modes[mode](url, opts)

  return {
    ...content,
    html: addHtml({ ...content, headers })
  }
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
