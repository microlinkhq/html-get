'use strict'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const TOP_MARGIN = 72
const LEFT_MARGIN = 72
const FIRST_IMAGE_OBJECT = 7
const MASK_ROW_PATTERN = ['00', 'ff']

const escapeText = text => text.replace(/([\\()])/g, '\\$1')

const toStream = lines => {
  let cursor = PAGE_HEIGHT - TOP_MARGIN
  const operations = []

  for (const { text, size = 10, gap = 6 } of lines) {
    cursor -= size + gap
    operations.push(
      `BT /F1 ${size} Tf ${LEFT_MARGIN} ${cursor.toFixed(2)} Td (${escapeText(text)}) Tj ET`
    )
  }

  return operations.join('\n')
}

const toHex = byte => byte.toString(16).padStart(2, '0')

const imageSamples = ({ width, height, color, mask }) => {
  if (mask) {
    const rowBytes = Math.ceil(width / 8)
    return Array.from({ length: height }, (_, row) =>
      MASK_ROW_PATTERN[row % MASK_ROW_PATTERN.length].repeat(rowBytes)
    ).join('')
  }
  return color
    .map(toHex)
    .join('')
    .repeat(width * height)
}

const imageObject = image => {
  const samples = `${imageSamples(image)}>`
  const format = image.mask
    ? '/ImageMask true /BitsPerComponent 1'
    : '/ColorSpace /DeviceRGB /BitsPerComponent 8'
  return `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ${format} /Filter /ASCIIHexDecode /Length ${samples.length} >>\nstream\n${samples}\nendstream`
}

const paintImages = images =>
  images.map(
    ({ width, height }, index) =>
      `q ${width} 0 0 ${height} ${LEFT_MARGIN} ${TOP_MARGIN} cm /Im${index} Do Q`
  )

/**
 * Builds a one page PDF out of `{ text, size }` lines, plus optional
 * `{ width, height, color: [r, g, b] }` images or `{ width, height, mask: true }`
 * image masks, so tests exercise the real parser without committing binaries
 * to the repository.
 */
const createPdf = (lines, { info = {}, images = [] } = {}) => {
  const stream = [toStream(lines), ...paintImages(images)].join('\n')
  const xobjects = images
    .map((_, index) => `/Im${index} ${FIRST_IMAGE_OBJECT + index} 0 R`)
    .join(' ')
  const infoEntries = Object.entries(info)
    .map(([key, value]) => `/${key} (${escapeText(String(value))})`)
    .join(' ')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R >> /XObject << ${xobjects} >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< ${infoEntries} >>`,
    ...images.map(imageObject)
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []

  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const startxref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R /Info 6 0 R >>\nstartxref\n${startxref}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

module.exports = { createPdf }
