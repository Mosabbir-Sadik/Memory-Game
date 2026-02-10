const TOTAL_PAIRS = 8;
const ICON_POOL = ['🜁', '🜂', '🜃', '🜄', '🜏', '🜔', '🜍', '🝔', '🝗', '🝑', '☼', '☾', '☽', '♢', '♤', '♧'];
const STORAGE_KEY = 'neon-memory-lab-best';

const selectors = {
  grid: document.getElementById('card-grid'),
  moveCount: document.getElementById('move-count'),
  pairCount: document.getElementById('pair-count'),
  totalPairs: document.getElementById('total-pairs'),
  timer: document.getElementById('timer'),
  bestMoves: document.getElementById('best-moves'),
  bestTime: document.getElementById('best-time'),
  restartBtn: document.getElementById('restart-btn'),
  peekBtn: document.getElementById('peek-btn'),
  winModal: document.getElementById('win-modal'),
  finalMoves: document.getElementById('final-moves'),
  finalTime: document.getElementById('final-time'),
  recordMessage: document.getElementById('record-message'),
  playAgainBtn: document.getElementById('play-again-btn'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  confettiRoot: document.getElementById('confetti-root')
};

const state = {
  deck: [],
  flipped: [],
  matches: 0,
  moves: 0,
  seconds: 0,
  timerId: null,
  started: false,
  locked: false,
  peekAvailable: true
};

selectors.totalPairs.textContent = TOTAL_PAIRS.toString();

selectors.restartBtn.addEventListener('click', resetGame);
selectors.playAgainBtn.addEventListener('click', resetGame);
selectors.closeModalBtn.addEventListener('click', () => toggleWinModal(false));
selectors.peekBtn.addEventListener('click', handlePeek);

init();

function init() {
  hydrateBestStats();
  resetGame();
}

function resetGame() {
  stopTimer();
  state.deck = buildDeck();
  state.flipped = [];
  state.matches = 0;
  state.moves = 0;
  state.seconds = 0;
  state.started = false;
  state.locked = false;
  state.peekAvailable = true;
  selectors.timer.textContent = formatTime(0);
  renderDeck();
  updateHud();
  updatePeekButton();
  toggleWinModal(false);
}

function buildDeck() {
  const icons = shuffle([...ICON_POOL]).slice(0, TOTAL_PAIRS);
  const doubled = [...icons, ...icons];
  return shuffle(doubled).map((icon, index) => ({
    uid: `${icon}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    icon,
    matched: false,
    revealed: false
  }));
}

function renderDeck() {
  selectors.grid.innerHTML = '';
  state.deck.forEach((card, index) => {
    selectors.grid.appendChild(createCardElement(card, index));
  });
}

function createCardElement(card, index) {
  const button = document.createElement('button');
  button.className = 'card';
  button.type = 'button';
  button.dataset.cardId = card.uid;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Hidden card');
  button.style.animationDelay = `${index * 35}ms`;

  const inner = document.createElement('div');
  inner.className = 'card__inner';

  const front = document.createElement('span');
  front.className = 'card__face card__face--front';

  const back = document.createElement('span');
  back.className = 'card__face card__face--back';
  back.textContent = card.icon;

  inner.append(front, back);
  button.appendChild(inner);

  button.addEventListener('click', () => handleCardClick(card.uid));
  return button;
}

function handleCardClick(uid) {
  if (state.locked) return;
  const card = state.deck.find((item) => item.uid === uid);
  if (!card || card.matched || card.revealed) return;

  if (!state.started) {
    state.started = true;
    startTimer();
  }

  card.revealed = true;
  state.flipped.push(card);
  syncCard(card);

  if (state.flipped.length === 2) {
    state.locked = true;
    state.moves += 1;
    updateHud();
    evaluatePair();
  }
}

function evaluatePair() {
  const [first, second] = state.flipped;
  if (first.icon === second.icon) {
    first.matched = true;
    second.matched = true;
    state.matches += 1;
    syncCard(first);
    syncCard(second);
    state.flipped = [];
    state.locked = false;
    updateHud();

    if (state.matches === TOTAL_PAIRS) {
      finishGame();
    }
    return;
  }

  setTimeout(() => {
    first.revealed = false;
    second.revealed = false;
    syncCard(first);
    syncCard(second);
    state.flipped = [];
    state.locked = false;
  }, 900);
}

function syncCard(card) {
  const el = selectors.grid.querySelector(`[data-card-id="${card.uid}"]`);
  if (!el) return;
  const shouldShow = card.revealed || card.matched;
  el.classList.toggle('is-flipped', shouldShow);
  el.classList.toggle('is-matched', card.matched);
  el.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
}

function updateHud() {
  selectors.moveCount.textContent = state.moves.toString();
  selectors.pairCount.textContent = state.matches.toString();
  selectors.timer.textContent = formatTime(state.seconds);
}

function startTimer() {
  if (state.timerId) return;
  state.timerId = window.setInterval(() => {
    state.seconds += 1;
    selectors.timer.textContent = formatTime(state.seconds);
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function finishGame() {
  stopTimer();
  const runStats = { moves: state.moves, seconds: state.seconds };
  const isRecord = persistBestIfNeeded(runStats);
  selectors.finalMoves.textContent = runStats.moves.toString();
  selectors.finalTime.textContent = formatTime(runStats.seconds);
  selectors.recordMessage.textContent = isRecord
    ? 'New personal record locked in.'
    : 'Record stands — but you are close.';
  toggleWinModal(true);
  spawnConfetti();
}

function toggleWinModal(show) {
  if (!selectors.winModal) return;
  selectors.winModal.classList.toggle('is-visible', show);
  selectors.winModal.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function hydrateBestStats() {
  const best = getStoredBest();
  if (best) {
    selectors.bestMoves.textContent = best.moves.toString();
    selectors.bestTime.textContent = formatTime(best.seconds);
  } else {
    selectors.bestMoves.textContent = '—';
    selectors.bestTime.textContent = '—';
  }
}

function persistBestIfNeeded(current) {
  const best = getStoredBest();
  const isBetter = !best || current.moves < best.moves || (current.moves === best.moves && current.seconds < best.seconds);
  if (isBetter) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    hydrateBestStats();
    return true;
  }
  return false;
}

function getStoredBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Unable to read best score', error);
    return null;
  }
}

function handlePeek() {
  if (!state.peekAvailable || state.locked || state.flipped.length) return;
  state.peekAvailable = false;
  updatePeekButton();
  state.locked = true;
  const candidates = [...selectors.grid.querySelectorAll('.card')].filter((el) => !el.classList.contains('is-matched'));
  candidates.forEach((el) => {
    el.classList.add('is-peek', 'is-flipped');
    el.setAttribute('aria-pressed', 'true');
  });
  window.setTimeout(() => {
    candidates.forEach((el) => {
      el.classList.remove('is-peek');
      const card = state.deck.find((item) => item.uid === el.dataset.cardId);
      if (!card || card.matched || card.revealed) return;
      el.classList.remove('is-flipped');
      el.setAttribute('aria-pressed', 'false');
    });
    state.locked = false;
  }, 1600);
}

function updatePeekButton() {
  selectors.peekBtn.disabled = !state.peekAvailable;
  selectors.peekBtn.textContent = state.peekAvailable ? 'One-time peek' : 'Peek used';
  selectors.peekBtn.setAttribute('aria-pressed', state.peekAvailable ? 'false' : 'true');
}

function spawnConfetti() {
  const colors = ['#ff7a18', '#ffd166', '#34d399', '#38bdf8', '#a78bfa'];
  if (!selectors.confettiRoot) return;
  for (let i = 0; i < 32; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = `${Math.random() * 20}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    selectors.confettiRoot.appendChild(piece);
    window.setTimeout(() => piece.remove(), 2000);
  }
}

function shuffle(list) {
  const array = [...list];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
