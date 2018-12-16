'use strict'

const { isMime } = require('@metascraper/helpers')
const createBrowserless = require('browserless')
const reachableUrl = require('reachable-url')
const parseDomain = require('parse-domain')
const PCancelable = require('p-cancelable')
const debug = require('debug')('html-get')
const htmlEncode = require('html-encode')
const timeSpan = require('time-span')
const pTimeout = require('p-timeout')
const { URL } = require('url')
const path = require('path')
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
const REQ_TIMEOUT = Number(process.env.REQ_TIMEOUT || 6000)
const REQ_TIMEOUT_REACHABLE = REQ_TIMEOUT * 0.25

// Puppeteer doesn't resolve redirection well.
// We need to ensure we have the right url.
const getUrl = mem(
  async targetUrl => {
    try {
      const res = await reachableUrl(targetUrl, {
        timeout: REQ_TIMEOUT_REACHABLE
      })
      return res
    } catch (err) {
      return { url: targetUrl, headers: {} }
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

const prerender = async (
  url,
  { getBrowserless, gotOptions, toEncode, ...opts }
) => {
  let fetchReq
  let fetchDataProps = {}
  let isFetchRejected = false
  let html = ''

  try {
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

const modes = { fetch, prerender }

const determinateMode = (url, { prerender }) => {
  if (prerender === false) return 'fetch'
  if (prerender !== 'auto') return 'prerender'
  return autoDomains.includes(getDomain(url)) ? 'fetch' : 'prerender'
}

const baseHtml = (url, headers, html = '') => {
  const { hostname } = new URL(url)
  const { date, expires } = headers

  return {
    url,
    mode: 'fetch',
    html: `
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, minimum-scale=0.1">
        <head>
          <meta charset="utf-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
          <title>${path.basename(url)}</title>
          <meta property="og:site_name" content="${hostname}">
          ${
  date
    ? `<meta property="article:published_time" content="${date}">`
    : ''
}
          ${
  expires
    ? `<meta property="article:expiration_time" content="${expires}">`
    : ''
}
          <meta property="og:locale" content="en">
          <meta property="og:url" content="${url}">
          <meta property="og:image" content="${url}">
          ${html}
          <link rel="canonical" href="${url}">
        </head>
      </head>
      <body>
        <img src="${url}">
      </body>
    </html>`.trim()
  }
}

const getImageHtml = (url, headers) =>
  baseHtml(url, headers, `<meta property="og:image" content="${url}">`)

const getVideoHtml = (url, headers) => {
  const { protocol } = new URL(url)
  const isHttps = protocol === 'https:'
  const videoProperty = `og:video${isHttps ? ':secure_url' : ''}`
  return baseHtml(
    url,
    headers,
    `<meta property="${videoProperty}" content="${url}">`
  )
}

const getAudioHtml = (url, headers) => {
  const { protocol } = new URL(url)
  const isHttps = protocol === 'https:'
  const audioProperty = `og:audio${isHttps ? ':secure_url' : ''}`
  return baseHtml(
    url,
    headers,
    `<meta property="${audioProperty}" content="${url}">`
  )
}

const getContent = async (encodedUrl, mode, opts) => {
  const { url, headers } = await getUrl(encodedUrl)
  debug(`getUrl ${encodedUrl === url ? url : `${encodedUrl} → ${url}`}`)
  const contentType = headers['content-type']
  if (isMime(contentType, 'image')) return getImageHtml(url, headers)
  if (isMime(contentType, 'video')) return getVideoHtml(url, headers)
  if (isMime(contentType, 'audio')) return getAudioHtml(url, headers)
  return modes[mode](url, opts)
}

module.exports = async (
  targetUrl,
  {
    getBrowserless = createBrowserless,
    encoding = 'utf-8',
    getMode = determinateMode,
    gotOptions,
    prerender = 'auto',
    puppeteerOpts
  } = {}
) => {
  const { href: encodedUrl } = new URL(targetUrl)
  const toEncode = htmlEncode(encoding)
  const reqMode = getMode(encodedUrl, { prerender })

  const opts =
    reqMode === 'fetch'
      ? { toEncode, ...gotOptions }
      : { toEncode, getBrowserless, gotOptions, ...puppeteerOpts }

  const time = timeSpan()
  const { url, html, mode } = await getContent(encodedUrl, reqMode, opts)
  return { url, html, stats: { mode, timing: time() } }
}

module.exports.createBrowserless = createBrowserless
