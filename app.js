const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const net = require('net');
const PORT = process.env.PORT || 8088;
const { v4: uuidv4 } = require('uuid');

// MongoDB
const blackPool = ["stratum-mining-pool.zapto.org"];

// App
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const queue = {};

// Client
class Client {
  conn;
  ws;
  uid;

  constructor(host, port, ws) {
    this.conn = net.createConnection(port, host);
    this.ws = ws;
    this.uid = uuidv4();

    console.log(`Client [${this.uid}] is connected!`);

    this.initSender();
    this.initReceiver();
  }

  initSender = () => {
    this.ws.on('message', (cmd) => {
      try {
        const command = JSON.parse(cmd);
        const method = command.method;;
        if (method === 'mining.extranonce.subscribe' || method === 'mining.subscribe' || method === 'mining.authorize' || method === 'mining.submit') {
          this.conn.write(cmd);
        }
      } catch (error) {
        console.log(`[Error][INTERNAL] ${error}`);
        this.ws.close();
      }
    });

    this.ws.on('close', () => {
      this.conn.end();
    });
  }
  
  initReceiver = () => {
    this.conn.on('data', (data) => {
      this.ws.send(data.toString());
    });

    this.conn.on('end', () => {
      this.ws.close();
    });

    this.conn.on('error', (err) => {
      this.conn.end();
    });
  }
}

// Proxy
async function proxyMain(ws, req) {
  ws.on('message', (message) => {
    const command = JSON.parse(message);

    if (command.method === 'proxy.connect' && command.params.length === 2) {
      const [host, port] = command.params || [];

      // filter
      if (!host || !port || blackPool.includes(host) || port < 0 || port > 65536) {
        ws.close();
        req.socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        req.socket.destroy();
        return;
      }

      // Create client
      const client = new Client(host, port, ws);
      queue[client.uid] = client;

      // Clear client
      ws.on('close', () => {
        delete queue[client.uid];
        console.log(`Client [${client.uid}] is closed!`);
      });  
    }
  });
}
wss.on('connection', proxyMain);

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
