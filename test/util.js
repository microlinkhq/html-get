'use strict'

const pretty = require('pretty')

module.exports = {
  prettyHtml: html => pretty(html, { ocd: true })
}
