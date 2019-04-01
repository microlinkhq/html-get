'use strict'

const { compact, reduce, findIndex } = require('lodash')
const { getDomain, getPublicSuffix } = require('tldts')
const writeJsonFile = require('write-json-file')
const topsites = require('top-sites')

const getDomainWithoutSuffix = url => {
  const suffix = getPublicSuffix(url)
  const domain = getDomain(url)
  return suffix ? domain.replace(`.${suffix}`, '') : domain
}

const domains = require('./src/auto-domains')

const sorted = reduce(
  domains,
  (acc, domain) => {
    const index = findIndex(topsites, topsite => getDomainWithoutSuffix(topsite.url) === domain)
    acc[index] = domain
    return acc
  },
  new Array(topsites.length)
)

writeJsonFile('./src/auto-domains.json', compact(sorted))
  .then(() => process.exit())
  .catch(err => console.log(err))
