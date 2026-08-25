#!/usr/bin/env node
// Simple script to start BullionAI API server
const http = require('http');

const port = 8787;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (req.url === '/health') {
    res.end(JSON.stringify({ ok: true, service: 'BullionAI API', port }));
  } else {
    res.end(JSON.stringify({ status: 'running' }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('BullionAI API running at http://localhost:' + port);
  console.log('Health check: http://localhost:' + port + '/health');
  console.log('Candles: http://localhost:' + port + '/api/candles?timeframe=60m');
});