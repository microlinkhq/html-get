'use strict'

const { getDomain, getPublicSuffix } = require('tldts')
const mem = require('mem')

const getDomainWithoutSuffix = mem(url => {
  const suffix = getPublicSuffix(url)
  const domain = getDomain(url)
  return suffix ? domain.replace(`.${suffix}`, '') : domain
})

module.exports = { getDomainWithoutSuffix }
