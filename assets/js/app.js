const cardsUrl = "./data/cards.json";

const state = {
  cards: [],
  target: null,
  guesses: [],
  maxGuesses: 8,
  winStreak: 0,
  randomUsed: false,
  over: false,
  filters: {
    owners: new Set(),
    versions: new Set(),
    multiplayer: true,
  },

  autocompleteIndex: -1,
  matches: [],
};

const ownerPinyin = {
  "铁甲战士": "tjzs",
  "静默猎手": "jmls",
  "故障机器人": "gzjqr",
  "观者": "gz",
  "无色": "ws",
  "亡灵契约师": "wlqys",
  "储君": "cj",
  "事件": "sj",
  "状态": "zt",
  "诅咒": "zz",
  "任务": "rw",
};

const OWNER_ORDER = ["铁甲战士", "静默猎手", "故障机器人", "观者", "储君", "亡灵契约师", "无色", "事件", "诅咒", "状态", "任务"];
const VERSION_ORDER = ["杀戮尖塔1", "杀戮尖塔2", "杀戮尖塔1/杀戮尖塔2"];

const el = {
  randomBtn: document.querySelector("#randomBtn"),
  confirmBtn: document.querySelector("#confirmBtn"),
  surrenderBtn: document.querySelector("#surrenderBtn"),
  restartBtn: document.querySelector("#restartBtn"),
  settingsBtn: document.querySelector("#settingsBtn"),
  themeToggle: document.querySelector("#themeToggle"),

  guessInput: document.querySelector("#guessInput"),
  autocompleteList: document.querySelector("#autocompleteList"),
  results: document.querySelector("#results"),
  message: document.querySelector("#message"),
  guessCountText: document.querySelector("#guessCountText"),
  streakText: document.querySelector("#streakText"),

  settingsModal: document.querySelector("#settingsModal"),
  closeSettings: document.querySelector("#closeSettings"),
  cancelSettings: document.querySelector("#cancelSettings"),
  saveSettings: document.querySelector("#saveSettings"),
  maxGuesses: document.querySelector("#maxGuesses"),
  maxGuessesValue: document.querySelector("#maxGuessesValue"),
  ownerFilters: document.querySelector("#ownerFilters"),
  versionFilters: document.querySelector("#versionFilters"),
  multiplayerToggle: document.querySelector("#multiplayerToggle"),
};

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function toggleTheme() {
  const nextTheme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("sts_theme", nextTheme);
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function sameArray(a, b) {
  const left = [...toArray(a)].filter((x) => x !== "无");
  const right = [...toArray(b)].filter((x) => x !== "无");
  if (left.length !== right.length) return false;
  const set = new Set(right);
  return left.every((x) => set.has(x));
}

function hasIntersection(a, b) {
  const left = new Set(toArray(a).filter((x) => x !== "无"));
  const right = new Set(toArray(b).filter((x) => x !== "无"));
  return [...left].some((x) => right.has(x));
}

function compareSetField(guessValue, targetValue) {
  if (sameArray(guessValue, targetValue)) return "exact";
  if (hasIntersection(guessValue, targetValue)) return "partial";
  return "none";
}

function compareScalar(guessValue, targetValue) {
  return String(guessValue ?? "") === String(targetValue ?? "") ? "exact" : "none";
}

function compareSpecial(guessCard, targetCard) {
  const targetTerms = new Set((targetCard.special || []).filter((x) => x !== "无"));
  return (guessCard.special || []).map((term) => ({
    term,
    state: term === "无" || targetTerms.has(term) ? "exact" : "none",
  }));
}

function compareCards(guessCard) {
  const target = state.target;
  return {
    owner: compareSetField(guessCard.owners, target.owners),
    cost: compareScalar(guessCard.cost, target.cost),
    type: compareScalar(guessCard.type, target.type),
    rarity: compareSetField(guessCard.rarities, target.rarities),
    keywords: compareSetField(guessCard.keywords, target.keywords),
    statuses: compareSetField(guessCard.statuses, target.statuses),
    version: compareSetField(guessCard.gameVersion, target.gameVersion),
    special: compareSpecial(guessCard, target),
  };
}

function currentPool() {
  return state.cards.filter((card) => {
    const ownerOk = card.owners.some((o) => state.filters.owners.has(o));
    const bothVersions = card.gameVersion.includes("杀戮尖塔1") && card.gameVersion.includes("杀戮尖塔2");
    const versionOk = card.gameVersion.some((v) => state.filters.versions.has(v)) || (state.filters.versions.has("杀戮尖塔1/杀戮尖塔2") && bothVersions);
    const multiplayerOk = state.filters.multiplayer || !(card.special || []).includes("多人专属");
    return ownerOk && versionOk && multiplayerOk;
  });
}

function randomCard(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function startGame() {
  const pool = currentPool();
  if (pool.length === 0) {
    showMessage("当前题库为空，请在设置中选择至少一个卡牌所属和一个所属版本。", "lose");
    state.target = null;
    state.over = true;
    updateStatus();
    return;
  }

  state.target = randomCard(pool);
  state.guesses = [];
  state.randomUsed = false;
  state.over = false;
  el.results.innerHTML = "";
  hideMessage();
  el.guessInput.value = "";
  el.autocompleteList.hidden = true;
  el.guessInput.disabled = false;
  updateStatus();
  el.guessInput.focus();
}

function updateStatus() {
  const remaining = Math.max(0, state.maxGuesses - state.guesses.length);
  el.guessCountText.textContent = `本轮猜测次数：${state.guesses.length}/${state.maxGuesses}`;
  el.streakText.textContent = `连胜次数：${state.winStreak}`;
  if (state.over) {
    el.guessCountText.textContent = state.target ? `本轮猜测次数：${state.guesses.length}/${state.maxGuesses}` : "题库为空";
  } else {
    el.guessCountText.textContent = `本轮猜测次数：${state.guesses.length}/${state.maxGuesses}`;
  }
}

function showMessage(text, kind = "") {
  el.message.textContent = text;
  el.message.className = `message${kind ? ` ${kind}` : ""}`;
  el.message.hidden = false;
}

function hideMessage() {
  el.message.hidden = true;
  el.message.className = "message";
  el.message.textContent = "";
}

function findCardByName(name) {
  const query = String(name || "").trim();
  return state.cards.find((card) => card.name === query || card.displayName === query);
}

function createChipList(items, states) {
  const wrapper = document.createElement("div");
  wrapper.className = "chip-list";
  items.forEach((item, index) => {
    const chip = document.createElement("span");
    chip.className = `chip ${states && states[index] ? states[index] : ""}`;
    chip.textContent = item;
    wrapper.appendChild(chip);
  });
  return wrapper;
}

function createField(label, valueEl) {
  const field = document.createElement("div");
  field.className = "field";
  const labelEl = document.createElement("span");
  labelEl.className = "field-label";
  labelEl.textContent = label;
  field.appendChild(labelEl);
  field.appendChild(valueEl);
  return field;
}

function renderFieldValue(value) {
  const div = document.createElement("div");
  div.className = "field-value";
  div.textContent = Array.isArray(value) ? value.join(" / ") : value;
  return div;
}

function splitTerms(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? "").split(/[,，]/).map((s) => s.trim()).filter(Boolean);
}

function compareTermStates(terms, targetTerms) {
  const targetSet = new Set(targetTerms);
  return terms.map((term) => ({
    term,
    state: targetSet.has(term) ? "exact" : "none",
  }));
}

function compareSpecialTerms(guessTerms, targetTerms) {
  const targetSet = new Set(targetTerms);
  const exactSet = guessTerms.length === targetTerms.length && guessTerms.every((term) => targetSet.has(term));
  return guessTerms.map((term) => {

    const correct = targetSet.has(term);
    if (!correct) return { term, state: "none" };
    if (exactSet) return { term, state: "exact" };
    if (guessTerms.length > targetTerms.length) return { term, state: "exact" };
    return { term, state: "partial" };
  });
}

function compareVersionTerms(guessTerms, targetTerms) {
  const targetSet = new Set(targetTerms);
  const guessIsBoth = guessTerms.length > 1;
  return guessTerms.map((term) => {
    if (term === "无" || !targetSet.has(term)) return { term, state: term === "无" ? "exact" : "none" };
    if (targetTerms.length === 1 && guessIsBoth) return { term, state: "exact" };
    if (guessTerms.length === targetTerms.length) return { term, state: "exact" };
    return { term, state: "partial" };
  });
}

function parseCost(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d+)(?:\((\d+|X|x)\))?$/);
  if (!match) return { raw, base: null, inner: null, hasInner: false };
  const rawInner = match[2] ?? null;
  const inner = rawInner == null || rawInner.toLowerCase() === "x"
    ? rawInner
    : Number.parseInt(rawInner, 10);
  return {
    raw,
    base: Number.parseInt(match[1], 10),
    inner,
    hasInner: rawInner != null,
  };
}

function compareCostTerms(guessCard, targetCard) {
  const guessCost = guessCard.cost;
  const targetCost = targetCard.cost;
  const term = String(guessCost ?? "");
  if (term === String(targetCost ?? "")) return [{ term, state: "exact" }];

  const g = parseCost(guessCost);
  const t = parseCost(targetCost);
  const close = (a, b) => a != null && b != null && Math.abs(a - b) <= 1;

  if (g.hasInner && t.hasInner) {
    const baseClose = close(g.base, t.base);
    const hasXInner = g.inner === "X" || g.inner === "x" || t.inner === "X" || t.inner === "x";
    if (hasXInner) return [{ term, state: baseClose ? "partial" : "none" }];
    const innerClose = close(g.inner, t.inner);
    return [{ term, state: baseClose || innerClose ? "partial" : "none" }];
  }

  if (g.hasInner !== t.hasInner) {
    return [{ term, state: close(g.base, t.base) ? "partial" : "none" }];
  }

  if (close(g.base, t.base)) {
    return [{ term, state: "partial" }];
  }

  const guessNumber = Number.parseInt(String(guessCost ?? "").match(/^\d+/)?.[0] ?? "", 10);
  const targetNumber = Number.parseInt(String(targetCost ?? "").match(/^\d+/)?.[0] ?? "", 10);
  if (!Number.isNaN(guessNumber) && !Number.isNaN(targetNumber) && Math.abs(guessNumber - targetNumber) <= 1) {
    return [{ term, state: "partial" }];
  }
  return [{ term, state: "none" }];
}

function renderGuess(guessCard) {
  const target = state.target;
  const card = document.createElement("article");
  card.className = guessCard.id === target.id ? "result-card answer-card" : "result-card";

  const name = document.createElement("div");
  name.className = "result-name";
  name.textContent = guessCard.id === target.id ? `正确答案：${guessCard.name}` : guessCard.name;
  card.appendChild(name);

  const list = document.createElement("div");
  list.className = "field-list";

  const rows = [
    ["卡牌所属", splitTerms(guessCard.owners), splitTerms(target.owners)],
    ["卡牌费用", splitTerms(guessCard.cost), splitTerms(target.cost)],
    ["卡牌类型", splitTerms(guessCard.type), splitTerms(target.type)],
    ["稀有度", splitTerms(guessCard.rarities), splitTerms(target.rarities)],
    ["附带特性", splitTerms(guessCard.keywords), splitTerms(target.keywords)],
    ["给予状态", splitTerms(guessCard.statuses), splitTerms(target.statuses)],
    ["所属版本", splitTerms(guessCard.gameVersion), splitTerms(target.gameVersion)],
    ["特殊说明", splitTerms(guessCard.special), splitTerms(target.special)],
  ];

  rows.forEach(([label, guessTerms, targetTerms]) => {
    const states = label === "所属版本" ? compareVersionTerms(guessTerms, targetTerms) : label === "卡牌费用" ? compareCostTerms(guessCard, target) : label === "特殊说明" ? compareSpecialTerms(guessTerms, targetTerms) : compareTermStates(guessTerms, targetTerms);
    const column = document.createElement("div");
    column.className = "field-column";
    const labelEl = document.createElement("span");
    labelEl.className = "field-label";
    labelEl.textContent = label;
    column.appendChild(labelEl);

    const chipList = document.createElement("div");
    chipList.className = "chip-list";
    states.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = `chip ${item.state}`;
      chip.textContent = item.term;
      chipList.appendChild(chip);
    });
    column.appendChild(chipList);
    list.appendChild(column);
  });

  card.appendChild(list);
  el.results.prepend(card);
}

function processGuess(card) {
  if (!card || !state.target || state.over) return;
  if (state.guesses.some((g) => g.id === card.id)) {
    showMessage("你已经猜过这张卡牌了。", "lose");
    return;
  }

  state.guesses.push(card);
  renderGuess(card);
  updateStatus();

  if (card.id === state.target.id) {
    state.over = true;
    state.winStreak += 1;
    localStorage.setItem("sts_win_streak", String(state.winStreak));
    updateStatus();
    showMessage(`我说猜中算你赢了！正确答案是 ${state.target.name}。当前连胜：${state.winStreak}。`, "win");
    el.guessInput.disabled = true;
    return;
  }

  if (state.guesses.length >= state.maxGuesses) {
    state.over = true;
    state.winStreak = 0;
    localStorage.setItem("sts_win_streak", "0");
    updateStatus();
    showMessage(`我说猜错算你输了，正确答案是 ${state.target.name}。`, "lose");
    el.guessInput.disabled = true;
  }
}

function submitGuess() {
  if (state.over || !state.target) return;
  const card = findCardByName(el.guessInput.value);
  if (!card) {
    showMessage("请输入有效卡牌名称，或从补全列表中选择。", "lose");
    return;
  }
  hideMessage();
  el.guessInput.value = "";
  el.autocompleteList.hidden = true;
  processGuess(card);
}

function randomOpening() {
  if (state.over || state.randomUsed || state.guesses.length > 0 || !state.target) return;
  const pool = currentPool().filter((card) => card.id !== state.target.id);
  if (pool.length === 0) return;
  state.randomUsed = true;
  processGuess(randomCard(pool));
}

function surrender() {
  if (state.over || !state.target) return;
  state.over = true;
  state.winStreak = 0;
  localStorage.setItem("sts_win_streak", "0");
  renderGuess(state.target);
  updateStatus();
  showMessage(`我说投降算你输了，正确答案是 ${state.target.name}。`, "lose");
  el.guessInput.disabled = true;
}

function renderAutocomplete(query) {
  const trimmed = query.trim().toLowerCase();
  state.autocompleteIndex = -1;
  if (!trimmed) {
    el.autocompleteList.hidden = true;
    state.matches = [];
    return;
  }

  const pool = currentPool();
  state.matches = pool
    .filter((card) => card.name.toLowerCase().includes(trimmed))
    .slice(0, 24);

  el.autocompleteList.innerHTML = "";
  state.matches.forEach((card, index) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.dataset.index = String(index);

    const name = document.createElement("span");
    name.className = "autocomplete-name";
    name.textContent = card.name;
    const meta = document.createElement("span");
    meta.className = "autocomplete-meta";
    meta.textContent = `${card.owner} · ${card.type}`;
    item.append(name, meta);

    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      el.guessInput.value = card.name;
      el.autocompleteList.hidden = true;
      submitGuess();
    });

    el.autocompleteList.appendChild(item);
  });

  el.autocompleteList.hidden = state.matches.length === 0;
}

function moveAutocomplete(direction) {
  if (state.matches.length === 0) return;
  state.autocompleteIndex = (state.autocompleteIndex + direction + state.matches.length) % state.matches.length;
  [...el.autocompleteList.children].forEach((item, index) => {
    item.classList.toggle("active", index === state.autocompleteIndex);
  });
}

function openSettings() {
  el.maxGuesses.value = state.maxGuesses;
  el.maxGuessesValue.textContent = state.maxGuesses;
  el.multiplayerToggle.checked = state.filters.multiplayer;
  buildFilters();
  el.settingsModal.hidden = false;
  el.settingsModal.style.display = "flex";
}

function closeSettings() {
  el.settingsModal.hidden = true;
  el.settingsModal.style.display = "none";
}

function buildFilters() {
  const allOwners = new Set(state.cards.flatMap((card) => card.owners));
  const owners = [...OWNER_ORDER.filter((owner) => allOwners.has(owner)), ...[...allOwners].filter((owner) => !OWNER_ORDER.includes(owner))];
  const versions = VERSION_ORDER;

  el.ownerFilters.innerHTML = owners
    .map(
      (owner) => `
        <label class="filter-item">
          <input type="checkbox" value="${owner}" ${state.filters.owners.has(owner) ? "checked" : ""}>
          <span>${owner}</span>
        </label>`,
    )
    .join("");

  el.versionFilters.innerHTML = versions
    .map(
      (version) => `
        <label class="filter-item">
          <input type="checkbox" value="${version}" ${state.filters.versions.has(version) ? "checked" : ""}>
          <span>${version}</span>
        </label>`,
    )
    .join("");
}

function saveSettings() {
  const max = Number.parseInt(el.maxGuesses.value, 10);
  const nextMax = Number.isNaN(max) ? 8 : Math.min(15, Math.max(3, max));

  const nextOwners = new Set(
    [...el.ownerFilters.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value),
  );
  const nextVersions = new Set(
    [...el.versionFilters.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value),
  );
  const nextMultiplayer = el.multiplayerToggle.checked;

  if (nextOwners.size === 0 || nextVersions.size === 0) {
    showMessage("卡牌所属和所属版本至少各选择一项。", "lose");
    return;
  }

  state.maxGuesses = nextMax;
  state.filters.owners = nextOwners;
  state.filters.versions = nextVersions;
  state.filters.multiplayer = nextMultiplayer;
  closeSettings();
  startGame();
}



function bindEvents() {
  el.confirmBtn.addEventListener("click", submitGuess);
  el.randomBtn.addEventListener("click", randomOpening);
  el.surrenderBtn.addEventListener("click", surrender);
  el.restartBtn.addEventListener("click", startGame);
  el.settingsBtn.addEventListener("click", openSettings);
  el.closeSettings.addEventListener("click", closeSettings);
  el.cancelSettings.addEventListener("click", closeSettings);
  el.saveSettings.addEventListener("click", saveSettings);
  el.maxGuesses.addEventListener("input", () => {
    el.maxGuessesValue.textContent = el.maxGuesses.value;
  });


  el.guessInput.addEventListener("input", (event) => renderAutocomplete(event.target.value));
  el.guessInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (state.autocompleteIndex >= 0 && state.matches[state.autocompleteIndex]) {
        el.guessInput.value = state.matches[state.autocompleteIndex].name;
        el.autocompleteList.hidden = true;
      }
      submitGuess();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveAutocomplete(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveAutocomplete(-1);
    } else if (event.key === "Escape") {
      el.autocompleteList.hidden = true;
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".autocomplete-wrap")) {
      el.autocompleteList.hidden = true;
    }
  });

  el.settingsModal.addEventListener("click", (event) => {
    if (event.target === el.settingsModal) closeSettings();
  });
}

async function init() {
  const savedStreak = Number.parseInt(localStorage.getItem("sts_win_streak") || "0", 10);
  state.winStreak = Number.isNaN(savedStreak) ? 0 : savedStreak;

  const savedTheme = localStorage.getItem("sts_theme");
  const preferredTheme = savedTheme || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferredTheme);
  el.themeToggle.addEventListener("click", toggleTheme);

  bindEvents();
  el.settingsModal.style.display = "none";
  try {
    const response = await fetch(cardsUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.cards = await response.json();
    state.filters.owners = new Set(state.cards.flatMap((card) => card.owners));
    state.filters.versions = new Set([...state.cards.flatMap((card) => card.gameVersion), "杀戮尖塔1/杀戮尖塔2"]);
    startGame();
  } catch (error) {
    console.error(error);
    showMessage(`卡牌数据加载失败：${error.message}。请通过本地 HTTP 服务打开页面。`, "lose");
  }
}

init();
