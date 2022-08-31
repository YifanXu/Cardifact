class Game {
  constructor(prevState = null, sockets) {
    this.sockets = sockets
    if (prevState) {
      this.state = state
      return
    }
    // Init State
    this.state = {
      phase: 'drafting',
      move: 'both',
      turn: 1,
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
  distributeState () {
    this.sockets.p1.send(JSON.stringify({msgType: 'gameState', payload: this.generatePacket('p1')}))
    this.sockets.p2.send(JSON.stringify({msgType: 'gameState', payload: this.generatePacket('p2')}))
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
      move: this.state.move,
      turn: this.state.turn,
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
      creatures: friendlyBlock.creatures,
      health: friendlyBlock.health.map(c => c.revealed ? c : {suit: "", val: 0}),
      draw: friendlyBlock.draw.length,
      hand: friendlyBlock.hand.length
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

  handleAction (player, packet) {
    switch(packet.action) {
      // Drafting the starting health cards from the deck
      case "draft": 
        if (this.state.phase !== 'drafting') {
          return {type: 'error', msg: 'Cannot draft when it is not the drafting phase'}
        }
        if (this.state[player].health.length > 0) {
          return {type: 'error', msg: 'You have already drafted'}
        }
        if (this.tryPullCards(packet.player, packet.cards)) {
          this.state[player].health = packet.cards
          return {type: 'info', msg: 'Health drafting successful'}
        }
        else {
          return {type: 'error', msg: 'Selected cards are not part of your hand'}
        }
    }

    
  }
}

module.exports = Game 