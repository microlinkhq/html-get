'use strict'

const { isMime } = require('@metascraper/helpers')
const isRelativeUrl = require('is-relative-url')
const { TAGS: URL_TAGS } = require('html-urls')
const replaceString = require('replace-string')
const { forEach, isString } = require('lodash')
const mimeTypes = require('mime-types')
const cssUrl = require('css-url-regex')
const isCdnUrl = require('is-cdn-url')
const { getDomain } = require('tldts')
const execall = require('execall')
const cheerio = require('cheerio')
const { URL } = require('url')
const path = require('path')

const HTML_MIME_EXT = ['html', 'xml', 'txt']

const addHead = ({ $, url, headers }) => {
  const tags = []

  const { date, expires } = headers

  const title = $('title')
  if (!title.length) {
    tags.push(`<title>${path.basename(url)}</title>`)
  }

  const siteName = $('meta[property="og:site_name"]')
  if (!siteName.length) {
    tags.push(`<meta property="og:site_name" content="${getDomain(url)}">`)
  }

  if (date) {
    const publishedTime = $('meta[property="article:published_time"]')
    if (!publishedTime.length) {
      tags.push(`<meta property="article:published_time" content="${date}">`)
    }
  }

  if (expires) {
    const expirationTime = $('meta[property="article:expiration_time"]')
    if (!expirationTime.length) {
      tags.push(`<meta property="article:expiration_time" content="${date}">`)
    }
  }

  const locale = $('meta[property="og:locale"]')
  if (!locale.length) {
    tags.push('<meta property="og:locale" content="en">')
  }

  tags.push(`<meta property="og:url" content="${url}">`)
  tags.push(`<link rel="canonical" href="${url}">`)

  const head = $('head')
  tags.forEach(tag => head.append(tag))
}

const addMedia = (media, { $, url, headers, body }) => {
  const tags = []

  const ogMedia = $(`meta[property="og:${media}"]`)

  if (!ogMedia.length) {
    const { protocol } = new URL(url)
    const isHttps = protocol === 'https:'
    const imageProperty = `og:${media}${isHttps ? ':secure_url' : ''}`
    tags.push(`<meta property="${imageProperty}" content="${url}">`)
  }

  const ogMediaType = $(`meta[property="og:${media}:type"]`)
  if (!ogMediaType.length) {
    tags.push(
      `<meta property="og:${media}:type" content="${headers['content-type']}">`
    )
  }

  const head = $('head')
  tags.forEach(tag => head.append(tag))

  const bodyTag = $('body')
  if (!bodyTag.children().length) bodyTag.append(body(url))
}

const htmlTemplate = () => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
    </head>
    <body></body>
  </html>
`

const rewriteHtmlUrls = ({ $, url }) => {
  forEach(URL_TAGS, (tagName, urlAttr) => {
    $(tagName.join(',')).each(function () {
      const el = $(this)
      const attr = el.attr(urlAttr)
      if (!isString(attr)) return
      let newAttr

      if (isCdnUrl(attr)) {
        newAttr = `https:${attr}`
      } else if (isRelativeUrl(attr)) {
        newAttr = new URL(attr, url).toString()
      }

      if (newAttr !== undefined) el.attr(urlAttr, newAttr)
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
    let replacement

    if (isCdnUrl(cssUrl)) {
      replacement = `https:${cssUrl}`
    } else if (isRelativeUrl(cssUrl)) {
      replacement = new URL(cssUrl, url).toString()
    }

    if (replacement !== undefined) {
      html = replaceString(html, cssUrl, replacement)
    }
  })

  return html
}

const isHTML = (html, contentType) =>
  HTML_MIME_EXT.includes(mimeTypes.extension(contentType)) &&
  typeof html === 'string' &&
  html.length > 0

module.exports = ({ html, url, headers = {} }) => {
  const contentType = headers['content-type'] || 'text/html; charset=utf-8'
  const content = isHTML(html, contentType) ? html : htmlTemplate()

  const $ = cheerio.load(content)

  rewriteHtmlUrls({ $, url, headers })

  addHead({ $, url, headers })

  if (isMime(contentType, 'image')) {
    addMedia('image', { $, url, headers, body: url => `<img src="${url}">` })
  } else if (isMime(contentType, 'video')) {
    addMedia('video', {
      $,
      url,
      headers,
      body: url => `<video src="${url}"></video>`
    })
  } else if (isMime(contentType, 'audio')) {
    addMedia('audio', {
      $,
      url,
      headers,
      body: url => `<audio src="${url}"></audio>`
    })
  }

  return rewriteCssUrls({ html: $.html(), url })
}

module.exports.isHTML = isHTML
