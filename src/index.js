'use strict'

const { parseUrl, isMediaUrl } = require('@metascraper/helpers')
const timeSpan = require('@kikobeats/time-span')()
const debug = require('debug-logfmt')('html-get')
const PCancelable = require('p-cancelable')
const { AbortError } = require('p-retry')
const htmlEncode = require('html-encode')
const got = require('got')

const autoDomains = require('./auto-domains')
const addHtml = require('./html')

const REQ_TIMEOUT = 8000
const ABORT_TYPES = ['image', 'stylesheet', 'font']

const fetch = PCancelable.fn(
  async (
    url,
    { reflect = false, toEncode, timeout = REQ_TIMEOUT, ...opts },
    onCancel
  ) => {
    const reqTimeout = reflect ? timeout / 2 : timeout

    const req = got(url, {
      ...opts,
      timeout: reqTimeout,
      responseType: 'buffer'
    })

    onCancel.shouldReject = false

    onCancel(() => {
      debug('fetch:cancel', { url, reflect })
      req.cancel()
    })

    try {
      const res = await req
      return {
        headers: res.headers,
        html:
          (res.headers['content-type'] ?? '').startsWith('text/html') ||
          !isMediaUrl(url)
            ? await toEncode(res.body, res.headers['content-type'])
            : res.body,
        mode: 'fetch',
        url: res.url,
        statusCode: res.statusCode
      }
    } catch (error) {
      debug('fetch:error', { url, message: error.message || error, reflect })
      return reflect
        ? { isRejected: true, error }
        : {
            url,
            html: '',
            mode: 'fetch',
            headers: error.response ? error.response.headers : {},
            statusCode: error.response ? error.response.statusCode : undefined
          }
    }
  }
)

const prerender = PCancelable.fn(
  async (
    url,
    {
      getBrowserless,
      toEncode,
      headers,
      gotOpts,
      timeout = REQ_TIMEOUT,
      abortTypes = ABORT_TYPES,
      ...opts
    },
    onCancel
  ) => {
    let fetchRes
    let data = {}
    let isFetchResRejected = false

    onCancel(() => fetchRes.cancel())

    try {
      fetchRes = fetch(url, {
        reflect: true,
        toEncode,
        ...gotOpts,
        headers,
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
        {
          timeout,
          headers,
          abortTypes
        }
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
)

const modes = { fetch, prerender }

const isFetchMode = url => {
  const parsedUrl = parseUrl(url)
  return autoDomains.some(conditions =>
    conditions.every(([prop, value]) => parsedUrl[prop] === value)
  )
}

const determinateMode = (url, { prerender }) => {
  if (prerender === false || isMediaUrl(url)) return 'fetch'
  if (prerender === true) return 'prerender'
  return isFetchMode(url) ? 'fetch' : 'prerender'
}

const getContent = PCancelable.fn(
  (
    url,
    mode,
    { getBrowserless, gotOpts, headers, puppeteerOpts, rewriteUrls, toEncode },
    onCancel
  ) => {
    const isFetchMode = mode === 'fetch'
    const fetchOpts = isFetchMode
      ? { headers, toEncode, ...gotOpts }
      : { headers, toEncode, getBrowserless, gotOpts, ...puppeteerOpts }

    const promise = modes[mode](url, fetchOpts)
    onCancel(() => promise.cancel())

    return promise.then(content => {
      const html = addHtml({
        ...content,
        ...(isFetchMode ? puppeteerOpts : undefined),
        rewriteUrls
      })

      return { ...content, html }
    })
  }
)

module.exports = PCancelable.fn(
  async (
    targetUrl,
    {
      encoding = 'utf-8',
      getBrowserless,
      getMode = determinateMode,
      gotOpts,
      headers,
      prerender = 'auto',
      puppeteerOpts,
      rewriteUrls = false
    } = {},
    onCancel
  ) => {
    if (!getBrowserless && prerender !== false) {
      throw TypeError(
        "Need to provide a `getBrowserless` function. Try to pass `getBrowserless: require('browserless')`"
      )
    }

    const toEncode = htmlEncode(encoding)
    const reqMode = getMode(targetUrl, { prerender })

    const duration = timeSpan()

    const promise = getContent(targetUrl, reqMode, {
      getBrowserless,
      gotOpts,
      headers,
      puppeteerOpts,
      rewriteUrls,
      toEncode
    })

    onCancel(() => promise.cancel())

    const { mode, ...payload } = await promise

    return Object.assign(payload, { stats: { mode, timing: duration() } })
  }
)

module.exports.REQ_TIMEOUT = REQ_TIMEOUT
module.exports.ABORT_TYPES = ABORT_TYPES
module.exports.isFetchMode = isFetchMode
module.exports.getContent = getContent
