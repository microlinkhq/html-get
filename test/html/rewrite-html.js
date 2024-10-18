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

test("don't rewrite og if property is already present", async t => {
  const output = html({
    rewriteHtml: true,
    url: 'https://kikobeats.com',
    html: composeHtml([
      '<meta content="This Pin was discovered by NMA Group" data-app="true" name="og:description" property="og:description">'
    ]),
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  const $ = cheerio.load(output)
  t.is(
    $('meta[name="og:description"]').attr('content'),
    'This Pin was discovered by NMA Group'
  )
  t.is(
    $('meta[property="og:description"]').attr('content'),
    'This Pin was discovered by NMA Group'
  )
})

test('fb propietary tags should be treat as og', async t => {
  {
    const output = html({
      rewriteHtml: true,
      url: 'https://kikobeats.com',
      html: composeHtml(['<meta content="1234" property="fb:app_id">']),
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })

    const $ = cheerio.load(output)
    t.is($('meta[property="fb:app_id"]').attr('content'), '1234')
    t.is($('meta[name="fb:app_id"]').attr('content'), undefined)
  }
  {
    const output = html({
      rewriteHtml: true,
      url: 'https://kikobeats.com',
      html: composeHtml(['<meta content="1234" name="fb:app_id">']),
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })

    const $ = cheerio.load(output)
    t.is($('meta[property="fb:app_id"]').attr('content'), '1234')
    t.is($('meta[name="fb:app_id"]').attr('content'), undefined)
  }
})

test("don't rewrite og if content is empty", async t => {
  const output = html({
    rewriteHtml: true,
    url: 'https://kikobeats.com',
    html: composeHtml(['<meta content="" name="twitter:description">']),
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  const $ = cheerio.load(output)
  t.is($('meta[name="twitter:description"]').attr('content'), '')
  t.is($('meta[property="twitter:description"]').attr('content'), undefined)
})

test('rewrite multiple og wrong markup', async t => {
  const output = html({
    rewriteHtml: true,
    url: 'https://kikobeats.com',
    html: composeHtml([
      '<meta name="og:title" content="Kiko Beats">',
      '<meta name="og:description" content="Personal website of Kiko Beats">',
      '<meta name="og:image" content="https://kikobeats.com/image.jpg">'
    ]),
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  const $ = cheerio.load(output)
  t.is($('meta[property="og:title"]').attr('content'), 'Kiko Beats')
  t.is(
    $('meta[property="og:description"]').attr('content'),
    'Personal website of Kiko Beats'
  )
  t.is(
    $('meta[property="og:image"]').attr('content'),
    'https://kikobeats.com/image.jpg'
  )
})

test('rewrite multiple meta wrong markup', async t => {
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
  t.is(
    $('meta[name="description"]').attr('content'),
    'Personal website of Kiko Beats'
  )
  t.is(
    $('meta[name="image"]').attr('content'),
    'https://kikobeats.com/image.jpg'
  )
})

test('rewrite multiple twitter wrong markup', async t => {
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
  t.is(
    $('meta[name="twitter:description"]').attr('content'),
    'Personal website of Kiko Beats'
  )
  t.is(
    $('meta[name="twitter:image"]').attr('content'),
    'https://kikobeats.com/image.jpg'
  )
})
