'use strict'

const test = require('ava')

const { initBrowserless } = require('./util')
const getHTML = require('..')

const getBrowserless = initBrowserless(test)

;[true, false].forEach(prerender => {
  const mode = prerender ? 'prerender' : 'fetch'

  test(`${mode} » collect redirects`, async t => {
    const targetUrl =
      'https://test-redirect-drab.vercel.app/?url=https%3A%2F%2Ftest-redirect-drab.vercel.app%3Furl%3Dhttps%253A%252F%252Ftest-redirect-drab.vercel.app%252F%253Furl%253Dhttps%253A%252F%252Fexample.com'

    const { redirects } = await getHTML(targetUrl, {
      prerender,
      getBrowserless
    })

    t.deepEqual(redirects, [
      {
        statusCode: 302,
        url: 'https://test-redirect-drab.vercel.app/?url=https%3A%2F%2Ftest-redirect-drab.vercel.app%3Furl%3Dhttps%253A%252F%252Ftest-redirect-drab.vercel.app%252F%253Furl%253Dhttps%253A%252F%252Fexample.com'
      },
      {
        statusCode: 302,
        url: 'https://test-redirect-drab.vercel.app/?url=https%3A%2F%2Ftest-redirect-drab.vercel.app%2F%3Furl%3Dhttps%3A%2F%2Fexample.com'
      },
      {
        statusCode: 302,
        url: 'https://test-redirect-drab.vercel.app/?url=https://example.com'
      }
    ])
  })
})
