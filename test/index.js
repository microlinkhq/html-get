'use strict'

const test = require('ava')

const getHTML = require('..')

const wait = async (promise, prop) => {
  const res = await promise
  return prop ? res[prop] : res
}

test('prerender by default', async t => {
  const url = 'https://kikobeats.com'
  const { stats } = await getHTML(url)
  t.is(stats.mode, 'prerender')
})

test('disable prerender explicitly', async t => {
  const url = 'https://kikobeats.com'
  const { stats } = await getHTML(url, { prerender: false })
  t.is(stats.mode, 'fetch')
})

test('prerender auto detection', async t => {
  const url = 'https://facebook.com'
  const { stats } = await getHTML(url)
  t.is(stats.mode, 'fetch')
})

test('follow redirect', async t => {
  const url = 'https://google.com'
  const redirectUrl = 'https://www.google.com/'

  t.is(await wait(getHTML(url, { prerender: false }), 'url'), redirectUrl)
  t.is(await wait(getHTML(url, { prerender: true }), 'url'), redirectUrl)
})

test('prerender error fallback into fetch mode', async t => {
  const url = 'https://www.washingtonpost.com/gdpr-consent/?noredirect=on'
  const { stats, html } = await getHTML(url, { prerender: true })
  t.true(!!html)
  t.is(stats.mode, 'fetch')
})

test('unreachable urls', async t => {
  const url = 'https://notexisturl.dev'
  t.is(await wait(getHTML(url, { prerender: false }), 'html'), '')
  t.is(await wait(getHTML(url, { prerender: true }), 'html'), '')
})
