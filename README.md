# swaggerSpy
HTTP proxy to generate swagger spec from an existing API

## How it works
- 1 Start swaggerSpy and point it to an existing API (e.g. swagger.io's petstore demo) - 
- 2 Point an API client (e.g. a browser or a cmdline client) to the swaggerSpy proxy
- 3 Have the API client execute a number of actions
- 4 Point a browser to the swaggerSpy controller and see the generated Swagger specification

## Disclaimer
- swaggerSpy can't identify hidden information, e.g. if your path contains /pets/{petname} then swaggerSpy currently has no way to figure out that the last part is a variable.
- swaggerSpy is still experimental, if you find cases where you think spec generation could be improved please submit a pull request or raise an issue and attach the trace data whcih can be obtained via the help menu of the controller.







