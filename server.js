const spyPort = process.env.SPY_PORT || 8080
const ctrlPort = process.env.SPY_CTRL_PORT || 8081
const Target = process.env.SPY_TARGET || 'http://127.0.0.1:80'

//
// Create a proxy server with custom application logic
//

const proxy = require('express-http-proxy')
const express = require('express')
const cors = require('cors')
const app = express()
const proxyApp = express()
const nock = require('nock')
const path = require('path')
const n2s = require('./nock2swagger')

var nockDB = []

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
app.use('/api/raw', function (req, res, next) {
  res.send(nockDB)
// next()
})

app.use('/api/swagger', function (req, res, next) {
  res.send(n2s.generate(nockDB))
// next()
})

// clear the database
app.use('/api/reset', function (req, res, next) {
  nockDB = []
  res.send()
// next()
})

// load demodata
app.use('/api/loadDemoData', function (req, res, next) {
  const demoData = require('./testdata.json')
  nockDB = JSON.parse(JSON.stringify(demoData))
  res.send()
// next()
})

app.use('/', express.static(path.join(__dirname, 'public')))

console.log(`swaggerSpy controller listening on port ${ctrlPort}`)
app.listen(ctrlPort)

proxyApp.use(cors())
proxyApp.use('/', proxy(Target))
console.log(`swaggerSpy proxy listening on port ${spyPort} and proxying to ${Target}`)
proxyApp.listen(spyPort)
