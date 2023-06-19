'use strict'

const test = require('ava')

const { isFetchMode } = require('..')

test('true', t => {
  const url =
    'https://www.abc.net.au/news/2023-06-14/idpwd-2023-calling-all-budding-storytellers-with-disability/102388090'

  t.true(isFetchMode(url))
})
