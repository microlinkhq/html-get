'use strict'

const { startsWith, get, split, nth, castArray, forEach } = require('lodash')
const { date: toDate, isUrl, isMime } = require('@metascraper/helpers')
const { TAGS: URL_TAGS } = require('html-urls')
const replaceString = require('replace-string')
const isHTML = require('is-html-content')
const cssUrl = require('css-url-regex')
const { getDomain } = require('tldts')
const execall = require('execall')
const cheerio = require('cheerio')
const { URL } = require('url')
const path = require('path')

const has = el => el.length !== 0

const upsert = (el, collection, item) => !has(el) && collection.push(item)

const addHead = ({ $, url, headers }) => {
  const tags = []
  const contentType = get(headers, 'content-type')
  const charset = nth(split(contentType, 'charset='), 1)
  const timestamp = get(headers, 'last-modified') || get(headers, 'date')
  const date = timestamp && toDate(timestamp)

  const head = $('head')

  upsert(head.find('title'), tags, `<title>${path.basename(url)}</title>`)

  upsert(
    head.find('meta[property="og:site_name"]'),
    tags,
    `<meta property="og:site_name" content="${getDomain(url)}">`
  )

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

const addBody = ({ url, headers }) => {
  const contentType = get(headers, 'content-type')

  let element = ''

  if (isMime(contentType, 'image')) {
    element = `<img src="${url}"></img>`
  } else if (isMime(contentType, 'video')) {
    element = `<video src="${url}"></video>`
  } else if (isMime(contentType, 'audio')) {
    element = `<audio src="${url}"></audio>`
  }

  return `<!DOCTYPE html><html><head></head><body>${element}</body></html>`
}

const rewriteHtmlUrls = ({ $, url }) => {
  forEach(URL_TAGS, (tagName, urlAttr) => {
    $(tagName.join(',')).each(function () {
      const el = $(this)
      const attr = el.attr(urlAttr)
      if (startsWith(attr, '/')) {
        el.attr(urlAttr, new URL(attr, url).toString())
      }
    })
  })
}

const rewriteCssUrls = ({ html, url }) => {
  const cssUrls = Array.from(
    execall(cssUrl(), html).reduce((acc, match) => {
      match.subMatches.forEach(match => acc.add(match))
      return acc
    }, new Set())
  )

  cssUrls.forEach(cssUrl => {
    if (cssUrl.startsWith('/')) {
      html = replaceString(html, cssUrl, new URL(cssUrl, url).toString())
    }
  })

  return html
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
  scripts,
  modules
}) => {
  const content = addDocType(isHTML(html) ? html : addBody({ url, headers }))

  const $ = cheerio.load(content)

  rewriteHtmlUrls({ $, url, headers })

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

  return rewriteCssUrls({ html: $.html(), url })
}

module.exports.isHTML = isHTML
