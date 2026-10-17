/* TalentScout 前端逻辑（教学风格，尽量少魔法）
   读：JsonRpcProvider + contract.on(...) 实时刷新
   写：BrowserProvider 拿 MetaMask 签名发交易
   设计：免费投票（1地址1票）· 打赏/留言走 payable · 达阈值自动"入池" */
const cfg = window.TALENTSCOUT ?? {};
const MONAD_TESTNET = {
  chainId: "0x279f",
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadscan.com"],
};
/* 卡片主题色：链上只存下标（0-7），色值取自这里。
   色带一律走明亮色 —— 带上的字固定用墨黑（--band-ink），不再依赖白字，
   于是可以放心把颜色调亮、调活；色带、留言头像、弹窗页眉共用这一组。 */
const THEMES = [
  "#ffc94d", // 琥珀
  "#6fd39a", // 薄荷
  "#7bb8ff", // 天蓝
  "#ff8a72", // 珊瑚
  "#b49cff", // 丁香
  "#ff9cc7", // 樱粉
  "#5fd0c8", // 青碧
  "#cadb5c", // 青柠
];

const $ = (id) => document.getElementById(id);
const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMon = (wei) => { const n = Number(ethers.formatEther(wei)); return n === 0 ? "0" : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""); };

/* 技能标签的色相：按文本哈希从一组挑过的色相里取 —— 同一门技能在任何卡片上都是同一个颜色。
   不用 hash % 360 随机色相：那会撞出橄榄绿、土黄这类发闷的颜色，越"随机"越难看。 */
const CHIP_HUES = [262, 212, 168, 96, 42, 12, 330, 190];
function chipHue(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return CHIP_HUES[h % CHIP_HUES.length];
}
const chipHTML = (text) => `<span class="chip" style="--h:${chipHue(text)}">${esc(text)}</span>`;

/* 主题色 → "r,g,b"：CSS 里用 rgba(var(--t), .34) 调出透明版本。
   比 color-mix() 的兼容面广得多（手机上的老 Safari 也认）。 */
const tintOf = (i) => {
  const hex = THEMES[i % 8];
  return [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16)).join(",");
};

let readProvider = null, readContract = null, writeContract = null, account = null;
let readProfile = null, writeProfile = null;   // ProfileRegistry：链上简历登记处
let candidates = [];
let pickedTheme = 0;
let currentModalId = 0;
let refreshTimer = null;
let flashId = 0, flashTimer = null;
let knownRecommended = new Set();
let firstLoadDone = false;
let pendingDeepLink = 0;
let offline = false;      // 读不到链时降级到 fallback.json 快照
let snap = null;          // 快照内容（只加载一次）
let failStreak = 0;       // 连续读取失败次数
let viewMode = "wall";    // wall = 人才墙 · pool = 企业视图（推荐池）
let threshold = 0;        // 当前入池阈值

const hasContract = Boolean(cfg.contractAddress);
const hasProfile = Boolean(cfg.profile?.address);

init();

function init() {
  initTheme();
  buildThemePicker();
  $("toggleFormBtn").onclick = () => { const el = $("publishForm"); el.style.display = el.style.display === "none" ? "block" : "none"; };
  $("projectionBtn").onclick = () => document.body.classList.toggle("big");
  $("connectBtn").onclick = connectWallet;
  $("publishBtn").onclick = publishCard;
  $("toggleResumeBtn").onclick = () => { const el = $("resumeFields"); el.hidden = !el.hidden; };
  $("tabWall").onclick = () => setView("wall");
  $("tabPool").onclick = () => setView("pool");
  $("skillFilter").oninput = () => renderWall();
  initMeter();
  handleDeepLink();

  // hero 区的合约地址（评委一眼就能点开浏览器验收）
  if (hasContract) {
    const a = $("addrScout");
    a.href = `${cfg.explorer}/address/${cfg.contractAddress}`;
    a.textContent = `TalentScout ${short(cfg.contractAddress)}`;
  } else {
    $("addrScout").textContent = "TalentScout 未部署";
  }
  if (hasProfile) {
    const p = $("addrProfile");
    p.href = `${cfg.explorer}/address/${cfg.profile.address}`;
    p.textContent = `ProfileRegistry ${short(cfg.profile.address)}`;
  } else {
    $("addrProfile").textContent = "简历登记处未部署";
  }

  if (!hasContract) { $("deployHint").hidden = false; return; }

  readProvider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  readProvider.pollingInterval = 2000;
  readContract = new ethers.Contract(cfg.contractAddress, cfg.abi, readProvider);
  if (hasProfile) readProfile = new ethers.Contract(cfg.profile.address, cfg.profile.abi, readProvider);

  startBlockTicker();
  loadSnap(); // 预先读一次快照：离线时兜底、在线时补全弹窗里读失败的字段

  // 公共 RPC 不支持 eth_newFilter（contract.on 会报 Method not found），改用轮询：
  // 每 4 秒自动刷新；自己的交易成功后通过 scheduleRefresh 立即刷新；
  // "新入池"的检测与庆祝动效在 refreshAll 内完成（见 knownRecommended）。
  setInterval(refreshAll, 4000);
  refreshAll();
}

/* ───────── 主题：白天 / 黑夜 ─────────
   默认仍是深色（大屏投影效果最好）；用户手动切换后记在 localStorage。
   注意：不跟随系统偏好自动切浅色——避免投影笔记本是浅色时台上突然变白。 */
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("ts-theme"); } catch {}
  applyTheme(saved === "light" ? "light" : "dark");

  $("themeBtn").onclick = () => {
    applyTheme(document.body.classList.contains("light") ? "dark" : "light");
  };
}

function applyTheme(mode) {
  const light = mode === "light";
  document.body.classList.toggle("light", light);
  // 手机浏览器的地址栏跟着纸面走（.lbl 在窄屏会被 CSS 藏掉，只留图标）
  const meta = $("themeColor");
  if (meta) meta.content = light ? "#f2f0ec" : "#100f12";
  // 标签写"点了会变成什么"，避免歧义（当前状态用图标体现）
  $("themeBtn").innerHTML = light
    ? '🌙<span class="lbl"> 切到夜间</span>'
    : '☀️<span class="lbl"> 切到白天</span>';
  try { localStorage.setItem("ts-theme", mode); } catch {}
}

/* ───────── 顶部发丝进度条 ─────────
   页面内容是真在滚的，所以这条线就是真实阅读进度；用 rAF 节流，
   滚动时最多每帧算一次（scrollHeight 会触发重排，不能直接在 scroll 回调里读）。 */
function initMeter() {
  const el = $("meter");
  if (!el) return;
  let raf = 0;
  const paint = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
    el.style.transform = "scaleX(" + p + ")";
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  paint();
}

/* ───────── Monad 区块心跳（大屏上的"链还在跳"）─────────
   两路数据：① 每 600ms 拉最新块号——让大屏上的数字肉眼可见地跳；
             ② 每 5 秒抓一次区块头，用 (块号差 / 时间戳差) 算真实出块间隔
                （只靠轮询间隔测不准，Monad 出块比轮询周期还快）。 */
function startBlockTicker() {
  const el = $("blockTicker");
  if (!el) return;
  let latest = 0, rateTxt = "";
  let prevN = 0, prevT = 0;

  const paint = () => {
    if (!latest) return;
    el.innerHTML = `<i class="dot" aria-hidden="true"></i><span class="tk-txt">` +
      `<span class="tk-lab">Monad 区块 </span><b>#${latest}</b>${rateTxt}</span>`;
  };

  const sample = async () => {
    try {
      const b = await readProvider.getBlock("latest");
      if (!b) return;
      if (prevN && b.number > prevN && b.timestamp > prevT) {
        const dn = b.number - prevN, dt = b.timestamp - prevT;
        // 速率那串文字在中等屏幕上会被 CSS 收起来（.tk-rate），窄屏只留块号
        rateTxt = ` <span class="tk-rate">· ${(dn / dt).toFixed(1)} 区块/秒 · 平均 ${(dt / dn).toFixed(2)}s/块</span>`;
      }
      prevN = b.number; prevT = b.timestamp; latest = b.number;
      paint();
    } catch { /* RPC 抖动忽略，下次重试 */ }
  };

  sample();
  setInterval(sample, 5000);
  setInterval(async () => {
    try {
      const n = await readProvider.getBlockNumber();
      if (n > latest) { latest = n; paint(); }
    } catch {}
  }, 600);
}

/* ───────── 卡片深链接（?id=4 直达某张卡，方便现场扫码）───────── */
function handleDeepLink() {
  const q = new URLSearchParams(location.search).get("id") ?? location.hash.replace(/^#/, "");
  const id = Number(q);
  if (Number.isInteger(id) && id > 0) pendingDeepLink = id;
}

function setUrlCard(id) {
  try { history.replaceState(null, "", id > 0 ? `?id=${id}` : location.pathname); } catch {}
}

function cardLink(id) {
  const base = location.origin && location.origin !== "null" ? location.origin + location.pathname : "";
  return `${base}?id=${id}`;
}

function scheduleRefresh(ms = 500) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshAll, ms);
}

/* ───────── 读取链上数据 ───────── */
async function refreshAll() {
  if (!readContract) return;
  try {
    const [countRaw, thresholdRaw] = await readContract.getStats();
    const count = Number(countRaw);
    threshold = Number(thresholdRaw);
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const list = [];
    for (let i = 0; i < ids.length; i += 4) {
      const chunk = ids.slice(i, i + 4);
      list.push(...(await Promise.all(chunk.map((id) => fetchCard(id)))));
    }
    if (list.length < count) throw new Error("部分数据未读到，稍后自动重试");

    // 检测"新入池"（recommended false → true）：金光闪卡 + 弹条庆祝
    if (firstLoadDone) {
      for (const c of list) {
        if (c.recommended && !knownRecommended.has(c.id)) {
          flashId = c.id;
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => { flashId = 0; }, 8000);
          toast(`⭐ <b>${esc(c.name)}</b> 票数达标，冲进入池！（当前 ${c.votes} 票）`);
        }
      }
    }
    for (const c of list) if (c.recommended) knownRecommended.add(c.id);
    firstLoadDone = true;

    // 成功读到链：若之前处于离线快照状态，切回实时并提示
    failStreak = 0;
    if (offline) { offline = false; $("offlineBanner").hidden = true; toast("✅ 已恢复与 Monad 的连接，切回实时数据"); }

    candidates = list.sort((a, b) => b.votes - a.votes || Number(b.tips - a.tips) || a.id - b.id);
    renderStats(count);
    renderPodium();
    renderWall();

    // 深链接：数据到位后再打开对应卡片（扫码直达某位候选人）
    if (pendingDeepLink) {
      const id = pendingDeepLink;
      pendingDeepLink = 0;
      if (candidates.some((c) => c.id === id)) openModal(id);
      else toast(`⚠️ 没找到编号 #${id} 的自荐卡`);
    }
  } catch (e) {
    console.error(e);
    // 连续两次读不到链 → 降级到快照，先让大屏有东西可看（现场网络是最大的不确定性）
    failStreak++;
    if (!offline && failStreak >= 2) await useFallback();
    else if (!offline) toast("❌ 读取数据失败：" + (e.shortMessage ?? e.message));
  }
}

/* ───────── 离线兜底：读不到链时用前端快照渲染 ───────── */
async function loadSnap() {
  if (snap) return snap;
  try {
    const res = await fetch("fallback.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    snap = await res.json();
  } catch (e) {
    console.error("快照也读不到", e);
    snap = null;
  }
  return snap;
}

async function useFallback() {
  const s = await loadSnap();
  if (!s) { toast("❌ 读不到链上数据，也没有本地快照（可运行 npm run snapshot 生成）"); return; }

  offline = true;
  threshold = Number(s.threshold ?? threshold);
  candidates = s.candidates
    .map((c) => ({ ...c, tips: BigInt(c.tips), pending: 0n }))
    .sort((a, b) => b.votes - a.votes || Number(b.tips - a.tips) || a.id - b.id);

  renderStats(s.candidates.length);
  renderPodium();
  renderWall();

  $("offlineAt").textContent = new Date(s.savedAt).toLocaleString("zh-CN", { hour12: false });
  $("offlineBlock").textContent = "#" + s.blockNumber;
  $("offlineBanner").hidden = false;

  if (pendingDeepLink) {
    const id = pendingDeepLink;
    pendingDeepLink = 0;
    if (candidates.some((c) => c.id === id)) openModal(id);
  }
  toast("⚠️ 已切到链上快照（" + new Date(s.savedAt).toLocaleTimeString("zh-CN", { hour12: false }) + " 抓取），网络恢复后自动切回");
}

/* 读取单张卡片（带重试；pending 仅在自己是 owner 时读取，省 RPC 调用）*/
async function fetchCard(id) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const c = await readContract.getCandidate(id);
      let pendingAmt = 0n;
      if (account && c.owner.toLowerCase() === account.toLowerCase()) {
        try { pendingAmt = await readContract.pending(id); } catch {}
      }
      return {
        id, owner: c.owner, name: c.name, tagline: c.tagline, skills: c.skills, links: c.links,
        theme: Number(c.theme), votes: Number(c.votes), tips: c.tips, msgCount: Number(c.msgCount),
        interestCount: Number(c.interestCount), recommended: c.recommended, pending: pendingAmt,
      };
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

function renderStats(count) {
  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
  const totalTips = candidates.reduce((s, c) => s + c.tips, 0n);
  const inPool = candidates.filter((c) => c.recommended).length;
  $("statCands").textContent = count;
  $("statVotes").textContent = totalVotes;
  $("statTips").textContent = fmtMon(totalTips);
  $("statPool").textContent = inPool;
}

function cardHTML(c, opts = {}) {
  const isMine = account && c.owner.toLowerCase() === account.toLowerCase();
  const chips = (c.skills || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4)
    .map((s) => chipHTML(s)).join("")
    // "有没有链上简历"这个信息来自启动时加载的快照，不给每次刷新增加 8 次 RPC 调用
    + (snap?.profiles?.[c.id] ? `<span class="chip chip-resume">📄 链上简历</span>` : "");
  return `
  <div class="cand${opts.rank ? ` rank-${opts.rank}` : ""}${c.id === flashId ? " flash" : ""}" data-id="${c.id}" style="--t:${tintOf(c.theme)}">
    ${opts.rank ? `<div class="medal" title="第 ${opts.rank} 名">${opts.rank}</div>` : ""}
    <div class="band" style="background:${THEMES[c.theme % 8]}">
      <div class="avatar">${esc((c.name || "?").slice(0, 1))}</div>
      <div class="name">${esc(c.name)}</div>
    </div>
    ${c.recommended ? `<div class="badge">⭐ 已入池</div>` : ""}
    ${isMine ? `<div class="badge mine">我的卡</div>` : ""}
    <div class="body">
      <div class="tagline">${esc(c.tagline)}</div>
      <div class="chips">${chips}</div>
      <div class="metrics">
        <span>👍 <b>${c.votes}</b></span>
        <span>💰 <b>${fmtMon(c.tips)}</b></span>
        <span>💬 <b>${c.msgCount}</b></span>
        <span>🏢 <b>${c.interestCount}</b></span>
      </div>
      ${opts.action ? `<div class="row" style="margin-top:10px;">
        <button class="btn gold small" data-interest="${c.id}">🏢 标记意向${c.interestCount ? `（已有 ${c.interestCount} 家）` : ""}</button>
      </div>` : ""}
    </div>
  </div>`;
}

function renderPodium() {
  const top = candidates.slice(0, 3);
  const podium = $("podium");
  if (top.length === 0) { podium.innerHTML = ""; return; }
  // 视觉顺序是「亚军 / 冠军 / 季军」（冠军居中），名次牌与高低差都按真实名次走
  const layout = top.length >= 3
    ? [[top[1], 2], [top[0], 1], [top[2], 3]]
    : top.map((c, i) => [c, i + 1]);
  podium.innerHTML = layout.map(([c, rank]) => cardHTML(c, { rank })).join("");
  bindCardClicks(podium);
}

function renderWall() {
  const wall = $("wall");
  wall.innerHTML = candidates.map((c) => cardHTML(c)).join("");
  $("wallEmpty").hidden = candidates.length > 0;
  bindCardClicks(wall);

  // 企业视图：只列已入池的人，可按技能筛选，卡上直接能标注意向
  const pool = $("pool");
  const kw = ($("skillFilter")?.value ?? "").trim().toLowerCase();
  const list = candidates
    .filter((c) => c.recommended)
    .filter((c) => !kw || `${c.skills} ${c.name} ${c.tagline}`.toLowerCase().includes(kw));
  pool.innerHTML = list.map((c) => cardHTML(c, { action: true })).join("");
  $("poolEmpty").hidden = viewMode !== "pool" || list.length > 0;
  // 区分"推荐池是空的"和"筛选没筛出来"——两种情况的下一步动作完全不同
  $("poolEmpty").innerHTML = candidates.some((c) => c.recommended)
    ? `没有符合「<b>${esc(kw)}</b>」的候选人 —— 换个关键词试试`
    : `推荐池还是空的 —— 还没有候选人票数达到阈值（当前阈值 <b>${threshold}</b> 票）。`;
  bindCardClicks(pool);
}

function bindCardClicks(root) {
  root.querySelectorAll(".cand").forEach((el) => {
    el.onclick = () => openModal(Number(el.dataset.id));
  });
  // 企业视图卡片上的快捷"标记意向"（不进弹窗，一步上链）
  root.querySelectorAll("[data-interest]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = Number(b.dataset.interest);
      sendTx("标记意向", (o) => writeContract.markInterest(id, o), 150_000n, () => scheduleRefresh(300));
    };
  });
}

/* ───────── 视图切换：人才墙 ⇄ 企业视图（推荐池）───────── */
function setView(mode) {
  viewMode = mode;
  $("wall").hidden = mode !== "wall";
  $("pool").hidden = mode !== "pool";
  $("skillFilter").hidden = mode !== "pool";
  $("poolNote").hidden = mode !== "pool";
  // 视图切换是一组下划线标签页（不是药丸按钮组）：安静，且一眼看出"这是一份目录的两栏"
  $("tabWall").className = mode === "wall" ? "tab on" : "tab";
  $("tabPool").className = mode === "pool" ? "tab on" : "tab";
  $("wallEmpty").hidden = mode !== "wall" || candidates.length > 0;
  renderWall();
}

/* ───────── 留言墙：每条留言标出链上来源地址 ─────────
   合约里 getMessages() 只返回文本，留言人地址在 MessagePosted 事件里，
   所以由 scripts/snapshot.mjs 扫链生成 messageMeta（按数组下标对齐）。
   本场刚发的留言还不在快照里 → 显示"刚刚 · 本场新留言"。 */
function msgAvatar(addr) {
  const g = THEMES[parseInt(addr.slice(2, 4), 16) % 8];
  return `<div class="mav" style="background:${g}">${addr.slice(2, 4).toUpperCase()}</div>`;
}

function messageListHTML(id, messages, owner) {
  if (!messages?.length) {
    return `<div class="msg-empty muted small">还没有留言 —— 0.01 MON 就能给求职者留一个好印象</div>`;
  }
  const meta = snap?.messageMeta?.[id] ?? null;
  // ⚠️ 合约返回的 messages 是 ethers 的 Result —— 一个"不可写"的 Proxy 数组。
  // Result.slice() 出来**还是 Result**，再调 reverse()/sort() 这类原地方法会直接抛
  // "Cannot assign to read only property '0'"。所以先 Array.from 转成普通数组再动。
  const all = Array.from(messages);
  const shown = all.slice(-20);                 // 只展示最近 20 条
  const offset = all.length - shown.length;
  return `<div class="msg-list">` + shown.slice().reverse().map((text, i) => {
    const idx = shown.length - 1 - i;           // 在链上数组里的原始下标
    const m = meta?.[offset + idx];
    const isMine = account && m && m.from.toLowerCase() === account.toLowerCase();
    // 候选人本人在自己留言墙上说话 → 标"候选人回复"，让"企业喊话 → 候选人回应"一眼可见
    const fromOwner = owner && m && m.from.toLowerCase() === owner.toLowerCase();
    return `<div class="msg${isMine ? " mine" : ""}">
      ${m ? msgAvatar(m.from) : `<div class="mav" style="background:var(--rule)">新</div>`}
      <div class="mbody">
        <div class="meta">
          ${m
            ? `<a class="addr" href="${cfg.explorer}/address/${m.from}" target="_blank" rel="noreferrer" title="${m.from}">${short(m.from)}</a>
               <a class="txlink" href="${cfg.explorer}/tx/${m.tx}" target="_blank" rel="noreferrer">链上交易 ↗</a>`
            : `<span class="addr">刚刚 · 本场新留言</span>`}
          ${fromOwner ? `<span class="tag owner">候选人回复</span>` : ""}
          ${isMine ? `<span>· 你</span>` : ""}
        </div>
        <div class="text">${esc(text)}</div>
      </div>
    </div>`;
  }).join("") + `</div>`;
}

/* ───────── 企业意向 + 入池时刻 ─────────
   合约里只存了一个计数（interestCount），**"是哪家企业"只在 InterestMarked 事件里**——
   和留言墙同一个问题、同一个解法：快照扫链把它恢复出来。 */
function enterpriseHTML(cardId, count, isOwner) {
  const list = snap?.interestMeta?.[cardId] ?? [];
  const at = snap?.recommendedAt?.[cardId] ?? null;
  if (!count && !at) return "";

  const rows = list.map((e) => `
    <div class="intent">
      <a class="co" href="${cfg.explorer}/address/${e.company}" target="_blank" rel="noreferrer" title="${e.company}">${short(e.company)}</a>
      <a class="quiet" href="${cfg.explorer}/tx/${e.tx}" target="_blank" rel="noreferrer">链上交易 ↗</a>
    </div>`).join("");

  return `<div class="row between" style="margin-top:16px;">
      <b class="small">🏢 企业意向</b>
      <span class="muted small">${count} 个地址标记过 · 公开留痕</span>
    </div>
    ${rows ? `<div class="intents">${rows}</div>` : ""}
    ${count > list.length ? `<div class="intent-note">还有 ${count - list.length} 个标记不在快照覆盖范围内（刚发生的），重跑快照即可查到。</div>` : ""}
    ${at ? `<div class="intent-note">⭐ <b>入池时刻</b>：第 ${at.block} 块（当时 ${at.votes} 票）· <a class="quiet" href="${cfg.explorer}/tx/${at.tx}" target="_blank" rel="noreferrer">链上交易 ↗</a></div>` : ""}
    ${isOwner && count ? `<div class="intent-note">💡 有企业对你感兴趣了 —— 建议：① 更新链上简历　② 把卡片链接发给更多同行（企业看的是<b>实名背书</b>，不只是票数）</div>` : ""}`;
}

/* ───────── 链上简历（ProfileRegistry）───────── */
const RESUME_LABELS = { role: "期望岗位", city: "城市", exp: "经验", edu: "教育", availability: "到岗时间" };

// Monad 按 gasLimit 计费（不是 gasUsed）——给宽了就是多花钱，给窄了会 out of gas。
// 简历落链 ≈ 每 32 字节占一个存储槽（20,000 gas），按内容长度算 + 25% 余量。
const gasForResume = (bytes) => 400_000n + BigInt(Math.ceil(bytes / 32) + 4) * 20_000n;

/* ───────── 简历表单：发布 与 编辑 共用同一份字段定义 ─────────
   以前是"发布用表单、编辑让你手写 JSON"，两套逻辑不一致、体验割裂。
   现在两边都由这里生成，字段/校验/提示永远一致；JSON 只留给「链上校验」（它本质就是比对一份 JSON）。
   id 规则：`${prefix}${字段名}` —— 发布用 r、编辑用 e，避免同页重复 id。 */
const RESUME_FIELDS = [
  { k: "role", label: "期望岗位", ph: "例如：智能合约工程师", max: 30, col: 0 },
  { k: "city", label: "城市", ph: "例如：上海", max: 20, col: 0 },
  { k: "exp", label: "经验", ph: "例如：3 年", max: 20, col: 0 },
  { k: "edu", label: "教育", ph: "例如：本科 · 计算机科学", max: 40, col: 1 },
  { k: "availability", label: "到岗时间", ph: "例如：随时到岗 · 可远程", max: 30, col: 1 },
  { k: "skills", label: "简历技能（逗号分隔）", ph: "Solidity,TypeScript", max: 80, col: 1 },
];

function resumeFieldsHTML(prefix, v = {}) {
  const input = (f) =>
    `<label>${f.label}</label><input id="${prefix}${f.k}" maxlength="${f.max}" placeholder="${f.ph}" value="${esc(v[f.k] ?? "")}" />`;
  const cols = [0, 1]
    .map((c) => `<div>${RESUME_FIELDS.filter((f) => f.col === c).map(input).join("")}</div>`)
    .join("");
  return `<div class="cols">${cols}</div>
    <label>联系方式（选填 · ⚠️ 会公开在链上，永久可查 —— 建议填 Telegram / X 这类能屏蔽的渠道，别填手机号）</label>
    <input id="${prefix}contact" maxlength="80" placeholder="Telegram @你的id（优先）· you@mail.com" value="${esc(v.contact ?? "")}" />
    <label>个人简介（一句话说清你能解决什么问题）</label>
    <textarea id="${prefix}summary" maxlength="300" placeholder="写过 6 个上主网的合约，最擅长把模糊的想法在两周内变成能演示、能上链的东西。">${esc(v.summary ?? "")}</textarea>
    <label>工作 / 项目经历（每行一条，用 <code>|</code> 分隔：公司 | 职位 | 时间 | 做了什么）</label>
    <textarea id="${prefix}experience" placeholder="某 DeFi 协议 | 合约工程师 | 2024-2026 | 负责借贷模块与清算逻辑，审计零高危">${esc(v.experience ?? "")}</textarea>`;
}

/* 链上简历 JSON → 表单值（编辑时预填） */
function resumeToFormValues(json) {
  let d = {};
  try { d = JSON.parse(json) ?? {}; } catch { return {}; }
  return {
    role: d.role ?? "", city: d.city ?? "", exp: d.exp ?? "", edu: d.edu ?? "",
    availability: d.availability ?? "", contact: d.contact ?? "",
    skills: Array.isArray(d.skills) ? d.skills.join(", ") : (d.skills ?? ""),
    summary: d.summary ?? "",
    experience: (d.experience ?? []).map((e) => [e.co, e.title, e.time, e.desc].filter(Boolean).join(" | ")).join("\n"),
  };
}

/* 表单值 → 链上简历 JSON。什么都没填就返回 null（不误发一笔空简历上链） */
function collectResume(prefix, fallbackSkills = "") {
  const val = (k) => ($(`${prefix}${k}`)?.value ?? "").trim();
  const d = {};
  for (const k of ["role", "city", "exp", "edu", "availability", "contact"]) {
    const x = val(k);
    if (x) d[k] = x;
  }
  const skillsRaw = val("skills") || fallbackSkills;
  const skills = skillsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (skills.length) d.skills = skills;
  if (val("summary")) d.summary = val("summary");

  const experience = val("experience").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const [co, title, time, desc] = line.split("|").map((s) => s.trim());
    return { co: co ?? "", title: title ?? "", time: time ?? "", desc: desc ?? "" };
  });
  if (experience.length) d.experience = experience;

  // 只有技能（可能是从卡片带过来的）不算"填了简历"
  return d.role || d.summary || d.experience ? d : null;
}

// 填充发布表单里的简历字段。
// ⚠️ 必须放在这里而不是 init()：RESUME_FIELDS 是 const，而 init() 在脚本很靠前就被调用，
// 那时它还在 TDZ（"Cannot access before initialization"）。
document.getElementById("resumeFieldsInner")?.insertAdjacentHTML("beforeend", resumeFieldsHTML("r", {}));

function resumeHTML(c, profile, isOwner) {
  if (!hasProfile) return "";
  if (!profile) {
    return `<div class="resume">
      <div class="muted small">📄 还没有链上简历${isOwner ? " —— 点「✏️ 填写简历」，把你的基本信息与经历写上链" : " —— 候选人还没填写"}</div>
      <div class="row small" style="margin-top:8px;">
        <span class="muted small">链上简历登记处：<span class="hash">${cfg.profile.address}</span></span>
        ${isOwner ? `<button class="btn ghost small" id="editResumeBtn">✏️ 填写简历</button>` : ""}
      </div>
      <div id="verifyArea" hidden style="margin-top:10px;">${verifyAreaHTML()}</div>
      ${isOwner ? `<div id="editArea" hidden style="margin-top:10px;">${editFormHTML(null)}</div>` : ""}
    </div>`;
  }

  let d = null;
  try { d = JSON.parse(profile.json); } catch {}
  const kv = d ? ["role", "city", "exp", "edu", "availability"].filter((k) => d[k])
    .map((k) => `<div><span>${RESUME_LABELS[k]}</span>${esc(d[k])}</div>`).join("") : "";
  const skills = d?.skills?.length ? `<div class="chips">${d.skills.map((s) => chipHTML(s)).join("")}</div>` : "";
  // 联系方式：候选人主动公开的接触入口。企业标记意向后，这里是唯一"能往下走一步"的地方
  const contact = d?.contact
    ? `<div class="contact-row">
        <span class="tag">公开</span>
        <b>📮 联系我</b>
        <span class="contact-val">${esc(d.contact)}</span>
        <button class="btn ghost small" id="copyContactBtn">复制</button>
      </div>`
    : "";
  const exps = (d?.experience ?? []).map((e) => `<div class="exp"><b>${esc(e.title)}</b> · ${esc(e.co)}<div class="t">${esc(e.time)}</div><div>${esc(e.desc)}</div></div>`).join("");
  const when = profile.updatedAt ? new Date(profile.updatedAt * 1000).toLocaleString("zh-CN", { hour12: false }) : "—";
  const body = d ? `${kv ? `<div class="kv">${kv}</div>` : ""}${contact}${skills}
      ${d.summary ? `<div style="font-size:13.5px;margin:8px 0;">${esc(d.summary)}</div>` : ""}${exps}`
    : `<pre class="hash" style="white-space:pre-wrap;margin:0;">${esc(profile.json)}</pre>`;

  return `<div class="resume">
    ${body}
    <div class="row between small" style="margin-top:10px;gap:8px;">
      <span class="small muted">🔐 链上存证 · 版本 v${profile.version} · 更新于 ${when}</span>
      <span class="hash">${profile.hash}</span>
    </div>
    <div class="row" style="margin-top:8px;">
      <button class="btn ghost small" id="verifyBtn">🔐 链上校验</button>
      ${isOwner ? `<button class="btn ghost small" id="editResumeBtn">✏️ 编辑简历</button>` : ""}
    </div>
    <div id="verifyArea" hidden style="margin-top:10px;">${verifyAreaHTML()}</div>
    ${isOwner ? `<div id="editArea" hidden style="margin-top:10px;">${editFormHTML(profile)}</div>` : ""}
  </div>`;
}

// 校验区只负责"比对一份 JSON" —— 编辑简历走的是表单，见 editFormHTML()
function verifyAreaHTML() {
  return `<label>把一份简历 JSON 贴进来 —— 链上比对其 keccak256 哈希（改一个字符就会对不上）</label>
    <textarea id="verifyText" maxlength="2000" style="min-height:96px;font-family:ui-monospace,Consolas,monospace;font-size:12px;"></textarea>
    <div class="row" style="margin-top:8px;">
      <button class="btn small" id="verifyRunBtn">🔍 开始校验</button>
    </div>
    <div id="verifyResult" style="margin-top:8px;"></div>`;
}

/* 编辑简历 = 和"首次填写"完全一样的表单（预填链上当前内容），不再是让人手写 JSON */
function editFormHTML(profile) {
  const v = profile ? resumeToFormValues(profile.json) : {};
  return `${resumeFieldsHTML("e", v)}
    <div class="row" style="margin-top:12px;">
      <button class="btn green small" id="editSaveBtn">💾 保存上链</button>
      <span class="small muted">${profile ? `当前 v${profile.version} → 保存后 v${profile.version + 1}（历史哈希留痕）` : "保存后生成 v1"}</span>
    </div>
    <div id="editResult" style="margin-top:8px;"></div>`;
}

/* ───────── 卡片详情弹窗 ───────── */
async function openModal(id) {
  const c = candidates.find((x) => x.id === id);
  if (!c) return;
  currentModalId = id;

  let voted = false, marked = false, messages = [];
  try { if (account) voted = await readContract.hasVoted(id, account); } catch {}
  try { if (account) marked = await readContract.hasMarked(id, account); } catch {}
  try { messages = await readContract.getMessages(id); } catch {}
  // 离线（或这条读失败）时用快照补齐，保证弹窗内容完整
  if (!messages?.length && snap?.messages?.[id]) messages = snap.messages[id];

  // 链上简历（ProfileRegistry）
  let profile = null;
  try {
    if (readProfile) {
      const p = await readProfile.getProfile(id);
      if (p.contentHash && p.contentHash !== ethers.ZeroHash) {
        profile = { hash: p.contentHash, json: p.json, updatedAt: Number(p.updatedAt), version: Number(p.version) };
      }
    }
  } catch (e) { console.error("读取链上简历失败", e); }
  if (!profile && snap?.profiles?.[id]) profile = snap.profiles[id];

  setUrlCard(id);

  const isOwner = account && c.owner.toLowerCase() === account.toLowerCase();
  const links = (c.links || "").split(",").map((s) => s.trim()).filter(Boolean)
    .map((l) => `<a href="${l.startsWith("http") ? l : "https://" + l}" target="_blank" rel="noreferrer">${esc(l)}</a>`).join(" · ");
  const msgHTML = messageListHTML(id, messages, c.owner);

  const modal = `
  <div class="modal-back" id="modalBack">
    <div class="modal">
      <div class="top" style="background:${THEMES[c.theme % 8]}">
        <div class="row between">
          <div class="row">
            <div class="avatar" style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.75);display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:500;">${esc(c.name.slice(0, 1))}</div>
            <div>
              <div style="font-size:21px;font-weight:500;letter-spacing:-.022em;">${esc(c.name)} ${c.recommended ? "⭐" : ""}</div>
              <div style="font-size:13px;opacity:.92;">${esc(c.tagline)}</div>
            </div>
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn ghost" id="copyLinkBtn">🔗 直达链接</button>
            <button class="btn ghost" id="modalClose">关闭 ✕</button>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="small muted" style="margin:10px 0;">👍 ${c.votes} 票 · 💰 ${fmtMon(c.tips)} MON 支持 · 💬 ${c.msgCount} 条留言 · 🏢 ${c.interestCount} 家企业感兴趣 ${links ? " · 🔗 " + links : ""}</div>
        <div class="actions">
          <button class="btn green" id="voteBtn" ${voted || isOwner ? "disabled" : ""}>👍 投票（免费）${voted ? "· 已投过" : isOwner ? "· 不能投自己" : ""}</button>
          <button class="btn gold" id="interestBtn" ${marked || isOwner ? "disabled" : ""}>🏢 标记感兴趣 ${marked ? "· 已标记" : ""}</button>
          <div class="row full">
            <input id="tipAmount" style="max-width:130px;" value="0.05" />
            <button class="btn" id="tipBtn">💰 打赏 MON</button>
            <span class="muted small">支持金可被候选人提取</span>
          </div>
          <div class="full">
            <textarea id="msgText" maxlength="120" placeholder="写一句公开留言（0.01 MON，永久上链）"></textarea>
            <div class="row between" style="margin-top:8px;">
              <button class="btn" id="msgBtn">💬 发送留言（0.01 MON）</button>
              ${isOwner ? `<button class="btn ghost" id="withdrawBtn">提取支持金（${fmtMon(c.pending)} MON）</button>` : ""}
            </div>
          </div>
        </div>
        ${enterpriseHTML(id, c.interestCount, isOwner)}
        ${hasProfile ? `<div class="row between" style="margin-top:16px;">
          <b class="small">📄 链上简历</b>
          <span class="muted small">${isOwner
            ? "本人可随时更新（每次留哈希）· 卡片名称与一句话简介发布后固定"
            : "内容哈希上链 · 可当场校验 · 篡改可查"}</span>
        </div>` + resumeHTML(c, profile, isOwner) : ""}
        <b class="small">💬 留言墙</b>
        <div style="margin-top:6px;">${msgHTML}</div>
      </div>
    </div>
  </div>`;

  $("modalRoot").innerHTML = modal;
  $("modalClose").onclick = closeModal;
  $("copyLinkBtn").onclick = async () => {
    const url = cardLink(id);
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); toast("🔗 已复制直达链接，扫码即开这张卡"); return; }
      throw new Error("no clipboard");
    } catch {
      // http://192.168.x.x 这类非安全上下文没有剪贴板 API，退化成"把链接显示出来手抄"
      toast(`🔗 直达链接：<code>${esc(url)}</code>`);
    }
  };

  // 联系方式复制（卡片上没有 contact 时这个按钮不存在）
  $("copyContactBtn")?.addEventListener("click", async () => {
    const txt = document.querySelector(".contact-val")?.textContent ?? "";
    if (!txt) return;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); toast("📮 联系方式已复制"); return; }
      throw new Error("no clipboard");
    } catch {
      toast(`📮 联系方式：<code>${esc(txt)}</code>`);
    }
  });
  $("modalBack").onclick = (e) => { if (e.target.id === "modalBack") closeModal(); };

  $("voteBtn").onclick = () => sendTx("投票", (o) => writeContract.vote(id, o), 200_000n, () => { closeModal(); scheduleRefresh(200); });
  $("interestBtn").onclick = () => sendTx("标记意向", (o) => writeContract.markInterest(id, o), 150_000n, () => { closeModal(); scheduleRefresh(200); });
  $("tipBtn").onclick = () => {
    const amt = $("tipAmount").value.trim();
    if (!amt || Number(amt) <= 0) return toast("请输入打赏金额");
    sendTx("打赏 " + amt + " MON", (o) => writeContract.tip(id, { ...o, value: ethers.parseEther(amt) }), 120_000n, () => { closeModal(); scheduleRefresh(200); });
  };
  $("msgBtn").onclick = () => {
    const text = $("msgText").value.trim();
    if (!text) return toast("留言不能为空");
    sendTx("发送留言", (o) => writeContract.postMessage(id, text, { ...o, value: ethers.parseEther("0.01") }), 250_000n, () => { closeModal(); scheduleRefresh(200); });
  };
  if (isOwner && $("withdrawBtn")) {
    $("withdrawBtn").onclick = () => sendTx("提取支持金", (o) => writeContract.withdraw(id, o), 120_000n, () => { closeModal(); scheduleRefresh(200); });
  }

  if (hasProfile) {
    const vt = $("verifyText");
    const area = $("verifyArea");
    const res = $("verifyResult");

    const eArea = $("editArea");

    const showVerify = () => {
      area.hidden = false;
      if (eArea) eArea.hidden = true;          // 校验和编辑互斥展开，避免一屏两个大区域
      if (!vt.value) vt.value = profile?.json ?? "";
      res.innerHTML = "";
    };

    $("verifyBtn")?.addEventListener("click", () => {
      if (!area.hidden) { area.hidden = true; return; }
      showVerify();
    });

    $("verifyRunBtn").onclick = async () => {
      const txt = vt.value;
      if (!txt.trim()) return toast("请先贴一份简历 JSON");
      const computed = ethers.keccak256(ethers.toUtf8Bytes(txt));
      let chainOk = null;
      try { chainOk = await readProfile.verify(id, txt); } catch (e) { console.error(e); }
      const localOk = profile ? computed.toLowerCase() === profile.hash.toLowerCase() : false;
      const ok = chainOk === true && localOk;
      // 链上 verify() 没调通（例如离线快照模式）时不误报"篡改"，只报本地哈希比对结果
      const onlyLocal = chainOk === null;
      const cls = onlyLocal ? "warn" : ok ? "verify-ok" : "verify-bad";
      const title = onlyLocal
        ? (localOk ? "✅ 与记录一致（离线模式：只做了本地哈希比对，链上 verify() 未调通）" : "❌ 与记录不一致（离线模式：只做了本地哈希比对）")
        : ok ? "✅ 校验通过：这份简历与链上记录逐字节一致，未被篡改" : "❌ 校验不通过：这份内容和链上存的那份不是同一份";
      res.innerHTML = `<div class="card ${cls} small" style="margin:0;">
        <b>${title}</b>
        <div class="hash" style="margin-top:6px;">本次计算：${computed}</div>
        <div class="hash">链上记录：${profile ? profile.hash : "（这张卡还没有链上简历）"}</div>
        <div class="hash">链上 verify() 返回：${chainOk === null ? "调用失败" : String(chainOk)}</div>
      </div>`;
    };

    // 编辑简历 = 和首次填写同一套表单（预填链上当前内容），不再是手写 JSON
    $("editResumeBtn")?.addEventListener("click", () => {
      if (!eArea) return;
      if (!eArea.hidden) { eArea.hidden = true; return; }
      area.hidden = true;
      eArea.hidden = false;
      $("editResult").innerHTML = "";
    });

    $("editSaveBtn")?.addEventListener("click", () => {
      const d = collectResume("e");
      if (!d) return toast("至少填「期望岗位」「个人简介」或一段「工作 / 项目经历」");
      const json = JSON.stringify(d);
      const bytes = new TextEncoder().encode(json).length;
      if (bytes > 2000) return toast(`❌ 超过 2000 字节上限（现在 ${bytes} 字节），精简一下`);
      if (!writeProfile) return toast("请先连接 MetaMask");
      sendTx("保存简历", (o) => writeProfile.setProfile(id, json, o), gasForResume(bytes), () => { closeModal(); scheduleRefresh(200); });
    });
  }
}

function closeModal() { currentModalId = 0; $("modalRoot").innerHTML = ""; setUrlCard(0); }

/* ───────── 发布自荐卡 ───────── */
function buildThemePicker() {
  const box = $("themePicker");
  // 选中态用 outline（不占布局）而不是加粗边框：切换时色块不会跳一下
  box.innerHTML = THEMES.map((g, i) =>
    `<button type="button" data-theme="${i}" aria-label="卡片主题色 ${i + 1}"` +
    ` style="width:36px;height:36px;border-radius:var(--r-pill);border:1px solid var(--rule);background:${g};` +
    `cursor:pointer;outline:${i === 0 ? "2px solid var(--fg)" : "none"};outline-offset:2px;"></button>`).join("");
  box.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      pickedTheme = Number(b.dataset.theme);
      box.querySelectorAll("button").forEach((x) => (x.style.outline = "none"));
      b.style.outline = "2px solid var(--fg)";
      b.style.outlineOffset = "2px";
    };
  });
}

/* 从发布交易的回执里取出新卡片编号（Published 事件的第一个参数） */
function publishedIdFromReceipt(receipt) {
  for (const log of receipt.logs) {
    try {
      const p = readContract.interface.parseLog(log);
      if (p?.name === "Published") return Number(p.args[0]);
    } catch { /* 不是本合约的事件，跳过 */ }
  }
  return 0;
}

function clearPublishForm() {
  const resumeIds = ["r" + f.k, "rcontact", "rsummary", "rexperience"];
  ["fName", "fTagline", "fSkills", "fLinks", ...resumeIds]
    .forEach((id) => { const el = $(id); if (el) el.value = ""; });
}

function publishCard() {
  const name = $("fName").value.trim();
  const tagline = $("fTagline").value.trim();
  const skills = $("fSkills").value.trim();
  const links = $("fLinks").value.trim();
  if (!name || !tagline) return toast("名字和一句话简介不能为空");

  const resume = collectResume("r", $("fSkills").value.trim());
  if (resume && !hasProfile) {
    toast("⚠️ 简历合约未配置（先跑 npm run deploy-profile），本次只发布卡片");
  }
  const withResume = Boolean(resume && hasProfile && writeProfile);

  sendTx("发布自荐卡", (o) => writeContract.publish(name, tagline, skills, links, pickedTheme, o), 900_000n, async (receipt) => {
    const newId = publishedIdFromReceipt(receipt);
    clearPublishForm();

    if (!withResume) {
      $("publishStatus").textContent = `✅ 已发布（#${newId || "?"}）！其他人现在可以给你投票、打赏、留言了`;
      scheduleRefresh(300);
      if (newId) setTimeout(() => openModal(newId), 600);
      return;
    }

    // 第二步：把简历也写上链（自己名下、版本 v1）
    const json = JSON.stringify(resume);
    const bytes = new TextEncoder().encode(json).length;
    $("publishStatus").textContent = `✅ 卡片 #${newId} 已上链 —— 请在钱包里确认第 2 笔（简历）`;
    sendTx("简历上链", (o) => writeProfile.setProfile(newId, json, o), gasForResume(bytes), () => {
      $("publishStatus").textContent = `✅ #${newId} 卡片 + 链上简历都已完成（简历以后可随时更新）`;
      scheduleRefresh(300);
      setTimeout(() => openModal(newId), 600);
    });
  });
}

/* ───────── 发交易（钱包签名）通用流程 ───────── */
async function sendTx(label, fn, gasLimit, onSuccess) {
  if (!writeContract || !account) return toast("请先连接 MetaMask");
  try {
    toast("⏳ " + label + "：请在钱包弹窗确认…");
    const tx = await fn({ gasLimit });
    toast("📨 已发出 <code>" + short(tx.hash) + "</code>，等待上链…");
    const receipt = await tx.wait();
    toast("✅ " + label + " 成功 · <a href=\"" + cfg.explorer + "/tx/" + tx.hash + "\" target=\"_blank\" rel=\"noreferrer\">在浏览器查看</a>");
    if (onSuccess) onSuccess(receipt);   // 回执传下去：发布流程要靠它解析新卡片编号
  } catch (e) {
    console.error(e);
    if (e.code === "ACTION_REJECTED" || e.code === 4001) toast("❌ 你在钱包里取消了交易");
    else toast("❌ " + label + " 失败：" + (e.shortMessage ?? e.message));
  }
}

/* ───────── 连接钱包 ───────── */
async function connectWallet() {
  if (!window.ethereum) return alert("没有检测到钱包插件。请先安装 MetaMask: https://metamask.io");
  try {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD_TESTNET.chainId }] });
    } catch (e) {
      if (e.code === 4902) await window.ethereum.request({ method: "wallet_addEthereumChain", params: [MONAD_TESTNET] });
      else throw e;
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    account = accounts[0];
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    const signer = await browserProvider.getSigner();
    if (hasContract) writeContract = new ethers.Contract(cfg.contractAddress, cfg.abi, signer);
    if (hasProfile) writeProfile = new ethers.Contract(cfg.profile.address, cfg.profile.abi, signer);
    const balance = await browserProvider.getBalance(account);
    $("accountInfo").innerHTML = "已连接 <b>" + short(account) + "</b> · 余额 " + Number(ethers.formatEther(balance)).toFixed(4) + " MON · 你的每一票/每条留言都会真实上链";
    scheduleRefresh(200);
  } catch (e) {
    console.error(e);
    $("accountInfo").textContent = "连接失败：" + (e.shortMessage ?? e.message ?? e);
  }
}

/* ───────── 小工具 ───────── */
let toastTimer = null;
function toast(html) {
  const box = $("toastRoot");
  box.innerHTML = `<div class="toast">${html}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.innerHTML = ""), 8000);
}

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => window.location.reload());
  window.ethereum.on?.("chainChanged", () => window.location.reload());
}