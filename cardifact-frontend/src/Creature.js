import './Creature.css'
import Card from './Card'

export default function Creature (props) {
  return (
    <table className={`creature ${props.val.tap ? 'tapped' : 'default'} ${props.targeted ? 'targeted' : ''} ${props.selected ? 'selected' : (props.combat ? 'combat' : '')}`} onClick={props.onClick}>
      <thead>
        <tr>
          <th>ATK</th>
          <th>DEF</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><Card suit={props.val.atk.suit} val={props.val.atk.val}/></td>
          <td><Card suit={props.val.def.suit} val={props.val.def.val}/></td>
        </tr>
        <tr className="buffRow">
          <td className='buffText'>{props.val.atkBuff ? `+${props.val.atkBuff.val}` : '-'}</td>
          <td className='buffText'>{props.val.defBuff ? `+${props.val.defBuff.val}` : '-'}</td>
        </tr>
      </tbody>
    </table>
  )
}