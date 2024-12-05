'use strict'

const { parseUrl, isMediaUrl, isPdfUrl } = require('@metascraper/helpers')
const timeSpan = require('@kikobeats/time-span')()
const debug = require('debug-logfmt')('html-get')
const { execSync } = require('child_process')
const { writeFile } = require('fs/promises')
const PCancelable = require('p-cancelable')
const { AbortError } = require('p-retry')
const htmlEncode = require('html-encode')
const crypto = require('crypto')
const $ = require('tinyspawn')
const path = require('path')
const got = require('got')
const os = require('os')

const autoDomains = require('./auto-domains')
const addHtml = require('./html')

const REQ_TIMEOUT = 8000

const ABORT_TYPES = ['image', 'stylesheet', 'font']

const fetch = PCancelable.fn(
  async (
    url,
    {
      getTemporalFile,
      mutoolPath,
      reflect = false,
      timeout = REQ_TIMEOUT,
      toEncode,
      ...opts
    },
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

    const redirects = []
    req.on('redirect', res =>
      redirects.push({ statusCode: res.statusCode, url: res.url })
    )

    try {
      const res = await req

      const html = await (async () => {
        const contentType = res.headers['content-type'] ?? ''
        if (mutoolPath && contentType === 'application/pdf') {
          const file = getTemporalFile(url, 'pdf')
          await writeFile(file.path, res.body)
          return (await $(`${mutoolPath} draw -q -F html ${file.path}`)).stdout
        }

        return contentType.startsWith('text/html') || !isMediaUrl(url)
          ? await toEncode(res.body, res.headers['content-type'])
          : res.body.toString()
      })()

      return {
        headers: res.headers,
        html,
        mode: 'fetch',
        url: res.url,
        statusCode: res.statusCode,
        redirects
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
            statusCode: error.response ? error.response.statusCode : undefined,
            redirects
          }
    }
  }
)

const prerender = PCancelable.fn(
  async (
    url,
    {
      abortTypes = ABORT_TYPES,
      getBrowserless,
      gotOpts,
      headers,
      timeout = REQ_TIMEOUT,
      toEncode,
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
            statusCode: response.status(),
            redirects: response
              .request()
              .redirectChain()
              .map(req => ({
                statusCode: req.response().status(),
                url: req.url()
              }))
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

const defaultGetMode = (url, { prerender }) => {
  if (prerender === false || isMediaUrl(url) || isPdfUrl(url)) return 'fetch'
  if (prerender === true) return 'prerender'
  return isFetchMode(url) ? 'fetch' : 'prerender'
}

const defaultGetTemporalFile = (url, ext) => {
  const hash = crypto.createHash('sha256').update(url).digest('hex')
  const filepath = path.join(
    os.tmpdir(),
    ext === undefined ? hash : `${hash}.${ext}`
  )
  return { path: filepath }
}

const defaultMutoolPath = () =>
  (() => {
    try {
      return execSync('which mutool', { stdio: 'pipe' }).toString().trim()
    } catch (_) {}
  })()

const getContent = PCancelable.fn(
  (
    url,
    mode,
    {
      getBrowserless,
      getTemporalFile,
      gotOpts,
      headers,
      mutoolPath,
      puppeteerOpts,
      rewriteUrls,
      rewriteHtml,
      toEncode
    },
    onCancel
  ) => {
    const isFetchMode = mode === 'fetch'

    const fetchOpts = isFetchMode
      ? { headers, toEncode, mutoolPath, getTemporalFile, ...gotOpts }
      : { headers, toEncode, getBrowserless, gotOpts, ...puppeteerOpts }

    const promise = modes[mode](url, fetchOpts)
    onCancel(() => promise.cancel())

    return promise.then(content => {
      const html = addHtml({
        ...content,
        ...(isFetchMode ? puppeteerOpts : undefined),
        rewriteUrls,
        rewriteHtml
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
      getMode = defaultGetMode,
      getTemporalFile = defaultGetTemporalFile,
      gotOpts,
      headers,
      mutoolPath = defaultMutoolPath(),
      prerender = 'auto',
      puppeteerOpts,
      rewriteUrls = false,
      rewriteHtml = false
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
      getTemporalFile,
      gotOpts,
      headers,
      mutoolPath,
      puppeteerOpts,
      rewriteUrls,
      rewriteHtml,
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
