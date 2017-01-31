const n2s = require('../nock2swagger')
const data = require('./heroku-petstore-test.json')
console.log(JSON.stringify(n2s.generate(data), null, 2))
