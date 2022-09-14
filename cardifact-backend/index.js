const WebSocketServer = require('ws').Server
const { randomUUID } = require('crypto')
const express = require('express')
const http = require('http')
const Game = require('./game')

const app = express()
const server = http.createServer(app)

const clientList = {}

// Holds info for lobbies. Keyed with Game ID
const lobbies = {}

// Holds references to game objects. Keyed with Game ID
const gameRefs = {}

app.get('/', (req, res) => {
  res.send('hello world!')
})

app.get('/game/:id', (req,res) => {
  const gameId = req.params.id
})

server.listen(8000)

const wss = new WebSocketServer({server})
wss.on('connection', (socket, req) => {
  // let queryParams = qs.parse(req.url.substring(req.url.indexOf('?') + 1))
  // let id = queryParams.id
  // if (!queryParams.id) {
  //   console.log('closing socket!!!! No id')
  //   socket.close()
  // }
  // else {
  //   if (clientList[id]) {
  //     clientList[id].close()
  //   }
  //   clientList[id] = socket
  //   socket.id = id
  // }
  // socket.id = randomUUID()
  // socket.send(JSON.stringify({msgType: 'id', payload: socket.id}))
  // socket.send(JSON.stringify({msgType: 'lobbylist', payload: Object.keys(lobbies)}))

  socket.connectionTimeout = setTimeout(() => {
    socket.close()
  }, 10000)

  socket.on('message', function message(data) {
    console.log('received: "%s" from %s', data, socket.id);
    let dataVal
    try { 
      dataVal = JSON.parse(data)
    }
    catch (error) {
      socket.send(JSON.stringify({msgType: 'error', payload: 'Invalid JSON payload'}))
      return
    }

    switch(dataVal.msgType) {
      case 'id':
        if (socket.id) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Id already set!'}))
          break
        }
        else if(dataVal.payload) {
          // The client already has a previous id
          console.log('set socket id to ' + dataVal.payload )
          socket.id = dataVal.payload

          // Disconnect the previous socket if it still exists
          if (clientList[socket.id]) {
            clientList[socket.id].socket.send(JSON.stringify({
              msgType: 'chatmsg', payload: {
                timestamp: Date.now(),
                source: 'System',
                content: 'You have been disconnected because you reopened this page on a different tab. Referesh to reconnect.',
                msgType: 'error',
              }
            }))
            clientList[socket.id].socket.close(1000, 'Another websocket with the same id was opened')
          }
        }
        else {
          // The client does not have an id, so we need to generate a new one
          socket.id = randomUUID()
          socket.send(JSON.stringify({msgType: 'id', payload: socket.id}))
        }
        clientList[socket.id] = {
          socket,
          gameId: null
        }
        clearTimeout(socket.connectionTimeout)
        break
      case 'lobbylist':
        socket.send(JSON.stringify({msgType: 'lobbylist', payload: lobbies}))
        break
      case 'createLobby':
        if (!socket.id) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Requires ID!'}))
        }
        else if (clientList[socket.id].gameId) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Already in a lobby!'}))
        }
        else if (lobbies[dataVal.payload]){
          socket.send(JSON.stringify({msgType: 'error', payload: 'Lobby Name Taken'}))
        }
        else {
          lobbies[dataVal.payload] = {
            players: [socket.id],
            createdAt: Date.now(),
            inGame: false
          }
          // Broadcast everyone in lobby screen
          wss.clients.forEach(client => {
            if (client.id && !clientList[client.id].gameId) {
              console.log ('send lobbies to %s', client.id)
              client.send(JSON.stringify({msgType: 'lobbylist', payload: lobbies}))
            }
          })
          clientList[socket.id].gameId = dataVal.payload
          clientList[socket.id].position = 'p1'
        }
        break
      case 'joinLobby':
        if (!socket.id) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Requires ID!'}))
        }
        else if (clientList[socket.id].gameId) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Already in a lobby!'}))
        }
        else if (!lobbies[dataVal.payload]){
          socket.send(JSON.stringify({msgType: 'error', payload: 'Lobby Name does not exist'}))
        }
        else if (!lobbies[dataVal.payload].players.length >= 2) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Lobby is Full!'}))
        }
        else {
          lobbies[dataVal.payload].players.push(socket.id)
          clientList[socket.id].gameId = dataVal.payload
          clientList[socket.id].position = 'p2'
          // Broadcast everyone else in lobby screen
          wss.clients.forEach(client => {
            if (client.id && !clientList[client.id].gameId) {
              console.log ('send lobbies to %s', client.id)
              client.send(JSON.stringify({msgType: 'lobbylist', payload: lobbies}))
            }
          })

          // Intialize new game
          gameRefs[dataVal.payload] = new Game(null, {
            p1: clientList[lobbies[dataVal.payload].players[0]].socket,
            p2: clientList[lobbies[dataVal.payload].players[1]].socket
          })
        }
        break
      case 'game':
        // Since it's a game action, therefore there has to be a game for this client
        if (!socket.id) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Requires ID!'}))
          return
        }
        const gameId = clientList[socket.id].gameId
        if (!gameId) {
          socket.send(JSON.stringify({msgType: 'error', payload: 'Must be in a lobby to execute game actions'}))
          return
        }
        if (!gameRefs[gameId]){
          socket.send(JSON.stringify({msgType: 'error', payload: 'Lobby Name does not exist'}))
        }
        else {
          let res = gameRefs[gameId].handleAction(clientList[socket.id].position, dataVal.payload)
          if (res) socket.send(JSON.stringify(res))
        }
    }
  });
})