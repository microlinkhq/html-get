'use strict'

const { compact, reduce, findIndex } = require('lodash')
const writeJsonFile = require('write-json-file')
const parseDomain = require('parse-domain')
const topsites = require('top-sites')

const getDomain = url => parseDomain(url).domain

const domains = require('./src/auto-domains')

const sorted = reduce(
  domains,
  (acc, domain) => {
    const index = findIndex(
      topsites,
      topsite => getDomain(topsite.url) === domain
    )
    acc[index] = domain
    return acc
  },
  new Array(topsites.length)
)

writeJsonFile('./src/auto-domains.json', compact(sorted))
  .then(() => process.exit())
  .catch(err => console.log(err))
