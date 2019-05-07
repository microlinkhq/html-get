'use strict'

const test = require('ava')

const html = require('../src/html')
const { prettyHtml } = require('./util')

const is = (t, html1, html2) => t.deepEqual(prettyHtml(html1), prettyHtml(html2))

test('add base html if not present', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: '',
    headers: {}
  })

  const expected = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
     <meta charset="utf-8">
     <meta http-equiv="X-UA-Compatible" content="IE=edge">
     <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
     <title>kikobeats.com</title>
     <meta property="og:site_name" content="kikobeats.com">
     <meta property="og:locale" content="en">
     <meta property="og:url" content="https://kikobeats.com">
     <link rel="canonical" href="https://kikobeats.com">
    </head>
    <body>
    </body>
  </html>
`

  is(t, output, expected)
})

test('append head at html if not present', t => {
  const output = html({
    url: 'https://kikobeats.com',
    html: '<html lang="en"><body></body></html>',
    headers: {}
  })

  const expected = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
      <title>kikobeats.com</title>
      <meta property="og:site_name" content="kikobeats.com">
      <meta property="og:locale" content="en">
      <meta property="og:url" content="https://kikobeats.com">
      <link rel="canonical" href="https://kikobeats.com">
    </head>
    <body>
    </body>
  </html>
`

  is(t, output, expected)
})

test('add image markup', t => {
  const output = html({
    url: 'https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif',
    html: '<html lang="en"><body></body></html>',
    headers: {
      'content-type': 'image/gif'
    }
  })

  const expected = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
      <title>giphy.gif</title>
      <meta property="og:site_name" content="giphy.com">
      <meta property="og:locale" content="en">
      <meta property="og:url" content="https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif">
      <link rel="canonical" href="https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif">
      <meta property="og:image:secure_url" content="https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif">
      <meta property="og:image:type" content="image/gif">
    </head>
    <body>
      <img src="https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif"></body>
  </html>
`

  is(t, output, expected)
})

test('add audio markup', t => {
  const output = html({
    url:
      'http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3',
    html: '<html lang="en"><body></body></html>',
    headers: {
      'content-type': 'audio/mp3'
    }
  })

  const expected = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
      <title>13.01.mp3</title>
      <meta property="og:site_name" content="audiovideoweb.com">
      <meta property="og:locale" content="en">
      <meta property="og:url" content="http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3">
      <link rel="canonical" href="http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3">
      <meta property="og:audio" content="http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3">
      <meta property="og:audio:type" content="audio/mp3">
    </head>
    <body>
    <audio src="http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3"></audio></body>
  </html>
`

  is(t, output, expected)
})

test('add video markup', t => {
  const output = html({
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    html: '<html lang="en"><body></body></html>',
    headers: {
      'content-type': 'video/mp4'
    }
  })

  const expected = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" shrink-to-fit="no">
      <title>big_buck_bunny_720p_1mb.mp4</title>
      <meta property="og:site_name" content="sample-videos.com">
      <meta property="og:locale" content="en">
      <meta property="og:url" content="https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4">
      <link rel="canonical" href="https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4">
      <meta property="og:video:secure_url" content="https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4">
      <meta property="og:video:type" content="video/mp4">
    </head>
    <body>
    <video src="https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"></video></body>
  </html>
`

  is(t, output, expected)
})
