import './Card.css';

const symbols = {
  'spade': '♠',
  'heart': '♥',
  'club': '♣',
  'diamond': '♦'
}
const values = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const colorClass = {
  'spade': 'black',
  'heart': 'red',
  'club': 'black',
  'diamond': 'red'
}

export default function Card (props) {
  if (!props.val) {
    return (<div className={`card disabled`}>
    </div>)
  }
  return (<div className={`card ${colorClass[props.suit]} ${props.disabled ? "disabled" : ""} ${props.selected ? "selected" : ""}`} onClick={e => props.onClick ? props.onClick(e) : null}>
    <p className='topleft'>{values[props.val]}</p>
    <p className='midSymbol'>{symbols[props.suit]}</p>
    <p className='botRight'>{values[props.val]}</p>
  </div>)
}