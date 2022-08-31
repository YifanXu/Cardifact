import './Game.css';
import Card from './Card'
import Creature from './Creature'

import React from 'react'

class Game extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      game: props.game,
      message: "Initializing...",
      selectedHand: []
    }
  }

  handleHandClick(i) {
    const index = this.state.selectedHand.indexOf(i)
    let selectCopy = [...this.state.selectedHand]
    if (index === -1) {
      selectCopy.push(i)
    }
    else {
      selectCopy.splice(index, 1)
    }
    this.setState({selectedHand: selectCopy})
  }

  handlePrimary(e) {
    switch (this.state.game.phase) {
      case 'drafting':
        if (!this.state.selectedHand.length) {
          this.setState({message: 'Must draft at least one card for health.'})
        }
        else {
          this.props.sendToServer('draft', this.state.selectedHand.map(i => this.state.game.friendly.hand[i]))
        }
        break
      default:
        break
    }
  }

  handleCancel(e) {
    if (this.state.selectedHand.length > 0) {
      this.setState({selectedHand: []})
    }
  }

  buildCardCollection (cards, maxCount, checkDisabled = (c) => false, friendlyDraw = -1) {
    let collection = cards.map((c,i) => 
    <Card 
      key={`card${i}`} 
      suit={c.suit} 
      val={c.val} 
      disabled={checkDisabled(c)}
      selected={friendlyDraw >= 0 && this.state.selectedHand.includes(i)}
      onClick={e => {if (friendlyDraw >= 0) this.handleHandClick(i)}}
    />)
    if (cards.length < maxCount) {
      for (let i = cards.length + 1; i <= maxCount; i++) {
        collection.push(<p key={`placeholder${i}`} className="cardPlaceholder">{i}</p>)
      }
    }

    if (friendlyDraw >= 0) {
      collection.unshift(<p key="drawIndicator" className="cardPlaceholder" style={{backgroundColor: "lightgreen"}}>{friendlyDraw}</p>)
      if (cards.length <= maxCount + 2) {
        for (let i = maxCount + 1; i <= maxCount + 2; i++) {
          collection.push(<p key={`placeholder${i}`} className="cardPlaceholder" style={{backgroundColor: "white"}}>{i}</p>)
        }
      }
    }

    return collection
  }

  buildCreatureCollection (creatures, maxCount) {
    let collection = creatures.map((c,i) => <Creature key={`creature${i}`} val={c}/>)
    if (creatures.length < maxCount) {
      for (let i = creatures.length + 1; i <= maxCount; i++) {
        collection.push(<p key={`placeholder${i}`} className="creaturePlaceholder">{i}</p>)
      }
    }

    return collection
  }

  render (props) {
    return (
      <div className="main">
        {/* <div className="enemyInfo">
          <p>Enemy Draw (<b>3</b>)</p>
          <p>Enemy Hand (<b>4</b>)</p>
          <p>Your Turn</p>
        </div> */}
        <div className="enemyContainer">
          <div className='cardCollection enemy health'>
            {this.buildCardCollection(this.state.game.enemy.health, 7)}
          </div>
          <div className="enemyInfo">
            <p>Enemy Draw (<b>{this.state.game.enemy.draw}</b>)</p>
            <p>Enemy Hand (<b>{this.state.game.enemy.hand}</b>)</p>
          </div>
        </div>
        <div className='creatures enemy'>
          <div className="creaturesContainer">
            {this.buildCreatureCollection(this.state.game.enemy.creatures, 5)}
          </div>
        </div>
        <div className='creatures friendly'>
          <div className="creaturesContainer friendly">
            {this.buildCreatureCollection(this.state.game.friendly.creatures, 5)}
          </div>
        </div>
        <div className='cardCollection friendly health'>
          {this.buildCardCollection(this.state.game.friendly.health, 7, c=>!c.revealed)}
        </div>
        <div className="friendlyInfo">
          <div className='controlLine'>
            <p className='infoLine'>{this.state.message}</p>
            <button className='controlButton active' onClick={e => this.handleCancel(e)}>{this.state.selectedHand.length > 0 ? 'Deselect All' : 'End Turn'}</button>
            <button className='controlButton disabled'>-</button>
            <button className='controlButton active' onClick={e => this.handlePrimary(e)}>Confirm</button>
          </div>
          <div className='cardCollection'>
            {this.buildCardCollection(this.state.game.friendly.hand, 7, c=>false, this.state.game.friendly.draw)}
          </div>
        </div>
      </div>
    );
  }
}

export default Game;
