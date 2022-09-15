import './Chat.css'
import { useState } from 'react'
import dateToString from './util/dateToString'

export default function Chat (props) {

  let [msgInput, setmsgInput] = useState('')
  const sendMsg = (e) => {
    if (msgInput.trim()) props.send(msgInput)
    setmsgInput('')
    e.preventDefault()
  }
  const messages = props.content.map((msg,i) => {
    return <p key={i} className={`message ${msg.msgType}`}><b>{`[${dateToString(msg.timestamp)}]`}<span>{msg.source}</span></b>: {msg.content}</p>
  })
  return (
    <div className='chat'>
      <div className='chatDisplay'>
        {messages}
      </div>
      <div className='inputArea'>
        <textarea className='inputBox' value={msgInput} onChange={e => setmsgInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') sendMsg(e) }}/>
        <button className='submitButton' onClick={() => sendMsg()}>Send</button>
      </div>
    </div>
  )
}