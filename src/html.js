'use strict'

const debug = require('debug-logfmt')('html-get:rewrite')
const { get, castArray, forEach } = require('lodash')
const isLocalAddress = require('is-local-address')
const { TAGS: URL_TAGS } = require('html-urls')
const isHTML = require('is-html-content')
const cssUrl = require('css-url-regex')
const execall = require('execall')
const cheerio = require('cheerio')
const { URL } = require('url')
const path = require('path')

const {
  date: toDate,
  isMime,
  isUrl,
  mimeExtension,
  parseUrl
} = require('@metascraper/helpers')

const { getContentType, getCharset } = require('./util')

const has = el => el.length !== 0

const upsert = (el, collection, item) => !has(el) && collection.push(item)

/**
 * Infer timestamp from `last-modified`, `date`, or `age` response headers.
 */
const getDate = headers => {
  const timestamp = get(headers, 'last-modified') || get(headers, 'date')
  return timestamp
    ? toDate(timestamp)
    : toDate(Date.now() - Number(get(headers, 'age')) * 1000)
}

const addHead = ({ $, url, headers }) => {
  const tags = []
  const charset = getCharset(headers)
  const date = getDate(headers)
  const { domain } = parseUrl(url)
  const head = $('head')

  upsert(head.find('title'), tags, `<title>${path.basename(url)}</title>`)

  if (domain) {
    upsert(
      head.find('meta[property="og:site_name"]'),
      tags,
      `<meta property="og:site_name" content="${domain}">`
    )
  }

  if (date) {
    upsert(
      head.find('meta[property="article:published_time"]'),
      tags,
      `<meta name="date" content="${date}" />`
    )
  }

  upsert(
    head.find('link[rel="canonical"]'),
    tags,
    `<link rel="canonical" href="${url}">`
  )

  if (charset) {
    upsert(head.find('meta[charset]'), tags, `<meta charset="${charset}">`)
  }

  tags.forEach(tag => head.append(tag))
}

const addBody = ({ url, headers, html }) => {
  const contentType = getContentType(headers)
  let element = ''

  if (isMime(contentType, 'image')) {
    element = `<img src="${url}"></img>`
  } else if (isMime(contentType, 'video')) {
    element = `<video><source src="${url}" type="${contentType}"></source></video>`
  } else if (isMime(contentType, 'audio')) {
    element = `<audio><source src="${url}" type="${contentType}"></source></audio>`
  } else if (mimeExtension(contentType) === 'json') {
    element = `<pre>${html}</pre>`
  }

  return `<!DOCTYPE html><html><head></head><body>${element}</body></html>`
}

const isOpenGraph = (prop = '') =>
  ['og:', 'fb:', 'al:'].some(prefix => prop.startsWith(prefix))

const rewriteMetaTags = ({ $ }) => {
  $('meta').each((_, element) => {
    const el = $(element)
    if (!el.attr('content')) return

    const name = el.attr('name')
    const property = el.attr('property')

    // Convert 'name' to 'property' for Open Graph tags if 'property' is not already set correctly
    if (property !== name && isOpenGraph(name)) {
      el.removeAttr('name').attr('property', name)
      debug('og', el.attr())
      // Convert 'property' to 'name' for non-Open Graph tags
    } else if (property && !isOpenGraph(property)) {
      el.removeAttr('property').attr('name', property)
      debug('meta', el.attr())
    }
  })
}

const rewriteHtmlUrls = ({ $, url }) => {
  forEach(URL_TAGS, (tagName, urlAttr) => {
    $(tagName.join(',')).each(function () {
      const el = $(this)
      const attr = el.attr(urlAttr)
      if (typeof attr !== 'string') return
      try {
        const urlObj = new URL(attr, url)
        if (!urlObj.protocol.startsWith('http')) return
        if (isLocalAddress(urlObj.hostname)) {
          el.remove()
        } else {
          el.attr(urlAttr, urlObj.toString())
        }
      } catch (_) {}
    })
  })
}

const replaceCssUrls = (url, stylesheet) => {
  const cssUrls = Array.from(execall(cssUrl(), stylesheet)).reduce(
    (acc, match) => {
      match.subMatches.forEach(match => acc.add(match))
      return acc
    },
    new Set()
  )

  cssUrls.forEach(cssUrl => {
    if (cssUrl.startsWith('/')) {
      try {
        const absoluteUrl = new URL(cssUrl, url).toString()
        stylesheet = stylesheet.replaceAll(
          `url(${cssUrl})`,
          `url(${absoluteUrl})`
        )
      } catch (_) {}
    }
  })

  return stylesheet
}

const rewriteCssUrls = ({ $, url }) => {
  // Process <style> tags
  // e.g., <style>body { background-image: url('/image.jpg'); }</style>
  $('style').each((_, element) =>
    $(element).html(replaceCssUrls(url, $(element).html()))
  )

  // Process elements with style attributes
  // e.g., <div style="background-image: url('/image.jpg');"></div>
  $('[style]').each((_, element) =>
    $(element).attr('style', replaceCssUrls(url, $(element).attr('style')))
  )

  return $
}

const injectStyle = ({ $, styles }) =>
  castArray(styles).forEach(style =>
    $('head').append(
      isUrl(style)
        ? `<link rel="stylesheet" type="text/css" href="${style}">`
        : `<style type="text/css">${style}</style>`
    )
  )

const injectScripts = ({ $, scripts, type }) =>
  castArray(scripts).forEach(script =>
    $('head').append(
      isUrl(script)
        ? `<script src="${script}" type="${type}"></script>`
        : `<script type="${type}">${script}</script>`
    )
  )

const addDocType = html =>
  html.startsWith('<!') ? html : `<!DOCTYPE html>${html}`

module.exports = ({
  html,
  url,
  headers = {},
  styles,
  hide,
  remove,
  rewriteUrls,
  rewriteHtml,
  scripts,
  modules
}) => {
  const content = addDocType(
    isHTML(html) ? html : addBody({ url, headers, html })
  )

  const $ = cheerio.load(content)

  if (rewriteUrls) rewriteHtmlUrls({ $, url })

  if (rewriteHtml) rewriteMetaTags({ $, url })

  addHead({ $, url, headers })

  if (styles) injectStyle({ $, styles })

  if (hide) {
    injectStyle({
      $,
      styles: `${castArray(hide).join(', ')} { visibility: hidden !important; }`
    })
  }

  if (remove) {
    injectStyle({
      $,
      styles: `${castArray(remove).join(', ')} { display: none !important; }`
    })
  }

  if (scripts) injectScripts({ $, scripts, type: 'text/javascript' })
  if (modules) injectScripts({ $, modules, type: 'module' })

  return rewriteUrls ? rewriteCssUrls({ $, url }) : $
}

module.exports.getDate = getDate
