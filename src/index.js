'use strict'

const { parseUrl, isMediaUrl, isPdfUrl } = require('@metascraper/helpers')
const { readFile, writeFile } = require('fs/promises')
const timeSpan = require('@kikobeats/time-span')()
const debug = require('debug-logfmt')('html-get')
const { execSync } = require('child_process')
const PCancelable = require('p-cancelable')
const { AbortError } = require('p-retry')
const htmlEncode = require('html-encode')
const crypto = require('crypto')
const $ = require('tinyspawn')
const path = require('path')
const got = require('got')
const os = require('os')

const { getContentLength, getContentType } = require('./util')
const autoDomains = require('./auto-domains')
const addHtml = require('./html')

const REQ_TIMEOUT = 8000

const ABORT_TYPES = ['image', 'stylesheet', 'font']

const PDF_SIZE_TRESHOLD = 150 * 1024 // 150kb

const fetch = PCancelable.fn(
  async (
    url,
    {
      getTemporalFile,
      mutool,
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
        const contentType = getContentType(res.headers)

        if (mutool && contentType === 'application/pdf') {
          const file = getTemporalFile(url, 'pdf')
          await writeFile(file.path, res.body)
          if (getContentLength(res.headers) > PDF_SIZE_TRESHOLD) {
            const ofile = getTemporalFile(`${url}-pdf`, 'pdf')
            await mutool(`-o ${ofile.path} ${file.path}`)
            return readFile(ofile.path, 'utf-8')
          } else {
            const { stdout } = await mutool(file.path)
            return stdout
          }
        }

        return contentType === 'text/html' || !isMediaUrl(url)
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

const defaultGetTemporalFile = (input, ext) => {
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  const filepath = path.join(
    os.tmpdir(),
    ext === undefined ? hash : `${hash}.${ext}`
  )
  return { path: filepath }
}

const defaultMutool = () =>
  (() => {
    try {
      const mutoolPath = execSync('which mutool', {
        stdio: ['pipe', 'pipe', 'ignore']
      })
        .toString()
        .trim()
      return (...args) => $(`${mutoolPath} draw -q -F html ${args}`)
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
      mutool,
      puppeteerOpts,
      rewriteUrls,
      rewriteHtml,
      toEncode
    },
    onCancel
  ) => {
    const isFetchMode = mode === 'fetch'

    const fetchOpts = isFetchMode
      ? { headers, toEncode, mutool, getTemporalFile, ...gotOpts }
      : { headers, toEncode, getBrowserless, gotOpts, ...puppeteerOpts }

    const promise = modes[mode](url, fetchOpts)
    onCancel(() => promise.cancel())

    return promise.then(content => {
      const $ = addHtml({
        ...content,
        ...(isFetchMode ? puppeteerOpts : undefined),
        rewriteUrls,
        rewriteHtml
      })

      return { ...content, $ }
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
      mutool = defaultMutool(),
      prerender = 'auto',
      puppeteerOpts,
      rewriteHtml = false,
      rewriteUrls = false,
      serializeHtml = $ => ({ html: $.html() })
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
      mutool,
      puppeteerOpts,
      rewriteUrls,
      rewriteHtml,
      toEncode
    })

    onCancel(() => promise.cancel())

    const { mode, $, ...payload } = await promise

    return Object.assign(payload, {
      ...serializeHtml($),
      stats: { mode, timing: duration() }
    })
  }
)

module.exports.REQ_TIMEOUT = REQ_TIMEOUT
module.exports.ABORT_TYPES = ABORT_TYPES
module.exports.PDF_SIZE_TRESHOLD = PDF_SIZE_TRESHOLD
module.exports.isFetchMode = isFetchMode
module.exports.getContent = getContent
module.exports.defaultMutool = defaultMutool
