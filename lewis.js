const $ = (id) => document.getElementById(id);

const molTitle = $("molTitle");
const molPrompt = $("molPrompt");
const btnNewMolTop = $("btnNewMolTop");
const btnNewMol = $("btnNewMol");

const valenceInput = $("valenceInput");
const btnCheckValence = $("btnCheckValence");
const valenceMsg = $("valenceMsg");

const centralSelect = $("centralSelect");
const btnLockCentral = $("btnLockCentral");
const btnReset = $("btnReset");
const centralMsg = $("centralMsg");

const bankTotal = $("bankTotal");
const bankRemain = $("bankRemain");
const bankMsg = $("bankMsg");

const stageLocked = $("stageLocked");
const stageWrap = $("stageWrap");
const bondSvg = $("bondSvg");

const btnCheckMol = $("btnCheckMol");
const btnShowCorrect = $("btnShowCorrect");
const btnClear = $("btnClear");
const buildMsg = $("buildMsg");
const feedback = $("feedback");

let state = {
  mol: null,
  computedTotal: null,
  confirmed: false,
  centralLocked: false,
  centralIndex: null, // null = "no central atom"
  totalBank: null,
  remaining: null,
  placements: { bonds: {}, lps: {} },
  dragTool: null
};

const VALENCE = { H:1, C:4, N:5, O:6, F:7, P:5, Br:7 };

function defMol(label, atoms, correct){
  return { label, atoms, correct };
}

const MOLECULES = [
  defMol("Br2", ["Br","Br"], { noCentral:true, bonds:[["A0","A1",1]], lp:{A0:3,A1:3} }),
  defMol("F2",  ["F","F"],   { noCentral:true, bonds:[["A0","A1",1]], lp:{A0:3,A1:3} }),
  defMol("H2",  ["H","H"],   { noCentral:true, bonds:[["A0","A1",1]], lp:{A0:0,A1:0} }),
  defMol("N2",  ["N","N"],   { noCentral:true, bonds:[["A0","A1",3]], lp:{A0:1,A1:1} }),
  defMol("O2",  ["O","O"],   { noCentral:true, bonds:[["A0","A1",2]], lp:{A0:2,A1:2} }),
  defMol("HF",  ["H","F"],   { noCentral:true, bonds:[["A0","A1",1]], lp:{A0:0,A1:3} }),

  defMol("H2O", ["O","H","H"], { bonds:[["A0","A1",1],["A0","A2",1]], lp:{A0:2,A1:0,A2:0} }),
  defMol("NH3", ["N","H","H","H"], { bonds:[["A0","A1",1],["A0","A2",1],["A0","A3",1]], lp:{A0:1,A1:0,A2:0,A3:0} }),
  defMol("PF3", ["P","F","F","F"], { bonds:[["A0","A1",1],["A0","A2",1],["A0","A3",1]], lp:{A0:1,A1:3,A2:3,A3:3} }),
  defMol("CF4", ["C","F","F","F","F"], { bonds:[["A0","A1",1],["A0","A2",1],["A0","A3",1],["A0","A4",1]], lp:{A0:0,A1:3,A2:3,A3:3,A4:3} }),
  defMol("CBr4", ["C","Br","Br","Br","Br"], { bonds:[["A0","A1",1],["A0","A2",1],["A0","A3",1],["A0","A4",1]], lp:{A0:0,A1:3,A2:3,A3:3,A4:3} }),

  defMol("CO2", ["C","O","O"], { bonds:[["A0","A1",2],["A0","A2",2]], lp:{A0:0,A1:2,A2:2} }),
  defMol("HCN", ["C","H","N"], { bonds:[["A0","A1",1],["A0","A2",3]], lp:{A0:0,A1:0,A2:1} }),
];

function parseFormula(formula){
  const parts = [];
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m;
  while((m = re.exec(formula)) !== null){
    const el = m[1];
    const n = m[2] ? parseInt(m[2],10) : 1;
    parts.push([el,n]);
  }
  return parts;
}
function computeTotalValence(formula){
  const parts = parseFormula(formula);
  let total = 0;
  for(const [el,n] of parts){
    if(!(el in VALENCE)) return null;
    total += VALENCE[el]*n;
  }
  return total;
}
function formatSubscripts(s){
  return s.replace(/(\d+)/g, "<sub>$1</sub>");
}
function clearChildren(node){
  while(node.firstChild) node.removeChild(node.firstChild);
}

function setFeedback(kind, title, bullets){
  feedback.style.display = "block";
  feedback.className = "feedback " + (kind === "good" ? "good" : "bad");
  const ul = bullets?.length
    ? `<ul>${bullets.map(b=>`<li>${b}</li>`).join("")}</ul>`
    : "";
  feedback.innerHTML = `<h3>${title}</h3>${ul}`;
}

/* -------- Geometry -------- */
function getGeometry(mol){
  const atomsPos = {};
  const n = mol.atoms.length;

  if(["CO2","HCN"].includes(mol.label)){
    atomsPos.A0 = {x:500, y:260};
    atomsPos.A1 = {x:350, y:260};
    atomsPos.A2 = {x:650, y:260};
  } else if(["O2","N2","F2","Br2","H2","HF"].includes(mol.label)){
    atomsPos.A0 = {x:430, y:260};
    atomsPos.A1 = {x:570, y:260};
  } else if(mol.label === "H2O"){
    atomsPos.A0 = {x:500, y:240};
    atomsPos.A1 = {x:380, y:340};
    atomsPos.A2 = {x:620, y:340};
  } else if(["NH3","PF3"].includes(mol.label)){
    atomsPos.A0 = {x:500, y:220};
    atomsPos.A1 = {x:360, y:330};
    atomsPos.A2 = {x:640, y:330};
    atomsPos.A3 = {x:500, y:385};
  } else if(["CF4","CBr4"].includes(mol.label)){
    atomsPos.A0 = {x:500, y:260};
    atomsPos.A1 = {x:500, y:110};
    atomsPos.A2 = {x:675, y:260};
    atomsPos.A3 = {x:500, y:410};
    atomsPos.A4 = {x:325, y:260};
  } else {
    atomsPos.A0 = {x:500, y:260};
    for(let i=1;i<n;i++){
      atomsPos["A"+i] = {x:280 + i*140, y:260};
    }
  }

  // ONE bond zone per correct connection (pill between the two atoms)
  const zones = [];
  const seen = new Set();

  for(const [a,b] of mol.correct.bonds){
    const key = [a,b].sort().join("-");
    if(seen.has(key)) continue;
    seen.add(key);

    const p1 = atomsPos[a], p2 = atomsPos[b];
    const cx = (p1.x+p2.x)/2;
    const cy = (p1.y+p2.y)/2;
    const dx = (p2.x-p1.x);
    const dy = (p2.y-p1.y);
    const dist = Math.hypot(dx,dy);

    // Width of pill drop zone: distance between atom edges (approx)
    const w = Math.max(90, dist - 80);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;

    zones.push({
      id:`BZ_${key}`,
      a,b,
      cx,cy,
      w,
      ang
    });
  }

  return { atomsPos, zones };
}

// Corner lone-pair dots (small + clean)
function lpOffsets(){
  return [
    {dx:-46, dy:-46}, // NW
    {dx: 46, dy:-46}, // NE
    {dx: 46, dy: 46}, // SE
    {dx:-46, dy: 46}, // SW
  ];
}

/* -------- Rendering -------- */
function renderMoleculeHeader(){
  molTitle.innerHTML = formatSubscripts(state.mol.label);
  molPrompt.innerHTML = state.mol.correct.noCentral
    ? `Confirm electrons, then choose <b>No central atom</b> and lock it.`
    : `Confirm electrons, choose a central atom, then build.`;
}

/* ✅ CENTRAL ATOM OPTIONS: ALL NON-H atoms (+ “No central atom” if diatomic) */
function renderCentralChoices(){
  clearChildren(centralSelect);

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select…";
  centralSelect.appendChild(opt0);

  // Diatomic explicit option
  if(state.mol.correct.noCentral){
    const optNone = document.createElement("option");
    optNone.value = "none";
    optNone.textContent = "No central atom (diatomic)";
    centralSelect.appendChild(optNone);
  }

  // All non-H atoms as candidates (students decide which is best)
  state.mol.atoms.forEach((sym, i) => {
    if(sym === "H") return;
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${sym} (atom ${i+1})`;
    centralSelect.appendChild(opt);
  });

  centralSelect.disabled = !state.confirmed;
  btnLockCentral.disabled = !state.confirmed;
}

function renderBank(){
  if(!state.confirmed){
    bankTotal.textContent = "—";
    bankRemain.textContent = "—";
    bankMsg.className = "msg msg-warn";
    bankMsg.textContent = "Electron bank will appear after you correctly confirm the total valence electrons.";
    return;
  }
  bankTotal.textContent = String(state.totalBank);
  bankRemain.textContent = String(state.remaining);
  bankMsg.className = "msg msg-good";
  bankMsg.textContent = "Nice. Now choose/lock the central atom to reveal the model.";
}

function enableBuildUI(enabled){
  btnCheckMol.disabled = !enabled;
  btnShowCorrect.disabled = !enabled;
  btnClear.disabled = !enabled;
}

function wireDropTarget(el){
  el.addEventListener("dragover", (e)=>{ e.preventDefault(); el.style.outline = "3px solid rgba(255,198,39,.55)"; });
  el.addEventListener("dragleave", ()=>{ el.style.outline = "none"; });
  el.addEventListener("drop", (e)=>{
    e.preventDefault();
    el.style.outline = "none";
    const tool = state.dragTool;
    if(!tool) return;

    const type = el.dataset.dropType;
    if(type === "bond") placeBond(el.dataset.bondId, tool);
    if(type === "lp") placeLP(el.dataset.lpId, tool);
  });
}

function renderStage(){
  const canShow = state.confirmed && state.centralLocked;

  stageWrap.style.display = canShow ? "block" : "none";
  stageLocked.style.display = canShow ? "none" : "block";
  enableBuildUI(canShow);

  if(!canShow){
    clearChildren(stageWrap);
    bondSvg.innerHTML = "";
    return;
  }

  clearChildren(stageWrap);
  stageWrap.appendChild(bondSvg);
  bondSvg.innerHTML = "";

  const { atomsPos, zones } = getGeometry(state.mol);

  // atoms + lone-pair dots
  for(let i=0;i<state.mol.atoms.length;i++){
    const id = "A"+i;
    const p = atomsPos[id];

    const atom = document.createElement("div");
    atom.className = "atom";
    atom.dataset.atomId = id;
    atom.style.left = (p.x - 30) + "px";
    atom.style.top  = (p.y - 30) + "px";
    atom.innerHTML = `<div class="sym">${state.mol.atoms[i]}</div>`;
    stageWrap.appendChild(atom);

    lpOffsets().forEach((off, k) => {
      const lpId = `LP_${id}_${k}`;
      const slot = document.createElement("div");
      slot.className = "drop-lp" + (state.placements.lps[lpId] ? " filled" : "");
      slot.dataset.dropType = "lp";
      slot.dataset.lpId = lpId;
      slot.dataset.atomId = id;
      slot.style.left = (p.x + off.dx - 9) + "px";
      slot.style.top  = (p.y + off.dy - 9) + "px";
      wireDropTarget(slot);
      slot.addEventListener("click", () => removeLP(lpId));
      stageWrap.appendChild(slot);
    });
  }

  // bond zones (one per pair, visually between atoms)
  zones.forEach(z => {
    const zone = document.createElement("div");
    zone.className = "bond-zone" + (state.placements.bonds[z.id] ? " filled" : "");
    zone.dataset.dropType = "bond";
    zone.dataset.bondId = z.id;
    zone.style.setProperty("--cx", z.cx + "px");
    zone.style.setProperty("--cy", z.cy + "px");
    zone.style.setProperty("--w", z.w + "px");
    zone.style.setProperty("--ang", z.ang + "deg");

    const order = state.placements.bonds[z.id] || 0;
    zone.innerHTML = (order === 0)
      ? `<div class="ph">Drop bond</div>`
      : `<div class="bondGlyph">${order===1?"—":order===2?"=":"≡"}</div>`;

    wireDropTarget(zone);
    zone.addEventListener("click", () => removeBond(z.id));
    stageWrap.appendChild(zone);
  });

  drawBondsSVG(atomsPos, zones);
}

function drawBondsSVG(atomsPos, zones){
  const lines = [];
  for(const z of zones){
    const order = state.placements.bonds[z.id] || 0;
    if(order === 0) continue;
    lines.push({ p1: atomsPos[z.a], p2: atomsPos[z.b], order });
  }

  const svgParts = [];
  for(const ln of lines){
    const {p1,p2,order} = ln;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx,dy) || 1;
    const ux = dx/len, uy = dy/len;
    const px = -uy, py = ux;

    const color = "rgba(140,29,64,.65)";
    const strokeW = 6;

    const offsets = (order === 1) ? [0]
      : (order === 2) ? [-10,10]
      : [-14,0,14];

    for(const off of offsets){
      const x1 = p1.x + px*off, y1 = p1.y + py*off;
      const x2 = p2.x + px*off, y2 = p2.y + py*off;
      svgParts.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
               stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" />`
      );
    }
  }
  bondSvg.innerHTML = svgParts.join("");
}

/* -------- Placement logic -------- */
function computeSpent(){
  let spent = 0;
  for(const k in state.placements.bonds) spent += (state.placements.bonds[k]||0)*2;
  for(const k in state.placements.lps) if(state.placements.lps[k]) spent += 2;
  return spent;
}

function placeBond(bondId, tool){
  if(!(tool === "bond1" || tool === "bond2" || tool === "bond3")) return;
  const order = tool === "bond1" ? 1 : tool === "bond2" ? 2 : 3;

  const prev = state.placements.bonds[bondId] || 0;
  const prevCost = prev*2;
  const newCost = order*2;

  const available = state.remaining + prevCost;
  if(available - newCost < 0){
    buildMsg.className = "msg msg-warn";
    buildMsg.textContent = "Not enough electrons remaining for that bond. Remove something first.";
    return;
  }

  state.remaining = available - newCost;
  state.placements.bonds[bondId] = order;
  renderBank();
  renderStage();
}

function placeLP(lpId, tool){
  if(tool !== "lp") return;
  if(state.placements.lps[lpId]) return;

  if(state.remaining - 2 < 0){
    buildMsg.className = "msg msg-warn";
    buildMsg.textContent = "Not enough electrons remaining for a lone pair. Remove something first.";
    return;
  }
  state.remaining -= 2;
  state.placements.lps[lpId] = true;
  renderBank();
  renderStage();
}

function removeBond(bondId){
  const prev = state.placements.bonds[bondId] || 0;
  if(prev === 0) return;
  state.remaining += prev*2;
  state.placements.bonds[bondId] = 0;
  renderBank();
  renderStage();
}

function removeLP(lpId){
  if(!state.placements.lps[lpId]) return;
  state.remaining += 2;
  state.placements.lps[lpId] = false;
  renderBank();
  renderStage();
}

function clearPlacements(){
  const spent = computeSpent();
  state.remaining += spent;
  state.placements.bonds = {};
  state.placements.lps = {};
  renderBank();
  renderStage();
  feedback.style.display = "none";
}

/* -------- Student-friendly check -------- */
function getUserSummary(){
  const mol = state.mol;

  const correctBondOrders = {};
  for(const [a,b,ord] of mol.correct.bonds){
    const id = `BZ_${[a,b].sort().join("-")}`;
    correctBondOrders[id] = ord;
  }

  const bondOrders = {};
  for(const id in correctBondOrders){
    bondOrders[id] = state.placements.bonds[id] || 0;
  }

  const lpCount = {};
  mol.atoms.forEach((_,i)=> lpCount["A"+i]=0);
  for(const lpId in state.placements.lps){
    if(!state.placements.lps[lpId]) continue;
    const atomId = lpId.split("_")[1];
    lpCount[atomId] += 1;
  }

  return { bondOrders, correctBondOrders, lpCount };
}

function checkMolecule(){
  const mol = state.mol;
  const { bondOrders, correctBondOrders, lpCount } = getUserSummary();

  let missingBond = 0;
  let wrongBondType = 0;

  for(const id in correctBondOrders){
    const want = correctBondOrders[id];
    const got = bondOrders[id] || 0;
    if(got === 0) missingBond++;
    else if(got !== want) wrongBondType++;
  }

  if(missingBond > 0){
    setFeedback("bad","Not yet — start with bonds.",[
      "Put a bond in each bond space between atoms.",
      "Then adjust single → double/triple if needed.",
      "Finish with lone pairs."
    ]);
    return;
  }

  if(wrongBondType > 0){
    setFeedback("bad","Close — check bond types.",[
      "At least one bond should be a different type (single/double/triple).",
      "Use the electron bank and octet rule to decide bond order."
    ]);
    return;
  }

  // Lone pairs
  let lpMismatch = 0;
  for(const atomId in mol.correct.lp){
    const want = mol.correct.lp[atomId];
    const got = lpCount[atomId] || 0;
    if(got !== want) lpMismatch++;
  }

  if(lpMismatch > 0){
    setFeedback("bad","Good bonds — now fix lone pairs.",[
      "Adjust lone pairs so each atom has a complete outer shell.",
      "Your electron bank should end at 0 remaining."
    ]);
    return;
  }

  if(state.remaining !== 0){
    setFeedback("bad","Almost — check the electron bank.",[
      "Your structure is close, but electron spending doesn’t match the total.",
      "Remove extras or adjust bond order until remaining = 0."
    ]);
    return;
  }

  setFeedback("good","Correct! 🎉",[
    "Bond types match the molecule.",
    "Lone pairs complete outer shells correctly.",
    "Electron bank is fully used (remaining = 0)."
  ]);
}

function showCorrect(){
  clearPlacements();

  for(const [a,b,ord] of state.mol.correct.bonds){
    const id = `BZ_${[a,b].sort().join("-")}`;
    state.placements.bonds[id] = ord;
  }

  for(const atomId in state.mol.correct.lp){
    const need = state.mol.correct.lp[atomId];
    for(let k=0;k<4;k++){
      if(k >= need) break;
      state.placements.lps[`LP_${atomId}_${k}`] = true;
    }
  }

  state.remaining = state.totalBank - computeSpent();
  renderBank();
  renderStage();
  setFeedback("good","Correct model shown.",["Compare bond types and lone pairs to yours."]);
}

/* -------- Reset / gating -------- */
function resetBuild(){
  state.confirmed = false;
  state.centralLocked = false;
  state.centralIndex = null;
  state.totalBank = null;
  state.remaining = null;
  state.placements = { bonds:{}, lps:{} };

  valenceInput.value = "";
  valenceMsg.className = "msg msg-neutral";
  valenceMsg.innerHTML = "Enter the total, then click <b>Check</b>.";

  centralMsg.className = "msg msg-neutral";
  centralMsg.textContent = "Check the total electrons first.";

  feedback.style.display = "none";
  buildMsg.className = "msg msg-neutral";
  buildMsg.textContent = "Build the skeleton first (bonds), then use lone pairs to complete outer shells.";

  renderCentralChoices();
  renderBank();
  renderStage();
}

function afterValenceCorrect(){
  state.confirmed = true;
  state.totalBank = state.computedTotal;
  state.remaining = state.totalBank;

  valenceMsg.className = "msg msg-good";
  valenceMsg.innerHTML = `Correct. <b>${state.totalBank}</b> total valence electrons.`;

  centralMsg.className = "msg msg-neutral";
  centralMsg.textContent = "Now choose the central atom (or “No central atom”) and lock it.";

  renderCentralChoices();
  renderBank();
  renderStage();
}

function pickRandomMolecule(){
  const mol = MOLECULES[Math.floor(Math.random()*MOLECULES.length)];
  state.mol = mol;
  state.computedTotal = computeTotalValence(mol.label);

  molTitle.innerHTML = formatSubscripts(state.mol.label);
  molPrompt.innerHTML = state.mol.correct.noCentral
    ? `Confirm electrons, then choose <b>No central atom (diatomic)</b> and lock it.`
    : `Confirm electrons, choose a central atom, then build.`;

  resetBuild();
}

/* -------- Drag wiring -------- */
document.querySelectorAll(".tool").forEach(toolEl=>{
  toolEl.addEventListener("dragstart", ()=>{ state.dragTool = toolEl.dataset.tool; });
  toolEl.addEventListener("dragend",   ()=>{ state.dragTool = null; });
});

/* -------- Events -------- */
btnNewMolTop.addEventListener("click", pickRandomMolecule);
btnNewMol.addEventListener("click", pickRandomMolecule);
btnReset.addEventListener("click", resetBuild);

btnCheckValence.addEventListener("click", ()=>{
  const raw = (valenceInput.value || "").trim();
  const n = parseInt(raw, 10);

  if(!Number.isFinite(n)){
    valenceMsg.className = "msg msg-warn";
    valenceMsg.textContent = "Enter a number (example: O₂ is 12).";
    return;
  }

  const want = state.computedTotal;
  if(want === null){
    valenceMsg.className = "msg msg-warn";
    valenceMsg.textContent = "This molecule uses an element not in the built-in valence table.";
    return;
  }

  if(n !== want){
    valenceMsg.className = "msg msg-warn";
    valenceMsg.textContent = `Not quite. Try again. (Hint: add valence electrons for each atom in ${state.mol.label}.)`;
    return;
  }

  afterValenceCorrect();
});

btnLockCentral.addEventListener("click", ()=>{
  if(!state.confirmed){
    centralMsg.className = "msg msg-warn";
    centralMsg.textContent = "Check the total electrons first.";
    return;
  }

  const v = centralSelect.value;
  if(!v){
    centralMsg.className = "msg msg-warn";
    centralMsg.textContent = "Select a central atom (or “No central atom”) first.";
    return;
  }

  if(v === "none"){
    state.centralIndex = null;
    state.centralLocked = true;
    centralMsg.className = "msg msg-good";
    centralMsg.innerHTML = `Locked: <b>No central atom</b>. Now build the model.`;
  } else {
    state.centralIndex = parseInt(v,10);
    state.centralLocked = true;
    centralMsg.className = "msg msg-good";
    centralMsg.innerHTML = `Central atom locked: <b>${state.mol.atoms[state.centralIndex]}</b>. Now build the model.`;
  }

  renderStage();
});

btnClear.addEventListener("click", clearPlacements);
btnCheckMol.addEventListener("click", checkMolecule);
btnShowCorrect.addEventListener("click", showCorrect);

/* Boot */
pickRandomMolecule();
