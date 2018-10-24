'use strict'

const test = require('ava')

const getHTML = require('..')

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
  t.is((await getHTML(url, { prerender: false })).url, redirectUrl)
  t.is((await getHTML(url, { prerender: true })).url, redirectUrl)
})

test('prerender error fallback into fetch mode', async t => {
  const url =
    'https://www.washingtonpost.com/gdpr-consent/?__twitter_impression=true&destination=%2Fnation%2F2018%2F10%2F24%2Fmega-millions-jackpot-winner-reported-south-carolina-its-not-official%2F%3Futm_term%3D.f26f36d5914d%26tid%3Dsm_tw%26__twitter_impression%3Dtrue&utm_term=.309ab3e98c97'

  const { stats, html } = await getHTML(url)
  t.true(!!html)
  t.is(stats.mode, 'fetch')
})
