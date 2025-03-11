'use strict'

const { randomBytes } = require('crypto')
const PDFDocument = require('pdfkit')
const bytes = require('bytes-iec')
const path = require('path')
const fs = require('fs')

function generatePdf (filename, filesize) {
  const doc = new PDFDocument()
  const filepath = path.join(__dirname, 'fixtures', filename)
  const stream = fs.createWriteStream(filepath)
  doc.pipe(stream)

  // adjust base64 overheard
  const size = bytes.format(Math.floor(filesize * 0.55))
  const randomData = randomBytes(bytes(size)).toString('base64')

  doc.text(randomData, {
    width: 410,
    align: 'left'
  })

  doc.end()

  stream.on('finish', () => console.log(filename))
}

const sizes = [...Array(10).keys()]
  .map(index => {
    const base = (index + 1) * 100
    const filename = bytes.format(base * 1000).toLowerCase()
    const filesize = bytes(`${base}KB`)
    return { filename, filesize }
  })
  .concat([
    { filename: '5mb', filesize: bytes('5MB') },
    { filename: '10mb', filesize: bytes('10MB') },
    { filename: '20mb', filesize: bytes('20MB') }
  ])

for (const { filename, filesize } of sizes) {
  generatePdf(`${filename}.pdf`, filesize)
}
