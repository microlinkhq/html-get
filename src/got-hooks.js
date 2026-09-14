'use strict'

const https = require('https')
const http = require('http')

const ALREADY_FINISHED = 'ERR_STREAM_ALREADY_FINISHED'

// Node.js 24.20 (nodejs/node#64847) calls `ClientRequest#end` callbacks with
// the error that prevented the flush. got@11 emits it while a retry is
// scheduled, settling the promise early and leaving the retried request
// without an error listener. The socket error still reaches got through the
// request 'error' event, so the callback keeps its previous contract.
const callOnFinish = onEnd => error => {
  if (!error) return onEnd()
  if (error.code === ALREADY_FINISHED) onEnd(error)
}

const wrapEnd = request => {
  const end = request.end
  request.end = function (...args) {
    const lastIndex = args.length - 1
    if (typeof args[lastIndex] === 'function') {
      args[lastIndex] = callOnFinish(args[lastIndex])
    }
    return end.apply(this, args)
  }
  return request
}

const restoreEndCallback = options => {
  if (options.request || options.http2) return
  const { request } = options.url.protocol === 'https:' ? https : http
  options.request = (...args) => wrapEnd(request(...args))
}

module.exports = { restoreEndCallback, wrapEnd }
