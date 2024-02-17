'use strict'

const cheerio = require('cheerio')
const test = require('ava')

const { prettyHtml } = require('../util')

const html = require('../../src/html')

test('add minimal html markup', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: '',
    headers: {}
  })

  t.snapshot(prettyHtml(output))
})

test('add meta charset', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: '',
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  t.snapshot(prettyHtml(output))
})

test('add doctype', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: `
    <html lang="en">
      <head>
       <title>kikobeats.com</title>
       <meta property="og:site_name" content="kikobeats.com">
       <link rel="canonical" href="https://kikobeats.com/">
       <meta charset="utf-8">
      </head>
      <body></body>
    </html>`,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  t.snapshot(prettyHtml(output))
})

test('add json markup', t => {
  const output = html({
    html: '{"origin":"83.46.149.83","city":"Madrid","alpha2":"ES","alpha3":"ESP","callingCodes":["+34"],"currencies":{"EUR":{"name":"Euro","symbol":"€"}},"eeaMember":true,"euMember":true,"flag":"🇪🇸","languages":{"spa":"Spanish"},"numeric":724,"tld":[".es"],"region":"MD","latitude":"40.4163","longitude":"-3.6934","timezone":"Europe/Madrid","headers":{"accept":"*/*","accept-encoding":"gzip","cdn-loop":"cloudflare","cf-connecting-ip":"83.46.149.83","cf-ipcountry":"ES","cf-ray":"73a29be38cdf37c7-MAD","cf-visitor":"{"scheme":"https"}","connection":"Keep-Alive","host":"geolocation.microlink.io","user-agent":"curl/7.79.1","x-forwarded-for":"172.70.57.171","x-forwarded-host":"geolocation.microlink.io","x-forwarded-proto":"https","x-real-ip":"172.70.57.171","x-vercel-edge-region":"dev","x-vercel-id":"cdg1::x96k9-1660405852783-a0083d276cde","x-vercel-ip-city":"Madrid","x-vercel-ip-country":"ES","x-vercel-ip-country-region":"MD","x-vercel-ip-latitude":"40.4163","x-vercel-ip-longitude":"-3.6934","x-vercel-ip-timezone":"Europe/Madrid","x-vercel-proxied-for":"172.70.57.171"}}',
    url: 'https://geolocation.microlink.io/',
    headers: { 'content-type': 'application/json' }
  })

  t.snapshot(prettyHtml(output))
})

test('add image markup', t => {
  const output = html({
    url: 'https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif',
    headers: { 'content-type': 'image/gif' }
  })

  t.snapshot(prettyHtml(output))
})

test('add audio markup', t => {
  const output = html({
    url: 'http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3',
    headers: { 'content-type': 'audio/mp3' }
  })

  t.snapshot(prettyHtml(output))
})

test('add video markup', t => {
  const output = html({
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    headers: { 'content-type': 'video/mp4' }
  })

  t.snapshot(prettyHtml(output))
})

test('styles injection', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <meta property="og:site_name" content="kikobeats.com">
        <meta property="og:locale" content="en">
        <meta property="og:url" content="https://kikobeats.com">
        <link rel="canonical" href="https://kikobeats.com">
      </head>
      <body>
      </body>
    </html>`,
    styles: [
      'https://necolas.github.io/normalize.css/8.0.1/normalize.css',
      'body { background: black; }'
    ]
  })

  t.true(
    output.includes(
      '<link rel="stylesheet" type="text/css" href="https://necolas.github.io/normalize.css/8.0.1/normalize.css">'
    )
  )

  t.true(output.includes('background: black'))

  t.snapshot(prettyHtml(output))
})

test('scripts injection', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <meta property="og:site_name" content="kikobeats.com">
        <meta property="og:locale" content="en">
        <meta property="og:url" content="https://kikobeats.com">
        <link rel="canonical" href="https://kikobeats.com">
      </head>
      <body>
      </body>
    </html>`,
    scripts: [
      `
      ;(function mutateWindow () {
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        document.body.appendChild(iframe)

        const a = Object.getOwnPropertyNames(iframe.contentWindow)
        const b = Object.getOwnPropertyNames(window)

        const diffKeys = b.filter(c => !a.includes(c))
        const diffObj = {}
        diffKeys.forEach(key => (diffObj[key] = window[key]))

        console.log('Found', diffKeys.length, 'keys mutates on window')
        copy(diffObj)
        console.log('Copied to clipboard!')
      })()`,
      'https://code.jquery.com/jquery-3.5.1.min.js'
    ]
  })

  t.true(output.includes('mutateWindow'))

  t.true(
    output.includes(
      '<script src="https://code.jquery.com/jquery-3.5.1.min.js" type="text/javascript"></script>'
    )
  )

  t.snapshot(prettyHtml(output))
})

test('hide elements', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <meta property="og:site_name" content="kikobeats.com">
        <meta property="og:locale" content="en">
        <meta property="og:url" content="https://kikobeats.com">
        <link rel="canonical" href="https://kikobeats.com">
      </head>
      <body>
      </body>
    </html>`,
    hide: '#banner'
  })

  t.true(output.includes('#banner { visibility: hidden !important; }'))
  t.snapshot(prettyHtml(output))
})

test('remove elements', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <meta property="og:site_name" content="kikobeats.com">
        <meta property="og:locale" content="en">
        <meta property="og:url" content="https://kikobeats.com">
        <link rel="canonical" href="https://kikobeats.com">
      </head>
      <body>
      </body>
    </html>`,
    remove: '#banner'
  })

  t.true(output.includes('#banner { display: none !important; }'))
  t.snapshot(prettyHtml(output))
})

test('add `og:site_name` when is possible', t => {
  t.is(
    cheerio
      .load(html({ url: 'https://1.1.1.1', html: '', headers: {} }))(
        'meta[property="og:site_name"]'
      )
      .attr('content'),
    undefined
  )
  t.is(
    cheerio
      .load(html({ url: 'https://kikobeats.com', html: '', headers: {} }))(
        'meta[property="og:site_name"]'
      )
      .attr('content'),
    'kikobeats.com'
  )
})
