import fs from 'fs';
import uWS from 'uWebSockets.js';
import { v4 as uuidv4 } from 'uuid';
import querystring  from 'querystring';

const port = process.env.PORT || 5000;
let sockets = {};

const decoder = new TextDecoder("utf-8");
// const encoder = new TextEncoder();

const app = uWS.App().ws('/:room', {

  /* There are many common helper features */
  idleTimeout: 30,
  maxBackpressure: 1024,
  maxPayloadLength: 10000,
  compression: uWS.DEDICATED_COMPRESSOR_3KB,

  upgrade: (res, req, context) => {
    const params = querystring.decode(req.getQuery());
    res.upgrade({
        id: uuidv4(),
        room: req.getParameter(0),
        params,
        name: params.name
      },
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context
    );
  },
  open: (ws) => {
     // any data may be attached to socket
    ws.publish(ws.room, JSON.stringify({ type: 'user:connect', user: { id: ws.id, name: ws.name} }), false, true);
    ws.subscribe(ws.room);

    ws.send(JSON.stringify({
      type: "handshake",
      assigned_id: ws.id,
      users: Object.entries(sockets).filter(([id, user]) => user.room === ws.room).map(([id, user]) => ({ id, name: user.name }))
    }), false, true);

    sockets[ws.id] = ws;
    console.log(`${ws.name} [${ws.id}] connected to room ${ws.room}`)
  },
  message: (ws, message) => {
    const decoded = decoder.decode(message);
    if(decoded === "ping") {
      ws.send('pong', false, true);
      return;
    }
    const data = JSON.parse(decoded);
    console.log(decoded.substring(0, 50));
    if(data.type.startsWith('webrtc:')) {
      if (data.target in sockets) {
        sockets[data.target].send(JSON.stringify({ ...data, source: ws.id }), false, true);
      }
      return;
    }

    switch (data.type) {
      case "message":
        if (data.target in sockets) {
          sockets[data.target].send(JSON.stringify({ ...data, type: 'message', source: ws.id }), false, true);
        }
        else {
          ws.publish(ws.room, JSON.stringify({ ...data, type: 'message', source: ws.id }), false, true);
        }
        break;
      case "rename":
        ws.name = data.name;
        ws.publish(ws.room, JSON.stringify({ type: 'user:rename', user: { id: ws.id, name: ws.name } }), false, true);
    
      default:
        break;
    }
  },
  close: (ws) => {
    const { [ws.id]: omit, ...rest } = sockets;
    sockets = rest;
    app.publish(ws.room, JSON.stringify({ type: 'user:disconnect', id: ws.id }), false, true);
    console.log(`${ws.name} [${ws.id}] disconnected`);
  }
  
}).get('/*', (res) => {
//   res.end(fs.readFileSync('index.html', 'utf8'));
  res.end("hej");
}).listen(port, (token) => {
  if (token) {
    console.log('Listening to port ' + port);
  } else {
    console.log('Failed to listen to port ' + port);
  }
});