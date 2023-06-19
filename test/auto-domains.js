'use strict'

const topsites = require('top-sites')
const test = require('ava')

const autoDomains = require('../src/auto-domains.json')

test('domains are sorted by popularity', t => {
  t.is(autoDomains[0][0][1], topsites[0].rootDomain.split('.')[0])
})
