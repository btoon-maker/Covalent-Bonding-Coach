/* Covalent Bonding Coach
   Layout upgrade:
   - Atoms are positioned radially (clean geometry)
   - Bond slots are centered between atoms and bonds rotate to match direction
   - Lone pairs remain as PAIRS (••) in boxes
*/

const VALENCE = { H:1, C:4, N:5, O:6, F:7, P:5, Br:7, Cl:7 };

const MOLECULES = [
  // diatomic
  makeMol("H2",  ["H","H"],           { centralMode:"none" }, expectedDiatomic(1, 0, 0)),
  makeMol("F2",  ["F","F"],           { centralMode:"none" }, expectedDiatomic(1, 3, 3)),
  makeMol("O2",  ["O","O"],           { centralMode:"none" }, expectedDiatomic(2, 2, 2)),
  makeMol("N2",  ["N","N"],           { centralMode:"none" }, expectedDiatomic(3, 1, 1)),
  makeMol("Br2", ["Br","Br"],         { centralMode:"none" }, expectedDiatomic(1, 3, 3)),

  // diatomic with different LPs
  makeMol("HF",  ["H","F"],           { centralMode:"none" }, expectedDiatomic(1, 0, 3)),

  // linear triatomic
  makeMol("CO2", ["O","C","O"],       { centralMode:"auto" }, expectedLinearTriatomic("C", 2, { O:2, C:0 })),
  makeMol("HCN", ["H","C","N"],       { centralMode:"auto" }, expectedLinearHCN()),

  // tetra
  makeMol("CF4",  ["C","F","F","F","F"], { centralMode:"auto" }, expectedTetra("C", "F")),
  makeMol("CBr4", ["C","Br","Br","Br","Br"], { centralMode:"auto" }, expectedTetra("C", "Br")),

  // trigonal
  makeMol("NH3", ["N","H","H","H"],   { centralMode:"auto" }, expectedTrigonal("N","H", { centralLP:1, terminalLP:0 })),
  makeMol("PF3", ["P","F","F","F"],   { centralMode:"auto" }, expectedTrigonal("P","F", { centralLP:1, terminalLP:3 })),

  // bent
  makeMol("H2O", ["O","H","H"],       { centralMode:"auto" }, expectedBent("O","H", { centralLP:2, terminalLP:0 })),
];

function makeMol(name, atoms, meta, expected){
  return {
    name,
    atoms,
    meta,
    expected,
    totalValence: atoms.reduce((s,a)=> s + (VALENCE[a] ?? 0), 0)
  };
}

function expectedDiatomic(bondOrder, lpA, lpB){
  return {
    type:"diatomic",
    bonds:[ { a:0, b:1, order:bondOrder } ],
    lonePairs:{ 0:lpA, 1:lpB }
  };
}

function expectedLinearTriatomic(centralSym, bondOrderToEachTerminal, lpMap){
  return {
    type:"linear3",
    centralSym,
    bonds:[ { a:0, b:1, order:bondOrderToEachTerminal }, { a:1, b:2, order:bondOrderToEachTerminal } ],
    lpBySymbol: lpMap
  };
}

function expectedLinearHCN(){
  return {
    type:"linear3",
    centralSym:"C",
    bonds:[ { a:0, b:1, order:1 }, { a:1, b:2, order:3 } ],
    lpByIndex: { 0:0, 1:0, 2:1 }
  };
}

function expectedTetra(centralSym, terminalSym){
  const terminalLP = (terminalSym === "F" || terminalSym === "Cl" || terminalSym === "Br") ? 3 : 0;
  return { type:"tetra", centralSym, bondOrder:1, terminalSym, centralLP:0, terminalLP };
}

function expectedTrigonal(centralSym, terminalSym, { centralLP, terminalLP }){
  return { type:"trigonal", centralSym, bondOrder:1, terminalSym, centralLP, terminalLP };
}

function expectedBent(centralSym, terminalSym, { centralLP, terminalLP }){
  return { type:"bent", centralSym, bondOrder:1, terminalSym, centralLP, terminalLP };
}

// ===== DOM =====
const el = {
  molName: document.getElementById("molName"),
  molPrompt: document.getElementById("molPrompt"),
  btnNew: document.getElementById("btnNew"),

  valenceInput: document.getElementById("valenceInput"),
  btnCheckValence: document.getElementById("btnCheckValence"),
  valenceMsg: document.getElementById("valenceMsg"),

  centralSelect: document.getElementById("centralSelect"),
  btnLockCentral: document.getElementById("btnLockCentral"),
  btnReset: document.getElementById("btnReset"),
  centralMsg: document.getElementById("centralMsg"),

  bankTotal: document.getElementById("bankTotal"),
  bankRemain: document.getElementById("bankRemain"),
  bankMsg: document.getElementById("bankMsg"),

  btnCheck: document.getElementById("btnCheck"),
  btnShow: document.getElementById("btnShow"),
  btnClear: document.getElementById("btnClear"),

  modelArea: document.getElementById("modelArea"),
  buildHint: document.getElementById("buildHint"),
  feedback: document.getElementById("feedback"),
};

let current = null;
let state = null;

function resetAll(newMol){
  current = newMol ?? pickRandom();
  el.molName.innerHTML = formatFormula(current.name);
  el.molPrompt.textContent = "Confirm electrons, choose a central atom, then build.";

  el.valenceInput.value = "";
  setMsg(el.valenceMsg, "hint", `Enter the total valence electrons for ${current.name}, then click Check.`);
  el.centralSelect.disabled = true;
  el.btnLockCentral.disabled = true;
  el.centralSelect.innerHTML = "";
  setMsg(el.centralMsg, "hint", "Check the total electrons first.");

  el.bankTotal.textContent = "—";
  el.bankRemain.textContent = "—";
  setMsg(el.bankMsg, "warn", "Electron bank will appear after you correctly confirm the total valence electrons.");

  el.btnCheck.disabled = true;
  el.btnShow.disabled = true;
  el.btnClear.disabled = true;

  clearModelArea(true);

  state = {
    valenceConfirmed:false,
    centralLocked:false,
    lockedCentralChoice:null, // { type:"none" | "index", index }
    bankTotal:0,
    bankRemain:0,
    bonds: new Map(),       // "a-b" => { order }
    lonePairs: new Map(),   // "atom|slotId" => true
  };

  wireToolboxDrag();
}

function pickRandom(){
  return MOLECULES[Math.floor(Math.random()*MOLECULES.length)];
}

function formatFormula(txt){
  return txt.replace(/(\d+)/g, "<sub>$1</sub>");
}

function setMsg(node, kind, html){
  node.className = "msg msg--" + kind;
  node.innerHTML = html;
}

function clearModelArea(showLockedMsg){
  el.modelArea.innerHTML = "";
  const layer = document.createElement("div");
  layer.className = "modelLayer";
  el.modelArea.appendChild(layer);

  const lock = document.createElement("div");
  lock.id = "modelLockedMsg";
  lock.className = "modelLockedMsg";
  lock.textContent = showLockedMsg ? "Confirm total valence electrons and lock the central atom to begin." : "";
  el.modelArea.appendChild(lock);

  el.buildHint.textContent = showLockedMsg ? "—" : "";
  el.feedback.hidden = true;
  el.feedback.className = "feedback";
  el.feedback.innerHTML = "";
}

// ===== Step 1 =====
el.btnCheckValence.addEventListener("click", () => {
  const raw = (el.valenceInput.value || "").trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0){
    setMsg(el.valenceMsg, "bad", "Please enter a valid positive number.");
    return;
  }

  const correct = current.totalValence;

  if (n === correct){
    state.valenceConfirmed = true;
    state.bankTotal = correct;
    state.bankRemain = correct;

    setMsg(el.valenceMsg, "good", `Correct. <b>${correct}</b> total valence electrons.`);
    el.bankTotal.textContent = String(state.bankTotal);
    el.bankRemain.textContent = String(state.bankRemain);
    setMsg(el.bankMsg, "good", "Nice. Now choose and lock the central atom to reveal the model.");

    populateCentralChoices();
    el.centralSelect.disabled = false;
    el.btnLockCentral.disabled = false;

    setMsg(el.centralMsg, "hint", "Pick a central atom (or choose “No central atom (diatomic)”), then lock it.");
  } else {
    state.valenceConfirmed = false;
    setMsg(el.valenceMsg, "bad",
      `Not quite. Try again. <span class="subtle">(Hint: add valence electrons for each atom in ${current.name}.)</span>`
    );
  }
});

function populateCentralChoices(){
  const opts = [];
  opts.push({ label:"No central atom (diatomic)", value:"none" });
  current.atoms.forEach((sym, i) => {
    opts.push({ label:`${sym} (atom ${i+1})`, value:String(i) });
  });

  el.centralSelect.innerHTML = `<option value="">Select…</option>` + opts.map(o =>
    `<option value="${o.value}">${o.label}</option>`
  ).join("");
}

el.btnLockCentral.addEventListener("click", () => {
  if (!state.valenceConfirmed){
    setMsg(el.centralMsg, "warn", "Check the total electrons first.");
    return;
  }
  const v = el.centralSelect.value;
  if (!v){
    setMsg(el.centralMsg, "warn", "Choose an option from the central atom dropdown first.");
    return;
  }

  state.centralLocked = true;
  if (v === "none"){
    state.lockedCentralChoice = { type:"none" };
    setMsg(el.centralMsg, "good", "Central choice locked: <b>No central atom</b>. Now build the model.");
  } else {
    const idx = Number(v);
    state.lockedCentralChoice = { type:"index", index: idx };
    setMsg(el.centralMsg, "good", `Central atom locked: <b>${current.atoms[idx]}</b>. Now build the model.`);
  }

  el.btnCheck.disabled = false;
  el.btnShow.disabled = false;
  el.btnClear.disabled = false;

  renderModel();
});

el.btnReset.addEventListener("click", () => resetAll(current));
el.btnClear.addEventListener("click", () => {
  if (!state.centralLocked) return;
  state.bonds.clear();
  state.lonePairs.clear();
  state.bankRemain = state.bankTotal;
  el.bankRemain.textContent = String(state.bankRemain);
  el.feedback.hidden = true;
  renderModel();
});

el.btnNew.addEventListener("click", () => resetAll(pickRandom()));

// ===== Layout engine: radial atoms + mid-point bond slots =====
function renderModel(){
  clearModelArea(false);

  const lock = document.getElementById("modelLockedMsg");
  if (lock) lock.style.display = "none";

  const layer = el.modelArea.querySelector(".modelLayer");
  const layout = computeLayout();

  // atoms
  layout.atoms.forEach(a => {
    const node = document.createElement("div");
    node.className = "atom" + (a.role === "center" ? "" : " small");
    node.style.left = `${a.x}px`;
    node.style.top  = `${a.y}px`;
    node.dataset.atom = String(a.i);
    node.innerHTML = `<div class="sym">${a.sym}</div>`;
    layer.appendChild(node);

    // lone pair slots (pair-boxes), none for H
    if (a.sym !== "H"){
      a.lpSlots.forEach(slot => {
        const lp = document.createElement("div");
        lp.className = "lpSlot";
        lp.style.left = `${slot.x}px`;
        lp.style.top  = `${slot.y}px`;
        lp.dataset.drop = "lp";
        lp.dataset.atom = String(a.i);
        lp.dataset.slot = slot.id;

        const key = lpKey(a.i, slot.id);
        if (state.lonePairs.has(key)){
          lp.classList.add("filled");
          lp.innerHTML = `<span class="lpText">••</span>`;
        } else {
          lp.innerHTML = `<span class="lpText"></span>`;
        }

        wireDropZone(lp);
        lp.addEventListener("click", () => {
          if (!state.lonePairs.has(key)) return;
          state.lonePairs.delete(key);
          spendElectrons(-2);
          renderModel();
        });

        layer.appendChild(lp);
      });
    }
  });

  // bond slots between
  layout.bondSlots.forEach(b => {
    const slot = document.createElement("div");
    slot.className = "bondSlot";
    slot.style.left = `${b.x}px`;
    slot.style.top  = `${b.y}px`;
    slot.dataset.drop = "bond";
    slot.dataset.a = String(b.a);
    slot.dataset.b = String(b.b);

    const key = bondKey(b.a, b.b);
    const placed = state.bonds.get(key)?.order ?? 0;

    if (placed > 0){
      slot.classList.add("filled");
      const rot = `${b.rotDeg}deg`;
      if (placed === 3){
        slot.innerHTML = `<div class="bondMark" data-order="3" style="--rot:${rot}"><span></span></div>`;
      } else {
        slot.innerHTML = `<div class="bondMark" data-order="${placed}" style="--rot:${rot}"></div>`;
      }
    } else {
      slot.innerHTML = `<div class="hint">DROP</div>`;
    }

    wireDropZone(slot);

    slot.addEventListener("click", () => {
      const cur = state.bonds.get(key)?.order ?? 0;
      if (cur === 0) return;
      state.bonds.delete(key);
      spendElectrons(-costForBond(cur));
      renderModel();
    });

    layer.appendChild(slot);
  });

  el.buildHint.textContent = "Build bonds between atoms first. Then add lone pairs (••) to complete outer shells.";
}

function computeLayout(){
  const W = el.modelArea.clientWidth;
  const H = el.modelArea.clientHeight;

  // center point for the model (slightly above true center looks nicer)
  const cx = Math.floor(W/2);
  const cy = Math.floor(H/2) - 10;

  const atoms = [];
  const bondSlots = [];

  const choice = state.lockedCentralChoice;

  // diatomic OR "no central"
  if (choice?.type === "none" || current.atoms.length === 2){
    const a0 = { sym: current.atoms[0], i: 0 };
    const a1 = { sym: current.atoms[1], i: 1 };

    const leftX = cx - 170, rightX = cx + 120;
    const y = cy - 28;

    atoms.push(atomNode(a0.i, a0.sym, leftX, y, "terminal"));
    atoms.push(atomNode(a1.i, a1.sym, rightX, y, "terminal"));

    const mid = midpoint(leftX+28, y+28, rightX+26, y+26);
    bondSlots.push(bondSlotBetween(a0.i, a1.i, mid.x, mid.y, 0));

    return { atoms, bondSlots };
  }

  // chosen center (even if "wrong" — still layout clean)
  const centerIndex = (choice?.type === "index") ? choice.index : 0;

  const centerSym = current.atoms[centerIndex];
  const terminals = current.atoms.map((sym, i) => ({ sym, i })).filter(x => x.i !== centerIndex);

  // place center
  const centerX = cx - 28;
  const centerY = cy - 28;
  atoms.push(atomNode(centerIndex, centerSym, centerX, centerY, "center"));

  const n = terminals.length;

  // radius scales with n
  const r = (n <= 2) ? 150 : (n === 3 ? 160 : 170);

  // angles (degrees) for clean shapes
  let anglesDeg = [];
  if (n === 2){
    anglesDeg = [180, 0];
  } else if (n === 3){
    // nice triangle: top, bottom-left, bottom-right
    anglesDeg = [-90, 150, 30];
  } else {
    // 4: top, left, right, bottom
    anglesDeg = [-90, 180, 0, 90];
  }

  terminals.forEach((t, idx) => {
    const ang = degToRad(anglesDeg[idx] ?? (idx*(360/n)));
    const tx = Math.round(cx + r * Math.cos(ang)) - 26;
    const ty = Math.round(cy + r * Math.sin(ang)) - 26;

    atoms.push(atomNode(t.i, t.sym, tx, ty, "terminal"));

    // bond slot between center and terminal
    const cpx = centerX + 28, cpy = centerY + 28;
    const tpx = tx + 26, tpy = ty + 26;
    const m = midpoint(cpx, cpy, tpx, tpy);
    const rotDeg = Math.atan2(tpy - cpy, tpx - cpx) * 180 / Math.PI;

    bondSlots.push(bondSlotBetween(centerIndex, t.i, m.x, m.y, rotDeg));
  });

  return { atoms, bondSlots };
}

function bondSlotBetween(a, b, mx, my, rotDeg){
  // center bond slot on midpoint
  return {
    a, b,
    x: Math.round(mx - 39), // half of 78
    y: Math.round(my - 20), // half of 40
    rotDeg: rotDeg
  };
}

function midpoint(x1,y1,x2,y2){
  return { x:(x1+x2)/2, y:(y1+y2)/2 };
}
function degToRad(d){ return d * Math.PI / 180; }

// Lone pair slot patterns (still boxes, but tucked closer and symmetrical)
function atomNode(i, sym, x, y, role){
  const lpSlots = [];
  if (sym !== "H"){
    const ax = x, ay = y;

    if (role === "center"){
      // 4 possible spots around center (student may fill 0–2 usually)
      lpSlots.push(lpPos("top",    ax+11, ay-32));
      lpSlots.push(lpPos("right",  ax+62, ay+14));
      lpSlots.push(lpPos("bottom", ax+11, ay+60));
      lpSlots.push(lpPos("left",   ax-40, ay+14));
    } else {
      // terminals: 3 boxes (typical for halogens), symmetric
      lpSlots.push(lpPos("top",    ax+9,  ay-32));
      lpSlots.push(lpPos("right",  ax+60, ay+14));
      lpSlots.push(lpPos("bottom", ax+9,  ay+60));
    }
  }
  return { i, sym, x, y, role, lpSlots };
}

function lpPos(id, x, y){ return { id, x, y }; }

// ===== Drag/Drop =====
let toolboxWired = false;
function wireToolboxDrag(){
  if (toolboxWired) return;
  toolboxWired = true;

  document.querySelectorAll(".tool[draggable='true']").forEach(t => {
    t.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", t.dataset.tool);
      e.dataTransfer.effectAllowed = "copy";
    });
  });
}

function wireDropZone(zone){
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dropHover");
    e.dataTransfer.dropEffect = "copy";
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dropHover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dropHover");
    const tool = e.dataTransfer.getData("text/plain");
    if (!tool) return;

    if (zone.dataset.drop === "bond"){
      handleBondDrop(zone, tool);
    } else if (zone.dataset.drop === "lp"){
      handleLonePairDrop(zone, tool);
    }
  });
}

function costForBond(order){
  if (order === 1) return 2;
  if (order === 2) return 4;
  if (order === 3) return 6;
  return 0;
}

function spendElectrons(delta){
  const next = state.bankRemain - delta;
  if (next < 0) return false;
  state.bankRemain = next;
  el.bankRemain.textContent = String(state.bankRemain);
  return true;
}

function handleBondDrop(zone, tool){
  if (!state.centralLocked) return;

  let newOrder = 0;
  if (tool === "bond1") newOrder = 1;
  if (tool === "bond2") newOrder = 2;
  if (tool === "bond3") newOrder = 3;
  if (newOrder === 0) return;

  const a = Number(zone.dataset.a);
  const b = Number(zone.dataset.b);
  const key = bondKey(a,b);

  const curOrder = state.bonds.get(key)?.order ?? 0;
  const curCost = costForBond(curOrder);
  const nextCost = costForBond(newOrder);
  const delta = nextCost - curCost;

  if (delta > 0){
    if (!spendElectrons(delta)){
      showFeedback("warn", "Not enough electrons left",
        [`You don’t have enough electrons remaining to place that bond.`]
      );
      return;
    }
  } else if (delta < 0){
    spendElectrons(delta);
  }

  state.bonds.set(key, { order:newOrder });
  renderModel();
}

function handleLonePairDrop(zone, tool){
  if (!state.centralLocked) return;
  if (tool !== "lp") return;

  const atom = Number(zone.dataset.atom);
  const slot = String(zone.dataset.slot);
  const key = lpKey(atom, slot);

  if (state.lonePairs.has(key)) return;

  if (!spendElectrons(2)){
    showFeedback("warn", "Not enough electrons left",
      [`You don’t have enough electrons remaining to add a lone pair.`]
    );
    return;
  }

  state.lonePairs.set(key, true);
  renderModel();
}

function bondKey(a,b){
  const lo = Math.min(a,b), hi = Math.max(a,b);
  return `${lo}-${hi}`;
}
function lpKey(atom, slot){
  return `${atom}|${slot}`;
}

// ===== Checking / expected logic (unchanged) =====
el.btnCheck.addEventListener("click", () => {
  if (!state.centralLocked) return;
  const result = checkWork(false);
  showCheckResult(result);
});

el.btnShow.addEventListener("click", () => {
  if (!state.centralLocked) return;
  applyExpectedToState();
  renderModel();
  const result = checkWork(true);
  showCheckResult(result);
});

function resolveExpected(){
  const exp = current.expected;

  if (exp.type === "linear3" && exp.lpBySymbol){
    const lonePairs = {};
    current.atoms.forEach((sym, i) => { lonePairs[i] = exp.lpBySymbol[sym] ?? 0; });
    return { bonds: exp.bonds, lonePairs };
  }
  if (exp.type === "linear3" && exp.lpByIndex){
    return { bonds: exp.bonds, lonePairs: exp.lpByIndex };
  }
  if (exp.type === "diatomic"){
    return { bonds: exp.bonds, lonePairs: exp.lonePairs };
  }
  if (exp.type === "tetra"){
    const center = findFirstIndex(exp.centralSym);
    const terminals = allIndicesExcept(center);
    const bonds = terminals.map(t => ({ a:center, b:t, order:exp.bondOrder }));
    const lonePairs = {};
    lonePairs[center] = exp.centralLP;
    terminals.forEach(t => lonePairs[t] = exp.terminalLP);
    return { bonds, lonePairs };
  }
  if (exp.type === "trigonal"){
    const center = findFirstIndex(exp.centralSym);
    const terminals = allIndicesExcept(center).slice(0,3);
    const bonds = terminals.map(t => ({ a:center, b:t, order:exp.bondOrder }));
    const lonePairs = {};
    lonePairs[center] = exp.centralLP;
    terminals.forEach(t => lonePairs[t] = exp.terminalLP);
    return { bonds, lonePairs };
  }
  if (exp.type === "bent"){
    const center = findFirstIndex(exp.centralSym);
    const terminals = allIndicesExcept(center).slice(0,2);
    const bonds = terminals.map(t => ({ a:center, b:t, order:exp.bondOrder }));
    const lonePairs = {};
    lonePairs[center] = exp.centralLP;
    terminals.forEach(t => lonePairs[t] = exp.terminalLP);
    return { bonds, lonePairs };
  }
  return { bonds:[], lonePairs:{} };
}

function applyExpectedToState(){
  state.bonds.clear();
  state.lonePairs.clear();
  state.bankRemain = state.bankTotal;
  el.bankRemain.textContent = String(state.bankRemain);

  const exp = resolveExpected();

  exp.bonds.forEach(b => {
    state.bonds.set(bondKey(b.a,b.b), { order:b.order });
    spendElectrons(costForBond(b.order));
  });

  Object.entries(exp.lonePairs).forEach(([idx, count]) => {
    const atomIndex = Number(idx);
    const sym = current.atoms[atomIndex];
    if (sym === "H") return;

    const layout = computeLayout();
    const atomNode = layout.atoms.find(a => a.i === atomIndex);
    if (!atomNode) return;

    const slots = atomNode.lpSlots.map(s => s.id);
    let placed = 0;
    for (const sid of slots){
      if (placed >= count) break;
      state.lonePairs.set(lpKey(atomIndex, sid), true);
      spendElectrons(2);
      placed++;
    }
  });

  el.bankRemain.textContent = String(state.bankRemain);
}

function expectedCentralChoice(){
  if (["H2","F2","O2","N2","Br2","HF"].includes(current.name)) return "none";
  if (current.name === "CO2") return "C";
  if (current.name === "HCN") return "C";
  if (current.name === "CF4") return "C";
  if (current.name === "CBr4") return "C";
  if (current.name === "NH3") return "N";
  if (current.name === "PF3") return "P";
  if (current.name === "H2O") return "O";
  return "none";
}

function checkWork(){
  const exp = resolveExpected();

  const expectedCentral = expectedCentralChoice();
  const chosen = state.lockedCentralChoice;

  let centralOk = true;
  if (expectedCentral === "none"){
    centralOk = (chosen?.type === "none");
  } else {
    if (chosen?.type !== "index") centralOk = false;
    else centralOk = (current.atoms[chosen.index] === expectedCentral);
  }

  const bondIssues = [];
  const expectedBondMap = new Map();
  exp.bonds.forEach(b => expectedBondMap.set(bondKey(b.a,b.b), b.order));

  expectedBondMap.forEach((order, key) => {
    const got = state.bonds.get(key)?.order ?? 0;
    if (got !== order){
      bondIssues.push("Some bonds are not the correct type (single/double/triple).");
    }
  });

  for (const [key, v] of state.bonds.entries()){
    if (!expectedBondMap.has(key) && v.order > 0){
      bondIssues.push("You have a bond placed where this molecule doesn’t usually connect.");
      break;
    }
  }

  const lpIssues = [];
  const expectedLP = exp.lonePairs;

  const gotLPCounts = {};
  current.atoms.forEach((_, i) => gotLPCounts[i] = 0);
  for (const k of state.lonePairs.keys()){
    const atom = Number(k.split("|")[0]);
    gotLPCounts[atom] = (gotLPCounts[atom] ?? 0) + 1;
  }

  current.atoms.forEach((sym, i) => {
    if (sym === "H" && gotLPCounts[i] > 0){
      lpIssues.push("Hydrogen should not have any lone pairs.");
    }
  });

  let lpMismatch = false;
  Object.keys(expectedLP).forEach(idxStr => {
    const i = Number(idxStr);
    const need = expectedLP[i] ?? 0;
    const got = gotLPCounts[i] ?? 0;
    if (got !== need) lpMismatch = true;
  });
  if (lpMismatch){
    lpIssues.push("Some atoms have the wrong number of lone pairs (••).");
  }

  const electronIssues = [];
  if (state.bankRemain !== 0){
    electronIssues.push("You still have electrons remaining. A finished Lewis model usually uses all valence electrons.");
  }

  const ok = centralOk && bondIssues.length === 0 && lpIssues.length === 0 && state.bankRemain === 0;

  return {
    ok,
    centralOk,
    bondIssues: uniq(bondIssues),
    lpIssues: uniq(lpIssues),
    electronIssues: uniq(electronIssues),
    expectedCentral
  };
}

function showCheckResult(result){
  if (result.ok){
    showFeedback("good", "✅ Nice work!",
      [
        "Your bonds and lone pairs match a typical Lewis structure for this molecule.",
        "Your electron bank is at 0 (all valence electrons are accounted for)."
      ]
    );
    return;
  }

  const bullets = [];

  if (!result.centralOk){
    if (result.expectedCentral === "none"){
      bullets.push("Central atom: This one is usually drawn with <b>no central atom</b> (it’s a two-atom molecule).");
    } else {
      bullets.push("Central atom: Re-check which atom is usually central for this molecule.");
    }
  }

  result.bondIssues.forEach(m => bullets.push(`Bonds: ${m}`));
  result.lpIssues.forEach(m => bullets.push(`Lone pairs: ${m}`));
  result.electronIssues.forEach(m => bullets.push(`Electron bank: ${m}`));
  bullets.push("Tip: Build the skeleton (bonds) first, then use lone pairs (••) to fill outer shells.");

  showFeedback("bad", "Not quite yet — keep going.", bullets);
}

function showFeedback(kind, title, bullets){
  el.feedback.hidden = false;
  el.feedback.className = "feedback " + kind;
  el.feedback.innerHTML = `
    <h3>${title}</h3>
    <ul>${bullets.map(b=>`<li>${b}</li>`).join("")}</ul>
  `;
}

function uniq(arr){ return Array.from(new Set(arr)); }
function findFirstIndex(sym){ const i = current.atoms.findIndex(s => s === sym); return i >= 0 ? i : 0; }
function allIndicesExcept(idx){ return current.atoms.map((_,i)=>i).filter(i=>i!==idx); }

// ===== init =====
resetAll(pickRandom());
