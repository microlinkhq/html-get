'use strict'

const { URL } = require('url')
const getHTML = require('..')

getHTML(new URL(process.argv[2]).toString())
  .then(({ html }) => {
    console.log(html)
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
