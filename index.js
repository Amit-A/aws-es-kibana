#!/usr/bin/env node

const AWS = require('aws-sdk');
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');
const stream = require('stream');
const basicAuth = require('basic-auth-connect');
const compression = require('compression');

const yargs = require('yargs')
  .usage('usage: $0 [options] <aws-es-cluster-endpoint>')
  .option('b', {
    alias: 'bind-address',
    default: process.env.BIND_ADDRESS || '127.0.0.1',
    demand: false,
    describe: 'the ip address to bind to',
    type: 'string'
  })
  .option('p', {
    alias: 'port',
    default: process.env.PORT || 9200,
    demand: false,
    describe: 'the port to bind to',
    type: 'number'
  })
  .option('r', {
    alias: 'region',
    default: process.env.REGION,
    demand: false,
    describe: 'the region of the Elasticsearch cluster',
    type: 'string'
  })
  .option('u', {
    alias: 'user',
    default: process.env.USER,
    demand: false,
    describe: 'the username to access the proxy'
  })
  .option('a', {
    alias: 'password',
    default: process.env.PASSWORD,
    demand: false,
    describe: 'the password to access the proxy'
  })
  .option('H', {
    alias: 'health-path',
    default: process.env.HEALTH_PATH,
    demand: false,
    describe: 'URI path for health check',
    type: 'string'
  })
  .option('l', {
    alias: 'limit',
    default: process.env.LIMIT || '10mb',
    demand: false,
    describe: 'request limit'
  })
  .help()
  .version()
  .strict();

const argv = yargs.argv;
const BIND_ADDRESS = argv.b;
const PORT = argv.p;
const REQ_LIMIT = argv.l;
const ENDPOINT = process.env.ENDPOINT || argv._[0];
let REGION = argv.r;
let TARGET = process.env.ENDPOINT || argv._[0];

if (!ENDPOINT) {
  yargs.showHelp();
  process.exit(1);
}

// Try to infer the region if it is not provided as an argument.
if (!REGION) {
  const m = ENDPOINT.match(/\.([^.]+)\.es\.amazonaws\.com\.?$/);
  if (m) {
    REGION = m[1];
  } else {
    console.error(`
      Region cannot be parsed from endpoint address.
      Either the endpoint must end in .<region>.es.amazonaws.com or --region should be provided as an argument.
    `);
    yargs.showHelp();
    process.exit(1);
  }
}

if (!TARGET.match(/^https?:\/\//)) {
  TARGET = 'https://' + TARGET;
}

let credentials;
const chain = new AWS.CredentialProviderChain();
chain.resolve(function (err, resolved) {
  if (err) {
    throw err;
  } else {
    credentials = resolved;
  }
});

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  secure: true
});

const app = express();

app.use(compression());

if (argv.u && argv.a) {
  app.use(basicAuth(argv.u, argv.a));
}

app.use(bodyParser.raw({
  limit: REQ_LIMIT,
  type: function () { return true; }
}));

app.use(function (req, res, next) {
  return credentials.get(function (err) {
    if (err) {
      return next(err);
    }
    return next();
  });
});

if (argv.H) {
  app.get(argv.H, function (req, res) {
    res.setHeader('Content-Type', 'text/plain');
    res.send('ok');
  });
}

app.use(function (req, res) {
  let bufferStream;
  if (Buffer.isBuffer(req.body)) {
    bufferStream = new stream.PassThrough();
    bufferStream.end(req.body);
  }
  proxy.web(req, res, { buffer: bufferStream });
});

proxy.on('proxyReq', function (proxyReq, req) {
  const endpoint = new AWS.Endpoint(ENDPOINT);
  const request = new AWS.HttpRequest(endpoint);
  request.method = proxyReq.method;
  request.path = proxyReq.path;
  request.region = REGION;
  if (Buffer.isBuffer(req.body)) {
    request.body = req.body;
  }
  if (!request.headers) {
    request.headers = {};
  }
  request.headers['presigned-expires'] = false;
  request.headers['Host'] = endpoint.hostname;
  const signer = new AWS.Signers.V4(request, 'es');
  signer.addAuthorization(credentials, new Date());
  proxyReq.setHeader('Host', request.headers['Host']);
  proxyReq.setHeader('X-Amz-Date', request.headers['X-Amz-Date']);
  proxyReq.setHeader('Authorization', request.headers['Authorization']);
  if (request.headers['x-amz-security-token']) {
    proxyReq.setHeader('x-amz-security-token', request.headers['x-amz-security-token']);
  }
});

proxy.on('proxyRes', function (proxyReq, req, res) {
  if (req.url.match(/\.(css|js|img|font)/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
});

http.createServer(app).listen(PORT, BIND_ADDRESS);

console.log('* * * aws-es-proxy * * *');
console.log(`AWS ES cluster available at http://${BIND_ADDRESS}:${PORT}`);
console.log(`Kibana available at http://${BIND_ADDRESS}:${PORT}/_plugin/kibana/`);
if (argv.H) {
  console.log(`Health endpoint enabled at http://${BIND_ADDRESS}:${PORT}${argv.H}`);
}
