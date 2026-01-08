// Independent & Challenge Practice
// - Does NOT modify Guided Build files.
// - Uses same molecule data structure + same drag/drop interface + same validation logic style.
// - Adds session/set runner, toggles, timer, and summary.

const VALENCE = { H:1, F:7, Cl:7, Br:7, C:4, N:5, O:6, P:5, B:3, S:6 };
const COST = { bond1:2, bond2:4, bond3:6, lp:2 };

// Existing bank + a few more "challenging-but-still-clean" molecules
const MOLECULES = [
  // --- from your Guided Build bank ---
  { name:"Br2", type:"diatomic", atoms:["Br","Br"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:3,1:3} } },
  { name:"F2", type:"diatomic", atoms:["F","F"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:3,1:3} } },
  { name:"H2", type:"diatomic", atoms:["H","H"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:0,1:0} } },
  { name:"N2", type:"diatomic", atoms:["N","N"], central:null,
    target:{ bonds:[{a:0,b:1,order:3}], lonePairs:{0:1,1:1} } },
  { name:"O2", type:"diatomic", atoms:["O","O"], central:null,
    target:{ bonds:[{a:0,b:1,order:2}], lonePairs:{0:2,1:2} } },
  { name:"HF", type:"diatomic", atoms:["H","F"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:0,1:3} } },

  { name:"CO2", type:"linear3", atoms:["O","C","O"], central:1,
    target:{ bonds:[{a:1,b:0,order:2},{a:1,b:2,order:2}], lonePairs:{0:2,1:0,2:2} } },
  { name:"HCN", type:"linear3", atoms:["H","C","N"], central:1,
    target:{ bonds:[{a:1,b:0,order:1},{a:1,b:2,order:3}], lonePairs:{0:0,1:0,2:1} } },

  { name:"PF3", type:"trigonal", atoms:["P","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:3,2:3,3:3} } },
  { name:"NH3", type:"trigonal", atoms:["N","H","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:0,2:0,3:0} } },

  { name:"H2O", type:"bent", atoms:["O","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1}], lonePairs:{0:2,1:0,2:0} } },

  { name:"CF4", type:"tetra", atoms:["C","F","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs:{0:0,1:3,2:3,3:3,4:3} } },
  { name:"CBr4", type:"tetra", atoms:["C","Br","Br","Br","Br"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs:{0:0,1:3,2:3,3:3,4:3} } },

  // --- additional challenge bank (still matches your supported layouts) ---
  // Formaldehyde: CH2O (trigonal around C): O double, two H single
  { name:"CH2O", type:"trigonal", atoms:["C","O","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:2},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:0,1:2,2:0,3:0} } },

  // Boron trifluoride: BF3 (trigonal) — classic incomplete octet on B
  { name:"BF3", type:"trigonal", atoms:["B","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:0,1:3,2:3,3:3} } },

  // Sulfur dioxide: SO2 (bent) — common “expanded octet” vibe; use one typical structure (O=S=O with 1 LP on S)
  { name:"SO2", type:"bent", atoms:["S","O","O"], central:0,
    target:{ bonds:[{a:0,b:1,order:2},{a:0,b:2,order:2}],
      lonePairs:{0:1,1:2,2:2} } },
];

// ---- DOM ----
const el = {
  btnNewSet: document.getElementById("btnNewSet"),
  btnStartSet: document.getElementById("btnStartSet"),
  btnRestart: document.getElementById("btnRestart"),

  toggleHints: document.getElementById("toggleHints"),
  toggleReminders: document.getElementById("toggleReminders"),
  toggleTimer: document.getElementById("toggleTimer"),
  setSize: document.getElementById("setSize"),

  progressRow: document.getElementById("progressRow"),
  progressText: document.getElementById("progressText"),
  modeText: document.getElementById("modeText"),

  remindersPanel: document.getElementById("remindersPanel"),
  bankMini: document.getElementById("bankMini"),
  bankRemainMini: document.getElementById("bankRemainMini"),

  timerBox: document.getElementById("timerBox"),
  timerText: document.getElementById("timerText"),

  molName: document.getElementById("molName"),
  molHint: document.getElementById("molHint"),

  stage: document.getElementById("stage"),
  stageOverlay: document.getElementById("stageOverlay"),

  btnCheckModel: document.getElementById("btnCheckModel"),
  btnClear: document.getElementById("btnClear"),
  btnNext: document.getElementById("btnNext"),

  feedback: document.getElementById("feedback"),

  setupNote: document.getElementById("setupNote"),

  summaryCard: document.getElementById("summaryCard"),
  summaryBody: document.getElementById("summaryBody"),
};

// ---- State ----
let session = null;

function formatFormula(str){
  return str.replace(/(\d+)/g, "<sub>$1</sub>");
}

function totalValence(mol){
  return mol.atoms.reduce((sum, sym) => sum + (VALENCE[sym] ?? 0), 0);
}

function setOverlay(isLocked, text){
  el.stageOverlay.style.display = isLocked ? "flex" : "none";
  el.stageOverlay.textContent = text || "";
}

function clearStage(){
  el.stage.innerHTML = `<div id="stageOverlay" class="stage-overlay"></div>`;
  el.stageOverlay = document.getElementById("stageOverlay");
}

function flashFeedback(text, kind="soft"){
  el.feedback.style.display = "block";
  el.feedback.className = `msg ${kind==="ok"?"msg-ok":kind==="bad"?"msg-bad":"msg-soft"}`;
  el.feedback.textContent = text;
}

function updateModeText(){
  const hintsOn = el.toggleHints.checked;
  const remindersOn = el.toggleReminders.checked;
  const timerOn = el.toggleTimer.checked;

  const parts = [
    hintsOn ? "Hints: ON" : "Hints: OFF",
    remindersOn ? "Reminders: ON" : "Reminders: OFF",
    timerOn ? "Timer: ON" : "Timer: OFF",
  ];
  el.modeText.textContent = parts.join(" • ");

  el.remindersPanel.style.display = remindersOn ? "block" : "none";
  // Bank mini display is controlled by reminders (but bank still exists internally)
  el.bankMini.style.display = remindersOn ? "block" : "none";
  el.timerBox.style.display = timerOn ? "block" : "none";
}

function enableBuildUI(on){
  el.btnCheckModel.disabled = !on;
  el.btnClear.disabled = !on;
  el.btnNext.disabled = !on;
}

// ---- Random set ----
function sampleWithoutReplacement(arr, n){
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function startNewSet(){
  const n = Number(el.setSize.value);
  const picked = sampleWithoutReplacement(MOLECULES, n);

  session = {
    options: {
      hints: el.toggleHints.checked,
      reminders: el.toggleReminders.checked,
      timer: el.toggleTimer.checked,
    },
    set: picked,
    idx: 0,

    // per-molecule record
    attemptsByMol: picked.map(()=>0),
    solvedByMol: picked.map(()=>false),
    timeByMolMs: picked.map(()=>0),

    // error tracking
    errorCounts: { electron:0, bonding:0, lonepairs:0, overspent:0 },

    // totals
    totalAttempts: 0,
  };

  el.summaryCard.style.display = "none";
  el.setupNote.style.display = "none";
  el.progressRow.style.display = "block";
  updateModeText();

  loadCurrentMolecule();
}

function setProgressUI(){
  const currentNumber = session.idx + 1;
  const total = session.set.length;
  el.progressText.textContent = `Molecule ${currentNumber} of ${total}`;
}

function loadCurrentMolecule(){
  const mol = session.set[session.idx];

  // Reset build state for this molecule
  session.build = createBuildState(mol);

  // UI header
  el.molName.innerHTML = formatFormula(mol.name);
  el.molHint.textContent = "Build the model. Check when ready.";
  setProgressUI();

  // Timer
  stopTimer();
  resetTimerUI();
  if (session.options.timer){
    startTimer();
  }

  // Render model immediately (no step gating)
  clearStage();
  session.build.layout = computeLayout(mol);
  renderModel();

  setOverlay(false);
  enableBuildUI(true);
  el.btnNext.disabled = true; // only enable after at least one check

  // Bank mini UI (remaining only)
  el.bankRemainMini.textContent = String(session.build.bankRemain);

  // Clear feedback
  el.feedback.style.display = "none";
  el.feedback.className = "msg msg-soft";
  el.feedback.textContent = "";
}

// ---- Timer helpers ----
let timerStart = null;
let timerInterval = null;

function resetTimerUI(){
  el.timerText.textContent = "0:00";
}

function startTimer(){
  timerStart = Date.now();
  timerInterval = setInterval(()=>{
    const ms = Date.now() - timerStart;
    el.timerText.textContent = formatTime(ms);
  }, 250);
}

function stopTimer(){
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(ms){
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2,"0")}`;
}

// ---- Build engine (same interaction style as Guided Build) ----
function createBuildState(mol){
  const bankTotal = totalValence(mol);

  return {
    mol,
    bankTotal,
    bankRemain: bankTotal,
    placed: {
      bonds: new Map(),      // "a-b" => order
      lonePairs: new Map(),  // "atomIdx|slotId" => true
    },
    layout: null,
  };
}

function bondKey(a,b){
  const x = Math.min(a,b);
  const y = Math.max(a,b);
  return `${x}-${y}`;
}

function canSpend(cost){
  return session.build.bankRemain >= cost;
}
function spend(cost){
  session.build.bankRemain -= cost;
  if (session.build.bankRemain < 0) session.build.bankRemain = 0;
  if (session.options.reminders) el.bankRemainMini.textContent = String(session.build.bankRemain);
}
function refund(cost){
  session.build.bankRemain += cost;
  if (session.build.bankRemain > session.build.bankTotal) session.build.bankRemain = session.build.bankTotal;
  if (session.options.reminders) el.bankRemainMini.textContent = String(session.build.bankRemain);
}

// --- LP side-blocking fix (same fix you just validated) ---
function computeBlockedSides(atoms, connections){
  const blocked = {};
  const centerOf = (idx) => {
    const A = atoms.find(t => t.idx === idx);
    return { cx: A.x + 27, cy: A.y + 27 };
  };
  const sideFromTo = (fromIdx, toIdx) => {
    const F = centerOf(fromIdx);
    const T = centerOf(toIdx);
    const dx = T.cx - F.cx;
    const dy = T.cy - F.cy;

    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "bottom" : "top";
  };
  const opposite = (side) => (
    side === "left" ? "right" :
    side === "right" ? "left" :
    side === "top" ? "bottom" : "top"
  );

  connections.forEach(({a,b})=>{
    const sA = sideFromTo(a,b);
    const sB = opposite(sA);
    blocked[a] = blocked[a] || new Set();
    blocked[b] = blocked[b] || new Set();
    blocked[a].add(sA);
    blocked[b].add(sB);
  });

  return blocked;
}

function computeLayout(mol){
  const stageW = el.stage.clientWidth || 700;
  const stageH = 320;

  const atoms = [];
  const bonds = [];
  const lpSlots = [];
  const connections = [];

  const isH = (sym) => sym === "H";

  const addLP = (atomIdx, x, y, slotId) => {
    lpSlots.push({ atomIdx, x, y, slotId });
  };

  const addLPBoxesAround = (atomIdx, x, y, sym, blockedSides=[]) => {
    if (isH(sym)) return;
    const blocked = new Set(blockedSides);

    const offsets = [
      {id:"top",    dx: 16, dy:-28},
      {id:"bottom", dx: 16, dy: 66},
      {id:"left",   dx:-28, dy: 18},
      {id:"right",  dx: 60, dy: 18},
    ];

    offsets.forEach(o=>{
      if (blocked.has(o.id)) return;
      addLP(atomIdx, x+o.dx, y+o.dy, o.id);
    });
  };

  const bondZoneBetween = (aIdx,bIdx) => {
    const A = atoms.find(x=>x.idx===aIdx);
    const B = atoms.find(x=>x.idx===bIdx);
    const ax = A.x+27, ay=A.y+27;
    const bx = B.x+27, by=B.y+27;

    bonds.push({
      a:aIdx, b:bIdx,
      x: Math.round((ax+bx)/2 - 49),
      y: Math.round((ay+by)/2 - 22)
    });
    connections.push({a:aIdx,b:bIdx});
  };

  if (mol.type === "diatomic"){
    const yAtom = Math.round(stageH * 0.48);
    const xLeft = Math.round(stageW * 0.30);
    const xRight = Math.round(stageW * 0.70);

    atoms.push({idx:0, sym:mol.atoms[0], x:xLeft-27, y:yAtom-27});
    atoms.push({idx:1, sym:mol.atoms[1], x:xRight-27, y:yAtom-27});

    bondZoneBetween(0,1);

    const blockedMap = computeBlockedSides(atoms, connections);
    atoms.forEach(a => addLPBoxesAround(a.idx, a.x, a.y, a.sym, [...(blockedMap[a.idx]||[])]));
    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "linear3"){
    const y = Math.round(stageH * 0.48);
    const xC = Math.round(stageW * 0.50);
    const xL = Math.round(stageW * 0.30);
    const xR = Math.round(stageW * 0.70);

    atoms.push({idx:0, sym:mol.atoms[0], x:xL-27, y:y-27});
    atoms.push({idx:1, sym:mol.atoms[1], x:xC-27, y:y-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xR-27, y:y-27});

    bondZoneBetween(1,0);
    bondZoneBetween(1,2);

    const blockedMap = computeBlockedSides(atoms, connections);
    atoms.forEach(a => addLPBoxesAround(a.idx, a.x, a.y, a.sym, [...(blockedMap[a.idx]||[])]));
    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "bent"){
    const xC = Math.round(stageW * 0.50);
    const yC = Math.round(stageH * 0.42);
    const xL = Math.round(stageW * 0.35);
    const xR = Math.round(stageW * 0.65);
    const yT = Math.round(stageH * 0.58);

    atoms.push({idx:0, sym:mol.atoms[0], x:xC-27, y:yC-27});
    atoms.push({idx:1, sym:mol.atoms[1], x:xL-27, y:yT-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xR-27, y:yT-27});

    bondZoneBetween(0,1);
    bondZoneBetween(0,2);

    const blockedMap = computeBlockedSides(atoms, connections);
    atoms.forEach(a => addLPBoxesAround(a.idx, a.x, a.y, a.sym, [...(blockedMap[a.idx]||[])]));
    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "trigonal"){
    const xC = Math.round(stageW * 0.55);
    const yC = Math.round(stageH * 0.45);

    atoms.push({idx:0, sym:mol.atoms[0], x:xC-27, y:yC-27});

    const xTop = xC;
    const yTop = Math.round(stageH * 0.25);
    const xLeft = Math.round(stageW * 0.40);
    const yLeft = Math.round(stageH * 0.52);
    const xRight = Math.round(stageW * 0.70);
    const yRight = Math.round(stageH * 0.52);

    atoms.push({idx:1, sym:mol.atoms[1], x:xTop-27, y:yTop-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xLeft-27, y:yLeft-27});
    atoms.push({idx:3, sym:mol.atoms[3], x:xRight-27, y:yRight-27});

    bondZoneBetween(0,1);
    bondZoneBetween(0,2);
    bondZoneBetween(0,3);

    const blockedMap = computeBlockedSides(atoms, connections);
    atoms.forEach(a => addLPBoxesAround(a.idx, a.x, a.y, a.sym, [...(blockedMap[a.idx]||[])]));
    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "tetra"){
    const xC = Math.round(stageW * 0.55);
    const yC = Math.round(stageH * 0.45);

    atoms.push({idx:0, sym:mol.atoms[0], x:xC-27, y:yC-27});

    const xUp = xC;
    const yUp = Math.round(stageH * 0.22);
    const xLeft = Math.round(stageW * 0.35);
    const xRight = Math.round(stageW * 0.75);
    const yLeft = yC;
    const yRight = yC;
    const xDown = xC;
    const yDown = Math.round(stageH * 0.70);

    atoms.push({idx:1, sym:mol.atoms[1], x:xUp-27, y:yUp-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xLeft-27, y:yLeft-27});
    atoms.push({idx:3, sym:mol.atoms[3], x:xRight-27, y:yRight-27});
    atoms.push({idx:4, sym:mol.atoms[4], x:xDown-27, y:yDown-27});

    bondZoneBetween(0,1);
    bondZoneBetween(0,2);
    bondZoneBetween(0,3);
    bondZoneBetween(0,4);

    const blockedMap = computeBlockedSides(atoms, connections);
    atoms.forEach(a => addLPBoxesAround(a.idx, a.x, a.y, a.sym, [...(blockedMap[a.idx]||[])]));
    return { atoms, bonds, lpSlots };
  }

  return { atoms:[], bonds:[], lpSlots:[] };
}

function renderBondZone(zoneEl, a, b){
  const key = bondKey(a,b);
  const order = session.build.placed.bonds.get(key);

  zoneEl.innerHTML = "";
  if (!order){
    zoneEl.classList.remove("filled");
    zoneEl.textContent = "DROP BOND";
    return;
  }

  zoneEl.classList.add("filled");
  const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("class","bondSvg");
  svg.setAttribute("viewBox","0 0 100 44");

  const A2 = session.build.layout.atoms.find(x=>x.idx===a);
  const B2 = session.build.layout.atoms.find(x=>x.idx===b);

  const ax = A2.x+27, ay=A2.y+27;
  const bx = B2.x+27, by=B2.y+27;
  const angle = Math.atan2(by-ay, bx-ax) * 180 / Math.PI;

  const g = document.createElementNS("http://www.w3.org/2000/svg","g");
  g.setAttribute("transform", `translate(50 22) rotate(${angle}) translate(-50 -22)`);

  const makeLine = (dy) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1","15");
    line.setAttribute("x2","85");
    line.setAttribute("y1", String(22+dy));
    line.setAttribute("y2", String(22+dy));
    line.setAttribute("stroke","#111827");
    line.setAttribute("stroke-width","4");
    line.setAttribute("stroke-linecap","round");
    return line;
  };

  if (order === 1){
    g.appendChild(makeLine(0));
  } else if (order === 2){
    g.appendChild(makeLine(-6));
    g.appendChild(makeLine(6));
  } else if (order === 3){
    g.appendChild(makeLine(-8));
    g.appendChild(makeLine(0));
    g.appendChild(makeLine(8));
  }

  svg.appendChild(g);
  zoneEl.appendChild(svg);

  zoneEl.onclick = () => {
    const current = session.build.placed.bonds.get(key);
    if (!current) return;
    session.build.placed.bonds.delete(key);
    refund(current === 1 ? COST.bond1 : current === 2 ? COST.bond2 : COST.bond3);
    zoneEl.onclick = null;
    renderBondZone(zoneEl, a, b);
  };
}

function renderLPZone(zoneEl, atomIdx, slotId){
  const key = `${atomIdx}|${slotId}`;
  const filled = session.build.placed.lonePairs.get(key);

  zoneEl.innerHTML = "";
  if (!filled){
    zoneEl.classList.remove("filled");
    zoneEl.textContent = "drop";
    return;
  }

  zoneEl.classList.add("filled");
  const span = document.createElement("span");
  span.className = "lpMark";
  span.textContent = "••";
  zoneEl.appendChild(span);

  zoneEl.onclick = () => {
    if (!session.build.placed.lonePairs.get(key)) return;
    session.build.placed.lonePairs.delete(key);
    refund(COST.lp);
    zoneEl.onclick = null;
    renderLPZone(zoneEl, atomIdx, slotId);
  };
}

function wireDropZone(zoneEl){
  zoneEl.addEventListener("dragover", (e)=>{ e.preventDefault(); });
  zoneEl.addEventListener("drop", (e)=>{
    e.preventDefault();
    const tool = e.dataTransfer.getData("text/plain");
    if (!tool) return;

    const kind = zoneEl.dataset.kind;

    if (kind === "bond"){
      if (!(tool==="bond1" || tool==="bond2" || tool==="bond3")) return;

      const a = Number(zoneEl.dataset.a);
      const b = Number(zoneEl.dataset.b);
      const key = bondKey(a,b);
      if (session.build.placed.bonds.get(key)) return;

      const cost = COST[tool];
      if (!canSpend(cost)){
        flashFeedback("You don’t have enough electrons left for that placement. Remove something first.", "bad");
        session.errorCounts.overspent++;
        return;
      }

      spend(cost);
      const order = tool==="bond1"?1:tool==="bond2"?2:3;
      session.build.placed.bonds.set(key, order);
      renderBondZone(zoneEl, a, b);
      return;
    }

    if (kind === "lp"){
      if (tool !== "lp") return;

      const atomIdx = Number(zoneEl.dataset.atom);
      const slotId = zoneEl.dataset.slot;
      const key = `${atomIdx}|${slotId}`;
      if (session.build.placed.lonePairs.get(key)) return;

      const cost = COST.lp;
      if (!canSpend(cost)){
        flashFeedback("You don’t have enough electrons left for that lone pair. Remove something first.", "bad");
        session.errorCounts.overspent++;
        return;
      }

      spend(cost);
      session.build.placed.lonePairs.set(key, true);
      renderLPZone(zoneEl, atomIdx, slotId);
      return;
    }
  });
}

function renderModel(){
  clearStage();
  const { atoms, bonds, lpSlots } = session.build.layout;

  atoms.forEach(a=>{
    const d = document.createElement("div");
    d.className = "atom";
    d.style.left = `${a.x}px`;
    d.style.top = `${a.y}px`;
    d.textContent = a.sym;
    d.dataset.atom = String(a.idx);
    el.stage.appendChild(d);
  });

  bonds.forEach(b=>{
    const d = document.createElement("div");
    d.className = "drop-bond";
    d.style.left = `${b.x}px`;
    d.style.top = `${b.y}px`;
    d.dataset.kind = "bond";
    d.dataset.a = String(b.a);
    d.dataset.b = String(b.b);
    renderBondZone(d, b.a, b.b);
    wireDropZone(d);
    el.stage.appendChild(d);
  });

  lpSlots.forEach(s=>{
    const d = document.createElement("div");
    d.className = "drop-lp";
    d.style.left = `${s.x}px`;
    d.style.top = `${s.y}px`;
    d.dataset.kind = "lp";
    d.dataset.atom = String(s.atomIdx);
    d.dataset.slot = String(s.slotId);
    renderLPZone(d, s.atomIdx, s.slotId);
    wireDropZone(d);
    el.stage.appendChild(d);
  });
}

// ---- Validation (same structure as Guided Build) ----
function countPlacedLonePairsByAtom(){
  const counts = {};
  for (const k of session.build.placed.lonePairs.keys()){
    const atomIdx = Number(k.split("|")[0]);
    counts[atomIdx] = (counts[atomIdx] || 0) + 1;
  }
  return counts;
}

function classifyErrors(mol){
  const target = mol.target;
  const placedLP = countPlacedLonePairsByAtom();

  let bondMistakes = 0;
  for (const tb of target.bonds){
    const key = bondKey(tb.a, tb.b);
    const got = session.build.placed.bonds.get(key) || 0;
    if (got !== tb.order) bondMistakes++;
  }
  for (const [key] of session.build.placed.bonds.entries()){
    const exists = target.bonds.some(tb => bondKey(tb.a,tb.b) === key);
    if (!exists) bondMistakes++;
  }

  let lpMistakes = 0;
  for (const idxStr of Object.keys(target.lonePairs)){
    const idx = Number(idxStr);
    const need = target.lonePairs[idx];
    const got = placedLP[idx] || 0;
    if (need !== got) lpMistakes++;
  }

  const bankOk = (session.build.bankRemain === 0);

  return { bondMistakes, lpMistakes, bankOk };
}

function checkModel(){
  if (!session) return;

  const mol = session.set[session.idx];

  // Stop timer "on submission"
  let elapsed = 0;
  if (session.options.timer && timerStart){
    elapsed = Date.now() - timerStart;
    stopTimer();
  }

  session.attemptsByMol[session.idx] += 1;
  session.totalAttempts += 1;
  el.btnNext.disabled = false;

  const { bondMistakes, lpMistakes, bankOk } = classifyErrors(mol);

  // log errors for summary (even if hints are OFF)
  if (!bankOk) session.errorCounts.electron++;
  if (bondMistakes > 0) session.errorCounts.bonding++;
  if (lpMistakes > 0) session.errorCounts.lonepairs++;

  const correct = (bondMistakes===0 && lpMistakes===0 && bankOk);

  if (correct){
    session.solvedByMol[session.idx] = true;
    // time per molecule: record elapsed on the successful submission
    if (session.options.timer) session.timeByMolMs[session.idx] = elapsed;

    flashFeedback("Correct ✅", "ok");
    el.btnNext.textContent = (session.idx === session.set.length - 1) ? "Finish set" : "Next";
    return;
  }

  // Incorrect
  if (!session.options.timer){
    // nothing
  } else {
    // If incorrect and timer ON, restart timer for the next attempt (keeps “starts when molecule loads” behavior)
    resetTimerUI();
    startTimer();
  }

  if (!session.options.hints){
    flashFeedback("Incorrect ❌", "bad");
    return;
  }

  // Hints ON: limited category feedback (no exact fixes)
  const hints = [];
  if (!bankOk) hints.push("• Electron count issue (you have electrons left, or you overspent).");
  if (bondMistakes > 0) hints.push("• Bonding pattern issue (check single vs double vs triple).");
  if (lpMistakes > 0) hints.push("• Lone-pair issue (some atoms are missing or have too many lone pairs).");

  flashFeedback("Not yet — try again.\n" + hints.join("\n"), "bad");
}

function clearPlacements(){
  if (!session) return;

  for (const [k, order] of session.build.placed.bonds.entries()){
    refund(order===1?COST.bond1:order===2?COST.bond2:COST.bond3);
  }
  for (const k of session.build.placed.lonePairs.keys()){
    refund(COST.lp);
  }

  session.build.placed.bonds.clear();
  session.build.placed.lonePairs.clear();

  renderModel();
  flashFeedback("Cleared placements. Rebuild the model.", "soft");
}

function nextMolecule(){
  if (!session) return;

  // If timer ON and they never got it correct, store time from the last attempt start as "time spent"
  if (session.options.timer && !session.solvedByMol[session.idx] && timerStart){
    const ms = Date.now() - timerStart;
    session.timeByMolMs[session.idx] = ms;
    stopTimer();
  }

  if (session.idx >= session.set.length - 1){
    finishSet();
    return;
  }

  session.idx += 1;
  loadCurrentMolecule();
}

// ---- Summary ----
function finishSet(){
  enableBuildUI(false);
  setOverlay(true, "Set complete. See your summary below.");
  el.btnNext.disabled = true;

  const total = session.set.length;
  const correctCount = session.solvedByMol.filter(Boolean).length;
  const attempts = session.totalAttempts;

  // most common error type
  const errors = session.errorCounts;
  const errorPairs = [
    ["Electron count issue", errors.electron],
    ["Bonding pattern issue", errors.bonding],
    ["Lone-pair issue", errors.lonepairs],
    ["Overspent electrons", errors.overspent],
  ];
  errorPairs.sort((a,b)=>b[1]-a[1]);
  const topError = errorPairs[0][1] > 0 ? `${errorPairs[0][0]} (${errorPairs[0][1]})` : "—";

  // average time per molecule (optional)
  let avgTimeText = "—";
  if (session.options.timer){
    const times = session.timeByMolMs.filter(ms => Number.isFinite(ms) && ms > 0);
    if (times.length){
      const avg = times.reduce((a,b)=>a+b,0) / times.length;
      avgTimeText = formatTime(avg);
    }
  }

  el.summaryBody.innerHTML = `
    <div style="display:grid; gap:10px;">
      <div><b>Total correct:</b> ${correctCount} / ${total}</div>
      <div><b>Number of attempts:</b> ${attempts}</div>
      <div><b>Most common error type:</b> ${topError}</div>
      <div><b>Average time per molecule:</b> ${avgTimeText}</div>
    </div>
  `;

  el.summaryCard.style.display = "block";
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function resetToIdle(){
  stopTimer();
  session = null;

  el.progressRow.style.display = "none";
  el.setupNote.style.display = "block";
  el.summaryCard.style.display = "none";

  el.molName.innerHTML = "—";
  el.molHint.textContent = "Start a set to begin.";
  clearStage();
  setOverlay(true, "Start a set to reveal the model.");

  el.feedback.style.display = "none";
  enableBuildUI(false);
  el.btnNext.textContent = "Next";
}

// ---- Toolbox drag ----
function initToolbox(){
  document.querySelectorAll(".tool").forEach(toolEl=>{
    toolEl.addEventListener("dragstart",(e)=>{
      e.dataTransfer.setData("text/plain", toolEl.dataset.tool);
    });
  });
}

// ---- Wire UI ----
el.toggleHints.addEventListener("change", updateModeText);
el.toggleReminders.addEventListener("change", updateModeText);
el.toggleTimer.addEventListener("change", updateModeText);

el.btnNewSet.addEventListener("click", resetToIdle);
el.btnStartSet.addEventListener("click", startNewSet);
el.btnRestart.addEventListener("click", ()=>{ resetToIdle(); });

el.btnCheckModel.addEventListener("click", checkModel);
el.btnClear.addEventListener("click", clearPlacements);
el.btnNext.addEventListener("click", nextMolecule);

// ---- Start ----
initToolbox();
updateModeText();
resetToIdle();
