const url = require('url')
const data = require('./testdata.json')

// console.log(data[0])

const GenerateSchema = require('generate-schema')
var operationIdSuffix = 0

// turn an array of keys and values into an object
// make keys lowercase
function kvArray2object (arr) {
  const obj = {}
  for (var i = 0; i < arr.length; i += 2) {
    obj[arr[i].toLowerCase()] = arr[i + 1]
  }
  return obj
}
// parse the nock database into an intermediate structure
// optimized for generation
function parseNock (nDb) {
  var intermediate = {}
  nDb.forEach(req => {
    const urlObj = url.parse(req.scope)
    const host = urlObj.host
    const scheme = (urlObj.protocol.replace(':', ''))
    if (typeof (intermediate[host]) === 'undefined') {
      intermediate[host] = { schemes: {}, paths: {} }
    }
    const scope = intermediate[host]
    scope.schemes[scheme] = true
    if (typeof (scope.paths[req.path]) === 'undefined') {
      scope.paths[req.path] = {}
    }
    const path = scope.paths[req.path]
    if (typeof (path[req.method]) === 'undefined') {
      path[req.method] = []
    }
    path[req.method].push({
      request: {
        headers: req.reqheaders,
        body: req.body
      },
      response: {
        status: req.status,
        headers: kvArray2object(req.rawHeaders),
        body: req.response
      }
    })
  })
  // console.log('intermediate', JSON.stringify(intermediate, null, 2))
  return intermediate
}

// generate swagger spec from intermediate object

// find common basePath from an array of paths
function findBasePath (paths) {
  const sep = '/'
  if (paths.length < 2) return ''
  var prefix = paths[0]
  var maxLength = prefix.length
  for (var i = 0; i < paths.length; i++) {
    var lastSep = -1
    for (var j = 0; j < maxLength; j++) {
      var matchChar = paths[i].charAt(j)
      if (matchChar === sep) {
        lastSep = j
      }
      if (matchChar !== prefix.charAt(j)) {
        maxLength = lastSep
      }
      if (maxLength < 0) {
        return ''
      }
    }
  }
  return prefix.substr(0, maxLength)
}

// turn things like 'text/plain; charset=utf-8' into 'text/plain'
function stripContentType (type) {
  if (typeof (type) !== 'undefined') {
    const items = type.split(/(?:;|,)/g)
    return items[0].trim()
  }
}

// fetch array of content types from array of call data
function getContentTypes (data, type) {
  var types = {}
  for (var i = 0; i < data.length; i++) {
    types[ stripContentType(data[i][type].headers['content-type']) ] = true
  }
  return Object.keys(types)
}

// generate parameters for the operation
function generateParameters (swagger, data, contentTypes) {
  swagger.parameters = []
  // handle application/json
  if ((typeof (contentTypes) === 'object') && (contentTypes[0] === 'application/json')) {
    // gather all body data for this path
    const reqData = data.map(el => {
      return el.request.body
    }).filter(el => { return (typeof (el) === 'object') })
    // create the schema
    const schema = GenerateSchema.json(reqData)
    // and create the parameters section
    swagger.parameters.push({
      'name': 'Generated parameter name',
      'in': 'body',
      'description': 'Generated parameter description',
      'required': true,
      'schema': schema.items
    })
  }
}

// generate responses for the operation
function generateResponses (swagger, data) {
  swagger.responses = {}
  var byStatus = {}
  // group responses by status code
  for (var i = 0; i < data.length; i++) {
    const status = data[i].response.status
    const body = data[i].response.body
    if (typeof (byStatus[status]) === 'undefined') {
      byStatus[status] = {
        type: data[i].response.headers['content-type']
      }
    }
    if ((typeof (body) === 'object') && (Object.keys(body).length > 0)) {
      if (typeof (byStatus[status].data) === 'undefined') {
        byStatus[status].data = []
      }
      byStatus[status].data.push(body)
    }
  }

  // add the responses to the swagger spec
  for (var status in byStatus) {
    swagger.responses[status] = {
      'description': 'Generated description'
    }
    // handle application/json payload
    if (typeof (byStatus[status].data) === 'object') {
      const schema = GenerateSchema.json(byStatus[status].data)
      swagger.responses[status].schema = schema.items
    }
  }
}

// generate the method section of the spec (e.g. 'get','post' etc)
function generateMethod (swagger, method, methodInfo) {
  if (typeof (swagger[method]) === 'undefined') {
    swagger[method] = {}
  }
  var thisMethod = swagger[method]
  // add description & operationId
  thisMethod.description = 'Generated description'
  thisMethod.operationId = 'GeneratedOperationId' + operationIdSuffix++
  // add  produces and consumes
  const consumes = getContentTypes(methodInfo, 'request')
  const produces = getContentTypes(methodInfo, 'response')
  if (typeof (consumes) === 'object') {
    thisMethod.consumes = consumes
  }
  if (typeof (produces) === 'object') {
    thisMethod.produces = produces
  }
  // add parameters
  generateParameters(thisMethod, methodInfo, consumes)
  // add responses
  generateResponses(thisMethod, methodInfo)
}

// generate the path section of the spec (e.g. '/v1/api/pets' etc)
function generatePath (swagger, path, pathInfo) {
  if (typeof (swagger[path]) === 'undefined') {
    swagger[path] = {}
  }
  for (var method in pathInfo) {
    generateMethod(swagger[path], method.toLowerCase(), pathInfo[method])
  }
}

// generate all the paths
function generatePaths (swagger, pathsInfo) {
  // find basePath first
  const basePath = findBasePath(Object.keys(pathsInfo))
  if (basePath !== '') {
    swagger.basePath = basePath
  }
  if (typeof (swagger.paths) === 'undefined') {
    swagger.paths = {}
  }
  for (var path in pathsInfo) {
    // generate path component and remove the basePath if present
    generatePath(swagger.paths, path.replace(basePath, ''), pathsInfo[path])
  }
}

// generate the swagger specification based on the template and
// the intermediate structure
function generateSwagger (intermediate) {
  // console.log(JSON.stringify(intermediate, null, 2))
  var swagger = require('./template.json')
  for (var host in intermediate) {
    swagger.host = host
    swagger.schemes = Object.keys(intermediate[host].schemes)
    generatePaths(swagger, intermediate[host].paths)
  }
  return swagger
}

const swagger = generateSwagger(parseNock(data))
console.log(JSON.stringify(swagger, null, 2))
