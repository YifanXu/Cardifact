import './Game.css';
import Card from './Card'
import Creature from './Creature'

import React from 'react'

const symbols = {
  'spade': '♠',
  'heart': '♥',
  'club': '♣',
  'diamond': '♦'
}
const values = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const cardToString = (card) => `${symbols[card.suit]}${values[card.val]}`

class Game extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      message: "Initializing...",
      selectedHand: [],
      selectedFriendlyCreature: -1,
      selectedEnemyCreature: -1
    }
  }

  // Handle when a card in the hand is selected or deselected
  handleHandClick(i) {
    const index = this.state.selectedHand.indexOf(i)
    let selectCopy = [...this.state.selectedHand]
    if (index === -1) {
      selectCopy.push(i)
    }
    else {
      selectCopy.splice(index, 1)
    }
    this.setState({
      selectedHand: selectCopy,
      selectedFriendlyCreature: -1,
      selectedEnemyCreature: -1
    })
  }

  handleCreatureClick (i, type, uiState) {
    console.log('creature click!')
    if (type === 'friendly') {
      const creature = this.props.game.friendly.creatures[i]
      if (i === this.state.selectedFriendlyCreature || !uiState.friendlyCreatureSelector(creature)) {
        this.setState({
          selectedFriendlyCreature: -1,
          selectedEnemyCreature: -1
        })
      }
      else {
        this.setState({
          selectedFriendlyCreature: i,
          selectedEnemyCreature: -1
        })
      }
    }
    else {
      const creature = this.props.game.enemy.creatures[i]
      if (uiState.enemyCreatureSelector(creature)) {
        this.setState({
          selectedFriendlyCreature: uiState.creatureMultiSelect ? this.state.selectedFriendlyCreature : -1,
          selectedEnemyCreature: i
        })
      }
    }
  }

  handlePrimary(e) {
    switch (this.props.game.phase) {
      case 'drafting':
        if (!this.state.selectedHand.length) {
          this.setState({message: 'Must draft at least one card for health.'})
        }
        else {
          this.props.sendGameAction('draft', this.state.selectedHand.map(i => this.props.game.friendly.hand[i]))
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

  buildCardCollection (cards, maxCount, checkEnabled = (c) => false, friendlyDraw = -1) {

    let collection = cards.map((c,i) => 
    <Card 
      key={`card${i}`} 
      suit={c.suit} 
      val={c.val} 
      disabled={!checkEnabled(c)}
      selected={friendlyDraw >= 0 ? this.state.selectedHand.indexOf(i) + 1 : 0}
      onClick={e => {if (friendlyDraw >= 0 && checkEnabled(c)) this.handleHandClick(i)}}
    />)
    if (cards.length < maxCount) {
      for (let i = cards.length + 1; i <= maxCount; i++) {
        collection.push(<p key={`placeholder${i}`} className="cardPlaceholder">{i}</p>)
      }
    }

    if (friendlyDraw >= 0) {
      collection.unshift(<p key="drawIndicator" className="cardPlaceholder" style={{backgroundColor: "lightgreen"}}>{friendlyDraw}</p>)
      if (cards.length <= maxCount + 2) {
        for (let i = Math.max(cards.length + 1, maxCount + 1); i <= maxCount + 2; i++) {
          collection.push(<p key={`placeholder${i}`} className="cardPlaceholder" style={{backgroundColor: "white"}}>{i}</p>)
        }
      }
    }

    return collection
  }

  buildCreatureCollection (creatures, maxCount, selectId, onClick) {
    let collection = creatures.map((c,i) => <Creature 
      key={`creature${i}`} 
      val={c} 
      onClick={() => onClick(i)}
      targeted={this.props.game && this.props.game.pendingSpell && this.props.game.pendingSpell.target && this.props.game.pendingSpell.target.id === c.id} 
      selected={i === selectId}
      combat={this.props.game.combatInfo && (this.props.game.combatInfo.attacker.id === c.id || (this.props.game.combatInfo.defender && this.props.game.combatInfo.defender.id === c.id))}
    />)
    if (creatures.length < maxCount) {
      for (let i = creatures.length + 1; i <= maxCount; i++) {
        collection.push(<p key={`placeholder${i}`} className="creaturePlaceholder">{i}</p>)
      }
    }

    return collection
  }

  // Generate text for message and buttons above player's hand, as well as selecting the appropriate handler
  getUIState () {
    const sendHand = (action) => {
      this.props.sendGameAction(action, this.state.selectedHand.map(i => this.props.game.friendly.hand[i]))
    }

    const sendCreature = () => {
      this.props.sendGameAction('creature', null, {attacker: this.state.selectedFriendlyCreature, defender: this.state.selectedEnemyCreature})
    }

    const sendSpellTarget = (action) => {
      this.props.sendGameAction(action, this.state.selectedHand.map(i => this.props.game.friendly.hand[i]), {attacker: this.state.selectedFriendlyCreature, defender: this.state.selectedEnemyCreature})
    }

    const draftCard = () => {
      if (!this.state.selectedHand.length) {
        this.setState({message: 'Must draft at least one card for health.'})
      }
      else {
        sendHand('draft')
      }
    }

    const deselectAll = () => {
      this.setState({
        selectedHand: [],
        selectedFriendlyCreature: -1,
        selectedEnemyCreature: -1
      })
    }

    const falseDelegate = () => false
    const trueDelegate = () => true

    if (!this.props.game) return {
      msg: 'Initializing...',
      primary: null,
      secondary: null,
      cancel: null
    }
    switch (this.props.game.phase) {
      case 'drafting':
        if (this.props.game.friendly.health.length > 0) {
          return {
            enemyCreatureSelector: falseDelegate,
            friendlyCreatureSelector: falseDelegate,
            cardSelector: falseDelegate,
            msg: 'Waiting for Opponent to finish draft...',
            primary: null,
            secondary: null,
            cancel: null
          }
        }
        else {
          return {
            enemyCreatureSelector: falseDelegate,
            friendlyCreatureSelector: falseDelegate,
            cardSelector: trueDelegate,
            msg: 'Draft your health deck from your hand, from bottom to top',
            primary: 'Draft',
            primaryFunc: draftCard,
            secondary: null,
            cancel: this.state.selectedHand.length > 0 || this.state.selectedFriendlyCreature !== -1 || this.state.selectedEnemyCreature !== -1 ? 'Deselect All' : null,
            cancelFunc: deselectAll,
          }
        }
      case 'action':
        if (this.props.game.move !== this.props.game.packetFor) {
          return {
            enemyCreatureSelector: falseDelegate,
            friendlyCreatureSelector: falseDelegate,
            cardSelector: falseDelegate,
            msg: 'Enemy Turn',
            primary: null,
            secondary: null,
            cancel: null,
            cancelFunc: deselectAll
          }
        }
        else {
          switch (this.props.game.subphase) {
            case 'discard':
              return {
                enemyCreatureSelector: falseDelegate,
                friendlyCreatureSelector: falseDelegate,
                cardSelector: trueDelegate,
                msg: 'Discard down to 7 cards',
                primary: this.props.game.friendly.hand.length - this.state.selectedHand.length === 7 ? 'Discard' : null,
                primaryFunc: () => sendHand('discard'),
                secondary: null,
                cancel: this.state.selectedHand.length > 0 ? 'Deselect All' : null,
                cancelFunc: deselectAll
              }
            case 'blocking':
              // The enemy is attacking, but we need to select something to block with
              let creature = this.state.selectedFriendlyCreature === -1 ? null : this.props.game.friendly.creatures[this.state.selectedFriendlyCreature]
              return {
                enemyCreatureSelector: falseDelegate,
                friendlyCreatureSelector: c => !c.tap && (c.def.suit === 'diamond' || c.def.suit === 'heart') && (!this.props.game.combatInfo.defender || c.id !== this.props.game.combatInfo.defender.id),
                cardSelector: falseDelegate,
                msg: 'Select a untapped red-health creature to block',
                primary: creature ? 'Block' : null,
                primaryFunc: sendCreature,
                secondary: null,
                cancel: creature ? 'Deselect All' : 'Pass',
                cancelFunc: creature ? deselectAll : () => sendCreature('block')
              }
            case 'buffing':
              return {
                enemyCreatureSelector: falseDelegate,
                friendlyCreatureSelector: falseDelegate,
                cardSelector: c => {
                  if (this.props.game.combatInfo.initiator === this.props.game.packetFor || this.props.game.combatInfo.defender) return (c.suit === 'club' || c.suit === 'diamond')
                  else return c.suit === 'heart'
                },
                msg: 'Play combat spells or pass',
                primary: this.state.selectedHand.length === 1 ? 'Cast' : '',
                primaryFunc: () => sendHand('buff'),
                secondary: null,
                cancel: this.state.selectedHand.length >= 1 ? 'Deselect All' : 'Pass',
                cancelFunc: this.state.selectedHand.length >= 1 ? deselectAll : () => sendHand('buff')
              }
            case 'counter':
              return {
                enemyCreatureSelector: falseDelegate,
                friendlyCreatureSelector: falseDelegate,
                cardSelector: c => {
                  const spell = this.props.game.pendingCounter || this.props.game.pendingSpell.spellCard
                  if (c.val >= spell.val) return false
                  else if ((c.suit === 'diamond' || c.suit === 'heart') && (spell.suit === 'diamond' || spell.suit === 'heart')) return false
                  else if ((c.suit === 'spade' || c.suit === 'club') && (spell.suit === 'spade' || spell.suit === 'club')) return false
                  return true
                },
                msg: `Counter ${this.props.game.pendingCounter ? 'Counter' : (this.props.game.pendingSpell.type === 'stSpell' ? 'Standard' : 'Special')} Spell? (${cardToString(this.props.game.pendingCounter || this.props.game.pendingSpell.spellCard)})`,
                primary: this.state.selectedHand.length === 1 ? 'Cast' : '',
                primaryFunc: () => sendHand('counter'),
                secondary: null,
                cancel: this.state.selectedHand.length >= 1 ? 'Deselect All' : 'Pass',
                cancelFunc: this.state.selectedHand.length >= 1 ? deselectAll : () => sendHand('counter')
              }
            default: 
              if (this.state.selectedHand.length === 0) {
                if (this.state.selectedFriendlyCreature !== -1) {
                  return {
                    creatureMultiSelect: true, // Allows the player to pick both enemy and friendly creatures
                    enemyCreatureSelector: () => {
                      if (this.state.selectedFriendlyCreature === -1) return false
                      const creature = this.props.game.friendly.creatures[this.state.selectedFriendlyCreature]
                      return creature.atk.suit === 'spade' || creature.atk.suit === 'club'
                    },
                    friendlyCreatureSelector: trueDelegate,
                    cardSelector: falseDelegate,
                    msg: this.state.selectedEnemyCreature !== -1 ? 'Attack the selected creature?' : 'Attack Face?',
                    primary: 'Attack',
                    primaryFunc: sendCreature,
                    secondary: null,
                    cancel: 'Deselect All',
                    cancelFunc: () => deselectAll,
                  }
                }
                // Nothing is selected
                return {
                  enemyCreatureSelector: falseDelegate,
                  friendlyCreatureSelector: c => !c.tap,
                  cardSelector: trueDelegate,
                  msg: 'Your Turn',
                  primary: null,
                  secondary: null,
                  cancel: 'End Turn',
                  cancelFunc: () => this.props.sendGameAction('pass', []),
                }
              }
              else if (this.state.selectedHand.length === 1) {
                const selectedCard = this.props.game.friendly.hand[this.state.selectedHand[0]]
                return {
                  enemyCreatureSelector: trueDelegate,
                  friendlyCreatureSelector: trueDelegate,
                  cardSelector: trueDelegate,
                  msg: 'Your Turn',
                  primary: (selectedCard.suit === 'spade' || selectedCard.suit === 'heart') ? 'Cast as Spell' : null,
                  primaryFunc: () => sendSpellTarget('stSpell'),
                  secondary: selectedCard.val <= 3 ? (selectedCard.val === 2 || this.state.selectedFriendlyCreature !== -1 || this.state.selectedEnemyCreature !== -1 ? 'Cast as Special' : null) : null,
                  secondaryFunc: () => sendSpellTarget('spSpell'),
                  cancel: 'Deselect All',
                  cancelFunc: deselectAll
                }
              }
              else if (this.state.selectedHand.length === 2) {
                return {
                  enemyCreatureSelector: falseDelegate,
                  friendlyCreatureSelector: falseDelegate,
                  cardSelector: trueDelegate,
                  msg: 'Your Turn',
                  primary: 'Summon',
                  primaryFunc: () => sendHand('summon'),
                  secondary: null,
                  cancel: 'Deselect All',
                  cancelFunc: deselectAll
                }
              }
              else {
                return {
                  enemyCreatureSelector: falseDelegate,
                  friendlyCreatureSelector: falseDelegate,
                  cardSelector: trueDelegate,
                  msg: 'Your Turn',
                  primary: null,
                  secondary: null,
                  cancel: 'Deselect All',
                  cancelFunc: deselectAll
                }
              }
          }
        }
      case 'completed':
        return {
          enemyCreatureSelector: falseDelegate,
          friendlyCreatureSelector: falseDelegate,
          cardSelector: falseDelegate,
          msg: this.props.game.move === this.props.game.packetFor ? 'Victory!' : 'Defeat.',
          primary: 'Back to Lobbies',
          primaryFunc: () => this.props.endGame(),
          secondary: null,
          cancel: null
        }
      default:
        return {
            enemyCreatureSelector: falseDelegate,
            friendlyCreatureSelector: falseDelegate,
            cardSelector: falseDelegate,
            msg: 'Inititalizing...',
            primary: null,
            secondary: null,
            cancel: null
          }
    }
  }

  render () {
    const uiState = this.getUIState()

    // Calculate whether the health deck is being targeted by anything
    let friendlyHealthTarget = false
    let enemyHealthTarget = false
    if (this.props.game && this.props.game.pendingSpell && this.props.game.pendingSpell.type === 'stSpell' && !this.props.game.pendingSpell.target) {
      if (this.props.game.pendingSpell.initiator === this.props.game.packetFor) {
        if (this.props.game.pendingSpell.spellCard.suit === 'heart') {
          friendlyHealthTarget = true
        }
        else if (this.props.game.pendingSpell.spellCard.suit === 'spade') {
          enemyHealthTarget = true
        }
      }
      else {
        if (this.props.game.pendingSpell.spellCard.suit === 'heart') {
          enemyHealthTarget = true
        }
        else if (this.props.game.pendingSpell.spellCard.suit === 'spade') {
          friendlyHealthTarget = true
        }
      }
    }

    // Calculate whether the health deck is in combat
    let healthInCombat = 'none'
    if (this.props.game && this.props.game.combatInfo && !this.props.game.combatInfo.defender) {
      healthInCombat = this.props.game.combatInfo.initiator === this.props.game.packetFor ? 'enemy' : 'friendly'
    }

    return (
      <div className="main">
        {/* <div className="enemyInfo">
          <p>Enemy Draw (<b>3</b>)</p>
          <p>Enemy Hand (<b>4</b>)</p>
          <p>Your Turn</p>
        </div> */}
        <div className="enemyContainer">
          <div className={`cardCollection enemy health ${enemyHealthTarget ? 'targeted' : ''} ${healthInCombat === 'enemy' ? 'combat' : ''}`}>
            {this.buildCardCollection(this.props.game.enemy.health, 7, c=>c.revealed)}
          </div>
          <div className="enemyInfo">
            <p>Enemy Draw (<b>{this.props.game.enemy.draw}</b>)</p>
            <p>Enemy Hand (<b>{this.props.game.enemy.hand}</b>)</p>
          </div>
        </div>
        <div className='creatures enemy'>
          <div className="creaturesContainer">
            {this.buildCreatureCollection(this.props.game.enemy.creatures, 5, this.state.selectedEnemyCreature, i => this.handleCreatureClick(i, 'enemy', uiState))}
          </div>
        </div>
        <div className='creatures friendly'>
          <div className="creaturesContainer friendly">
            {this.buildCreatureCollection(this.props.game.friendly.creatures, 5, this.state.selectedFriendlyCreature, i => this.handleCreatureClick(i, 'friendly', uiState))}
          </div>
        </div>
        <div className={`cardCollection friendly health ${friendlyHealthTarget ? 'targeted' : ''} ${healthInCombat === 'friendly' ? 'combat' : ''}`}>
          {this.buildCardCollection(this.props.game.friendly.health, 7, c=>c.revealed)}
        </div>
        <div className="friendlyInfo">
          <div className={`controlLine ${(this.props.game.move === 'both' || this.props.game.move === this.props.game.packetFor) ? '' : 'red'}`}>
            <p className='infoLine'>{uiState.msg}</p>
            <button className={`controlButton ${uiState.cancel ? 'active' : 'disabled'}`} onClick={uiState.cancel ? uiState.cancelFunc : null}>{uiState.cancel}</button>
            <button className={`controlButton ${uiState.secondary ? 'active' : 'disabled'}`} onClick={uiState.secondary ? uiState.secondaryFunc : null}>{uiState.secondary}</button>
            <button className={`controlButton ${uiState.primary ? 'active' : 'disabled'}`} onClick={uiState.primary ? uiState.primaryFunc : null}>{uiState.primary}</button>
          </div>
          <div className='cardCollection'>
            {this.buildCardCollection(this.props.game.friendly.hand, 7, uiState.cardSelector, this.props.game.friendly.draw)}
          </div>
        </div>
      </div>
    );
  }
}

export default Game;
