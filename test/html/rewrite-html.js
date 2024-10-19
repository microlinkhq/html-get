'use strict'

const test = require('ava')
const cheerio = require('cheerio')

const { prettyHtml } = require('../util')

const html = require('../../src/html')

const composeHtml = meta =>
  prettyHtml(`
<!DOCTYPE html>
<html>
  <head>
    <title>kikobeats.com</title>
    <meta property="og:site_name" content="kikobeats.com">
    <link rel="canonical" href="https://kikobeats.com"><meta charset="utf-8">
    ${meta.join('\n')}
  </head>
  <body></body>
  </html>`)

;['fb', 'al'].forEach(prefix => {
  test(`treat '${prefix}:' following 'og:' spec`, t => {
    const output = html({
      rewriteHtml: true,
      url: 'https://kikobeats.com',
      html: composeHtml([
        `<meta content="applinks://docs" name="${prefix}:ios:url">`
      ]),
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })

    const $ = cheerio.load(output)
    t.is(
      $(`meta[property="${prefix}:ios:url"]`).attr('content'),
      'applinks://docs'
    )
    t.is($(`meta[name="${prefix}:ios:url"]`).attr('content'), undefined)
  })
})
;['twitter', 'fb', 'al', 'og'].forEach(prefix => {
  test(`don't rewrite '${prefix}:' if content is empty`, t => {
    const output = html({
      rewriteHtml: true,
      url: 'https://kikobeats.com',
      html: composeHtml([`<meta content="" name="${prefix}:ios:url">`]),
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })

    const $ = cheerio.load(output)
    t.is($(`meta[name="${prefix}:ios:url"]`).attr('content'), '')
    t.is($(`meta[property="${prefix}:ios:url"]`).attr('content'), undefined)
  })
})

test("don't rewrite meta if content is empty", t => {
  const output = html({
    rewriteHtml: true,
    url: 'https://kikobeats.com',
    html: composeHtml(['<meta property="title" content="">']),
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  const $ = cheerio.load(output)
  t.is($('meta[property="title"]').attr('content'), '')
  t.is($('meta[name="title"]').attr('content'), undefined)
})

test('rewrite multiple meta wrong markup', t => {
  const output = html({
    rewriteHtml: true,
    url: 'https://kikobeats.com',
    html: composeHtml([
      '<meta property="title" content="Kiko Beats">',
      '<meta property="description" content="Personal website of Kiko Beats">',
      '<meta property="image" content="https://kikobeats.com/image.jpg">'
    ]),
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  const $ = cheerio.load(output)
  t.is($('meta[name="title"]').attr('content'), 'Kiko Beats')
  t.is($('meta[property="title"]').attr('content'), undefined)
  t.is(
    $('meta[name="description"]').attr('content'),
    'Personal website of Kiko Beats'
  )
  t.is($('meta[property="description"]').attr('content'), undefined)
  t.is(
    $('meta[name="image"]').attr('content'),
    'https://kikobeats.com/image.jpg'
  )
  t.is($('meta[property="image"]').attr('content'), undefined)
})

test("rewrite multiple 'twitter:' wrong markup", t => {
  const output = html({
    rewriteHtml: true,
    url: 'https://kikobeats.com',
    html: composeHtml([
      '<meta property="twitter:title" content="Kiko Beats">',
      '<meta property="twitter:description" content="Personal website of Kiko Beats">',
      '<meta property="twitter:image" content="https://kikobeats.com/image.jpg">'
    ]),
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  const $ = cheerio.load(output)
  t.is($('meta[name="twitter:title"]').attr('content'), 'Kiko Beats')
  t.is($('meta[property="twitter:title"]').attr('content'), undefined)
  t.is(
    $('meta[name="twitter:description"]').attr('content'),
    'Personal website of Kiko Beats'
  )
  t.is($('meta[property="twitter:description"]').attr('content'), undefined)
  t.is(
    $('meta[name="twitter:image"]').attr('content'),
    'https://kikobeats.com/image.jpg'
  )
  t.is($('meta[property="twitter:image"]').attr('content'), undefined)
})
;['al', 'fb', 'og'].forEach(prefix => {
  test(`rewrite multiple '${prefix}' wrong markup`, t => {
    const output = html({
      rewriteHtml: true,
      url: 'https://kikobeats.com',
      html: composeHtml([
        `<meta content="1234" name="${prefix}:app_id">`,
        `<meta content="5678" name="${prefix}:session_id">`
      ]),
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })

    const $ = cheerio.load(output)
    t.is($(`meta[property="${prefix}:app_id"]`).attr('content'), '1234')
    t.is($(`meta[name="${prefix}:app_id"]`).attr('content'), undefined)
    t.is($(`meta[property="${prefix}:session_id"]`).attr('content'), '5678')
    t.is($(`meta[name="${prefix}:session_id"]`).attr('content'), undefined)
  })
})
