import { describe, expect, it } from 'vitest'
import {
  type Card,
  buildBaseDeck,
  createGame,
  newDecisionPhase,
  recordDecision,
  recordDecisions,
  resolveRevealedTurn,
  reviseDecisions,
  startNextRound,
  totalScore,
} from './game'

const names = ['Ada', 'Ben', 'Chloe']

function forceDeck(cards: Card[]) {
  const game = createGame(names, 42)
  return {
    ...game,
    round: {
      ...game.round,
      deck: cards,
    },
  }
}

function chooseAllContinue(game: ReturnType<typeof createGame>) {
  return game.round.decisionOrder.reduce(
    (state, playerId) => recordDecision(state, playerId, 'continue'),
    game,
  )
}

it('splits treasure among explorers and leaves the remainder on the path', () => {
  const game = forceDeck([{ id: 'treasure-5', kind: 'treasure', value: 5, gemsOnCard: 0 }])
  const resolved = resolveRevealedTurn(chooseAllContinue(game))

  expect(resolved.players.map((player) => player.carried)).toEqual([1, 1, 1])
  expect(resolved.round.path[0]).toMatchObject({ kind: 'treasure', gemsOnCard: 2 })
  expect(resolved.round.decisionPhase).toBe('card-revealed')
})

it('requires everyone to acknowledge the drawn card before the next decisions', () => {
  const game = forceDeck([{ id: 'treasure-5', kind: 'treasure', value: 5, gemsOnCard: 0 }])
  const awaitingAcknowledgement = resolveRevealedTurn(chooseAllContinue(game))

  expect(recordDecision(awaitingAcknowledgement, 'p1', 'continue')).toEqual(awaitingAcknowledgement)

  const acknowledged = newDecisionPhase(awaitingAcknowledgement)
  expect(acknowledged.round.decisionPhase).toBe('choosing')
  expect(acknowledged.round.decisionOrder).toEqual(['p1', 'p2', 'p3'])
  expect(acknowledged.round.currentDecisionIndex).toBe(0)
})

it('keeps decisions hidden until every active player has chosen', () => {
  const game = createGame(names, 12)
  const first = recordDecision(game, 'p1', 'leave')
  const second = recordDecision(first, 'p2', 'continue')

  expect(first.round.decisionPhase).toBe('choosing')
  expect(second.round.decisionPhase).toBe('choosing')
  expect(recordDecision(second, 'p3', 'continue').round.decisionPhase).toBe('revealed')
})

it('rejects out-of-turn and duplicate decisions', () => {
  const game = createGame(names, 12)
  const outOfTurn = recordDecision(game, 'p2', 'leave')
  const first = recordDecision(game, 'p1', 'continue')
  const duplicate = recordDecision(first, 'p1', 'leave')

  expect(outOfTurn).toEqual(game)
  expect(duplicate).toEqual(first)
  expect(first.round.currentDecisionIndex).toBe(1)
})

it('records a complete host vote in one action', () => {
  const game = createGame(names, 12, { mode: 'host' })
  const recorded = recordDecisions(game, {
    p1: 'continue',
    p2: 'leave',
    p3: 'continue',
  })

  expect(recorded.round.decisionPhase).toBe('revealed')
  expect(recorded.round.currentDecisionIndex).toBe(3)
  expect(recorded.round.pendingDecisions).toEqual({
    p1: 'continue',
    p2: 'leave',
    p3: 'continue',
  })
})

it('rejects an incomplete or unexpected host vote', () => {
  const game = createGame(names, 12, { mode: 'host' })

  expect(recordDecisions(game, { p1: 'continue', p2: 'leave' })).toEqual(game)
  expect(
    recordDecisions(game, {
      p1: 'continue',
      p2: 'leave',
      p3: 'continue',
      p4: 'leave',
    }),
  ).toEqual(game)
})

it('lets the host return to edit a reviewed vote', () => {
  const game = createGame(names, 12, { mode: 'host' })
  const recorded = recordDecisions(game, {
    p1: 'continue',
    p2: 'leave',
    p3: 'continue',
  })
  const revised = reviseDecisions(recorded)

  expect(revised.round.decisionPhase).toBe('choosing')
  expect(revised.round.pendingDecisions).toEqual(recorded.round.pendingDecisions)
})

it('stores the participating host identity only in host mode', () => {
  const hosted = createGame(names, 12, {
    mode: 'host',
    hostParticipates: true,
    hostPlayerId: 'p2',
  })
  const hotSeat = createGame(names, 12, {
    mode: 'hot-seat',
    hostParticipates: true,
    hostPlayerId: 'p2',
  })

  expect(hosted).toMatchObject({
    mode: 'host',
    hostParticipates: true,
    hostPlayerId: 'p2',
  })
  expect(hotSeat).toMatchObject({
    mode: 'hot-seat',
    hostParticipates: false,
    hostPlayerId: null,
  })
})

it('lets a single leaver bank carried gems and loose gems, with artifact scored once', () => {
  const game = forceDeck([{ id: 'treasure-1', kind: 'treasure', value: 1, gemsOnCard: 0 }])
  const staged = {
    ...game,
    players: game.players.map((player) => ({ ...player, carried: 3 })),
    round: {
      ...game.round,
      path: [
        { id: 'loose', kind: 'treasure', value: 5, gemsOnCard: 2 },
        { id: 'artifact', kind: 'artifact', value: 5 },
      ] as Card[],
    },
  }

  const withChoices = recordDecision(
    recordDecision(recordDecision(staged, 'p1', 'leave'), 'p2', 'continue'),
    'p3',
    'continue',
  )
  const resolved = resolveRevealedTurn(withChoices)

  expect(resolved.players[0].banked).toBe(5)
  expect(resolved.players[0].artifacts).toEqual([5])
  expect(totalScore(resolved.players[0])).toBe(10)
  expect(resolved.players[1].inTemple).toBe(true)
})

it('does not award an artifact when multiple players leave together', () => {
  const game = forceDeck([{ id: 'treasure-1', kind: 'treasure', value: 1, gemsOnCard: 0 }])
  const staged = {
    ...game,
    round: {
      ...game.round,
      path: [{ id: 'artifact', kind: 'artifact', value: 5 }] as Card[],
    },
  }
  const withChoices = recordDecision(
    recordDecision(recordDecision(staged, 'p1', 'leave'), 'p2', 'leave'),
    'p3',
    'continue',
  )

  const resolved = resolveRevealedTurn(withChoices)

  expect(resolved.players[0].artifacts).toEqual([])
  expect(resolved.players[1].artifacts).toEqual([])
})

it('keeps an undrawn artifact available when one player leaves early', () => {
  const game = forceDeck([{ id: 'treasure-3', kind: 'treasure', value: 3, gemsOnCard: 0 }])
  const withChoices = recordDecision(
    recordDecision(recordDecision(game, 'p1', 'leave'), 'p2', 'continue'),
    'p3',
    'continue',
  )

  const resolved = resolveRevealedTurn(withChoices)

  expect(resolved.round.artifactsAvailable).toEqual([5])
  expect(resolved.round.path.some((card) => card.kind === 'artifact')).toBe(false)
})

it('reshuffles undrawn artifacts into the next round together with the new artifact', () => {
  const game = forceDeck([{ id: 'artifact-r1', kind: 'artifact', value: 5 }])
  const allLeave = game.round.decisionOrder.reduce(
    (state, playerId) => recordDecision(state, playerId, 'leave'),
    game,
  )
  const ended = resolveRevealedTurn(allLeave)
  const nextRound = startNextRound(ended)

  expect(ended.round.artifactsAvailable).toEqual([5])
  expect(nextRound.round.artifactsAvailable).toEqual([5, 5])
  expect(nextRound.round.deck.filter((card) => card.kind === 'artifact')).toHaveLength(2)
})

it('removes a revealed artifact at round end when nobody claims it', () => {
  const game = forceDeck([{ id: 'artifact-r1', kind: 'artifact', value: 5 }])
  const revealed = resolveRevealedTurn(chooseAllContinue(game))
  const choosingAgain = newDecisionPhase(revealed)
  const allLeave = choosingAgain.round.decisionOrder.reduce(
    (state, playerId) => recordDecision(state, playerId, 'leave'),
    choosingAgain,
  )
  const ended = resolveRevealedTurn(allLeave)

  expect(ended.round.artifactsAvailable).toEqual([])
})

it('banks carried and loose gems when the deck is exhausted', () => {
  const game = forceDeck([])
  const staged = {
    ...game,
    players: game.players.map((player) => ({ ...player, carried: 4 })),
    round: {
      ...game.round,
      path: [{ id: 'loose', kind: 'treasure', value: 5, gemsOnCard: 2 }] as Card[],
    },
  }
  const ended = resolveRevealedTurn(chooseAllContinue(staged))

  expect(ended.round.active).toBe(false)
  expect(ended.players.map((player) => player.banked)).toEqual([4, 4, 4])
  expect(ended.players.every((player) => player.carried === 0)).toBe(true)
})

it('ends the round and removes one hazard type when a second matching hazard appears', () => {
  const game = forceDeck([{ id: 'spider-2', kind: 'hazard', hazard: 'spider' }])
  const staged = {
    ...game,
    players: game.players.map((player) => ({ ...player, carried: 4 })),
    round: {
      ...game.round,
      path: [{ id: 'spider-1', kind: 'hazard', hazard: 'spider' }] as Card[],
    },
  }

  const resolved = resolveRevealedTurn(chooseAllContinue(staged))

  expect(resolved.round.active).toBe(false)
  expect(resolved.round.removedHazards).toContain('spider')
  expect(resolved.players.every((player) => player.carried === 0)).toBe(true)
})

it('removes only one matching hazard card from future rounds per disaster', () => {
  expect(buildBaseDeck([]).filter((card) => card.kind === 'hazard' && card.hazard === 'spider')).toHaveLength(3)
  expect(buildBaseDeck(['spider']).filter((card) => card.kind === 'hazard' && card.hazard === 'spider')).toHaveLength(2)
  expect(buildBaseDeck(['spider', 'spider']).filter((card) => card.kind === 'hazard' && card.hazard === 'spider')).toHaveLength(1)
  expect(buildBaseDeck(['spider']).filter((card) => card.kind === 'hazard')).toHaveLength(14)
})

describe.each([3, 6, 8])('%i-player game', (playerCount) => {
  it('completes all five rounds and reaches final scoring', () => {
    let game = createGame(
      Array.from({ length: playerCount }, (_, index) => `Player ${index + 1}`),
      7,
    )

    for (let round = 1; round <= 5; round += 1) {
      const withChoices = game.round.decisionOrder.reduce(
        (state, playerId) => recordDecision(state, playerId, 'leave'),
        game,
      )
      game = resolveRevealedTurn(withChoices)
      if (round < 5) {
        game = startNextRound(game)
      }
    }

    const finished = startNextRound(game)

    expect(finished.status).toBe('game-over')
    expect(finished.players).toHaveLength(playerCount)
    expect(Math.max(...finished.players.map(totalScore))).toBeGreaterThanOrEqual(0)
  })
})

describe('player count validation', () => {
  it('requires 3 to 8 players', () => {
    expect(() => createGame(['A', 'B'])).toThrow()
    expect(() => createGame(Array.from({ length: 9 }, (_, index) => `P${index}`))).toThrow()
  })
})

describe('deck randomization', () => {
  it('is reproducible for the same seed and changes across seeds', () => {
    const first = createGame(names, 12345).round.deck.map((card) => card.id)
    const repeated = createGame(names, 12345).round.deck.map((card) => card.id)
    const different = createGame(names, 12346).round.deck.map((card) => card.id)

    expect(repeated).toEqual(first)
    expect(different).not.toEqual(first)
  })

  it('gives every first-round card a reasonable chance to appear first', () => {
    const frequencies = new Map<string, number>()

    for (let seed = 1; seed <= 3100; seed += 1) {
      const firstCard = createGame(names, seed).round.deck[0]
      frequencies.set(firstCard.id, (frequencies.get(firstCard.id) ?? 0) + 1)
    }

    const counts = [...frequencies.values()]
    expect(frequencies.size).toBe(31)
    expect(Math.min(...counts)).toBeGreaterThan(65)
    expect(Math.max(...counts)).toBeLessThan(140)
  })
})

describe.each([3, 6, 8])('%i-player randomized simulations', (playerCount) => {
  it('finishes 100 complete games without invalid scores or stuck phases', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      let game = createGame(
        Array.from({ length: playerCount }, (_, index) => `Player ${index + 1}`),
        seed,
        { mode: 'host' },
      )
      let step = 0

      while (game.status === 'playing') {
        step += 1
        expect(step).toBeLessThan(500)

        if (!game.round.active) {
          game = startNextRound(game)
          continue
        }

        if (game.round.decisionPhase === 'card-revealed') {
          game = newDecisionPhase(game)
          continue
        }

        if (game.round.decisionPhase === 'choosing') {
          const decisions = Object.fromEntries(
            game.round.decisionOrder.map((playerId, index) => [
              playerId,
              (seed + game.round.number + step + index) % 7 === 0 ? 'leave' : 'continue',
            ]),
          ) as Record<string, 'continue' | 'leave'>
          game = recordDecisions(game, decisions)
          continue
        }

        game = resolveRevealedTurn(game)
      }

      expect(game.round.number).toBe(5)
      expect(game.players.every((player) => Number.isInteger(totalScore(player)))).toBe(true)
      expect(game.players.every((player) => totalScore(player) >= 0)).toBe(true)
      expect(game.players.every((player) => player.carried === 0)).toBe(true)
    }
  })
})
