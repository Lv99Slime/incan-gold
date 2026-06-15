import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Award,
  Bug,
  CircleCheckBig,
  ClipboardCheck,
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
  ShieldCheck,
  Sparkles,
  Tent,
  Trophy,
  Undo2,
  UserRoundCog,
  Waves,
  X,
} from 'lucide-react'
import './App.css'
import {
  type Card,
  type Decision,
  type GameMode,
  type GameState,
  HAZARD_LABELS,
  createGame,
  newDecisionPhase,
  rankPlayers,
  recordDecision,
  recordDecisions,
  resolveRevealedTurn,
  reviseDecisions,
  startNextRound,
  totalScore,
} from './game'

const STORAGE_KEY = 'incan-gold-hotseat-v1'
const UNDO_STORAGE_KEY = 'incan-gold-undo-v1'

const defaultNames = ['阿進', '阿寶', 'Mina']

function App() {
  const [game, setGame] = useState<GameState | null>(() => loadGame())
  const [undoGame, setUndoGame] = useState<GameState | null>(() => loadUndoGame())
  const [visibleScores, setVisibleScores] = useState<Set<string>>(() => new Set())
  const [unlockedPlayerId, setUnlockedPlayerId] = useState<string | null>(null)
  const [scorePeekPlayerId, setScorePeekPlayerId] = useState<string | null>(null)
  const [scorePeekRevealed, setScorePeekRevealed] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [playerCount, setPlayerCount] = useState(game?.players.length ?? 3)
  const [names, setNames] = useState<string[]>(
    game?.players.map((player) => player.name) ?? defaultNames,
  )
  const [gameMode, setGameMode] = useState<GameMode>(game?.mode ?? 'host')
  const [hostParticipates, setHostParticipates] = useState(game?.hostParticipates ?? false)
  const [hostPlayerId, setHostPlayerId] = useState(game?.hostPlayerId ?? 'p1')

  useEffect(() => {
    if (game) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
    }
  }, [game])

  useEffect(() => {
    if (undoGame) {
      localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(undoGame))
    } else {
      localStorage.removeItem(UNDO_STORAGE_KEY)
    }
  }, [undoGame])

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
    if (Number(hostPlayerId.slice(1)) > count) {
      setHostPlayerId('p1')
    }
  }

  function startGame() {
    const cleanNames = names.slice(0, playerCount).map((name, index) => name.trim() || `玩家 ${index + 1}`)
    setUnlockedPlayerId(null)
    setUndoGame(null)
    setGame(
      createGame(cleanNames, createRandomSeed(), {
        mode: gameMode,
        hostParticipates,
        hostPlayerId: hostParticipates ? hostPlayerId : undefined,
      }),
    )
  }

  function resetGame() {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(UNDO_STORAGE_KEY)
    setVisibleScores(new Set())
    setUnlockedPlayerId(null)
    setScorePeekPlayerId(null)
    setScorePeekRevealed(false)
    setShowResetConfirm(false)
    setUndoGame(null)
    setGame(null)
    setPlayerCount(3)
    setNames(defaultNames)
    setGameMode('host')
    setHostParticipates(false)
    setHostPlayerId('p1')
  }

  function choose(decision: Decision) {
    if (!game || !activePlayer || unlockedPlayerId !== activePlayer.id) return
    setUndoGame(null)
    setVisibleScores(new Set())
    setUnlockedPlayerId(null)
    setGame(recordDecision(game, activePlayer.id, decision))
  }

  function submitHostDecisions(decisions: Record<string, Decision>) {
    if (!game || game.mode !== 'host') return
    setUndoGame(null)
    setGame(recordDecisions(game, decisions))
  }

  function editHostDecisions() {
    if (!game) return
    setGame(reviseDecisions(game))
  }

  function resolveTurn() {
    if (!game) return
    if (game.mode === 'host') setUndoGame(game)
    setGame(resolveRevealedTurn(game))
  }

  function nextRound() {
    if (!game) return
    setUndoGame(null)
    setGame(startNextRound(game))
  }

  function confirmDrawnCard() {
    if (!game) return
    setUndoGame(null)
    setVisibleScores(new Set())
    setUnlockedPlayerId(null)
    setGame(newDecisionPhase(game))
  }

  function undoSettlement() {
    if (!undoGame) return
    setGame(undoGame)
    setUndoGame(null)
    setVisibleScores(new Set())
    setUnlockedPlayerId(null)
  }

  function requestScorePeek(playerId: string) {
    if (game?.mode !== 'host' || game.status !== 'playing') return
    setScorePeekPlayerId(playerId)
    setScorePeekRevealed(false)
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
            <span className="eyebrow">Choose your table mode</span>
            <h2>設定探險隊</h2>
            <p>一部裝置就玩得。可以由主持人帶住全場，亦可以沿用逐位秘密交機。</p>
          </div>

          <div className="mode-selector" aria-label="遊戲模式">
            <button
              type="button"
              className={`mode-option${gameMode === 'host' ? ' selected' : ''}`}
              onClick={() => setGameMode('host')}
              aria-pressed={gameMode === 'host'}
            >
              <UserRoundCog size={24} />
              <span>
                <strong>遊戲主持人</strong>
                <small>一人控制畫面，全體用手勢同步投票</small>
              </span>
            </button>
            <button
              type="button"
              className={`mode-option${gameMode === 'hot-seat' ? ' selected' : ''}`}
              onClick={() => setGameMode('hot-seat')}
              aria-pressed={gameMode === 'hot-seat'}
            >
              <Eye size={24} />
              <span>
                <strong>秘密交機</strong>
                <small>逐位玩家接過裝置，私下作出決定</small>
              </span>
            </button>
          </div>

          {gameMode === 'host' && (
            <section className="host-setup">
              <label className="host-toggle">
                <input
                  type="checkbox"
                  checked={hostParticipates}
                  onChange={(event) => setHostParticipates(event.target.checked)}
                />
                <span>
                  <strong>主持人同時參賽</strong>
                  <small>主持人每次會先鎖定自己答案，再記錄其他玩家。</small>
                </span>
              </label>
              {hostParticipates && (
                <label className="field compact">
                  <span>邊位係主持人？</span>
                  <select value={hostPlayerId} onChange={(event) => setHostPlayerId(event.target.value)}>
                    {Array.from({ length: playerCount }, (_, index) => (
                      <option value={`p${index + 1}`} key={index}>
                        {names[index]?.trim() || `玩家 ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="gesture-guide">
                <Footprints size={20} />
                <span><b>握拳：繼續</b><b>手掌：回營</b></span>
                <small>主持人倒數 3、2、1，所有玩家同時示意。</small>
              </div>
            </section>
          )}

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
      {game.mode === 'hot-seat' &&
        game.round.active &&
        game.round.decisionPhase === 'choosing' &&
        activePlayer &&
        unlockedPlayerId !== activePlayer.id && (
          <PrivacyHandoff
            player={activePlayer}
            step={game.round.currentDecisionIndex + 1}
            total={game.round.decisionOrder.length}
            onReset={() => setShowResetConfirm(true)}
            onReady={() => {
              setVisibleScores(new Set())
              setUnlockedPlayerId(activePlayer.id)
            }}
          />
        )}
      {scorePeekPlayerId && (
        <ScorePeekOverlay
          player={game.players.find((player) => player.id === scorePeekPlayerId) ?? null}
          revealed={scorePeekRevealed}
          onReveal={() => setScorePeekRevealed(true)}
          onClose={() => {
            setScorePeekPlayerId(null)
            setScorePeekRevealed(false)
          }}
        />
      )}
      {showResetConfirm && (
        <ConfirmResetDialog
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={resetGame}
        />
      )}
      <header className="top-bar">
        <div>
          <span className="eyebrow">Incan Gold / 印加寶藏 教學遊玩版</span>
          <div className="table-title-row">
            <h1>神廟桌面</h1>
            <span className="mode-badge">
              {game.mode === 'host' ? <UserRoundCog size={15} /> : <Eye size={15} />}
              {game.mode === 'host' ? '主持人模式' : '秘密交機'}
            </span>
          </div>
        </div>
        <div className="top-actions">
          {game.mode === 'host' && undoGame && (
            <button className="ghost-button" type="button" onClick={undoSettlement}>
              <Undo2 size={18} />
              撤銷結算
            </button>
          )}
          <button className="ghost-button" type="button" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw size={18} />
            新遊戲
          </button>
        </div>
      </header>

      <RoundProgress currentRound={game.round.number} active={game.round.active} />

      <section className="score-strip" aria-label="玩家分數">
        {game.players.map((player, index) => {
          const scoreVisible = visibleScores.has(player.id)
          const canViewHotSeatScore =
            game.mode === 'hot-seat' &&
            game.round.decisionPhase === 'choosing' &&
            activePlayer?.id === player.id &&
            unlockedPlayerId === player.id
          const canRequestHostScore = game.mode === 'host' && game.status === 'playing'
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
              onClick={() =>
                game.mode === 'host' ? requestScorePeek(player.id) : toggleScore(player.id)
              }
              disabled={!canViewHotSeatScore && !canRequestHostScore}
              aria-label={
                canRequestHostScore
                  ? `私人查看 ${player.name} 的分數`
                  : canViewHotSeatScore
                  ? `${scoreVisible ? '隱藏' : '顯示'} ${player.name} 的分數`
                  : `${player.name} 的分數已鎖定`
              }
              title={
                canRequestHostScore
                  ? `將裝置交給 ${player.name} 私人查看`
                  : canViewHotSeatScore
                  ? `${scoreVisible ? '隱藏' : '顯示'}自己的營地分數`
                  : '只可由目前選擇中的玩家查看'
              }
            >
              {!canViewHotSeatScore && !canRequestHostScore ? (
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
                game.mode === 'host' ? (
                  <HostDecisionPanel game={game} onSubmit={submitHostDecisions} />
                ) : (
                  <DecisionPanel activePlayer={activePlayer} game={game} onChoose={choose} />
                )
              ) : game.round.decisionPhase === 'revealed' ? (
                game.mode === 'host' ? (
                  <HostRevealPanel game={game} onEdit={editHostDecisions} onResolve={resolveTurn} />
                ) : (
                  <RevealPanel game={game} onResolve={resolveTurn} />
                )
              ) : (
                <CardRevealPanel game={game} onConfirm={confirmDrawnCard} />
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
      <span className="eyebrow">Incan Gold / 印加寶藏</span>
      <h1>
        <span>入神廟，拎寶石</span>
        <span>識走先係醒目</span>
      </h1>
    </section>
  )
}

function PrivacyHandoff({
  player,
  step,
  total,
  onReady,
  onReset,
}: {
  player: GameState['players'][number]
  step: number
  total: number
  onReady: () => void
  onReset: () => void
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
        <button className="privacy-reset-button" type="button" onClick={onReset}>
          <RotateCcw size={17} />
          返回設定 / 新遊戲
        </button>
      </section>
    </div>
  )
}

function ScorePeekOverlay({
  player,
  revealed,
  onReveal,
  onClose,
}: {
  player: GameState['players'][number] | null
  revealed: boolean
  onReveal: () => void
  onClose: () => void
}) {
  if (!player) return null

  const artifactScore = player.artifacts.reduce((sum, value) => sum + value, 0)
  const securedScore = player.banked + artifactScore

  return (
    <div className="privacy-overlay" role="dialog" aria-modal="true" aria-labelledby="score-peek-title">
      <section className="privacy-card score-peek-card">
        <div className="privacy-seal" style={{ background: player.color }}>
          {revealed ? <Gem size={30} /> : <LockKeyhole size={30} />}
        </div>
        <span className="eyebrow">Private score check</span>
        <h2 id="score-peek-title">
          {revealed ? `${player.name} 的私人分數` : `請將裝置交給 ${player.name}`}
        </h2>
        {!revealed ? (
          <>
            <p>其他人請移開視線。只有玩家本人接過裝置後先好撳開，主持人都唔好扮忙偷望。</p>
            <button className="primary-action" type="button" onClick={onReveal}>
              <Eye size={20} />
              我係 {player.name}，顯示分數
            </button>
          </>
        ) : (
          <>
            <div className="private-score-grid">
              <span>營地寶石<strong>{player.banked}</strong></span>
              <span>神器分數<strong>{artifactScore}</strong></span>
              <span className="private-score-total">安全總分<strong>{securedScore}</strong></span>
            </div>
            <button className="primary-action" type="button" onClick={onClose}>
              <EyeOff size={20} />
              隱藏並交回主持人
            </button>
          </>
        )}
      </section>
    </div>
  )
}

function ConfirmResetDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="privacy-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <section className="privacy-card reset-card">
        <div className="privacy-seal reset-seal">
          <RotateCcw size={30} />
        </div>
        <span className="eyebrow">Start over?</span>
        <h2 id="reset-title">確定要開新遊戲？</h2>
        <p>目前五輪進度、玩家分數同事件紀錄都會清除。呢粒掣唔係用嚟試手感。</p>
        <div className="dialog-actions">
          <button className="secondary-action" type="button" onClick={onCancel}>
            <X size={19} />
            返回遊戲
          </button>
          <button className="danger-action" type="button" onClick={onConfirm}>
            <RotateCcw size={19} />
            清除並開新遊戲
          </button>
        </div>
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

function HostDecisionPanel({
  game,
  onSubmit,
}: {
  game: GameState
  onSubmit: (decisions: Record<string, Decision>) => void
}) {
  const activePlayers = game.round.decisionOrder
    .map((playerId) => game.players.find((player) => player.id === playerId))
    .filter((player): player is GameState['players'][number] => Boolean(player))
  const hostPlayer = game.hostPlayerId
    ? activePlayers.find((player) => player.id === game.hostPlayerId) ?? null
    : null
  const [draft, setDraft] = useState<Record<string, Decision>>(() => ({
    ...game.round.pendingDecisions,
  }))
  const [hostLocked, setHostLocked] = useState(
    () => !hostPlayer || Boolean(game.round.pendingDecisions[hostPlayer.id]),
  )

  const selectedCount = activePlayers.filter((player) => Boolean(draft[player.id])).length
  const allComplete = selectedCount === activePlayers.length

  function setDecision(playerId: string, decision: Decision) {
    if (hostPlayer?.id === playerId && hostLocked) return
    setDraft((current) => ({ ...current, [playerId]: decision }))
  }

  function setEveryoneContinue() {
    setDraft((current) => ({
      ...Object.fromEntries(activePlayers.map((player) => [player.id, 'continue' as Decision])),
      ...(hostPlayer && hostLocked && current[hostPlayer.id]
        ? { [hostPlayer.id]: current[hostPlayer.id] }
        : {}),
    }))
  }

  function clearChoices() {
    setDraft(
      hostPlayer && hostLocked && draft[hostPlayer.id]
        ? { [hostPlayer.id]: draft[hostPlayer.id] }
        : {},
    )
  }

  if (hostPlayer && !hostLocked) {
    const hostChoice = draft[hostPlayer.id]
    return (
      <section className="decision-panel host-decision-panel host-lock-panel">
        <span className="eyebrow">Host plays first</span>
        <h2>{hostPlayer.name}，先鎖定自己答案</h2>
        <p>未睇其他玩家手勢之前先決定。鎖定後唔可以改，公平先有資格叫人唔好跟風。</p>
        <div className="host-lock-choice">
          <button
            type="button"
            className={hostChoice === 'continue' ? 'host-choice continue selected' : 'host-choice continue'}
            onClick={() => setDecision(hostPlayer.id, 'continue')}
          >
            <Footprints size={22} />
            繼續探索
          </button>
          <button
            type="button"
            className={hostChoice === 'leave' ? 'host-choice leave selected' : 'host-choice leave'}
            onClick={() => setDecision(hostPlayer.id, 'leave')}
          >
            <DoorOpen size={22} />
            回營入帳
          </button>
        </div>
        <button
          type="button"
          className="primary-action"
          disabled={!hostChoice}
          onClick={() => setHostLocked(true)}
        >
          <LockKeyhole size={19} />
          鎖定我的答案
        </button>
      </section>
    )
  }

  return (
    <section className="decision-panel host-decision-panel">
      <div className="host-panel-heading">
        <div>
          <span className="eyebrow">Host vote recorder</span>
          <h2>記錄全體決定</h2>
        </div>
        <strong className={allComplete ? 'vote-count complete' : 'vote-count'}>
          {selectedCount} / {activePlayers.length}
        </strong>
      </div>
      <div className="host-callout">
        <ShieldCheck size={22} />
        <p><b>主持人倒數 3、2、1。</b> 握拳繼續，手掌回營；所有人同時示意。</p>
      </div>
      <div className="host-vote-list">
        {activePlayers.map((player) => {
          const decision = draft[player.id]
          const isLockedHost = hostPlayer?.id === player.id && hostLocked
          return (
            <article className="host-vote-row" key={player.id} style={{ borderColor: player.color }}>
              <div className="host-vote-player">
                <span className="mini-player-marker" style={{ background: player.color }}>
                  <Tent size={16} />
                </span>
                <div>
                  <strong>{player.name}</strong>
                  {isLockedHost && <small><LockKeyhole size={12} /> 主持人答案已鎖定</small>}
                </div>
              </div>
              <div className="host-vote-actions" aria-label={`${player.name} 的選擇`}>
                <button
                  type="button"
                  className={decision === 'continue' ? 'vote-button continue selected' : 'vote-button continue'}
                  onClick={() => setDecision(player.id, 'continue')}
                  disabled={isLockedHost}
                  aria-label={`${player.name} 繼續探索`}
                >
                  <Footprints size={18} />
                  <span>繼續</span>
                </button>
                <button
                  type="button"
                  className={decision === 'leave' ? 'vote-button leave selected' : 'vote-button leave'}
                  onClick={() => setDecision(player.id, 'leave')}
                  disabled={isLockedHost}
                  aria-label={`${player.name} 回營`}
                >
                  <DoorOpen size={18} />
                  <span>回營</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>
      <div className="host-tools">
        <button type="button" className="secondary-action" onClick={setEveryoneContinue}>
          <Footprints size={18} />
          全部繼續
        </button>
        <button type="button" className="secondary-action" onClick={clearChoices}>
          <X size={18} />
          清除選擇
        </button>
      </div>
      <button
        type="button"
        className="primary-action"
        disabled={!allComplete}
        onClick={() => onSubmit(draft)}
      >
        <ClipboardCheck size={20} />
        確認全體選擇
      </button>
      {!allComplete && <small className="form-hint">尚有 {activePlayers.length - selectedCount} 位玩家未記錄。</small>}
    </section>
  )
}

function HostRevealPanel({
  game,
  onEdit,
  onResolve,
}: {
  game: GameState
  onEdit: () => void
  onResolve: () => void
}) {
  return (
    <section className="decision-panel reveal host-review-panel">
      <span className="eyebrow">Review before resolving</span>
      <h2>確認投票紀錄</h2>
      <p>{game.round.turnSummary}</p>
      <div className="choice-reveal-list">
        {game.round.decisionOrder.map((playerId) => {
          const player = game.players.find((item) => item.id === playerId)
          const decision = game.round.pendingDecisions[playerId]
          return (
            <div className={`choice-row decision-${decision}`} key={playerId}>
              <span>{player?.name}</span>
              <strong>
                {decision === 'continue' ? <Footprints size={17} /> : <DoorOpen size={17} />}
                {decision === 'continue' ? '繼續探索' : '回營入帳'}
              </strong>
            </div>
          )
        })}
      </div>
      <div className="review-actions">
        <button type="button" className="secondary-action" onClick={onEdit}>
          <Undo2 size={18} />
          返回修改
        </button>
        <button type="button" className="primary-action" onClick={onResolve}>
          <Gem size={20} />
          確認並處理結果
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

function CardRevealPanel({ game, onConfirm }: { game: GameState; onConfirm: () => void }) {
  const card = game.round.path.at(-1)
  if (!card) return null

  const description =
    card.kind === 'treasure'
      ? `寶藏已分配，${card.gemsOnCard} 分留在路上。`
      : card.kind === 'artifact'
        ? `神器價值 ${card.value} 分，單獨回營嘅玩家先可以帶走。`
        : `${HAZARD_LABELS[card.hazard]} 第一次出現；同類危機再出現就會爆煲。`

  return (
    <section className="decision-panel card-reveal-panel">
      <span className="eyebrow">New card revealed</span>
      <h2>全員確認新卡</h2>
      <p>暫時未開始下一次秘密選擇。請所有玩家先睇清楚新卡同結算結果。</p>
      <div className="card-reveal-content">
        <CardTile card={card} pathIndex={game.round.path.length} isLatest />
        <strong>{description}</strong>
      </div>
      <button type="button" className="primary-action" onClick={onConfirm}>
        <CircleCheckBig size={20} />
        大家已看清楚，開始下一次選擇
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
    return normalizeGame(JSON.parse(raw) as GameState)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function loadUndoGame(): GameState | null {
  try {
    const raw = localStorage.getItem(UNDO_STORAGE_KEY)
    if (!raw) return null
    return normalizeGame(JSON.parse(raw) as GameState)
  } catch {
    localStorage.removeItem(UNDO_STORAGE_KEY)
    return null
  }
}

function normalizeGame(game: GameState): GameState {
  return {
    ...game,
    mode: game.mode ?? 'hot-seat',
    hostParticipates: game.hostParticipates ?? false,
    hostPlayerId: game.hostPlayerId ?? null,
  }
}

function createRandomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  }
  return Date.now() >>> 0
}

export default App
