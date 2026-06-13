export type Decision = 'continue' | 'leave'

export type HazardType = 'spider' | 'snake' | 'fire' | 'rocks' | 'spirit'

export type Card =
  | { id: string; kind: 'treasure'; value: number; gemsOnCard: number }
  | { id: string; kind: 'hazard'; hazard: HazardType }
  | { id: string; kind: 'artifact'; value: number }

export type Player = {
  id: string
  name: string
  color: string
  banked: number
  carried: number
  artifacts: number[]
  inTemple: boolean
}

export type LogEntry = {
  id: string
  title: string
  detail: string
}

export type RoundState = {
  number: number
  active: boolean
  deck: Card[]
  path: Card[]
  pendingDecisions: Record<string, Decision>
  decisionOrder: string[]
  currentDecisionIndex: number
  decisionPhase: 'choosing' | 'revealed'
  turnSummary: string
  artifactsAvailable: number[]
  removedHazards: HazardType[]
}

export type GameState = {
  players: Player[]
  round: RoundState
  status: 'setup' | 'playing' | 'game-over'
  seed: number
  log: LogEntry[]
}

export const PLAYER_COLORS = [
  '#f05d3b',
  '#26a88e',
  '#f0b429',
  '#5687f2',
  '#ca5cff',
  '#e45f92',
  '#66b84f',
  '#f17f29',
]

const TREASURE_VALUES = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17]
const HAZARDS: HazardType[] = ['spider', 'snake', 'fire', 'rocks', 'spirit']
const ARTIFACT_VALUES = [5, 5, 5, 10, 10]

export const HAZARD_LABELS: Record<HazardType, string> = {
  spider: '蛛網陷阱',
  snake: '毒蛇甬道',
  fire: '古火機關',
  rocks: '落石密室',
  spirit: '守墓幻影',
}

export function createGame(playerNames: string[], seed = Date.now()): GameState {
  if (playerNames.length < 3 || playerNames.length > 8) {
    throw new Error('Incan Gold needs 3 to 8 players.')
  }

  const players = playerNames.map((name, index) => ({
    id: `p${index + 1}`,
    name: name.trim() || `Explorer ${index + 1}`,
    color: PLAYER_COLORS[index],
    banked: 0,
    carried: 0,
    artifacts: [],
    inTemple: true,
  }))

  return startRound({
    players,
    seed,
    status: 'playing',
    round: emptyRound(0),
    log: [
      {
        id: `log-${seed}`,
        title: '探險隊出發',
        detail: `${players.length} 位玩家進入神廟。記住，貪心唔係錯，錯係爆煲都唔走。`,
      },
    ],
  })
}

export function recordDecision(state: GameState, playerId: string, decision: Decision): GameState {
  if (state.status !== 'playing' || state.round.decisionPhase !== 'choosing') return state
  const expectedPlayerId = state.round.decisionOrder[state.round.currentDecisionIndex]
  if (playerId !== expectedPlayerId || state.round.pendingDecisions[playerId]) return state

  const pendingDecisions = { ...state.round.pendingDecisions, [playerId]: decision }
  const nextIndex = state.round.currentDecisionIndex + 1
  const allChosen = nextIndex >= state.round.decisionOrder.length

  return {
    ...state,
    round: {
      ...state.round,
      pendingDecisions,
      currentDecisionIndex: nextIndex,
      decisionPhase: allChosen ? 'revealed' : 'choosing',
      turnSummary: allChosen ? summarizeChoices(state.players, pendingDecisions) : state.round.turnSummary,
    },
  }
}

export function resolveRevealedTurn(state: GameState): GameState {
  if (state.status !== 'playing' || state.round.decisionPhase !== 'revealed') return state

  const leavingIds = state.round.decisionOrder.filter(
    (id) => state.round.pendingDecisions[id] === 'leave',
  )

  let nextState = processLeavingPlayers(state, leavingIds)

  const remaining = nextState.players.filter((player) => player.inTemple)
  if (remaining.length === 0) {
    nextState = endRound(nextState, '全部玩家回營，今輪收隊。')
    return nextState
  }

  const drawn = nextState.round.deck[0]
  if (!drawn) {
    nextState = endRound(nextState, '牌堆清空，神廟今日都算夠你哋玩。')
    return nextState
  }

  const deck = nextState.round.deck.slice(1)
  if (drawn.kind === 'treasure') {
    return handleTreasure(nextState, drawn, deck)
  }

  if (drawn.kind === 'artifact') {
    return nextDecisionPhase(
      addLog(
        {
          ...nextState,
          round: {
            ...nextState.round,
            deck,
            path: [...nextState.round.path, drawn],
          },
        },
        '神器現身',
        `價值 ${drawn.value} 分嘅神器留在路上，單獨回營先可以帶走。`,
      ),
    )
  }

  return handleHazard(nextState, drawn, deck)
}

export function startNextRound(state: GameState): GameState {
  if (state.status !== 'playing' || state.round.active) return state
  if (state.round.number >= 5) {
    return {
      ...state,
      status: 'game-over',
      log: [
        finalLog(state),
        ...state.log,
      ],
    }
  }
  return startRound(state)
}

export function newDecisionPhase(state: GameState): GameState {
  return nextDecisionPhase(state)
}

export function totalScore(player: Player): number {
  return player.banked + player.carried + player.artifacts.reduce((sum, value) => sum + value, 0)
}

export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => totalScore(b) - totalScore(a))
}

export function buildBaseDeck(removedHazards: HazardType[] = []): Card[] {
  const treasures: Card[] = TREASURE_VALUES.map((value, index) => ({
    id: `t${index}-${value}`,
    kind: 'treasure',
    value,
    gemsOnCard: 0,
  }))

  const hazards: Card[] = HAZARDS.flatMap((hazard) => {
    const removedCount = removedHazards.filter((removed) => removed === hazard).length
    return Array.from({ length: Math.max(0, 3 - removedCount) }, (_, index) => ({
      id: `h-${hazard}-${index}`,
      kind: 'hazard' as const,
      hazard,
    }))
  })

  return [...treasures, ...hazards]
}

function startRound(state: GameState): GameState {
  const roundNumber = state.round.number + 1
  const removedHazards = state.round.removedHazards ?? []
  const artifact = ARTIFACT_VALUES[roundNumber - 1]
  const artifactCards: Card[] = artifact
    ? [{ id: `a${roundNumber}-${artifact}`, kind: 'artifact', value: artifact }]
    : []
  const seed = advanceSeed(state.seed)
  const deck = shuffle([...buildBaseDeck(removedHazards), ...artifactCards], seed)
  const players = state.players.map((player) => ({
    ...player,
    carried: 0,
    inTemple: true,
  }))

  return nextDecisionPhase({
    ...state,
    seed,
    players,
    round: {
      number: roundNumber,
      active: true,
      deck,
      path: [],
      pendingDecisions: {},
      decisionOrder: [],
      currentDecisionIndex: 0,
      decisionPhase: 'choosing',
      turnSummary: '',
      artifactsAvailable: artifact ? [artifact] : [],
      removedHazards,
    },
    log: [
      {
        id: `log-round-${roundNumber}-${seed}`,
        title: `第 ${roundNumber} 輪開始`,
        detail: `新神器已洗入牌堆。想做英雄可以，記得英雄都會跌落坑。`,
      },
      ...state.log,
    ],
  })
}

function emptyRound(number: number): RoundState {
  return {
    number,
    active: false,
    deck: [],
    path: [],
    pendingDecisions: {},
    decisionOrder: [],
    currentDecisionIndex: 0,
    decisionPhase: 'choosing',
    turnSummary: '',
    artifactsAvailable: [],
    removedHazards: [],
  }
}

function nextDecisionPhase(state: GameState): GameState {
  const decisionOrder = state.players.filter((player) => player.inTemple).map((player) => player.id)

  return {
    ...state,
    round: {
      ...state.round,
      pendingDecisions: {},
      decisionOrder,
      currentDecisionIndex: 0,
      decisionPhase: 'choosing',
      turnSummary: '',
    },
  }
}

function processLeavingPlayers(state: GameState, leavingIds: string[]): GameState {
  if (leavingIds.length === 0) return state

  const looseGems = state.round.path.reduce(
    (sum, card) => sum + (card.kind === 'treasure' ? card.gemsOnCard : 0),
    0,
  )
  const share = Math.floor(looseGems / leavingIds.length)
  let remainder = looseGems % leavingIds.length
  const singleLeaver = leavingIds.length === 1 ? leavingIds[0] : null
  const artifactsOnPath = state.round.path
    .filter((card): card is Extract<Card, { kind: 'artifact' }> => card.kind === 'artifact')
    .map((card) => card.value)

  const players = state.players.map((player) => {
    if (!leavingIds.includes(player.id)) return player
    const wonArtifacts = singleLeaver === player.id ? artifactsOnPath : []
    return {
      ...player,
      banked: player.banked + player.carried + share,
      carried: 0,
      artifacts: [...player.artifacts, ...wonArtifacts],
      inTemple: false,
    }
  })

  const path = state.round.path.map((card) => {
    if (card.kind !== 'treasure') return card
    const gemsOnCard = remainder
    remainder = 0
    return { ...card, gemsOnCard }
  }).filter((card) => !(singleLeaver && card.kind === 'artifact'))

  const artifactText =
    singleLeaver && artifactsOnPath.length
      ? ` ${playerName(state, singleLeaver)} 單獨回營，順手拎走神器 ${artifactsOnPath.join(', ')} 分。`
      : artifactsOnPath.length
        ? ' 多人一齊回營，神器無人可以獨吞。'
        : ''

  return addLog(
    {
      ...state,
      players,
      round: {
        ...state.round,
        path,
        artifactsAvailable:
          singleLeaver && artifactsOnPath.length > 0
            ? []
            : state.round.artifactsAvailable,
      },
    },
    '有人回營',
    `${leavingIds.map((id) => playerName(state, id)).join('、')} 入帳本輪寶石，每人分到路上餘寶 ${share} 分。${artifactText}`,
  )
}

function handleTreasure(state: GameState, card: Extract<Card, { kind: 'treasure' }>, deck: Card[]): GameState {
  const explorers = state.players.filter((player) => player.inTemple)
  const share = Math.floor(card.value / explorers.length)
  const remainder = card.value % explorers.length
  const players = state.players.map((player) =>
    player.inTemple ? { ...player, carried: player.carried + share } : player,
  )
  const drawn = { ...card, gemsOnCard: remainder }

  return nextDecisionPhase(
    addLog(
      {
        ...state,
        players,
        round: {
          ...state.round,
          deck,
          path: [...state.round.path, drawn],
        },
      },
      '發現寶石',
      `翻出 ${card.value} 分寶藏，仍在神廟嘅玩家每人即袋 ${share} 分，${remainder} 分留在路上。`,
    ),
  )
}

function handleHazard(state: GameState, card: Extract<Card, { kind: 'hazard' }>, deck: Card[]): GameState {
  const sameHazards = state.round.path.filter(
    (pathCard) => pathCard.kind === 'hazard' && pathCard.hazard === card.hazard,
  )
  const path = [...state.round.path, card]

  if (sameHazards.length === 0) {
    return nextDecisionPhase(
      addLog(
        {
          ...state,
          round: {
            ...state.round,
            deck,
            path,
          },
        },
        '危機出現',
        `${HAZARD_LABELS[card.hazard]} 出現第一次。未爆，但氣氛已經唔對路。`,
      ),
    )
  }

  const players = state.players.map((player) =>
    player.inTemple ? { ...player, carried: 0, inTemple: false } : player,
  )

  return endRound(
    addLog(
      {
        ...state,
        players,
        round: {
          ...state.round,
          deck,
          path,
          removedHazards: [...state.round.removedHazards, card.hazard],
        },
      },
      '災難爆煲',
      `${HAZARD_LABELS[card.hazard]} 第二次出現，仍在神廟嘅玩家本輪未入帳寶石全部歸零。`,
    ),
    `${HAZARD_LABELS[card.hazard]} 令第 ${state.round.number} 輪即時結束。`,
  )
}

function endRound(state: GameState, reason: string): GameState {
  const keptPath = state.round.path.filter((card) => card.kind !== 'artifact')
  return addLog(
    {
      ...state,
      round: {
        ...state.round,
        active: false,
        deck: [],
        path: keptPath,
        decisionOrder: [],
        pendingDecisions: {},
        currentDecisionIndex: 0,
        decisionPhase: 'revealed',
        turnSummary: reason,
      },
    },
    '回合結束',
    reason,
  )
}

function summarizeChoices(players: Player[], decisions: Record<string, Decision>): string {
  const names = (decision: Decision) =>
    players
      .filter((player) => decisions[player.id] === decision)
      .map((player) => player.name)
      .join('、') || '無人'

  return `繼續探索：${names('continue')}。回營：${names('leave')}。`
}

function finalLog(state: GameState): LogEntry {
  const winner = rankPlayers(state.players)[0]
  return {
    id: `log-final-${state.seed}`,
    title: '遊戲完結',
    detail: `${winner.name} 以 ${totalScore(winner)} 分勝出。其他人今晚要反省下：係運氣差，定係貪到離晒譜。`,
  }
}

function addLog(state: GameState, title: string, detail: string): GameState {
  return {
    ...state,
    log: [
      {
        id: `log-${state.seed}-${state.log.length}-${title.replace(/\s+/g, '-').toLowerCase()}`,
        title,
        detail,
      },
      ...state.log,
    ],
  }
}

function playerName(state: GameState, playerId: string): string {
  return state.players.find((player) => player.id === playerId)?.name ?? '未知玩家'
}

function advanceSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0
}

function shuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items]
  let currentSeed = seed
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    currentSeed = advanceSeed(currentSeed)
    const swapIndex = currentSeed % (index + 1)
    const temp = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = temp
  }
  return shuffled
}
