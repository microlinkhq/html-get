'use strict'

const { pdfToHtml } = require('../..')

const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-lang')(),
  require('metascraper-logo')(),
  require('metascraper-manifest')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-url')()
])

const scrapePdf = async (pdf, url) => metascraper({ url, html: await pdfToHtml(pdf, url) })

module.exports = { metascraper, scrapePdf }
