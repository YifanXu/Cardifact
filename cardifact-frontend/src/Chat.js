import './Chat.css'
import { useState } from 'react'

export default function Chat (props) {

  let [msgInput, setmsgInput] = useState('')
  const sendMsg = (e) => {
    if (msgInput.trim()) props.send(msgInput)
    setmsgInput('')
    e.preventDefault()
  }
  const addZero = (n) => n < 10 ? `0${n}` : n
  const messages = props.content.map((msg,i) => {
    const dateObj = new Date(msg.timestamp)
    return <p key={i} className={`message ${msg.msgType}`}><b>{`[${addZero(dateObj.getHours())}:${addZero(dateObj.getMinutes())}:${addZero(dateObj.getSeconds())}]`}<span>{msg.source}</span></b>: {msg.content}</p>
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