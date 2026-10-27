'use strict'

const { spawnSync } = require('child_process')
const { writeFileSync } = require('fs')
const { join } = require('path')

const { extractPdf } = require('..')
const addHtml = require('../src/html')

const RUNS = 7
const PAGE_BYTES = 1_000_000
const PAGE_URL = 'https://example.com/blog/post'
const PDF_URL = 'https://example.com/reports/benchmark-report.pdf'
const PDF_PAGES = 3
const PDF_LINES_PER_PAGE = 48
const HTML_ITERATIONS = 2
const PDF_ITERATIONS = 20
const REQUIRE_ITERATIONS = 1
const ROOT = join(__dirname, '..')

const HEADERS = { 'content-type': 'text/html; charset=utf-8' }

const WORDS = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'sed',
  'tempor',
  'incididunt',
  'labore',
  'magna',
  'aliqua',
  'veniam',
  'nostrud'
]

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const sentence = (seed, length) =>
  Array.from({ length }, (_, index) => WORDS[(seed * 7 + index * 3) % WORDS.length]).join(' ')

const createSection = index =>
  `<section id="s${index}" style="background-image: url(/static/bg-${index}.png)">` +
  `<h2>${sentence(index, 5)}</h2>` +
  `<p>${sentence(index, 40)} <a href="/article/${index}">${sentence(index + 1, 3)}</a> ` +
  `<a href="https://cdn.example.org/${index}">${sentence(index + 2, 2)}</a> ` +
  `<a href="#s${index}">anchor</a> <a href="mailto:team${index}@example.com">mail</a></p>` +
  `<img src="/static/${index}.jpg" alt="${sentence(index + 3, 3)}">` +
  `<iframe src="/embed/${index}"></iframe>` +
  `<form action="/submit/${index}"><input type="image" src="/static/btn-${index}.png"></form>` +
  `<video poster="/static/poster-${index}.jpg"><source src="/media/${index}.mp4"></video>` +
  `<blockquote cite="/quotes/${index}">${sentence(index + 4, 12)}</blockquote>` +
  '</section>\n'

const createPage = bytes => {
  const head =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<title>Benchmark page</title>' +
    '<meta name="og:title" content="Benchmark page">' +
    '<meta property="description" content="A deterministic benchmark page">' +
    '<link rel="stylesheet" href="/static/main.css">' +
    '<script src="/static/main.js"></script>' +
    '<style>body { background: url(/static/body.png) } .hero { background: url("/static/hero.png") }</style>' +
    '</head><body>'
  const sections = []
  let size = head.length
  for (let index = 0; size < bytes; index++) {
    const section = createSection(index)
    sections.push(section)
    size += section.length
  }
  return `${head}${sections.join('')}</body></html>`
}

const escapePdfText = text => text.replace(/[\\()]/g, match => `\\${match}`)

const createPdfPage = pageIndex => {
  const lines = [
    [20, 'Benchmark Report'],
    [12, 'Jane Doe and John Smith'],
    ...Array.from({ length: PDF_LINES_PER_PAGE }, (_, line) => [
      11,
      `Paragraph ${pageIndex}.${line} ${sentence(pageIndex + line, 12)}.`
    ])
  ]
  const operators = lines.map(([size, text]) => `/F1 ${size} Tf (${escapePdfText(text)}) Tj T*`)
  return ['BT', '14 TL', '72 760 Td', ...operators, 'ET'].join('\n')
}

const createPdf = pageCount => {
  const objects = []
  const add = body => objects.push(body)
  const catalogId = add(null)
  const pagesId = add(null)
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pageIds = Array.from({ length: pageCount }, (_, pageIndex) => {
    const content = createPdfPage(pageIndex)
    const streamId = add(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
    )
    return add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`
    )
  })
  const infoId = add(
    '<< /Title (Benchmark Report) /Author (Jane Doe) /Subject (A deterministic benchmark document) >>'
  )
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] ` +
    `/Count ${pageIds.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, index) => {
    const offset = Buffer.byteLength(pdf)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xrefOffset = Buffer.byteLength(pdf)
  const xref = offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xref}` +
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const renderHtml = (html, rewriteUrls) =>
  addHtml({ html, url: PAGE_URL, headers: HEADERS, rewriteUrls }).html()

const assertRewritten = html => {
  assert(html.includes('href="https://example.com/article/0"'), 'relative link not rewritten')
  assert(html.includes('url(https://example.com/static/bg-0.png)'), 'css url not rewritten')
}

const assertUntouched = html => {
  assert(html.includes('href="/article/0"'), 'relative link was rewritten')
  assert(html.includes('<link rel="canonical"'), 'head not added')
}

const spawnNode = code => {
  const started = process.hrtime.bigint()
  const { status, stderr } = spawnSync(process.execPath, ['-e', code])
  const wall = Number(process.hrtime.bigint() - started) / 1e6
  assert(status === 0, `node -e failed: ${stderr}`)
  return wall
}

const coldRequire = () => {
  const baseline = spawnNode('0')
  const loaded = spawnNode(`require(${JSON.stringify(ROOT)})`)
  return loaded - baseline
}

const measure = async entry => {
  const walls = []
  let errors = 0
  await entry.run(1)
  for (let run = 0; run < RUNS; run++) {
    try {
      const started = process.hrtime.bigint()
      const wall = await entry.run(entry.iterations)
      walls.push(wall ?? Number(process.hrtime.bigint() - started) / 1e6)
    } catch (error) {
      errors++
      console.error(`${entry.name} run ${run}`, error)
    }
  }
  return { walls, errors }
}

const fmt = value => value.toFixed(1)

const report = (entry, { walls, errors }) => {
  const med = walls.length ? median(walls) : Number.NaN
  const min = walls.length ? Math.min(...walls) : Number.NaN
  const max = walls.length ? Math.max(...walls) : Number.NaN
  const extra = `work ${entry.iterations} ${entry.work}, errors ${errors}, runs ${RUNS}`
  console.log(`${entry.name}  median ${fmt(med)}ms  range ${fmt(min)}-${fmt(max)}  ${extra}`)
  return {
    name: entry.name,
    unit: 'ms',
    value: Number(fmt(med)),
    range: `${fmt(min)}-${fmt(max)}`,
    extra
  }
}

const createCases = () => {
  const page = createPage(PAGE_BYTES)
  const pdf = createPdf(PDF_PAGES)
  const pageWork = `renders of ${page.length} html chars`

  return [
    {
      name: 'html rewriteUrls off',
      iterations: HTML_ITERATIONS,
      work: pageWork,
      run: iterations => {
        for (let i = 0; i < iterations; i++) {
          assertUntouched(renderHtml(page, false))
        }
      }
    },
    {
      name: 'html rewriteUrls on',
      iterations: HTML_ITERATIONS,
      work: pageWork,
      run: iterations => {
        for (let i = 0; i < iterations; i++) {
          assertRewritten(renderHtml(page, true))
        }
      }
    },
    {
      name: 'pdf extract',
      iterations: PDF_ITERATIONS,
      work: `extractions of a ${pdf.length} byte ${PDF_PAGES} page pdf`,
      run: async iterations => {
        for (let i = 0; i < iterations; i++) {
          const meta = await extractPdf({ url: PDF_URL, pdf })
          assert(meta.title === 'Benchmark Report', `title ${meta.title}`)
          assert(meta.author === 'Jane Doe', `author ${meta.author}`)
        }
      }
    },
    {
      name: 'cold require',
      iterations: REQUIRE_ITERATIONS,
      work: 'node spawns minus a node -e 0 baseline',
      run: () => coldRequire()
    }
  ]
}

const main = async () => {
  const results = []
  let errors = 0
  for (const entry of createCases()) {
    let measured
    try {
      measured = await measure(entry)
    } catch (error) {
      console.error(`${entry.name} warmup`, error)
      measured = { walls: [], errors: 1 }
    }
    errors += measured.errors
    results.push(report(entry, measured))
  }
  writeFileSync(join(ROOT, 'benchmark-output.json'), JSON.stringify(results, null, 2) + '\n')
  if (errors > 0 || results.some(result => !Number.isFinite(result.value))) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
