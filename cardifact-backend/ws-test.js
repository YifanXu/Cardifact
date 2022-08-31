const WebSocket = require('ws')

const socket = new WebSocket('ws://localhost:8000'); 

const prevId = ''

socket.on('open', function open() {
  socket.send(JSON.stringify({msgType: 'id', payload: prevId}));
});

socket.on('message', function message(data) {
  console.log(Buffer.from(data).toString())
})
