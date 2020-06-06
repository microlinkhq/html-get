'use strict'

const execall = require('execall')
const path = require('path')
const test = require('ava')
const fs = require('fs')

const { prettyHtml } = require('./util')

const html = require('../src/html')

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

test('add image markup', t => {
  const output = html({
    url: 'https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif',
    headers: { 'content-type': 'image/gif' }
  })

  t.snapshot(prettyHtml(output))
})

test('add audio markup', t => {
  const output = html({
    url:
      'http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3',
    headers: { 'content-type': 'audio/mp3' }
  })

  t.snapshot(prettyHtml(output))
})

test('add video markup', t => {
  const output = html({
    url:
      'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    headers: { 'content-type': 'video/mp4' }
  })

  t.snapshot(prettyHtml(output))
})

test('rewrite relative URLs inside html markup', t => {
  const output = html({
    url: 'https://browserless.js.org',
    html: fs.readFileSync(
      path.resolve(__dirname, 'fixtures/browserless.html'),
      'utf8'
    ),
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  t.true(output.includes('https://browserless.js.org/static/main.min.js'))
  t.true(output.includes('https://unpkg.com/docsify/lib/docsify.min.js'))
  t.snapshot(prettyHtml(output))
})

test('rewrite relative URLs inside stylesheet', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: `
    <html lang="en">
      <body>
        <div style="background-image: url(/images/microlink.jpg)"></div>
        <div style="background-image: url(/images/microlink.jpg)"></div>
      </body>
    </html>
    `,
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  const results = execall(
    new RegExp('https://kikobeats.com/images/microlink.jpg', 'g'),
    output
  )

  t.is(results.length, 2)
  t.snapshot(prettyHtml(output))
})

test("don't rewrite data URIs or HTML selectors as URLs", t => {
  const output = html({
    url:
      'https://www.theguardian.com/education/2020/jun/05/tell-us-about-your-young-childs-experiences-of-going-back-to-school',
    html: fs.readFileSync(
      path.resolve(__dirname, 'fixtures/theguardian.html'),
      'utf8'
    ),
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  t.true(
    output.includes(
      '<meta property="og:title" content="Tell us about your young child&apos;s experiences of going back to school">'
    )
  )
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
