'use strict'

const test = require('ava')

const getHTML = require('..')

test('prerender by default', async t => {
  const url = 'https://kikobeats.com'
  const { stats } = await getHTML(url)
  t.is(stats.mode, 'prerender')
})

test('disable prerender', async t => {
  const url = 'https://kikobeats.com'
  const { stats } = await getHTML(url, { prerender: false })
  t.is(stats.mode, 'fetch')
})

test('prerender auto detection', async t => {
  const url = 'https://facebook.com'
  const { stats } = await getHTML(url)
  t.is(stats.mode, 'fetch')
})
