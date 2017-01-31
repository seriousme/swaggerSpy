// app.js

var appData = {
  swaggerSpec: {},
  rawData: {},
  showSpec: true
}
var app = new Vue({

  // We want to target the div with an id of 'events'
  el: '#swaggerSpy',

  // Here we can register any values or collections that hold data
  // for the application
  data: appData,

  // Methods we want to use in our application are registered here
  methods: {
    fetchSwagger: function () {
      this.$http.get('/api/swagger').then((response) => {
        appData.swaggerSpec = response.body
      }, (response) => {
        // error callback
        doNotify('danger', 'Failed to fetch Swagger spec')
      })
    },
    fetchRaw: function () {
      this.$http.get('/api/raw').then((response) => {
        appData.rawData = response.body
      }, (response) => {
        // error callback
        doNotify('danger', 'Failed to fetch raw data')
      })
    },
    toggleShowSpec: function () {
      app.showSpec = !app.showSpec
    },
    reset: function (request) {
      this.$http.get('/api/reset').then((response) => {
        app.fetchSwagger()
        app.fetchRaw()
        doNotify('info', 'Succesfully emptied trace data ')
      }, (response) => {
        // error callback
        doNotify('danger', 'Failed to empty trace data')
      })
    },
    loadDemoData: function (request) {
      this.$http.get('/api/loadDemoData').then((response) => {
        app.fetchSwagger()
        app.fetchRaw()
        doNotify('info', 'Succesfully loaded demo data ')
      }, (response) => {
        // error callback
        doNotify('danger', 'Failed to load demo data')
      })
    }
  }
})

function dateSince (date) {
  var seconds = Math.floor((new Date() - date) / 1000)

  var interval = Math.floor(seconds / 31536000)

  if (interval > 1) {
    return interval + ' years'
  }
  interval = Math.floor(seconds / 2592000)
  if (interval > 1) {
    return interval + ' months'
  }
  interval = Math.floor(seconds / 86400)
  if (interval > 1) {
    return interval + ' days'
  }
  interval = Math.floor(seconds / 3600)
  if (interval > 1) {
    return interval + ' hours'
  }
  interval = Math.floor(seconds / 60)
  if (interval > 1) {
    return interval + ' minutes'
  }
  return Math.floor(seconds) + ' seconds'
}

function doNotify (type, txt) {
  $.notify({
    // options
    message: txt
  }, {
    // settings
    element: 'body',
    type: type,
    mouse_over: 'pause',
    delay: 3000,
    placement: {
      from: 'top',
      align: 'center'
    }
  })
}

app.fetchSwagger()
app.fetchRaw()

setInterval(() => {
  app.fetchSwagger()
  app.fetchRaw()
}, 5000)
