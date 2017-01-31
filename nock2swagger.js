const Url = require('url')

const SwaggerTemplate = require('./template.json')
// console.log(data[0])

const GenerateSchema = require('generate-schema')
var operationIdSuffix

// turn an array of keys and values into an object
// make keys lowercase
function kvArray2object (arr) {
  const obj = {}
  for (var i = 0; i < arr.length; i += 2) {
    obj[arr[i].toLowerCase()] = arr[i + 1]
  }
  return obj
}

// small helper to see if an object is empty
function isValidObject (obj) {
  if (typeof (obj) !== 'object') {
    return false
  }
  return (Object.keys(obj).length > 0)
}

// parse the nock database into an intermediate structure
// optimized for generation
function parseNock (nDb) {
  var intermediate = {}
  nDb.forEach(req => {
    const urlObj = Url.parse(req.scope)
    const host = urlObj.host
    const scheme = (urlObj.protocol.replace(':', ''))
    if (typeof (intermediate[host]) === 'undefined') {
      intermediate[host] = { schemes: {}, paths: {} }
    }
    const scope = intermediate[host]
    scope.schemes[scheme] = true
    const pathObj = Url.parse(req.path, true)
    req.pathname = pathObj.pathname
    if (!isValidObject(scope.paths[req.pathname])) {
      scope.paths[req.pathname] = {}
    }
    const path = scope.paths[req.pathname]
    if (!isValidObject(path[req.method])) {
      path[req.method] = []
    }
    const data = {
      request: {
        headers: req.reqheaders,
        body: req.body
      },
      response: {
        status: req.status,
        headers: kvArray2object(req.rawHeaders),
        body: req.response
      }
    }
    if (typeof (req.response.status) !== 'undefined') {
      data.response.status = req.response.status
    }
    if (isValidObject(pathObj.query)) {
      data.request.query = pathObj.query
    }
    path[req.method].push(data)
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
  var maxLength = prefix.length - 1
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
    const contentType = stripContentType(data[i][type].headers['content-type'])
    if (typeof (contentType) === 'string') {
      types[contentType] = true
    }
  }
  return Object.keys(types)
}

// generate parameters for the operation
function generateParameters (swagger, data, contentTypes) {
  // gather info
  const reqQuery = data.map(el => {
    return el.request.query
  }).filter(el => { return isValidObject(el) })
  // handle query parameters
  if (isValidObject(reqQuery)) {
    const schema = GenerateSchema.json(reqQuery).items.properties
    swagger.parameters = []
    for (var item in schema) {
      const type = schema[item].type
      swagger.parameters.push({
        'name': item,
        'in': 'query',
        'type': type,
        'description': 'Generated parameter description',
        'required': false
      })
    }
    return
  }
  // handle application/json
  if (isValidObject(contentTypes) && (contentTypes[0] === 'application/json')) {
    // gather all body data for this path
    const reqData = data.map(el => {
      return el.request.body
    }).filter(el => { return isValidObject(el) })
    // create the schema
    const schema = GenerateSchema.json(reqData)
    // and create the parameters section
    swagger.parameters = []
    swagger.parameters.push({
      'name': 'Generated parameter name',
      'in': 'body',
      'description': 'Generated parameter description',
      'required': false,
      'schema': schema.items
    })
    return
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
    if (!isValidObject(byStatus[status])) {
      byStatus[status] = {
        type: data[i].response.headers['content-type']
      }
    }
    if (isValidObject(body)) {
      if (!isValidObject(byStatus[status].data)) {
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
    if (isValidObject(byStatus[status].data)) {
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
  if (isValidObject(consumes)) {
    thisMethod.consumes = consumes
  }
  if (isValidObject(produces)) {
    thisMethod.produces = produces
  }
  // add parameters
  generateParameters(thisMethod, methodInfo, consumes)
  // add responses
  generateResponses(thisMethod, methodInfo)
}

// generate the path section of the spec (e.g. '/v1/api/pets' etc)
function generatePath (swagger, path, pathInfo) {
  if (!isValidObject(swagger[path])) {
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
  // require() caches its data, so we need to deep clone the template here
  var swagger = JSON.parse(JSON.stringify(SwaggerTemplate))
  // add more content to the template
  for (var host in intermediate) {
    swagger.host = host
    swagger.schemes = Object.keys(intermediate[host].schemes)
    generatePaths(swagger, intermediate[host].paths)
  }
  return swagger
}

function generate (data) {
  operationIdSuffix = 0
  return generateSwagger(parseNock(data))
}

module.exports = { generate: generate }
