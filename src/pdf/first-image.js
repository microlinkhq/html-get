'use strict'

const MAX_IMAGE_PAGES = 20
const IMAGE_SRC = /<img\b[^>]*?\ssrc="(data:[^"]+)"/

const imageOf = html => IMAGE_SRC.exec(html)?.[1].replace(/\s+/g, '')

const firstImage = async (
  filepath,
  { mutool, convertOpts, signal, maxPages = MAX_IMAGE_PAGES }
) => {
  for (let page = 1; page <= maxPages && !signal.aborted; page++) {
    const { stdout } = await mutool(`${filepath} ${page}`, convertOpts())
    if (!stdout.includes(`<div id="page${page}"`)) return
    const image = imageOf(stdout)
    if (image) return image
  }
}

module.exports = { firstImage, MAX_IMAGE_PAGES }
