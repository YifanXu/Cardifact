import './App.css';
import Game from './Game'
import React from 'react'
import Chat from './Chat';
import Lobbylist from './Lobbylist';

class App extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      gameState: null,
      chatlog: [
      ],
      lobbies: []
    }
  }
  componentDidMount() {
    if (this.socket) return
    console.log(`Connecting to Websocket at ws://${window.location.host}`)
    let socket= new WebSocket(`ws://${window.location.host}`)
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
        case 'gameState':
          this.setState({
            gameState: msgJson.payload
          })
          break
        case 'chatmsg':
          this.setState({
            chatlog: [...this.state.chatlog, {
              timestamp: Date.now(),
              source: msgJson.payload.source,
              content: msgJson.payload.message,
              msgType: msgJson.msgType,
            }]
          })
            break
        case 'error':
        case 'info':
          this.setState({
            chatlog: [...this.state.chatlog, {
              timestamp: Date.now(),
              source: 'System',
              content: msgJson.payload,
              msgType: msgJson.msgType,
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

  sendGameAction (actionType, cards, creatures) {
    this.sendToServer('game', {
      action: actionType,
      cards,
      creatures
    })
  }

  sendChatMsg (msg) {
    if (msg.startsWith('/')) {
      // This is a command
      const args = msg.split(' ')
      switch (args[0]) {
        case '/forceUpdate':
          this.sendGameAction('state')
          break
        case '/alias':
          if (args[1]) this.sendToServer('alias', args[1])
          break
        default:
          this.addSysMsg({msgType: 'error', content: `Unknown command ${msg}`})
      }
    }
    else {
      this.sendToServer('chatmsg', msg)
    }
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
         ? <Game key={this.state.gameState.key} game={this.state.gameState} addChat={msg => this.addSysMsg(msg)} sendGameAction={this.sendGameAction.bind(this)}/>
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