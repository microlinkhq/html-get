'use strict'

const { parseUrl, isMediaUrl, isPdfUrl, memoizeOne } = require('@metascraper/helpers')
const { readFile, writeFile } = require('fs/promises')
const timeSpan = require('@kikobeats/time-span')()
const debug = require('debug-logfmt')('html-get')
const { execFileSync } = require('child_process')
const PCancelable = require('p-cancelable')
const { AbortError } = require('p-retry')
const htmlEncode = require('html-encode')
const crypto = require('crypto')
const $ = require('tinyspawn')
const path = require('path')
const got = require('got')
const os = require('os')

const { getContentLength, getContentType } = require('./util')
const { getOfficeFormat, isOfficeUrl } = require('./office')
const autoDomains = require('./auto-domains')
const addHtml = require('./html')

const REQ_TIMEOUT = 8000

const ABORT_TYPES = ['image', 'stylesheet', 'font']

const PDF_SIZE_TRESHOLD = 150 * 1024 // 150kb

const fetch = PCancelable.fn(
  async (
    url,
    { getTemporalFile, mutool, pandoc, reflect = false, timeout = REQ_TIMEOUT, toEncode, ...opts },
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
    req.on('redirect', res => redirects.push({ statusCode: res.statusCode, url: res.url }))

    try {
      const res = await req

      const html = await (async () => {
        const contentType = getContentType(res.headers)

        const officeFormat = pandoc && getOfficeFormat({ contentType, url: [res.url, url] })

        // a recognized office file never goes through mutool, even if the
        // response is mislabeled as application/pdf
        if (mutool && !officeFormat && contentType === 'application/pdf') {
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

        if (officeFormat) {
          const file = getTemporalFile(res.url, officeFormat)
          await writeFile(file.path, res.body)
          try {
            const converted = await pandoc(officeFormat, file.path)
            if (converted) return converted
            debug('pandoc:empty', { url: res.url, format: officeFormat })
          } catch (error) {
            debug('pandoc:error', {
              url: res.url,
              format: officeFormat,
              message: error.message || error
            })
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
          flattenShadowDOM: true,
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
          mode: 'prerender',
          statusCode: data.error?.response?.statusCode,
          redirects: []
        }
      : data
  }
)

const modes = { fetch, prerender }

const isInsideEmbeddedDocument = el => {
  let node = el.parent
  while (node) {
    const tag = node.tagName
    if (tag === 'svg' || tag === 'math') return true
    node = node.parent
  }
  return false
}

// Custom element names must contain a hyphen, but SVG/MathML also use
// hyphenated tags (e.g. font-face) that are not shadow hosts.
const hasShadowDOM = $ =>
  $('*')
    .toArray()
    .some(el => el.tagName?.includes('-') && !isInsideEmbeddedDocument(el))

const isFetchMode = url => {
  const parsedUrl = parseUrl(url)
  return autoDomains.some(conditions =>
    conditions.every(([prop, value]) => parsedUrl[prop] === value)
  )
}

const defaultGetMode = (url, { prerender }) => {
  if (prerender === false || isMediaUrl(url) || isPdfUrl(url) || isOfficeUrl(url)) {
    return 'fetch'
  }
  if (prerender === true) return 'prerender'
  return isFetchMode(url) ? 'fetch' : 'prerender'
}

const defaultGetTemporalFile = (input, ext) => {
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  const filepath = path.join(os.tmpdir(), ext === undefined ? hash : `${hash}.${ext}`)
  return { path: filepath }
}

// Resolve a binary path once and cache it: html-get owns the pandoc/mutool
// lookup, so both the internal runners and the exposed accessors share a single
// `which` per binary for the whole process. execFileSync (no shell) is faster
// than execSync and free of any interpolation surface.
const whichCache = new Map()
const whichSync = bin => {
  if (!whichCache.has(bin)) {
    let resolved
    try {
      resolved = execFileSync('which', [bin], {
        stdio: ['pipe', 'pipe', 'ignore']
      })
        .toString()
        .trim()
    } catch (_) {}
    whichCache.set(bin, resolved)
  }
  return whichCache.get(bin)
}

// The default runners are wired as default parameters (evaluated on every
// call), so memoizeOne builds each runner once instead of re-running the pandoc
// `--list-input-formats` probe and rebuilding the closure per request.
const defaultMutool = memoizeOne(() => {
  const mutoolPath = whichSync('mutool')
  if (!mutoolPath) return
  return (...args) => $(`${mutoolPath} draw -q -F html ${args}`)
})

const defaultPandoc = memoizeOne(() => {
  try {
    const pandocPath = whichSync('pandoc')
    if (!pandocPath) return
    // a broken/incompatible pandoc can throw here (or on the runner below); in
    // either case conversion stays disabled instead of breaking every getHTML
    // call through the default-parameter evaluation
    const supported = new Set(
      execFileSync(pandocPath, ['--list-input-formats'], {
        stdio: ['pipe', 'pipe', 'ignore']
      })
        .toString()
        .trim()
        .split(/\s+/)
    )
    return async (format, filepath) => {
      if (!supported.has(format)) return
      // array form keeps `filepath` a single argv entry even if it has spaces
      const { stdout } = await $(pandocPath, [
        `--from=${format}`,
        '--to=html',
        '--standalone',
        '--embed-resources',
        filepath
      ])
      return stdout.trim() ? stdout : undefined
    }
  } catch (_) {}
})

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
      pandoc,
      puppeteerOpts,
      rewriteUrls,
      rewriteHtml,
      toEncode
    },
    onCancel
  ) => {
    const isFetchMode = mode === 'fetch'

    const fetchOpts = isFetchMode
      ? { headers, toEncode, mutool, pandoc, getTemporalFile, ...gotOpts }
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
      pandoc = defaultPandoc(),
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
      pandoc,
      puppeteerOpts,
      rewriteUrls,
      rewriteHtml,
      toEncode
    })

    onCancel(() => promise.cancel())

    let { mode, html, $, ...payload } = await promise

    let shadowDOM = hasShadowDOM($)

    if (mode === 'fetch' && getBrowserless && shadowDOM && prerender !== false) {
      debug('shadow DOM detected, retrying with prerender', { url: targetUrl })
      const prerenderPromise = getContent(targetUrl, 'prerender', {
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
      onCancel(() => prerenderPromise.cancel())
      const prerenderResult = await prerenderPromise
      if (prerenderResult.html) {
        ;({ mode, html, $, ...payload } = prerenderResult)
        shadowDOM = hasShadowDOM($)
      }
    }

    return Object.assign(payload, {
      ...serializeHtml($),
      stats: { mode, timing: duration(), shadowDOM }
    })
  }
)

module.exports.REQ_TIMEOUT = REQ_TIMEOUT
module.exports.ABORT_TYPES = ABORT_TYPES
module.exports.PDF_SIZE_TRESHOLD = PDF_SIZE_TRESHOLD
module.exports.isFetchMode = isFetchMode
module.exports.getContent = getContent
module.exports.defaultMutool = defaultMutool
module.exports.defaultPandoc = defaultPandoc

// html-get already resolves pandoc/mutool for office and PDF conversion; expose
// the cached paths so a consumer (e.g. the microlink api markdown pipeline)
// reuses them instead of running its own `which`. Each returns undefined when
// the binary is not installed. Lazy: nothing runs until first call.
module.exports.getPandocPath = () => whichSync('pandoc')
module.exports.getMutoolPath = () => whichSync('mutool')
