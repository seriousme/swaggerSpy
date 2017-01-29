const sourcePort = process.env.SPY_PORT || 8080
const Target = process.env.SPY_TARGET || 'http://127.0.0.1:80'

var nockDB = []
//
// Create a proxy server with custom application logic
//
var proxy = require('express-http-proxy')
var app = require('express')()
var nock = require('nock')

// store the recorded object in the datastore
function store (obj) {
  // console.log("Logging obj", JSON.stringify(obj))
  // const resHeaders = obj.rawHeaders.
  nockDB.push(obj)
}

// switch on recording,
// recording is only performed on calls initiated by node.js
nock.recorder.rec({
  output_objects: true,
  enable_reqheaders_recording: true,
  logging: store,
  use_separator: false
})

// get the database of recorded items
app.use('/swaggerSpy/get', function (req, res, next) {
  res.end(JSON.stringify(nockDB))
// next()
})

// clear the database
app.use('/swaggerSpy/reset', function (req, res, next) {
  nockDB = []
  res.end('[]')
// next()
})

// put req stream into the body so we can pick it up later
// app.use(function(req, res, next) {
//       var received = []
//       req.on('data', function onData(chunk) {
//         if (!chunk) { return; }
//         received.push(chunk)
//       })
//       req.on('end', function onEnd() {
//         req.body= Buffer.concat(received).toString('utf8')
//         next()
//       })
//     })

// application/x-www-form-urlencoded

app.use('/', proxy(Target))

console.log(`listening on port ${sourcePort} and proxying to ${Target}`)
app.listen(sourcePort)
