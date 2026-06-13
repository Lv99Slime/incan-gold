import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Award,
  Bug,
  DoorOpen,
  Eye,
  EyeOff,
  Flame,
  Footprints,
  Gem,
  Ghost,
  History,
  LockKeyhole,
  Mountain,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tent,
  Trophy,
  Waves,
} from 'lucide-react'
import './App.css'
import {
  type Card,
  type Decision,
  type GameState,
  HAZARD_LABELS,
  createGame,
  rankPlayers,
  recordDecision,
  resolveRevealedTurn,
  startNextRound,
  totalScore,
} from './game'

const STORAGE_KEY = 'incan-gold-hotseat-v1'

const defaultNames = ['阿進', '阿寶', 'Mina']

function App() {
  const [game, setGame] = useState<GameState | null>(() => loadGame())
  const [visibleScores, setVisibleScores] = useState<Set<string>>(() => new Set())
  const [unlockedPlayerId, setUnlockedPlayerId] = useState<string | null>(null)
  const [playerCount, setPlayerCount] = useState(game?.players.length ?? 3)
  const [names, setNames] = useState<string[]>(
    game?.players.map((player) => player.name) ?? defaultNames,
  )

  useEffect(() => {
    if (game) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
    }
  }, [game])

  const activePlayer = useMemo(() => {
    if (!game || game.status !== 'playing') return null
    const playerId = game.round.decisionOrder[game.round.currentDecisionIndex]
    return game.players.find((player) => player.id === playerId) ?? null
  }, [game])

  const rankedPlayers = useMemo(() => (game ? rankPlayers(game.players) : []), [game])

  function updatePlayerCount(count: number) {
    setPlayerCount(count)
    setNames((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? `玩家 ${index + 1}`),
    )
  }

  function startGame() {
    const cleanNames = names.slice(0, playerCount).map((name, index) => name.trim() || `玩家 ${index + 1}`)
    setUnlockedPlayerId(null)
    setGame(createGame(cleanNames))
  }

  function resetGame() {
    localStorage.removeItem(STORAGE_KEY)
    setVisibleScores(new Set())
    setUnlockedPlayerId(null)
    setGame(null)
    setPlayerCount(3)
    setNames(defaultNames)
  }

  function choose(decision: Decision) {
    if (!game || !activePlayer || unlockedPlayerId !== activePlayer.id) return
    setVisibleScores(new Set())
    setUnlockedPlayerId(null)
    setGame(recordDecision(game, activePlayer.id, decision))
  }

  function resolveTurn() {
    if (!game) return
    setGame(resolveRevealedTurn(game))
  }

  function nextRound() {
    if (!game) return
    setGame(startNextRound(game))
  }

  function toggleScore(playerId: string) {
    if (
      game?.round.decisionPhase !== 'choosing' ||
      activePlayer?.id !== playerId ||
      unlockedPlayerId !== playerId
    ) {
      return
    }

    setVisibleScores((current) => {
      const next = new Set(current)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }

  if (!game || game.status === 'setup') {
    return (
      <main className="app-shell setup-shell">
        <HeroPanel />
        <section className="setup-panel">
          <div className="panel-heading">
            <span className="eyebrow">Hot-seat local play</span>
            <h2>設定探險隊</h2>
            <p>3 至 8 人，同一個畫面逐位秘密決定：繼續入神廟，定係即刻返營。</p>
          </div>

          <label className="field">
            <span>玩家人數</span>
            <select value={playerCount} onChange={(event) => updatePlayerCount(Number(event.target.value))}>
              {Array.from({ length: 6 }, (_, index) => index + 3).map((count) => (
                <option key={count} value={count}>
                  {count} 人
                </option>
              ))}
            </select>
          </label>

          <div className="name-grid">
            {Array.from({ length: playerCount }, (_, index) => (
              <label className="field compact" key={index}>
                <span>玩家 {index + 1}</span>
                <input
                  value={names[index] ?? ''}
                  maxLength={14}
                  onChange={(event) =>
                    setNames((current) =>
                      current.map((name, nameIndex) => (nameIndex === index ? event.target.value : name)),
                    )
                  }
                />
              </label>
            ))}
          </div>

          <button className="primary-action" type="button" onClick={startGame}>
            <Sparkles size={20} />
            開始尋寶
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell game-shell">
      {game.round.active &&
        game.round.decisionPhase === 'choosing' &&
        activePlayer &&
        unlockedPlayerId !== activePlayer.id && (
          <PrivacyHandoff
            player={activePlayer}
            step={game.round.currentDecisionIndex + 1}
            total={game.round.decisionOrder.length}
            onReady={() => {
              setVisibleScores(new Set())
              setUnlockedPlayerId(activePlayer.id)
            }}
          />
        )}
      <header className="top-bar">
        <div>
          <span className="eyebrow">Incan Gold / 印加寶藏 教學遊玩版</span>
          <h1>神廟桌面</h1>
        </div>
        <button className="ghost-button" type="button" onClick={resetGame}>
          <RotateCcw size={18} />
          新遊戲
        </button>
      </header>

      <RoundProgress currentRound={game.round.number} active={game.round.active} />

      <section className="score-strip" aria-label="玩家分數">
        {game.players.map((player, index) => {
          const scoreVisible = visibleScores.has(player.id)
          const canViewScore =
            game.round.decisionPhase === 'choosing' &&
            activePlayer?.id === player.id &&
            unlockedPlayerId === player.id
          return (
          <article className="player-chip" key={player.id} style={{ borderColor: player.color }}>
            <div className="player-marker" title={`玩家 ${index + 1}`}>
              <Tent size={18} />
            </div>
            <div className="player-chip-copy">
              <div className="player-chip-heading">
                <strong>{player.name}</strong>
                <span className={player.inTemple ? 'player-location active' : 'player-location'}>
                  {player.inTemple ? '仍在神廟' : '已回營'}
                </span>
              </div>
              <div className="player-chip-scores">
                <span>
                  袋中 <b>{player.carried}</b>
                </span>
                <span>
                  營地 <b>{scoreVisible ? player.banked : '•••'}</b>
                </span>
              </div>
            </div>
            <button
              className="score-visibility-button"
              type="button"
              onClick={() => toggleScore(player.id)}
              disabled={!canViewScore}
              aria-label={
                canViewScore
                  ? `${scoreVisible ? '隱藏' : '顯示'} ${player.name} 的分數`
                  : `${player.name} 的分數已鎖定`
              }
              title={
                canViewScore
                  ? `${scoreVisible ? '隱藏' : '顯示'}自己的營地分數`
                  : '只可由目前選擇中的玩家查看'
              }
            >
              {!canViewScore ? (
                <LockKeyhole size={17} />
              ) : scoreVisible ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
            <div className={player.inTemple ? 'status-dot active' : 'status-dot'} title={player.inTemple ? '仍在探索' : '已回營'} />
          </article>
          )
        })}
      </section>

      {game.status === 'game-over' ? (
        <FinalScore players={rankedPlayers} onReset={resetGame} />
      ) : (
        <section className="table-layout">
          <GameBoard game={game} />
          <aside className="control-panel">
            {game.round.active ? (
              game.round.decisionPhase === 'choosing' ? (
                <DecisionPanel activePlayer={activePlayer} game={game} onChoose={choose} />
              ) : (
                <RevealPanel game={game} onResolve={resolveTurn} />
              )
            ) : (
              <RoundBreak game={game} onNextRound={nextRound} />
            )}
          </aside>
          <LogPanel game={game} />
        </section>
      )}
    </main>
  )
}

function HeroPanel() {
  return (
    <section className="hero-panel">
      <div className="sun-disc" />
      <div className="temple-stack" aria-hidden="true">
        <div />
        <div />
        <div />
        <div />
      </div>
      <span className="eyebrow">Incan Gold / 印加寶藏</span>
      <h1>入神廟，拎寶石，識走先係真醒目。</h1>
      <p>
        這是原創視覺的教學遊玩版：保留 press-your-luck 核心流程，適合課堂、社團或朋友聚會即場試玩。
      </p>
    </section>
  )
}

function PrivacyHandoff({
  player,
  step,
  total,
  onReady,
}: {
  player: GameState['players'][number]
  step: number
  total: number
  onReady: () => void
}) {
  return (
    <div className="privacy-overlay" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <section className="privacy-card">
        <div className="privacy-seal" style={{ background: player.color }}>
          <Tent size={30} />
        </div>
        <span className="eyebrow">秘密選擇 {step} / {total}</span>
        <h2 id="privacy-title">請將裝置交給 {player.name}</h2>
        <p>其他玩家請移開視線。按下準備好後，先會顯示今次探索選擇同私人分數按鈕。</p>
        <button className="primary-action" type="button" onClick={onReady}>
          <Eye size={20} />
          我係 {player.name}，準備好
        </button>
      </section>
    </div>
  )
}

function RoundProgress({ currentRound, active }: { currentRound: number; active: boolean }) {
  return (
    <section className="round-progress" aria-label={`五輪探索進度，目前第 ${currentRound} 輪`}>
      {Array.from({ length: 5 }, (_, index) => {
        const round = index + 1
        const completed = round < currentRound || (round === currentRound && !active)
        const current = round === currentRound && active
        return (
          <div
            className={`round-step${completed ? ' completed' : ''}${current ? ' current' : ''}`}
            key={round}
          >
            <span>{completed ? '✓' : round}</span>
            <strong>{round === 5 ? '終章' : `第 ${round} 輪`}</strong>
          </div>
        )
      })}
    </section>
  )
}

function GameBoard({ game }: { game: GameState }) {
  const hazards = game.round.path.filter((card) => card.kind === 'hazard')
  const looseGems = game.round.path.reduce(
    (sum, card) => sum + (card.kind === 'treasure' ? card.gemsOnCard : 0),
    0,
  )

  return (
    <section className="board-panel">
      <div className="round-header">
        <div>
          <span className="eyebrow">Round {game.round.number} / 5</span>
          <h2>{game.round.active ? '探索中' : '回合已結束'}</h2>
        </div>
        <div className="deck-meter">
          <span>牌堆</span>
          <strong>{game.round.deck.length}</strong>
        </div>
      </div>

      <div className="round-stats">
        <Stat icon={<Gem size={18} />} label="路上餘寶" value={`${looseGems} 分`} />
        <Stat icon={<ShieldAlert size={18} />} label="已見危機" value={`${hazards.length} 張`} />
        <Stat icon={<Award size={18} />} label="本輪神器" value={game.round.artifactsAvailable.join(', ') || '已處理'} />
      </div>

      <div className="path-lane" aria-label="已翻開的探索路徑">
        {game.round.path.length === 0 ? (
          <div className="empty-path">神廟入口仲靜到似測驗前一分鐘，第一張牌未翻。</div>
        ) : (
          game.round.path.map((card, index) => (
            <CardTile
              card={card}
              pathIndex={index + 1}
              isLatest={index === game.round.path.length - 1}
              key={card.id}
            />
          ))
        )}
      </div>
    </section>
  )
}

function DecisionPanel({
  activePlayer,
  game,
  onChoose,
}: {
  activePlayer: GameState['players'][number] | null
  game: GameState
  onChoose: (decision: Decision) => void
}) {
  if (!activePlayer) return null

  const step = game.round.currentDecisionIndex + 1
  const total = game.round.decisionOrder.length

  return (
    <section className="decision-panel">
      <span className="eyebrow">Secret choice {step} / {total}</span>
      <h2>{activePlayer.name}，你嘅選擇</h2>
      <p>其他人轉開視線。呢一步唔顯示之前選擇，咪偷睇，做人要有少少 board game 道德。</p>
      <div className="choice-actions">
        <button type="button" className="continue-button" onClick={() => onChoose('continue')}>
          <Footprints size={22} />
          繼續探索
        </button>
        <button type="button" className="leave-button" onClick={() => onChoose('leave')}>
          <DoorOpen size={22} />
          回營入帳
        </button>
      </div>
    </section>
  )
}

function RevealPanel({ game, onResolve }: { game: GameState; onResolve: () => void }) {
  return (
    <section className="decision-panel reveal">
      <span className="eyebrow">Choices revealed</span>
      <h2>全員開拳</h2>
      <p>{game.round.turnSummary}</p>
      <div className="choice-reveal-list">
        {game.round.decisionOrder.map((playerId) => {
          const player = game.players.find((item) => item.id === playerId)
          const decision = game.round.pendingDecisions[playerId]
          return (
            <div className="choice-row" key={playerId}>
              <span>{player?.name}</span>
              <strong>{decision === 'continue' ? '繼續' : '回營'}</strong>
            </div>
          )
        })}
      </div>
      <button type="button" className="primary-action" onClick={onResolve}>
        <Gem size={20} />
        處理結果 / 翻下一張牌
      </button>
    </section>
  )
}

function RoundBreak({ game, onNextRound }: { game: GameState; onNextRound: () => void }) {
  return (
    <section className="decision-panel round-break">
      <span className="eyebrow">Round break</span>
      <h2>第 {game.round.number} 輪完結</h2>
      <p>{game.round.turnSummary}</p>
      <button type="button" className="primary-action" onClick={onNextRound}>
        {game.round.number >= 5 ? <Trophy size={20} /> : <Footprints size={20} />}
        {game.round.number >= 5 ? '查看最終排名' : '開始下一輪'}
      </button>
    </section>
  )
}

function LogPanel({ game }: { game: GameState }) {
  return (
    <aside className="log-panel">
      <div className="log-heading">
        <History size={18} />
        <h2>事件紀錄</h2>
      </div>
      <div className="log-list">
        {game.log.slice(0, 8).map((entry) => (
          <article key={entry.id}>
            <strong>{entry.title}</strong>
            <p>{entry.detail}</p>
          </article>
        ))}
      </div>
    </aside>
  )
}

function FinalScore({ players, onReset }: { players: GameState['players']; onReset: () => void }) {
  return (
    <section className="final-panel">
      <Trophy size={42} />
      <span className="eyebrow">Final score</span>
      <h2>{players[0].name} 勝出</h2>
      <div className="final-list">
        {players.map((player, index) => (
          <article key={player.id}>
            <span>#{index + 1}</span>
            <strong>{player.name}</strong>
            <em>{totalScore(player)} 分</em>
          </article>
        ))}
      </div>
      <button className="primary-action" type="button" onClick={onReset}>
        <RotateCcw size={20} />
        再玩一局
      </button>
    </section>
  )
}

function CardTile({
  card,
  isLatest,
  pathIndex,
}: {
  card: Card
  isLatest: boolean
  pathIndex: number
}) {
  const pathBadge = <b className="path-index">{String(pathIndex).padStart(2, '0')}</b>

  if (card.kind === 'treasure') {
    return (
      <article className={`card-tile treasure-card${isLatest ? ' latest-card' : ''}`}>
        {pathBadge}
        <Gem size={24} />
        <strong>{card.value}</strong>
        <span>寶藏</span>
        <small>路上餘寶 {card.gemsOnCard}</small>
      </article>
    )
  }

  if (card.kind === 'artifact') {
    return (
      <article className={`card-tile artifact-card${isLatest ? ' latest-card' : ''}`}>
        {pathBadge}
        <Award size={24} />
        <strong>{card.value}</strong>
        <span>神器</span>
        <small>單人回營可取</small>
      </article>
    )
  }

  const hazardIcons = {
    spider: <Bug size={25} />,
    snake: <Waves size={25} />,
    fire: <Flame size={25} />,
    rocks: <Mountain size={25} />,
    spirit: <Ghost size={25} />,
  }

  return (
    <article className={`card-tile hazard-card hazard-${card.hazard}${isLatest ? ' latest-card' : ''}`}>
      {pathBadge}
      {hazardIcons[card.hazard]}
      <strong>{HAZARD_LABELS[card.hazard]}</strong>
      <span>危機</span>
      <small>同類再現即爆煲</small>
    </article>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="stat-box">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GameState
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export default App
