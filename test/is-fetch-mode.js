'use strict'

const test = require('ava').default

const { isFetchMode } = require('..')

test('true', t => {
  t.true(
    isFetchMode(
      'https://www.abc.net.au/news/2023-06-14/idpwd-2023-calling-all-budding-storytellers-with-disability/102388090'
    )
  )
  // houzz rate-limits datacenter IPs with a bare 429; fetch mode surfaces that
  // status so is-antibot can flag it and escalate to the residential proxy,
  // whereas prerender would return an empty shell that hides the block.
  t.true(
    isFetchMode(
      'https://www.houzz.com/photos/primary-bathroom-retreat-transitional-bathroom-london-phvw-vp~210219633'
    )
  )
})

test('false', t => {
  t.false(isFetchMode('https://x.com/Kikobeats/status/1741205717636264436'))
})
