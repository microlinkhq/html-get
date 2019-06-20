'use strict'

const { isMime } = require('@metascraper/helpers')
const mimeTypes = require('mime-types')
const { getDomain } = require('tldts')
const cheerio = require('cheerio')
const { URL } = require('url')
const path = require('path')

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types
const TEXT_MIME_TYPES = ['htm', 'html', 'xml', 'xhtml', 'text']

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
    tags.push(`<meta property="og:locale" content="en">`)
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

module.exports = ({ html, url, headers }) => {
  const contentType = headers['content-type'] || 'text/html'
  const mime = mimeTypes.extension(contentType)
  const hasHTML =
    TEXT_MIME_TYPES.includes(mime) &&
    typeof html === 'string' &&
    html.length > 0

  const content = hasHTML ? html : htmlTemplate()

  const $ = cheerio.load(content, {
    decodeEntities: false,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true
  })

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

  return $.html()
}
