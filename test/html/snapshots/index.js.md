# Snapshot report for `test/html/index.js`

The actual snapshot is saved in `index.js.snap`.

Generated by [AVA](https://avajs.dev).

## add minimal html markup

> Snapshot 1

    `<!DOCTYPE html>␊
    <html>␊
      <head>␊
        <title>kikobeats.com</title>␊
        <meta property="og:site_name" content="kikobeats.com">␊
        <link rel="canonical" href="https://kikobeats.com">␊
      </head>␊
      <body></body>␊
    </html>`

## add meta charset

> Snapshot 1

    `<!DOCTYPE html>␊
    <html>␊
      <head>␊
        <title>kikobeats.com</title>␊
        <meta property="og:site_name" content="kikobeats.com">␊
        <link rel="canonical" href="https://kikobeats.com">␊
        <meta charset="utf-8">␊
      </head>␊
      <body></body>␊
    </html>`

## add doctype

> Snapshot 1

    `<!DOCTYPE html>␊
    <html lang="en">␊
      <head>␊
        <title>kikobeats.com</title>␊
        <meta property="og:site_name" content="kikobeats.com">␊
        <link rel="canonical" href="https://kikobeats.com/">␊
        <meta charset="utf-8">␊
      </head>␊
      <body>␊
      </body>␊
    </html>`

## add json markup

> Snapshot 1

    `<!DOCTYPE html>␊
    <html>␊
      <head>␊
        <title>geolocation.microlink.io</title>␊
        <meta property="og:site_name" content="microlink.io">␊
        <link rel="canonical" href="https://geolocation.microlink.io/">␊
      </head>␊
      <body><pre>{"origin":"83.46.149.83","city":"Madrid","alpha2":"ES","alpha3":"ESP","callingCodes":["+34"],"currencies":{"EUR":{"name":"Euro","symbol":"€"}},"eeaMember":true,"euMember":true,"flag":"🇪🇸","languages":{"spa":"Spanish"},"numeric":724,"tld":[".es"],"region":"MD","latitude":"40.4163","longitude":"-3.6934","timezone":"Europe/Madrid","headers":{"accept":"*/*","accept-encoding":"gzip","cdn-loop":"cloudflare","cf-connecting-ip":"83.46.149.83","cf-ipcountry":"ES","cf-ray":"73a29be38cdf37c7-MAD","cf-visitor":"{"scheme":"https"}","connection":"Keep-Alive","host":"geolocation.microlink.io","user-agent":"curl/7.79.1","x-forwarded-for":"172.70.57.171","x-forwarded-host":"geolocation.microlink.io","x-forwarded-proto":"https","x-real-ip":"172.70.57.171","x-vercel-edge-region":"dev","x-vercel-id":"cdg1::x96k9-1660405852783-a0083d276cde","x-vercel-ip-city":"Madrid","x-vercel-ip-country":"ES","x-vercel-ip-country-region":"MD","x-vercel-ip-latitude":"40.4163","x-vercel-ip-longitude":"-3.6934","x-vercel-ip-timezone":"Europe/Madrid","x-vercel-proxied-for":"172.70.57.171"}}</pre>␊
      </body>␊
    </html>`

## add image markup

> Snapshot 1

    `<!DOCTYPE html>␊
    <html>␊
      <head>␊
        <title>giphy.gif</title>␊
        <meta property="og:site_name" content="giphy.com">␊
        <link rel="canonical" href="https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif">␊
      </head>␊
      <body><img src="https://media.giphy.com/media/LqTSLCsIIkCTvQ8X9g/giphy.gif"></body>␊
    </html>`

## add audio markup

> Snapshot 1

    `<!DOCTYPE html>␊
    <html>␊
      <head>␊
        <title>13.01.mp3</title>␊
        <meta property="og:site_name" content="audiovideoweb.com">␊
        <link rel="canonical" href="http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3">␊
      </head>␊
      <body><audio>␊
          <source src="http://websrvr90va.audiovideoweb.com/va90web25003/companions/Foundations%20of%20Rock/13.01.mp3" type="audio/mp3">␊
        </audio></body>␊
    </html>`

## add video markup

> Snapshot 1

    `<!DOCTYPE html>␊
    <html>␊
      <head>␊
        <title>big_buck_bunny_720p_1mb.mp4</title>␊
        <meta property="og:site_name" content="sample-videos.com">␊
        <link rel="canonical" href="https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4">␊
      </head>␊
      <body><video>␊
          <source src="https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4" type="video/mp4">␊
        </video></body>␊
    </html>`

## styles injection

> Snapshot 1

    `<!DOCTYPE html>␊
    <html lang="en">␊
      <head>␊
        <meta charset="UTF-8">␊
        <meta name="viewport" content="width=device-width, initial-scale=1.0">␊
        <title>Document</title>␊
        <meta property="og:site_name" content="kikobeats.com">␊
        <meta property="og:locale" content="en">␊
        <meta property="og:url" content="https://kikobeats.com">␊
        <link rel="canonical" href="https://kikobeats.com">␊
        <link rel="stylesheet" type="text/css" href="https://necolas.github.io/normalize.css/8.0.1/normalize.css">␊
        <style type="text/css">␊
          body {␊
            background: black;␊
          }␊
        </style>␊
      </head>␊
      <body>␊
      </body>␊
    </html>`

## scripts injection

> Snapshot 1

    `<!DOCTYPE html>␊
    <html lang="en">␊
      <head>␊
        <meta charset="UTF-8">␊
        <meta name="viewport" content="width=device-width, initial-scale=1.0">␊
        <title>Document</title>␊
        <meta property="og:site_name" content="kikobeats.com">␊
        <meta property="og:locale" content="en">␊
        <meta property="og:url" content="https://kikobeats.com">␊
        <link rel="canonical" href="https://kikobeats.com">␊
        <script type="text/javascript">␊
          ;␊
          (function mutateWindow() {␊
            const iframe = document.createElement('iframe')␊
            iframe.style.display = 'none'␊
            document.body.appendChild(iframe)␊
            const a = Object.getOwnPropertyNames(iframe.contentWindow)␊
            const b = Object.getOwnPropertyNames(window)␊
            const diffKeys = b.filter(c => !a.includes(c))␊
            const diffObj = {}␊
            diffKeys.forEach(key => (diffObj[key] = window[key]))␊
            console.log('Found', diffKeys.length, 'keys mutates on window')␊
            copy(diffObj)␊
            console.log('Copied to clipboard!')␊
          })()␊
        </script>␊
        <script src="https://code.jquery.com/jquery-3.5.1.min.js" type="text/javascript"></script>␊
      </head>␊
      <body>␊
      </body>␊
    </html>`

## hide elements

> Snapshot 1

    `<!DOCTYPE html>␊
    <html lang="en">␊
      <head>␊
        <meta charset="UTF-8">␊
        <meta name="viewport" content="width=device-width, initial-scale=1.0">␊
        <title>Document</title>␊
        <meta property="og:site_name" content="kikobeats.com">␊
        <meta property="og:locale" content="en">␊
        <meta property="og:url" content="https://kikobeats.com">␊
        <link rel="canonical" href="https://kikobeats.com">␊
        <style type="text/css">␊
          #banner {␊
            visibility: hidden !important;␊
          }␊
        </style>␊
      </head>␊
      <body>␊
      </body>␊
    </html>`

## remove elements

> Snapshot 1

    `<!DOCTYPE html>␊
    <html lang="en">␊
      <head>␊
        <meta charset="UTF-8">␊
        <meta name="viewport" content="width=device-width, initial-scale=1.0">␊
        <title>Document</title>␊
        <meta property="og:site_name" content="kikobeats.com">␊
        <meta property="og:locale" content="en">␊
        <meta property="og:url" content="https://kikobeats.com">␊
        <link rel="canonical" href="https://kikobeats.com">␊
        <style type="text/css">␊
          #banner {␊
            display: none !important;␊
          }␊
        </style>␊
      </head>␊
      <body>␊
      </body>␊
    </html>`
