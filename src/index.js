'use strict'

const { isMediaUrl } = require('@metascraper/helpers')
const { getDomainWithoutSuffix } = require('tldts')
const debug = require('debug-logfmt')('html-get')
const { AbortError } = require('p-retry')

const requireOneOf = require('require-one-of')
const PCancelable = require('p-cancelable')
const htmlEncode = require('html-encode')
const timeSpan = require('time-span')
const got = require('got')

const autoDomains = require('./auto-domains')
const addHtml = require('./html')

const REQ_TIMEOUT = 8000

const fetch = (
  url,
  { reflect = false, toEncode, timeout = REQ_TIMEOUT, ...opts }
) =>
  new PCancelable(async (resolve, reject, onCancel) => {
    const req = got(url, {
      responseType: 'buffer',
      timeout: reflect ? timeout / 2 : timeout,
      ...opts
    })

    onCancel.shouldReject = false

    onCancel(() => {
      debug('fetch:cancel', { url, reflect })
      req.cancel()
    })

    try {
      const res = await req
      return resolve({
        headers: res.headers,
        html: await toEncode(res.body, res.headers['content-type']),
        mode: 'fetch',
        url: res.url,
        statusCode: res.statusCode
      })
    } catch (error) {
      debug('fetch:error', { url, message: error.message || error, reflect })
      return reflect
        ? resolve({ isRejected: true, error })
        : resolve({
          url,
          html: '',
          mode: 'fetch',
          headers: error.response ? error.response.headers : {},
          statusCode: error.response ? error.response.statusCode : undefined
        })
    }
  })

const prerender = async (
  url,
  { getBrowserless, toEncode, headers, gotOpts, timeout = REQ_TIMEOUT, ...opts }
) => {
  let fetchRes
  let data = {}
  let isFetchResRejected = false

  try {
    fetchRes = fetch(url, {
      reflect: true,
      toEncode,
      headers,
      ...gotOpts,
      timeout
    })
    const browserless = await getBrowserless()

    const getPayload = browserless.evaluate(
      async (page, response) => {
        if (!response) throw new AbortError('empty response')

        return {
          headers: response.headers(),
          html: await page.content(),
          mode: 'prerender',
          url: response.url(),
          statusCode: response.status()
        }
      },
      { timeout, headers }
    )

    const payload = await getPayload(url, opts)

    await fetchRes.cancel()
    debug('prerender', { url, state: 'success' })
    return payload
  } catch (err) {
    const { isRejected, ...dataProps } = await fetchRes

    debug('prerender:error', {
      url,
      isRejected,
      error: err.message
    })

    isFetchResRejected = isRejected
    data = dataProps
  }

  return isFetchResRejected
    ? {
        headers: data.headers || {},
        html: '',
        url,
        mode: 'prerender'
      }
    : data
}

const modes = { fetch, prerender }

const isFetchMode = url => autoDomains.includes(getDomainWithoutSuffix(url))

const determinateMode = (url, { prerender }) => {
  if (prerender === false || isMediaUrl(url)) return 'fetch'
  if (prerender === true) return 'prerender'
  return isFetchMode(url) ? 'fetch' : 'prerender'
}

const getContent = async (
  url,
  mode,
  { getBrowserless, gotOpts, headers, puppeteerOpts, rewriteUrls, toEncode }
) => {
  const isFetchMode = mode === 'fetch'
  const fetchOpts = isFetchMode
    ? { headers, toEncode, ...gotOpts }
    : { headers, toEncode, getBrowserless, gotOpts, ...puppeteerOpts }
  const content = await modes[mode](url, fetchOpts)
  const html = addHtml({
    ...content,
    ...(isFetchMode ? puppeteerOpts : undefined),
    rewriteUrls
  })
  return { ...content, html }
}

module.exports = async (
  targetUrl,
  {
    encoding = 'utf-8',
    getBrowserless = requireOneOf(['@browserless/pool', 'browserless']),
    getMode = determinateMode,
    gotOpts,
    headers,
    prerender = 'auto',
    puppeteerOpts,
    rewriteUrls = false
  } = {}
) => {
  const toEncode = htmlEncode(encoding)
  const reqMode = getMode(targetUrl, { prerender })

  const time = timeSpan()

  const { mode, ...payload } = await getContent(targetUrl, reqMode, {
    getBrowserless,
    gotOpts,
    headers,
    puppeteerOpts,
    rewriteUrls,
    toEncode
  })

  return { ...payload, stats: { mode, timing: time.rounded() } }
}

module.exports.REQ_TIMEOUT = REQ_TIMEOUT
