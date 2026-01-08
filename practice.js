// Independent & Challenge Practice (practice.js)
// Uses SAME molecule structure, SAME interface behaviors, SAME validation style,
// but with an expanded practice-only bank to reduce memorization.

const VALENCE = { H:1, F:7, Cl:7, Br:7, C:4, N:5, O:6, P:5 };
const COST = { bond1:2, bond2:4, bond3:6, lp:2 };

/**
 * PRACTICE BANK
 * - Partial overlap with Guided Build (HF, CO2, H2O, NH3, PF3, CF4)
 * - Adds additional molecules that still fit existing layout types
 * - Avoids radicals/odd-electron species to keep grading clean
 */
const PRACTICE_MOLECULES = [
  // ===== Overlap (some, not all) =====
  { name:"HF",  type:"diatomic", atoms:["H","F"],  central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:0,1:3} } },
  { name:"CO2", type:"linear3",  atoms:["O","C","O"], central:1,
    target:{ bonds:[{a:1,b:0,order:2},{a:1,b:2,order:2}], lonePairs:{0:2,1:0,2:2} } },
  { name:"H2O", type:"bent",     atoms:["O","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1}], lonePairs:{0:2,1:0,2:0} } },
  { name:"NH3", type:"trigonal", atoms:["N","H","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:0,2:0,3:0} } },
  { name:"PF3", type:"trigonal", atoms:["P","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:3,2:3,3:3} } },
  { name:"CF4", type:"tetra",    atoms:["C","F","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs:{0:0,1:3,2:3,3:3,4:3} } },

  // ===== New (reduces memorization) =====

  // Diatomic
  { name:"Cl2", type:"diatomic", atoms:["Cl","Cl"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:3,1:3} } },
  { name:"HCl", type:"diatomic", atoms:["H","Cl"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:0,1:3} } },
  { name:"HBr", type:"diatomic", atoms:["H","Br"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:0,1:3} } },

  // Linear 3
  { name:"FCN", type:"linear3", atoms:["F","C","N"], central:1,
    target:{ bonds:[{a:1,b:0,order:1},{a:1,b:2,order:3}], lonePairs:{0:3,1:0,2:1} } },
  { name:"ClCN", type:"linear3", atoms:["Cl","C","N"], central:1,
    target:{ bonds:[{a:1,b:0,order:1},{a:1,b:2,order:3}], lonePairs:{0:3,1:0,2:1} } },

  // Bent 3
  { name:"OF2", type:"bent", atoms:["O","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1}], lonePairs:{0:2,1:3,2:3} } },
  { name:"Cl2O", type:"bent", atoms:["O","Cl","Cl"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1}], lonePairs:{0:2,1:3,2:3} } },

  // Trigonal
  { name:"NF3", type:"trigonal", atoms:["N","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:3,2:3,3:3} } },
  { name:"PCl3", type:"trigonal", atoms:["P","Cl","Cl","Cl"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:3,2:3,3:3} } },
  { name:"PBr3", type:"trigonal", atoms:["P","Br","Br","Br"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:3,2:3,3:3} } },

  // Tetrahedral
  { name:"CH4", type:"tetra", atoms:["C","H","H","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs:{0:0,1:0,2:0,3:0,4:0} } },
  { name:"CCl4", type:"tetra", atoms:["C","Cl","Cl","Cl","Cl"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs:{0:0,1:3,2:3,3:3,4:3} } },
];

// ===== DOM =====
const el = {
  btnNewSet: document.getElementById("btnNewSet"),
  btnStartSet: document.getElementById("btnStartSet"),
  btnCheckModel: document.getElementById("btnCheckModel"),
  btnClear: document.getElementById("btnClear"),
  btnNext: document.getElementById("btnNext"),
  btnRestart: document.getElementById("btnRestart"),

  toggleHints: document.getElementById("toggleHints"),
  toggleReminders: document.getElementById("toggleReminders"),
  toggleTimer: document.getElementById("toggleTimer"),
  remindersPanel: document.getElementById("remindersPanel"),

  setSize: document.getElementById("setSize"),
  progressRow: document.getElementById("progressRow"),
  progressText: document.getElementById("progressText"),
  modeText: document.getElementById("modeText"),
  timerBox: document.getElementById("timerBox"),
  timerText: document.getElementById("timerText"),

  molName: document.getElementById("molName"),
  molHint: document.getElementById("molHint"),
  stage: document.getElementById("stage"),
  stageOverlay: document.getElementById("stageOverlay"),
  feedback: document.getElementById("feedback"),

  summaryCard: document.getElementById("summaryCard"),
  summaryBody: document.getElementById("summaryBody"),

  bankMini: document.getElementById("bankMini"),
  bankRemainMini: document.getElementById("bankRemainMini"),
};

// ===== State =====
let session = null;
let timerInterval = null;
let startedAt = null;

function formatFormula(str){
  return str.replace(/(\d+)/g, "<sub>$1</sub>");
}
function totalValence(mol){
  return mol.atoms.reduce((sum, sym)=> sum + (VALENCE[sym] ?? 0), 0);
}
function bondKey(a,b){
  const x = Math.min(a,b), y = Math.max(a,b);
  return `${x}-${y}`;
}
function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function setEnabledBuild(on){
  el.btnCheckModel.disabled = !on;
  el.btnClear.disabled = !on;
  el.btnNext.disabled = !on;
}

function lockStage(isLocked, text){
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

function stopTimer(){
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}
function startTimer(){
  stopTimer();
  startedAt = Date.now();
  tickTimer();
  timerInterval = setInterval(tickTimer, 250);
}
function tickTimer(){
  if (!startedAt) return;
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(sec/60);
  const s = sec % 60;
  el.timerText.textContent = `${m}:${String(s).padStart(2,"0")}`;
}
function getElapsedSeconds(){
  if (!startedAt) return 0;
  return Math.floor((Date.now()-startedAt)/1000);
}

function applyToggleUI(){
  // reminders panel show/hide
  el.remindersPanel.style.display = el.toggleReminders.checked ? "block" : "none";

  // timer show/hide (only when set is running)
  const setRunning = !!session && session.inSet;
  el.timerBox.style.display = (setRunning && el.toggleTimer.checked) ? "block" : "none";

  // mini bank only shown during set
  el.bankMini.style.display = setRunning ? "block" : "none";
}

function initToolbox(){
  document.querySelectorAll(".tool").forEach(toolEl=>{
    toolEl.addEventListener("dragstart",(e)=>{
      e.dataTransfer.setData("text/plain", toolEl.dataset.tool);
    });
  });
}

function computeLayout(mol){
  const stageW = el.stage.clientWidth || 700;
  const stageH = 320;

  const atoms = [];
  const bonds = [];
  const lpSlots = [];

  const isH = (sym)=> sym==="H";

  const addLP = (atomIdx, x, y, slotId)=> lpSlots.push({atomIdx,x,y,slotId});

  const addLPBoxesAround = (atomIdx, x, y, sym, blockedSide=null)=>{
    if (isH(sym)) return;
    const offsets = [
      {id:"top",    dx: 16, dy:-24},
      {id:"bottom", dx: 16, dy: 62},
      {id:"left",   dx:-22, dy: 18},
      {id:"right",  dx: 54, dy: 18},
    ];
    offsets.forEach(o=>{
      if (blockedSide && o.id===blockedSide) return;
      addLP(atomIdx, x+o.dx, y+o.dy, o.id);
    });
  };

  if (mol.type === "diatomic"){
    const yAtom = Math.round(stageH * 0.48);
    const xLeft = Math.round(stageW * 0.30);
    const xRight = Math.round(stageW * 0.70);

    atoms.push({idx:0, sym:mol.atoms[0], x:xLeft-27, y:yAtom-27});
    atoms.push({idx:1, sym:mol.atoms[1], x:xRight-27, y:yAtom-27});

    bonds.push({a:0,b:1,x:Math.round((xLeft+xRight)/2-49),y:Math.round(yAtom-22)});

    addLPBoxesAround(0, xLeft-27, yAtom-27, mol.atoms[0], "right");
    addLPBoxesAround(1, xRight-27, yAtom-27, mol.atoms[1], "left");
    return {atoms,bonds,lpSlots};
  }

  if (mol.type === "linear3"){
    const y = Math.round(stageH * 0.48);
    const xC = Math.round(stageW * 0.50);
    const xL = Math.round(stageW * 0.30);
    const xR = Math.round(stageW * 0.70);

    atoms.push({idx:0, sym:mol.atoms[0], x:xL-27, y:y-27});
    atoms.push({idx:1, sym:mol.atoms[1], x:xC-27, y:y-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xR-27, y:y-27});

    bonds.push({a:1,b:0,x:Math.round((xL+xC)/2-49),y:Math.round(y-22)});
    bonds.push({a:1,b:2,x:Math.round((xC+xR)/2-49),y:Math.round(y-22)});

    atoms.forEach(a=> addLPBoxesAround(a.idx,a.x,a.y,a.sym,null));
    return {atoms,bonds,lpSlots};
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

    bonds.push({a:0,b:1,x:Math.round((xC+xL)/2-49),y:Math.round((yC+yT)/2-22)});
    bonds.push({a:0,b:2,x:Math.round((xC+xR)/2-49),y:Math.round((yC+yT)/2-22)});

    atoms.forEach(a=> addLPBoxesAround(a.idx,a.x,a.y,a.sym,null));
    return {atoms,bonds,lpSlots};
  }

  if (mol.type === "trigonal"){
    const xC = Math.round(stageW * 0.55);
    const yC = Math.round(stageH * 0.45);

    atoms.push({idx:0, sym:mol.atoms[0], x:xC-27, y:yC-27});

    const xTop = xC, yTop = Math.round(stageH * 0.25);
    const xLeft = Math.round(stageW * 0.40), yLeft = Math.round(stageH * 0.52);
    const xRight = Math.round(stageW * 0.70), yRight = Math.round(stageH * 0.52);

    atoms.push({idx:1, sym:mol.atoms[1], x:xTop-27, y:yTop-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xLeft-27, y:yLeft-27});
    atoms.push({idx:3, sym:mol.atoms[3], x:xRight-27, y:yRight-27});

    const bondBetween = (aIdx,bIdx)=>{
      const A = atoms.find(x=>x.idx===aIdx);
      const B = atoms.find(x=>x.idx===bIdx);
      const ax = A.x+27, ay=A.y+27;
      const bx = B.x+27, by=B.y+27;
      bonds.push({a:aIdx,b:bIdx,x:Math.round((ax+bx)/2-49),y:Math.round((ay+by)/2-22)});
    };
    bondBetween(0,1); bondBetween(0,2); bondBetween(0,3);

    atoms.forEach(a=> addLPBoxesAround(a.idx,a.x,a.y,a.sym,null));
    return {atoms,bonds,lpSlots};
  }

  if (mol.type === "tetra"){
    const xC = Math.round(stageW * 0.55);
    const yC = Math.round(stageH * 0.45);

    atoms.push({idx:0, sym:mol.atoms[0], x:xC-27, y:yC-27});

    const xUp = xC, yUp = Math.round(stageH * 0.22);
    const xLeft = Math.round(stageW * 0.35), yLeft = yC;
    const xRight = Math.round(stageW * 0.75), yRight = yC;
    const xDown = xC, yDown = Math.round(stageH * 0.70);

    atoms.push({idx:1, sym:mol.atoms[1], x:xUp-27, y:yUp-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xLeft-27, y:yLeft-27});
    atoms.push({idx:3, sym:mol.atoms[3], x:xRight-27, y:yRight-27});
    atoms.push({idx:4, sym:mol.atoms[4], x:xDown-27, y:yDown-27});

    const bondBetween = (aIdx,bIdx)=>{
      const A = atoms.find(x=>x.idx===aIdx);
      const B = atoms.find(x=>x.idx===bIdx);
      const ax = A.x+27, ay=A.y+27;
      const bx = B.x+27, by=B.y+27;
      bonds.push({a:aIdx,b:bIdx,x:Math.round((ax+bx)/2-49),y:Math.round((ay+by)/2-22)});
    };
    bondBetween(0,1); bondBetween(0,2); bondBetween(0,3); bondBetween(0,4);

    atoms.forEach(a=> addLPBoxesAround(a.idx,a.x,a.y,a.sym,null));
    return {atoms,bonds,lpSlots};
  }

  return {atoms:[],bonds:[],lpSlots:[]};
}

function renderBondZone(zoneEl, a, b){
  const key = bondKey(a,b);
  const order = session.placed.bonds.get(key);

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

  const A = session.layout.atoms.find(x=>x.idx===a);
  const B = session.layout.atoms.find(x=>x.idx===b);
  const ax = A.x+27, ay=A.y+27;
  const bx = B.x+27, by=B.y+27;
  const angle = Math.atan2(by-ay, bx-ax) * 180 / Math.PI;

  const g = document.createElementNS("http://www.w3.org/2000/svg","g");
  g.setAttribute("transform", `translate(50 22) rotate(${angle}) translate(-50 -22)`);

  const makeLine = (dy)=>{
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

  if (order===1) g.appendChild(makeLine(0));
  if (order===2){ g.appendChild(makeLine(-6)); g.appendChild(makeLine(6)); }
  if (order===3){ g.appendChild(makeLine(-8)); g.appendChild(makeLine(0)); g.appendChild(makeLine(8)); }

  svg.appendChild(g);
  zoneEl.appendChild(svg);

  zoneEl.onclick = ()=>{
    const current = session.placed.bonds.get(key);
    if (!current) return;
    session.placed.bonds.delete(key);
    refund(current===1?COST.bond1:current===2?COST.bond2:COST.bond3);
    zoneEl.onclick = null;
    renderBondZone(zoneEl, a, b);
  };
}

function renderLPZone(zoneEl, atomIdx, slotId){
  const key = `${atomIdx}|${slotId}`;
  const filled = session.placed.lonePairs.get(key);

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

  zoneEl.onclick = ()=>{
    if (!session.placed.lonePairs.get(key)) return;
    session.placed.lonePairs.delete(key);
    refund(COST.lp);
    zoneEl.onclick = null;
    renderLPZone(zoneEl, atomIdx, slotId);
  };
}

function wireDropZone(zoneEl){
  zoneEl.addEventListener("dragover",(e)=> e.preventDefault());
  zoneEl.addEventListener("drop",(e)=>{
    e.preventDefault();
    const tool = e.dataTransfer.getData("text/plain");
    if (!tool || !session || !session.inSet) return;

    const kind = zoneEl.dataset.kind;

    if (kind==="bond"){
      if (!(tool==="bond1"||tool==="bond2"||tool==="bond3")) return;
      const a = Number(zoneEl.dataset.a);
      const b = Number(zoneEl.dataset.b);
      const key = bondKey(a,b);
      if (session.placed.bonds.get(key)) return;

      const cost = COST[tool];
      if (!canSpend(cost)){
        flashFeedback("Not enough electrons left. Remove something first.", "bad");
        return;
      }
      spend(cost);
      const order = tool==="bond1"?1:tool==="bond2"?2:3;
      session.placed.bonds.set(key, order);
      renderBondZone(zoneEl, a, b);
      return;
    }

    if (kind==="lp"){
      if (tool!=="lp") return;
      const atomIdx = Number(zoneEl.dataset.atom);
      const slotId = zoneEl.dataset.slot;
      const key = `${atomIdx}|${slotId}`;
      if (session.placed.lonePairs.get(key)) return;

      if (!canSpend(COST.lp)){
        flashFeedback("Not enough electrons left. Remove something first.", "bad");
        return;
      }
      spend(COST.lp);
      session.placed.lonePairs.set(key, true);
      renderLPZone(zoneEl, atomIdx, slotId);
    }
  });
}

function canSpend(cost){
  return session.bankRemain !== null && session.bankRemain >= cost;
}
function spend(cost){
  session.bankRemain -= cost;
  if (session.bankRemain < 0) session.bankRemain = 0;
  el.bankRemainMini.textContent = String(session.bankRemain);
}
function refund(cost){
  session.bankRemain += cost;
  if (session.bankRemain > session.bankTotal) session.bankRemain = session.bankTotal;
  el.bankRemainMini.textContent = String(session.bankRemain);
}

function renderModel(){
  clearStage();
  const { atoms, bonds, lpSlots } = session.layout;

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

function countPlacedLonePairsByAtom(){
  const counts = {};
  for (const k of session.placed.lonePairs.keys()){
    const atomIdx = Number(k.split("|")[0]);
    counts[atomIdx] = (counts[atomIdx] || 0) + 1;
  }
  return counts;
}

function checkModel(){
  const mol = session.mol;
  const target = mol.target;

  session.attemptsTotal++;

  const placedLP = countPlacedLonePairsByAtom();

  let bondMistakes = 0;
  for (const tb of target.bonds){
    const key = bondKey(tb.a, tb.b);
    const got = session.placed.bonds.get(key) || 0;
    if (got !== tb.order) bondMistakes++;
  }
  for (const [key] of session.placed.bonds.entries()){
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

  const bankOk = (session.bankRemain === 0);

  const correct = (bondMistakes===0 && lpMistakes===0 && bankOk);

  // Track common error type
  let errorType = "unknown";
  if (!correct){
    if (!bankOk) errorType = (session.bankRemain > 0) ? "unused electrons" : "overspent electrons";
    else if (bondMistakes>0) errorType = "bonding pattern";
    else if (lpMistakes>0) errorType = "lone pairs";
  }
  if (!correct){
    session.errorCounts[errorType] = (session.errorCounts[errorType] || 0) + 1;
  }

  if (correct){
    session.correctCount++;
    session.moleculeResults.push({
      name: mol.name,
      attempts: session.attemptsThisMol,
      timeSec: el.toggleTimer.checked ? getElapsedSeconds() : null,
      correct: true
    });

    if (el.toggleHints.checked){
      flashFeedback("Correct ✅", "ok");
    } else {
      flashFeedback("Correct ✅", "ok");
    }
    el.btnNext.disabled = false;
    stopTimer();
    return;
  }

  // Incorrect
  if (!el.toggleHints.checked){
    flashFeedback("Incorrect ❌", "bad");
    return;
  }

  // Limited hint buckets only (as requested)
  const buckets = [];
  if (!bankOk) buckets.push("electron count issue");
  else {
    if (bondMistakes>0) buckets.push("bonding pattern issue");
    if (lpMistakes>0) buckets.push("lone pairs issue");
  }

  flashFeedback("Incorrect ❌  • " + buckets.join(" • "), "bad");
}

function clearPlacements(){
  // Refund everything
  for (const [, order] of session.placed.bonds.entries()){
    refund(order===1?COST.bond1:order===2?COST.bond2:COST.bond3);
  }
  for (const k of session.placed.lonePairs.keys()){
    refund(COST.lp);
  }
  session.placed.bonds.clear();
  session.placed.lonePairs.clear();

  session.attemptsThisMol++; // retry attempt counter (counts rebuilds as attempts after a check)
  renderModel();
  flashFeedback("Cleared placements. Rebuild the model.", "soft");
}

function pickSet(n){
  const pool = shuffle(PRACTICE_MOLECULES);
  return pool.slice(0, Math.min(n, pool.length));
}

function loadMolecule(mol, idx, total){
  session.mol = mol;
  session.layout = computeLayout(mol);

  session.bankTotal = totalValence(mol);
  session.bankRemain = session.bankTotal;

  session.placed = {
    bonds: new Map(),
    lonePairs: new Map(),
  };

  session.attemptsThisMol = 1;

  el.molName.innerHTML = formatFormula(mol.name);
  el.molHint.textContent = "Build your best Lewis structure, then check.";
  el.bankRemainMini.textContent = String(session.bankRemain);

  el.progressRow.style.display = "block";
  el.progressText.textContent = `Molecule ${idx+1} of ${total}`;
  el.modeText.textContent =
    `${el.toggleHints.checked ? "Hints: ON" : "Hints: OFF"} • ` +
    `${el.toggleReminders.checked ? "Reminders: ON" : "Reminders: OFF"} • ` +
    `${el.toggleTimer.checked ? "Timer: ON" : "Timer: OFF"}`;

  el.summaryCard.style.display = "none";
  lockStage(false);
  renderModel();
  setEnabledBuild(true);
  el.btnNext.disabled = true;
  el.feedback.style.display = "none";

  if (el.toggleTimer.checked){
    el.timerBox.style.display = "block";
    startTimer();
  } else {
    el.timerBox.style.display = "none";
    stopTimer();
    startedAt = null;
    el.timerText.textContent = "0:00";
  }
}

function nextMolecule(){
  stopTimer();

  session.index++;
  if (session.index >= session.set.length){
    endSet();
    return;
  }
  loadMolecule(session.set[session.index], session.index, session.set.length);
}

function endSet(){
  stopTimer();
  setEnabledBuild(false);
  lockStage(true, "Set complete. View your summary below.");
  el.summaryCard.style.display = "block";

  const total = session.set.length;
  const correct = session.correctCount;

  let common = "—";
  const entries = Object.entries(session.errorCounts);
  if (entries.length){
    entries.sort((a,b)=> b[1]-a[1]);
    common = entries[0][0];
  }

  let avgTime = "—";
  const times = session.moleculeResults.map(r=>r.timeSec).filter(x=>typeof x==="number");
  if (times.length){
    const avg = Math.round(times.reduce((a,b)=>a+b,0) / times.length);
    const m = Math.floor(avg/60), s = avg%60;
    avgTime = `${m}:${String(s).padStart(2,"0")}`;
  }

  el.summaryBody.innerHTML =
    `<b>Results</b><br>` +
    `• Total correct: <b>${correct}</b> of <b>${total}</b><br>` +
    `• Total attempts (checks): <b>${session.attemptsTotal}</b><br>` +
    `• Most common error type: <b>${common}</b><br>` +
    `• Average time per molecule: <b>${avgTime}</b>`;

  flashFeedback("Set complete ✅", "ok");
}

function startSet(){
  const n = Number(el.setSize.value || 5);

  session = {
    inSet: true,
    set: pickSet(n),
    index: 0,
    mol: null,
    layout: null,
    bankTotal: null,
    bankRemain: null,
    placed: { bonds:new Map(), lonePairs:new Map() },
    correctCount: 0,
    attemptsTotal: 0,
    attemptsThisMol: 1,
    moleculeResults: [],
    errorCounts: {},
  };

  el.btnStartSet.disabled = true;
  el.btnNewSet.disabled = false;

  el.bankMini.style.display = "block";
  applyToggleUI();

  loadMolecule(session.set[0], 0, session.set.length);
}

function resetToNotStarted(){
  stopTimer();
  session = null;
  clearStage();
  lockStage(true, "Start a set to reveal the model.");
  el.molName.innerHTML = "—";
  el.molHint.textContent = "Start a set to begin.";
  el.progressRow.style.display = "none";
  el.summaryCard.style.display = "none";
  el.feedback.style.display = "none";
  el.btnStartSet.disabled = false;
  setEnabledBuild(false);
  applyToggleUI();
}

function newSet(){
  resetToNotStarted();
}

// ===== Events =====
el.btnNewSet.addEventListener("click", ()=> newSet());
el.btnStartSet.addEventListener("click", ()=> startSet());
el.btnCheckModel.addEventListener("click", ()=> checkModel());
el.btnClear.addEventListener("click", ()=> clearPlacements());
el.btnNext.addEventListener("click", ()=> nextMolecule());
el.btnRestart.addEventListener("click", ()=> newSet());

el.toggleHints.addEventListener("change", applyToggleUI);
el.toggleReminders.addEventListener("change", applyToggleUI);
el.toggleTimer.addEventListener("change", applyToggleUI);

// ===== Boot =====
initToolbox();
resetToNotStarted();
