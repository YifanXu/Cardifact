import './App.css';
import Game from './Game'
import testState from './gameState.json'
import React from 'react'
import Chat from './Chat';
import Lobbylist from './Lobbylist';

class App extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      gameState: null,
      chatlog: [
        {
          timestamp: Date.now(),
          source: 'yourmom',
          content: 'get rekt kiddo',
          msgType: 'chatmsg',
        }
      ],
      lobbies: []
    }
  }
  componentDidMount() {
    if (this.socket) return
    console.log('mount!')
    let socket= new WebSocket(`ws://localhost:8000`)
    socket.onerror = e => {
      this.addSysMsg({msgType: 'error', content: 'An error has occured with the websocket'})
      console.error(e)
    }

    socket.onopen = () => {
      socket.send(JSON.stringify({msgType: 'id', payload: localStorage.getItem('id') || ''}));
      socket.send(JSON.stringify({msgType: 'lobbylist', payload: null}));
    }

    socket.onclose = () => {
      this.socket = null
    }
    
    socket.onmessage = (msgEvent) => {
      let msgJson
      try {
        msgJson = JSON.parse(msgEvent.data)
      }
      catch(error) {
        console.error('error parsing json')
        return
      }
      console.log(msgJson)
      switch(msgJson.msgType) {
        case 'id':
          localStorage.setItem('id', msgJson.payload)
          break
        case 'lobbylist':
          this.setState({
            lobbies: msgJson.payload
          })
          break
        case 'chatmsg':
          this.setState({
            chatlog: [...this.state.chatlog, msgJson.payload]
          })
          break
        case 'gameState':
          this.setState({
            gameState: msgJson.payload
          })
          break
        case 'error':
          this.setState({
            chatlog: [...this.state.chatlog, {
              timestamp: Date.now(),
              source: 'System',
              content: msgJson.payload,
              msgType: 'error',
            }]
          })
          break
        default:
          console.log(`unhandled msgType ${msgJson.msgType}`)
          break
      }
    }

    this.socket = socket
  }
  sendToServer (msgType, payload) {
    if (!this.socket) {
      this.addSysMsg({msgType: 'error', content: 'A WebSocket was not Intialized. Try refreshing the page'})
      return
    }
    this.socket.send(JSON.stringify({msgType, payload}))
  }

  sendChatMsg (msg) {
    this.setState({
      chatlog: [
        ...this.state.chatlog,
        {
          timestamp: Date.now(),
          source: 'You',
          content: msg,
          msgType: 'chatmsg'
        }
      ]
    })
  }

  addSysMsg (msgBloc) {
    msgBloc.timestamp = Date.now()
    msgBloc.source = 'Local'
    this.setState({
      chatlog: [
        ...this.state.chatlog,
        msgBloc
      ]
    })
  }

  createNewLobby() {
    
  }

  render() {
    return (
      <div className="app">
        {this.state.gameState
         ? <Game game={this.state.gameState} addChat={msg => this.addSysMsg(msg)} sendToServer={this.sendToServer.bind(this)}/>
         : <Lobbylist 
              lobbies={this.state.lobbies} 
              addChat={msg => this.addSysMsg(msg)} 
              joinLobby={(n)=>this.sendToServer('joinLobby', n)} 
              createNewLobby={(n)=>this.sendToServer('createLobby', n)}
            />
        }
        <Chat content={this.state.chatlog} send={msg => this.sendChatMsg(msg)}/>
      </div>
    )
  }
}

export default App;