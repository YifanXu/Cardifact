class Game {
  constructor(prevState = null, sockets, endGameHandler) {
    this.sockets = sockets
    this.endGameHandler = endGameHandler
    this.nextCreatureId = 0
    if (prevState) {
      this.state = state
      return
    }
    // Init State
    this.state = {
      phase: 'drafting',
      subphase: '',
      move: 'both',
      turn: 1,
      key: 0,
      combatInfo: null,
      pendingSpell: null,
      pendingCounter: null,
      p1: {
        creatures: [],
        health: [],
        draw: [],
        hand: [],
      },
      p2: {
        creatures: [],
        health: [],
        draw: [],
        hand: [],
      }
    }

    this.initCards()
    this.distributeState()
  }

  // Send the state of the game to both players
  distributeState (player = null) {
    // console.log(JSON.stringify(this.state, null, 2))
    if (!player || player === 'p1') this.sockets.p1.send(JSON.stringify({msgType: 'gameState', payload: this.generatePacket('p1')}))
    if (!player || player === 'p2') this.sockets.p2.send(JSON.stringify({msgType: 'gameState', payload: this.generatePacket('p2')}))
  }

  // shuffle cards
  initCards() {
    // Create deck
    const deck = new Array(52)
    let suit = ['spade', 'club', 'diamond', 'heart']

    // Populate Deck
    for (let i = 0; i < deck.length; i++) {
      deck[i] = {
        suit: suit[Math.floor(i / 13)],
        val: (i % 13) + 1
      }
    }

    // Shuffle
    for (let i = deck.length - 1; i >= 1; i--) {
      const target = Math.floor(Math.random() * i)
      const temp = deck[i]
      deck[i] = deck[target]
      deck[target] = temp
    }

    // Put in the two decks
    this.state.p1.hand = deck.slice(0, 7)
    this.state.p1.draw = deck.slice(7, 26)

    this.state.p2.hand = deck.slice(26, 33)
    this.state.p2.draw = deck.slice(33, 52)
  }

  generatePacket (player) {
    const packet = {
      phase: this.state.phase,
      subphase: this.state.subphase,
      move: this.state.move,
      turn: this.state.turn,
      key: this.state.key,
      combatInfo: this.state.combatInfo,
      pendingSpell: this.state.pendingSpell,
      pendingCounter: this.state.pendingCounter,
      packetFor: player
    }
    let friendlyBlock, enemyBlock
    if (player === 'p1') {
      friendlyBlock = this.state.p1
      enemyBlock = this.state.p2
    }
    else {
      friendlyBlock = this.state.p2
      enemyBlock = this.state.p1
    }
    // Transform Friendly and Enemy
    // (Shallow reference is okay since we won't be changing anything before serializing)
    packet.friendly = {
      creatures: friendlyBlock.creatures,
      health: friendlyBlock.health,
      draw: friendlyBlock.draw.length,
      hand: friendlyBlock.hand
    }
    packet.enemy = {
      creatures: enemyBlock.creatures,
      health: enemyBlock.health.map(c => c.revealed ? c : {suit: "", val: 0}),
      draw: enemyBlock.draw.length,
      hand: enemyBlock.hand.length
    }

    return packet
  }

  // Discard cards from players hands. True if successful, false if the player do not have the cards
  tryPullCards (player, cards) {
    const handCopy = [...this.state[player].hand]
    for (const cardToPull of cards) {
      let index = handCopy.findIndex(card => (card.val === cardToPull.val && card.suit === cardToPull.suit))
      if (index < 0) {
        // A card was supposed to be removed but was not in the hand
        return false
      } 
      handCopy.splice(index, 1)
    }
    this.state[player].hand = handCopy
    return true
  }

  otherPlayer (player) {
    return player === 'p1' ? 'p2' : 'p1'
  }

  handleAction (player, packet) {
    switch(packet.action) {
      // Drafting the starting health cards from the deck
      case "state":
        this.distributeState(player)
        break
      case "draft": 
        if (this.state.phase !== 'drafting') {
          return {msgType: 'error', payload: 'Cannot draft when it is not the drafting phase'}
        }
        if (this.state[player].health.length > 0) {
          return {msgType: 'error', payload: 'You have already drafted'}
        }
        if (this.tryPullCards(player, packet.cards)) {
          this.state[player].health = packet.cards.map((card, i) => ({
            ...card,
            revealed: i === packet.cards.length - 1
          }))
          this.state.key++
          // Do not update the other player if they are still drafting
          if (this.state[this.otherPlayer(player)].health.length > 0) {
            // End draft state
            this.state.phase = 'action'
            // Determine move order
            if (this.state.p1.health.length !== this.state.p2.health.length) {
              this.state.move = this.state.p1.health.length < this.state.p2.health.length ? 'p1' : 'p2'
            }
            else {
              for (let i = this.state.p1.health.length - 1; i >= 0; i--) {
                // console.log(`Card #${i}: ${this.state.p1.health[i].val} vs ${this.state.p2.health[i].val}`)
                this.state.p1.health[i].revealed = true
                this.state.p2.health[i].revealed = true
                if (this.state.p1.health[i].val > this.state.p2.health[i].val) {
                  this.state.move = 'p2'
                  break
                }
                else if (this.state.p1.health[i].val < this.state.p2.health[i].val){
                  this.state.move = 'p1'
                  break
                }
              }
              if (this.state.move === 'both')
              {
                // Just default to this for now
                this.state.move === 'p1'
              }
            }
            this.startTurnFor(this.state.move)
            this.distributeState()
          }
          else {
            this.distributeState(player)
            this.sockets[this.otherPlayer(player)].send(JSON.stringify({msgType: 'info', payload: "Your opponent has finished drafting!"}))

          }
          return {msgType: 'info', payload: 'Health drafting successful'}
        }
        else {
          return {msgType: 'error', payload: 'Selected cards are not part of your hand'}
        }
      case 'discard':
        if (this.state.phase === 'action' && this.state.move === player && this.state.subphase === 'discard') {
          if (this.state[player].hand.length - packet.cards.length !== 7) {
            return {msgType: 'error', payload: 'Must discard down to exactly 7 cards!'}
          }
          if (this.tryPullCards(player, packet.cards)) {
            this.state.subphase = 'standard'
            this.state.move = this.state.originalTurn
            this.state.key++
            this.distributeState()
          }
          else {
            return {msgType: 'error', payload: 'Selected cards are not part of your hand'}
          }
        }
        break
      case 'summon':
        if (packet.cards.length !== 2) {
          return {msgType: 'error', payload: 'Must summon with exactly 2 cards'}
        }
        if (this.state[player].creatures.length >= 5) {
          return {msgType: 'error', payload: 'You can control a maximum of 5 creatures'}
        }
        if (this.state.phase === 'action' && this.state.move === player && this.state.subphase === 'standard') {
          if (this.tryPullCards(player, packet.cards)) {
            this.state[player].creatures.push({
              id: this.nextCreatureId++,
              atk: packet.cards[0],
              def: packet.cards[1],
              atkBuff: null,
              defBuff: null,
              tap: true
            })
            this.state.key++
            this.distributeState()
          }
        }
        else {
          return {msgType: 'error', payload: 'Must summon with exactly 2 cards'}
        }
        break
      case 'creature':
        if (player !== this.state.move) {
          return {msgType: 'error', payload: 'Can only use action during turn'}
        }
        switch (this.state.subphase) {
          case 'standard':
            // This is meant to initiate an attack
            const attacker = this.state[player].creatures[packet.creatures.attacker]
            if (!attacker) {
              return {msgType: 'error', payload: 'Invalid attacking creature'}
            }
            const defender = packet.creatures.defender === -1 ? null : this.state[this.otherPlayer(player)].creatures[packet.creatures.defender]
            console.log(defender)
            if (defender && attacker.atk.suit !== 'spade' && attacker.def.suit === 'club') {
              return {msgType: 'error', payload: 'Creature is targeting specific creature but does not have black attack card'}
            }
            this.state.combatInfo = {
              attacker,
              defender,
              initiator: player, // Used to return to standard state after combat
              buffRoundRemain: 2, // Advances the combat when neither player buffs their creature
            },
            attacker.tap = true
            this.state.subphase = 'blocking'
            this.state.move = this.otherPlayer(player)
            this.state.key++
            this.distributeState()
            break
          case 'blocking':
            // This is meant to be a block
            if (packet.creatures.attacker !== -1) {
              const blocker = this.state[player].creatures[packet.creatures.attacker]
              if (!blocker) {
                return {msgType: 'error', payload: 'Invalid blocking creature'}
              }
              if (this.state.combatInfo.defender && this.state.combatInfo.defender.id === blocker.id) {
                return {msgType: 'error', payload: 'Creature is already targeted'}
              }
              if (blocker.tap || (blocker.def.suit !== 'diamond' && blocker.def.suit !== 'heart')) {
                return {msgType: 'error', payload: 'Blocking creature must be untapped and has a red defense card'}
              }
              // Valid blocking creature, replace the original
              this.state.combatInfo.defender = blocker
              blocker.tap = true
            }
            // Advance to buffing
            this.state.subphase = 'buffing'
            this.state.move = this.otherPlayer(player)
            this.state.key++
            this.distributeState()
            break
        }
        break
      case 'buff':
        if (player !== this.state.move || this.state.subphase !== 'buffing') {
          return {msgType: 'error', payload: 'Can only use action during turn and buffing phase'}
        }
        if (packet.cards.length === 0) {
          // signifies the guy is giving up. Advances buff round
          const combatBlock = this.state.combatInfo
          combatBlock.buffRoundRemain--
          if (!combatBlock.buffRoundRemain) {
            // Resolve Combat
            if (combatBlock.defender) {
              console.log(combatBlock)
              // Resolve creature-to-creature combat
              if (combatBlock.attacker.atk.suit === combatBlock.defender.def.suit 
                || (combatBlock.attacker.atk.val + (combatBlock.attacker.atkBuff ? combatBlock.attacker.atkBuff.val : 0)
                >= combatBlock.defender.def.val + (combatBlock.defender.defBuff ? combatBlock.defender.defBuff.val : 0))) {
                  console.log('defender dies')
                this.destroyCreature(combatBlock.defender.id)
              }
              else {
                // Replace buff cards
                this.applyBuff(this.state[this.otherPlayer(combatBlock.initiator)].creatures, combatBlock.defender.id)
              }
              if (combatBlock.defender.atk.suit === combatBlock.attacker.def.suit 
                || (combatBlock.defender.atk.val + (combatBlock.defender.atkBuff ? combatBlock.defender.atkBuff.val : 0) 
                >= combatBlock.attacker.def.val + (combatBlock.attacker.defBuff ? combatBlock.attacker.defBuff.val : 0))) {
                  console.log('attacker dies')
                this.destroyCreature(combatBlock.attacker.id)
              }
              else {
                // Replace buff cards
                this.applyBuff(this.state[combatBlock.initiator].creatures, combatBlock.attacker.id)
              }
            }
            else {
              // Resolve damage dealt straight to the health deck
              const defenderHealth = this.state[this.otherPlayer(combatBlock.initiator)].health
              const defendingCard = defenderHealth[defenderHealth.length - 1]
              if (combatBlock.attacker.atk.suit === defendingCard.suit 
                || combatBlock.attacker.atk.val + (combatBlock.attacker.atkBuff ? combatBlock.attacker.atkBuff.val : 0) >= defendingCard.val) {
                  defenderHealth.pop()
                  if (defenderHealth.length === 0) {
                    // Game ends!
                    this.state.phase = 'completed'
                    this.state.key++
                    this.state.move = combatBlock.initiator
                    this.distributeState()
                    this.endGameHandler()
                    return
                  }
                  defenderHealth[defenderHealth.length - 1].revealed = true
              }
            }
            this.state.move = combatBlock.initiator
            this.state.subphase = 'standard'
            this.state.combatInfo = null
          }
          else {
            // Turn over to the other player for buffs
            this.state.move = this.otherPlayer(player)
          }
        }
        else if (packet.cards.length !== 1) {
          return {msgType: 'error', payload: 'Must have exactly 1 card for spells'}
        }
        else {
          let spellCard = packet.cards[0]
          // Check for replentish mid-combat
          if (player !== this.state.combatInfo.initiator && !this.state.combatInfo.defender) {
            if (spellCard.suit !== 'heart') {
              return {msgType: 'error', payload: 'Can only cast replentish with heart when attacked directly'}
            }
            if (!this.tryPullCards(player, packet.cards)) {
              return {msgType: 'error', payload: 'Spell cards are not part of your hand'}
            }
          }
          else if (spellCard.suit !== 'club' && spellCard.suit !== 'diamond') {
            return {msgType: 'error', payload: 'Must either boost with clubs, or shield with diamond'}
          }
          else if (!this.tryPullCards(player, packet.cards)) {
            return {msgType: 'error', payload: 'Spell cards are not part of your hand'}
          }
          this.state.pendingSpell = {
            spellCard,
            initiator: player,
            type: 'stSpell',
            target: player === this.state.combatInfo.initiator ? this.state.combatInfo.attacker : this.state.combatInfo.defender
          }
          this.state.subphase = 'counter'
          this.state.move = this.otherPlayer(player)
        }
        this.state.key++
        this.distributeState()
        break
      case 'stSpell':
      case 'spSpell':
        if (player !== this.state.move) {
          return {msgType: 'error', payload: 'Can only use action during turn'}
        }
        if (packet.cards.length !== 1) {
          return {msgType: 'error', payload: 'Must have exactly 1 card for spells'}
        }
        let spellCard = packet.cards[0]
        if (this.state.phase === 'action' && this.state.subphase === 'standard') {
          let target = null
          if (packet.action === 'stSpell') {
            switch (spellCard.suit) {
              case 'spade':
                // Must include a target
                target = packet.creatures ? this.findCreature(player, packet.creatures) : null
                break
              case 'heart':
                break
              default:
                return {msgType: 'error', payload: 'Can only cast spade and heart cards as spell actions'}
            }
          }
          else {
            switch (spellCard.val) {
              case 1:
              case 3:
                if (!packet.creatures) {
                  return {msgType: 'error', payload: 'Must specify a target'}
                }
                target = this.findCreature(player, packet.creatures)
                if (!target) {
                  return {msgType: 'error', payload: 'Invalid creature'}
                }
                break
              case 2:
                // Must have an empty creature slot avaliable to summon
                if (this.state[player].creatures.length >= 5) {
                  return {msgType: 'error', payload: 'Cannot summon any additional creatures!'}
                }
                break
              default:
                return {msgType: 'error', payload: 'Can only cast cards A-3 as special spells'}
            }
          }
          if (!this.tryPullCards(player, packet.cards)) {
            return {msgType: 'error', payload: 'You do not have the selected cards'}
          }
          this.state.pendingSpell = {
            spellCard,
            initiator: player,
            type: packet.action,
            target
          }
        }
        this.state.key++
        this.state.subphase = 'counter'
        this.state.move = this.otherPlayer(player)
        this.distributeState()
        break
      case 'counter':
        if (player !== this.state.move) {
          return {msgType: 'error', payload: 'Can only use action during turn'}
        }
        if (packet.cards.length === 0) {
          if (player !== this.state.pendingSpell.initiator) {
            // Resolve spell, since the original caster won the duel
            const spellBlock = this.state.pendingSpell
            if (spellBlock.type === 'stSpell') {
              switch (spellBlock.spellCard.suit) {
                case 'spade':
                  if (spellBlock.target) {
                    if (spellBlock.spellCard.val >= spellBlock.target.def.val || spellBlock.target.def.suit === 'spade') {
                      this.destroyCreature(spellBlock.target.id)
                    }
                  }
                  else {
                    // Damage to health directly
                    const defenderHealth = this.state[this.otherPlayer(spellBlock.initiator)].health
                    const topHealthCard = defenderHealth[defenderHealth.length - 1]
                    if (topHealthCard.suit === 'spade' || spellBlock.spellCard.val >= topHealthCard.val) {
                      defenderHealth.pop()
                      if (defenderHealth.length === 0) {
                        // Game ends!
                        this.state.phase = 'completed'
                        this.state.key++
                        this.state.move = spellBlock.initiator
                        this.distributeState()
                        this.endGameHandler()
                        return
                      }
                      defenderHealth[defenderHealth.length - 1].revealed = true
                    }
                  }
                  this.state.move = spellBlock.initiator
                  this.state.subphase = 'standard'
                  break
                case 'club':
                  spellBlock.target.atkBuff = spellBlock.spellCard
                  this.state.move = this.otherPlayer(spellBlock.initiator)
                  this.state.combatInfo.buffRoundRemain = 2
                  this.state.subphase = 'buffing'
                  break
                case 'diamond':
                  spellBlock.target.defBuff = spellBlock.spellCard
                  this.state.move = this.otherPlayer(spellBlock.initiator)
                  this.state.combatInfo.buffRoundRemain = 2
                  this.state.subphase = 'buffing'
                  break
                case 'heart':
                  spellBlock.spellCard.revealed = true
                  this.state[spellBlock.initiator].health.push(spellBlock.spellCard)
                  this.state.move = spellBlock.initiator
                  if (this.state.combatInfo) {
                    // This is done mid-combat, return to combat order as a buff card
                    this.state.combatInfo.buffRoundRemain = 2
                    this.state.subphase = 'buffing'
                  }
                  else {
                    this.state.subphase = 'standard'
                  }
                  break
              }
            }
            else if (spellBlock.type === 'spSpell') {
                switch (spellBlock.spellCard.val) {
                  case 1:
                    // Swap
                    const temp = spellBlock.target.atk
                    spellBlock.target.atk = spellBlock.target.def
                    spellBlock.target.def = temp
                    this.state.move = spellBlock.initiator
                    this.state.subphase = 'standard'
                    break
                  case 2:
                    // Quick Summon
                    this.state[this.state.pendingSpell.initiator].creatures.push({
                      id: this.nextCreatureId++,
                      atk: {...spellBlock.spellCard},
                      def: {...spellBlock.spellCard},
                      atkBuff: null,
                      defBuff: null,
                      tap: true
                    })
                    this.state.move = spellBlock.initiator
                    this.state.subphase = 'standard'
                    break
                  case 3:
                    // Recall
                    const owner = this.destroyCreature(spellBlock.target.id)
                    if (spellBlock.target.atk.val === spellBlock.target.def.val && spellBlock.target.atk.suit === spellBlock.target.def.suit) {
                      // The creature was summoned via quick summon special, so we don't want to return 2 of the same card
                      this.state[owner].hand.push(spellBlock.target.atk)
                    }
                    else {
                      this.state[owner].hand.push(spellBlock.target.atk, spellBlock.target.def)
                    }
                    if (this.state[owner].hand.length > 7) {
                      this.state.move = owner
                      this.state.subphase = 'discarding'
                    }
                    else {
                      this.state.move = this.state.pendingSpell.initiator
                      this.state.subphase = 'standard'
                    }
                    break
              }
            }
          }
          else {
            // Cancel the spell as if nothing had happened
            this.state.subphase = this.state.combatInfo ? 'buffing' : 'standard'
            this.state.move = this.state.pendingSpell.initiator
          }
          this.state.pendingSpell = null
          this.state.pendingCounter = null
          this.state.key++
          this.distributeState()
        }
        else if (packet.cards.length === 1) {
          // Check is valid counter
          const prevCard = this.state.pendingCounter || this.state.pendingSpell.spellCard
          const spellCard = packet.cards[0]
          if (spellCard.val >= prevCard.val) {
            return {msgType: 'error', payload: 'Counterspell cards must be of a smaller value!'}
          }
          const previousIsRed = prevCard.suit === 'heart' || prevCard.suit === 'diamond'
          const newIsRed = spellCard.suit === 'heart' || spellCard.suit === 'diamond'
          if (previousIsRed === newIsRed) {
            return {msgType: 'error', payload: 'Counterspell cards must be of a different color'}
          }
          if (!this.tryPullCards(player, packet.cards)) {
            return {msgType: 'error', payload: 'You do not have the selected cards'}
          }
          // Correct counterspell! We go to the other side
          this.state.move = this.otherPlayer(this.state.move)
          this.state.pendingCounter = spellCard
          this.state.key++
          this.distributeState()
        }
        break
      case 'pass':
        if (this.state.move === player && this.state.subphase === 'standard') {
          // Untap all creatures belonging to the player
          this.state[player].creatures.forEach(c => c.tap = false)
          // They are passing soo
          this.state.turn++
          this.state.key++
          this.state.move = this.otherPlayer(player)
          this.startTurnFor(this.state.move)
          this.distributeState()
        }
        break
      case 'forfeit':
        this.sockets[player].send(JSON.stringify({msgType: 'info', payload: 'You have forfeited the match.'}))
        this.sockets[this.otherPlayer(player)].send(JSON.stringify({msgType: 'info', payload: 'Your opponent has forfeited the match.'}))
        this.state.phase = 'completed'
        this.state.move = this.otherPlayer(player)
        this.state.key++
        this.distributeState()
        this.endGameHandler()
        break
    }
  }

  destroyCreature (id) {
    for (let i = 0; i < this.state.p1.creatures.length; i++) {
      if (this.state.p1.creatures[i].id === id) {
        this.state.p1.creatures.splice(i, 1)
        return 'p1'
      }
    }
    
    for (let i = 0; i < this.state.p2.creatures.length; i++) {
      if (this.state.p2.creatures[i].id === id) {
        this.state.p2.creatures.splice(i, 1)
        return 'p2'
      }
    }
  }

  findCreature (player, creatures) {
    if (creatures.attacker !== -1) return this.state[player].creatures[creatures.attacker]
    else if (creatures.defender !== -1) return this.state[this.otherPlayer(player)].creatures[creatures.defender]
    else return null
  }

  applyBuff (creatureArr, id) {
    for (let i = 0; i < creatureArr.length; i++) {
      if (creatureArr[i].id === id) {
        if (creatureArr[i].atkBuff) {
          creatureArr[i].atk = creatureArr[i].atkBuff
          creatureArr[i].atkBuff = null
        }
        if (creatureArr[i].defBuff) {
          creatureArr[i].def = creatureArr[i].defBuff
          creatureArr[i].defBuff = null
        }
        return
      }
    }
  }

  startTurnFor (player, count = 2) {
    this.state.key++
    const stateBlock = this.state[player]
    for (let i = 0; i < count; i++) {
      if (stateBlock.draw.length > 0) {
        stateBlock.hand.push(stateBlock.draw.pop())
      }
      else {
        stateBlock.hand.push(stateBlock.health.pop())
        if (stateBlock.health.length === 0) {
          // Active player loses
          this.state.phase = 'completed'
          this.state.move = this.otherPlayer(player)
          this.distributeState()
          this.endGameHandler()
          return
        }
        stateBlock.health[stateBlock.health.length - 1].revealed = true
      }
    }
    this.state.subphase = stateBlock.hand.length > 7 ? 'discard' : 'standard'
    this.state.originalTurn = player
  }
}

module.exports = Game 