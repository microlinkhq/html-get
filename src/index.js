'use strict'

const { parseUrl, isMediaUrl, isPdfUrl, memoizeOne } = require('@metascraper/helpers')
const { readFile, writeFile, rm } = require('fs/promises')
const timeSpan = require('@kikobeats/time-span')()
const debug = require('debug-logfmt')('html-get')
const { execFileSync } = require('child_process')
const PCancelable = require('p-cancelable')
const { AbortError } = require('p-retry')
const htmlEncode = require('html-encode')
const got = require('@kikobeats/got')
const crypto = require('crypto')
const $ = require('tinyspawn')
const path = require('path')
const os = require('os')

const { getContentLength, getContentType } = require('./util')
const { getOfficeFormat, isOfficeUrl } = require('./office')
const { extractSafe, isPdf } = require('./pdf')
const { firstImage } = require('./pdf/first-image')
const autoDomains = require('./auto-domains')
const addHtml = require('./html')

const REQ_TIMEOUT = 8000

const ABORT_TYPES = ['image', 'stylesheet', 'font']

const PDF_SIZE_TRESHOLD = 150 * 1024 // 150kb

const WITHOUT_IMAGES = '-O preserve-images=no'

const firstImageSafe = async (filepath, url, opts) => {
  try {
    return await firstImage(filepath, opts)
  } catch (error) {
    debug('mutool:image:error', { url, message: error.message || error })
  }
}

// `URL#hash` is empty both when the fragment is missing and when it is
// empty. An empty fragment is still present on `href`, and it must win.
const inheritRequestFragment = (options, response) => {
  if (!options.url.href.includes('#')) options.url.hash = new URL(response.url).hash
}

const fetch = PCancelable.fn(
  async (
    url,
    { getTemporalFile, mutool, pandoc, reflect = false, timeout = REQ_TIMEOUT, toEncode, ...opts },
    onCancel
  ) => {
    const temporalFiles = []
    const temporalFile = (input, ext) => {
      const file = getTemporalFile(input, ext)
      temporalFiles.push(file)
      return file
    }
    const reqTimeout = reflect ? timeout / 2 : timeout
    const deadline = Date.now() + reqTimeout
    const conversion = new AbortController()
    const convertOpts = () => ({
      signal: conversion.signal,
      timeout: Number.isFinite(deadline)
        ? Math.max(Math.floor(deadline - Date.now()), 1)
        : undefined
    })

    const req = got(url, {
      ...opts,
      hooks: {
        ...opts.hooks,
        beforeRedirect: [inheritRequestFragment].concat(opts.hooks?.beforeRedirect || [])
      },
      timeout: reqTimeout,
      responseType: 'buffer'
    })

    onCancel.shouldReject = false

    onCancel(() => {
      debug('fetch:cancel', { url, reflect })
      req.cancel()
      conversion.abort()
    })

    const redirects = []
    req.on('redirect', res => redirects.push({ statusCode: res.statusCode, url: res.url }))

    try {
      const res = await req

      let pdfMeta
      const html = await (async () => {
        const contentType = getContentType(res.headers)

        const officeFormat = getOfficeFormat({ contentType, url: [res.url, url] })
        const convertOffice = officeFormat && (await resolvePandoc(pandoc))

        // a recognized office file never goes through mutool, even if the
        // response is mislabeled as application/pdf
        if (!convertOffice && contentType === 'application/pdf') {
          pdfMeta = await extractSafe(res.body, res.url)
          if (!mutool) return ''
          const file = temporalFile(url, 'pdf')
          await writeFile(file.path, res.body)
          try {
            let converted
            if (getContentLength(res.headers) > PDF_SIZE_TRESHOLD) {
              const ofile = temporalFile(`${url}-pdf`, 'pdf')
              await mutool(`${WITHOUT_IMAGES} -o ${ofile.path} ${file.path}`, convertOpts())
              converted = await readFile(ofile.path, 'utf-8')
            } else {
              converted = (await mutool(`${WITHOUT_IMAGES} ${file.path}`, convertOpts())).stdout
            }
            if (converted) {
              if (!pdfMeta?.image && isPdf(res.body)) {
                const image = await firstImageSafe(file.path, res.url, {
                  mutool,
                  convertOpts,
                  signal: conversion.signal
                })
                pdfMeta = { ...pdfMeta, image }
              }
              return converted
            }
            debug('mutool:empty', { url: res.url })
          } catch (error) {
            debug('mutool:error', {
              url: res.url,
              message: error.message || error
            })
          }
          return ''
        }

        if (convertOffice) {
          const file = temporalFile(res.url, officeFormat)
          await writeFile(file.path, res.body)
          try {
            const converted = await convertOffice(officeFormat, file.path, convertOpts())
            if (converted) return converted
            debug('pandoc:empty', { url: res.url, format: officeFormat })
          } catch (error) {
            debug('pandoc:error', {
              url: res.url,
              format: officeFormat,
              message: error.message || error
            })
          }
          if (conversion.signal.aborted) return ''
        }

        return contentType === 'text/html' || !isMediaUrl(url)
          ? await toEncode(res.body, res.headers['content-type'])
          : res.body.toString()
      })()

      return {
        headers: res.headers,
        html,
        pdfMeta,
        mode: 'fetch',
        url: res.url,
        statusCode: res.statusCode,
        redirects
      }
    } catch (error) {
      debug('fetch:error', { url, message: error.message || error, reflect })
      const answer = {
        url: error.response ? error.response.url : url,
        headers: error.response ? error.response.headers : {},
        statusCode: error.response ? error.response.statusCode : undefined
      }
      return reflect
        ? { isRejected: true, error, ...answer }
        : { ...answer, html: '', mode: 'fetch', redirects }
    } finally {
      await removeTemporalFiles(temporalFiles)
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
      // page.content() succeeds on 4xx/5xx challenge pages; only cancel
      // fetch when prerender is actually usable, otherwise keep a 2xx/3xx fetch.
      if (payload.statusCode >= 400) {
        const { isRejected, ...dataProps } = await fetchRes
        if (!isRejected && dataProps.statusCode < 400) {
          debug('prerender', { url, state: 'fallback', statusCode: payload.statusCode })
          return dataProps
        }
      }
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
          headers: data.headers,
          html: '',
          url: data.url,
          mode: 'prerender',
          statusCode: data.statusCode,
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
  const name = crypto.randomUUID()
  return { path: path.join(os.tmpdir(), ext === undefined ? name : `${name}.${ext}`) }
}

const removeTemporalFiles = files =>
  Promise.all(
    files.map(file =>
      rm(file.path, { force: true }).catch(error =>
        debug('temporal:error', { path: file.path, message: error.message })
      )
    )
  )

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

const spawnOptions = ({ signal, timeout } = {}) => ({ signal, timeout, killSignal: 'SIGKILL' })

// The default mutool runner is wired as a default parameter (evaluated on every
// call), so memoizeOne builds it once instead of rebuilding it per request.
const defaultMutool = memoizeOne(() => {
  const mutoolPath = whichSync('mutool')
  if (!mutoolPath) return
  return (args, opts) => $(`${mutoolPath} draw -q -F html ${args}`, spawnOptions(opts))
})

const PANDOC_LIST_FORMATS = ['--list-input-formats']

const createPandoc = (pandocPath, inputFormats) => {
  const supported = new Set(inputFormats.toString().trim().split(/\s+/))
  return async (format, filepath, opts) => {
    if (!supported.has(format)) return
    // array form keeps `filepath` a single argv entry even if it has spaces
    const { stdout } = await $(
      pandocPath,
      [`--from=${format}`, '--to=html', '--standalone', '--embed-resources', filepath],
      spawnOptions(opts)
    )
    return stdout.trim() ? stdout : undefined
  }
}

// a broken/incompatible pandoc can throw while probing (or on the runner); in
// either case conversion stays disabled instead of breaking the request
const defaultPandoc = memoizeOne(() => {
  try {
    const pandocPath = whichSync('pandoc')
    if (!pandocPath) return
    return createPandoc(
      pandocPath,
      execFileSync(pandocPath, PANDOC_LIST_FORMATS, {
        stdio: ['pipe', 'pipe', 'ignore']
      })
    )
  } catch (_) {}
})

// The pandoc probe spawns the binary (~30-100ms). Most processes never fetch an
// office document, so getHTML defers it to the first one and runs it async.
const loadDefaultPandoc = memoizeOne(async () => {
  try {
    const pandocPath = whichSync('pandoc')
    if (!pandocPath) return
    const { stdout } = await $(pandocPath, PANDOC_LIST_FORMATS)
    return createPandoc(pandocPath, stdout)
  } catch (_) {}
})

const DEFAULT_PANDOC = Symbol('defaultPandoc')

const resolvePandoc = pandoc => (pandoc === DEFAULT_PANDOC ? loadDefaultPandoc() : pandoc)

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
      const { pdfMeta, ...rest } = content
      const $ = addHtml({
        ...rest,
        pdfMeta,
        ...(isFetchMode ? puppeteerOpts : undefined),
        rewriteUrls,
        rewriteHtml
      })

      return { ...rest, $ }
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
      pandoc = DEFAULT_PANDOC,
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
      // Same rule as the prerender 4xx fetch fallback: challenge HTML is
      // still a successful page.content(), so only replace a working fetch
      // when the retry is actually usable.
      if (
        prerenderResult.mode === 'prerender' &&
        prerenderResult.html &&
        prerenderResult.statusCode < 400
      ) {
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
module.exports.extractPdf = require('./pdf').extract
module.exports.extractPdfSafe = extractSafe
module.exports.isPdf = require('./pdf').isPdf
module.exports.isPdfLink = require('./pdf').isPdfLink
module.exports.pdfToHtml = async (input, url, opts) => {
  const pdfMeta = await extractSafe(input, url, opts)
  return addHtml({
    html: '',
    url,
    headers: { 'content-type': 'application/pdf' },
    pdfMeta
  }).html()
}
