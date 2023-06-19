'use strict'

const test = require('ava')

const autoDomains = require('../src/auto-domains.json')

test('domains are sorted by popularity', t => {
  t.true(['youtube', 'google'].includes(autoDomains[0][0][1]))
})
