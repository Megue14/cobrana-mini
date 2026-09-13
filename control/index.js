'use strict';

const http = require('node:http');
const { handleRequest } = require('./routes');

const PORT = process.env.CONTROL_PORT || 3001;

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`[control]  internal API on http://localhost:${PORT}`);
});

module.exports = server;
