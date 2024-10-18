'use strict'

const path = require('path')
const test = require('ava')
const fs = require('fs')

const { prettyHtml } = require('../util')

const html = require('../../src/html')

test('remove localhost alike URLs', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://kikobeats.com',
    html: `
    <html lang="en">
      <head>
       <title>kikobeats.com</title>
       <meta property="og:site_name" content="kikobeats.com">
       <link rel="canonical" href="https://kikobeats.com/">
       <meta charset="utf-8">
      </head>
      <body>
        <script async="" src="http://localhost:35729/livereload.js?snipver=1" id="livereloadscript"></script>
        <script async="" src="http://127.0.0.1:35729/livereload.js?snipver=1" id="livereloadscript"></script>
        <script async="" src="http://0.0.0.1:35729/livereload.js?snipver=1" id="livereloadscript"></script>
      </body>
    </html>`,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  t.snapshot(prettyHtml(output))
})

test('rewrites relative root URLs inside html markup', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://browserless.js.org',
    html: fs.readFileSync(
      path.resolve(__dirname, '../fixtures/browserless.html'),
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

test('rewrites relative URLs inside html markup', t => {
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

test(" don't modify inline javascript", t => {
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

test("don't modify non http protocols", t => {
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

test("don't modify data URIs", t => {
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

test("don't modify undefined attributes", t => {
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
