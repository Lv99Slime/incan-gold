import { describe, expect, it } from 'vitest'
import {
  type Card,
  buildBaseDeck,
  createGame,
  recordDecision,
  resolveRevealedTurn,
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
