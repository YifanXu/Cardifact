import { useState } from 'react'
import './Lobbylist.css'

export default function Lobbylist (props) {
  let [filter, setFilter] = useState('')
  let [newLobbyName, setNewLobbyName] = useState('')

  const createNewLobby = (e) => {
    if(e.key === 'Enter') {
      if (newLobbyName.trim() && !newLobbyName.includes('"')) {
        props.createNewLobby(newLobbyName)
      }
      else {
        props.addChat({msgType: "error", content: "Lobby name must be non-empty and does not contain quotation marks (\")"})
      }
      setNewLobbyName('')
      e.preventDefault()
    }
  }

  const id = localStorage.getItem('id')

  return (
    <div className='main'>
      <h2>Open Lobbies</h2>
      <div className='lobbyContainer'>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder='Search...'></input>
        <table className='lobbytable'>
          <thead>
            <tr className='row'>
              <th>Lobby Name</th>
              <th>Created at</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(props.lobbies).map(([lobbyName, info]) => <tr onClick={e => props.joinLobby(lobbyName)} key={lobbyName} className={(id && info.players.includes(id)) ? 'highlighted' : 'normal'}>
              <td className='nameColumn'>{lobbyName}</td>
              <td className='timeColumn'>{info.createdAt}</td>
              <td className='statusColumn'>{info.ingame ? 'In Progress' : 'Open'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="lobbyCreationForm">
        <p className='lobbyCreationLabel'>Create a Lobby: </p>
        <input value={newLobbyName} onChange={e => setNewLobbyName(e.target.value)} onKeyDown={e => createNewLobby(e)}></input>
      </div>
    </div>
  )
}