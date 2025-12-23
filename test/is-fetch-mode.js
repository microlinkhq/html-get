'use strict'

const test = require('ava')

const { isFetchMode } = require('..')

test('true', t => {
  t.true(
    isFetchMode(
      'https://www.abc.net.au/news/2023-06-14/idpwd-2023-calling-all-budding-storytellers-with-disability/102388090'
    )
  )
})

test('false', t => {
  t.false(isFetchMode('https://x.com/Kikobeats/status/1741205717636264436'))
})
