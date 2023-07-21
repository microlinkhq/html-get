/* eslint-disable prefer-regex-literals */

'use strict'

const cheerio = require('cheerio')
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

test("'`rewriteCssUrls` don't modify html markup", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://www.rubiomonocoatusa.com/blogs/blog/how-to-apply-oil-plus-2c-to-furniture',
    html: `<!DOCTYPE html>
<html>
<head>
  <style>body { background: url(//cdn.shopify.com/s/files/1/0260/4810/2497/articles/Applying-Oil-Plus-2C-to-a-table_600x.jpg?v=1616464305) }</style>
  <meta property="og:image" content="http://cdn.shopify.com/s/files/1/0260/4810/2497/articles/Applying-Oil-Plus-2C-to-a-table_600x.jpg?v=1616464305">
</head>
<body></body>
</html>`,
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  t.true(
    output.includes(
      'content="http://cdn.shopify.com/s/files/1/0260/4810/2497/articles/Applying-Oil-Plus-2C-to-a-table_600x.jpg?v=1616464305"'
    )
  )

  t.true(
    output.includes(
      'url(https://cdn.shopify.com/s/files/1/0260/4810/2497/articles/Applying-Oil-Plus-2C-to-a-table_600x.jpg?v=1616464305)'
    )
  )

  t.snapshot(prettyHtml(output))
})

test('`rewriteHtmlUrls` rewrites relative root URLs inside html markup', t => {
  const output = html({
    rewriteUrls: true,
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

test('`rewriteHtmlUrls` rewrites relative URLs inside html markup', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://moovility.me/',
    html: `<!DOCTYPE html>
    <html>
    <head>
      <link rel="apple-touch-icon" href="img/icons/MOV/icon2-76.png" sizes="76x76">
    </head>
    <body></body>
    </html>`,
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  t.true(output.includes('https://moovility.me/img/icons/MOV/icon2-76.png'))

  t.snapshot(prettyHtml(output))
})

test('`rewriteHtmlUrls` rewrites relative URLs inside stylesheet', t => {
  const output = html({
    rewriteUrls: true,
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

test("`rewriteHtmlUrls` don't modify inline javascript", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://www.latimes.com/opinion/story/2020-06-07/column-muralist-honors-african-americans-killed-by-police',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<a class="ActionLink" data-social-service="print" href="javascript:window.print()"><svg><use xlink:href="#mono-icon-print"></use></svg><span>Print</span></a>
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(
    output.includes(
      '<a class="ActionLink" data-social-service="print" href="javascript:window.print()"><svg><use xlink:href="#mono-icon-print"></use></svg><span>Print</span></a>'
    )
  )

  t.snapshot(prettyHtml(output))
})

test("`rewriteHtmlUrls` don't modify non http protocols", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://www.latimes.com/opinion/story/2020-06-07/column-muralist-honors-african-americans-killed-by-police',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<a href="mailto:jen@oreilly.com"></a>
<a href="ftp://user:password@server/pathname"></a>
<a href="file://server/path"></a>
<a href="nntp://server:port/newsgroup/article"></a>
<a href="telnet://user:password@server:port/"/></a>
<a href="gopher://docstore.mik.ua/orelly.htm"></a>
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(output.includes('<a href="mailto:jen@oreilly.com"></a>'))
  t.true(output.includes('<a href="ftp://user:password@server/pathname"></a>'))
  t.true(output.includes('<a href="file://server/path'))
  t.true(output.includes('<a href="nntp://server:port/newsgroup/article"></a>'))
  t.true(output.includes('<a href="telnet://user:password@server:port/"></a>'))
  t.true(output.includes('<a href="gopher://docstore.mik.ua/orelly.htm"></a>'))

  t.snapshot(prettyHtml(output))
})

test("`rewriteHtmlUrls` don't modify data URIs", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://example.com',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<img src="data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7" alt="star" width="16" height="16">
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(
    output.includes(
      '<img src="data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7" alt="star" width="16" height="16">'
    )
  )

  t.snapshot(prettyHtml(output))
})

test("`rewriteHtmlUrls` don't modify undefined attributes", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://moovility.me',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <title>Document</title>
</head>
<body>
  <script>console.log('greetings')</script>
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(output.includes("<script>console.log('greetings')</script>"))

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
