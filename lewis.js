/* Covalent Bonding Coach
   - Step 1: confirm total valence electrons
   - Step 1b: choose + lock central atom (or No central for diatomic)
   - Step 2: build bonds (one bond slot BETWEEN atoms) + lone pairs as PAIRS (••) in boxes
   - Electron bank decrements/refunds correctly
   - Feedback is HS-friendly and NOT a step-by-step “do this exact fix”
*/

const VALENCE = { H:1, C:4, N:5, O:6, F:7, P:5, Br:7, Cl:7 };

const MOLECULES = [
  // diatomic
  makeMol("H2",  ["H","H"],           { centralMode:"none" }, expectedDiatomic(1, 0, 0)),
  makeMol("F2",  ["F","F"],           { centralMode:"none" }, expectedDiatomic(1, 3, 3)),
  makeMol("O2",  ["O","O"],           { centralMode:"none" }, expectedDiatomic(2, 2, 2)),
  makeMol("N2",  ["N","N"],           { centralMode:"none" }, expectedDiatomic(3, 1, 1)),
  makeMol("Br2", ["Br","Br"],         { centralMode:"none" }, expectedDiatomic(1, 3, 3)),

  // small
  makeMol("HF",  ["H","F"],           { centralMode:"none" }, expectedDiatomic(1, 0, 3)),

  // linear triatomic
  makeMol("CO2", ["O","C","O"],       { centralMode:"auto" }, expectedLinearTriatomic("C", 2, { O:2, C:0 })),
  makeMol("HCN", ["H","C","N"],       { centralMode:"auto" }, expectedLinearHCN()),

  // central with 4
  makeMol("CF4",  ["C","F","F","F","F"], { centralMode:"auto" }, expectedTetra("C", "F")),
  makeMol("CBr4", ["C","Br","Br","Br","Br"], { centralMode:"auto" }, expectedTetra("C", "Br")),

  // central with 3
  makeMol("NH3", ["N","H","H","H"],   { centralMode:"auto" }, expectedTrigonal("N","H", { centralLP:1, terminalLP:0 })),
  makeMol("PF3", ["P","F","F","F"],   { centralMode:"auto" }, expectedTrigonal("P","F", { centralLP:1, terminalLP:3 })),

  // bent
  makeMol("H2O", ["O","H","H"],       { centralMode:"auto" }, expectedBent("O","H", { centralLP:2, terminalLP:0 })),
];

function makeMol(name, atoms, meta, expected){
  return {
    name,
    atoms,                 // explicit list
    meta,
    expected,              // expected structure for checking
    totalValence: atoms.reduce((s,a)=> s + (VALENCE[a] ?? 0), 0)
  };
}

function expectedDiatomic(bondOrder, lpA, lpB){
  return {
    type:"diatomic",
    central:null,
    bonds:[ { a:0, b:1, order:bondOrder } ],
    lonePairs:{ 0:lpA, 1:lpB }
  };
}

function expectedLinearTriatomic(centralSym, bondOrderToEachTerminal, lpMap){
  // atoms: terminal - central - terminal
  return {
    type:"linear3",
    centralSym,
    bonds:[ { a:0, b:1, order:bondOrderToEachTerminal }, { a:1, b:2, order:bondOrderToEachTerminal } ],
    lonePairs: (function(){
      // set by symbol defaults in lpMap (e.g., {O:2,C:0})
      return {}; // resolved later based on actual indices
    })(),
    lpBySymbol: lpMap
  };
}

function expectedLinearHCN(){
  // H-C≡N ; LP: H0 C0 N1
  return {
    type:"linear3",
    centralSym:"C",
    bonds:[ { a:0, b:1, order:1 }, { a:1, b:2, order:3 } ],
    lpByIndex: { 0:0, 1:0, 2:1 }
  };
}

function expectedTetra(centralSym, terminalSym){
  // 4 single bonds, central LP 0, terminals LP 3 if halogen else 0
  const terminalLP = (terminalSym === "F" || terminalSym === "Cl" || terminalSym === "Br") ? 3 : 0;
  return {
    type:"tetra",
    centralSym,
    bondOrder:1,
    terminalSym,
    centralLP:0,
    terminalLP
  };
}

function expectedTrigonal(centralSym, terminalSym, { centralLP, terminalLP }){
  return {
    type:"trigonal",
    centralSym,
    bondOrder:1,
    terminalSym,
    centralLP,
    terminalLP
  };
}

function expectedBent(centralSym, terminalSym, { centralLP, terminalLP }){
  return {
    type:"bent",
    centralSym,
    bondOrder:1,
    terminalSym,
    centralLP,
    terminalLP
  };
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
  modelLockedMsg: document.getElementById("modelLockedMsg"),
  buildHint: document.getElementById("buildHint"),
  feedback: document.getElementById("feedback"),
};

let current = null;
let state = null;

function resetAll(newMol){
  current = newMol ?? pickRandom();
  el.molName.innerHTML = formatFormula(current.name);
  el.molPrompt.textContent = "Confirm electrons, choose a central atom, then build.";

  // Step 1 reset
  el.valenceInput.value = "";
  setMsg(el.valenceMsg, "hint", `Enter the total valence electrons for ${current.name}, then click Check.`);
  el.centralSelect.disabled = true;
  el.btnLockCentral.disabled = true;
  el.centralSelect.innerHTML = "";
  setMsg(el.centralMsg, "hint", "Check the total electrons first.");

  // bank hidden until correct
  el.bankTotal.textContent = "—";
  el.bankRemain.textContent = "—";
  setMsg(el.bankMsg, "warn", "Electron bank will appear after you correctly confirm the total valence electrons.");

  // Step 2 locked
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

    // build state
    bonds: new Map(),       // key "a-b" => { order:0..3 }
    lonePairs: new Map(),   // key "atomIndex|slotId" => true
  };

  // enable toolbox drag
  wireToolboxDrag();
}

function pickRandom(){
  return MOLECULES[Math.floor(Math.random()*MOLECULES.length)];
}

function formatFormula(txt){
  // simple subscript digits
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

// ===== Step 1: valence check =====
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

    // enable central select (ALL atoms + "No central atom")
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

  // always include "No central atom" option so students can choose it (diatomic or linear special cases)
  opts.push({ label:"No central atom (diatomic)", value:"none" });

  // include each atom (with index) as options
  current.atoms.forEach((sym, i) => {
    opts.push({ label:`${sym} (atom ${i+1})`, value:String(i) });
  });

  el.centralSelect.innerHTML = `<option value="">Select…</option>` + opts.map(o =>
    `<option value="${o.value}">${o.label}</option>`
  ).join("");
}

// ===== Step 1b: lock central =====
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

  // render model skeleton ONLY after lock
  renderModel();
});

// Reset / Clear
el.btnReset.addEventListener("click", () => resetAll(current));
el.btnClear.addEventListener("click", () => {
  if (!state.centralLocked) return;
  state.bonds.clear();
  state.lonePairs.clear();
  state.bankRemain = state.bankTotal;
  el.bankRemain.textContent = String(state.bankRemain);
  el.feedback.hidden = true;
  renderModel(); // re-render empty placements
});

el.btnNew.addEventListener("click", () => resetAll(pickRandom()));

// ===== Model rendering =====
function renderModel(){
  clearModelArea(false);

  // remove locked msg overlay
  const lock = document.getElementById("modelLockedMsg");
  if (lock) lock.style.display = "none";

  const layer = el.modelArea.querySelector(".modelLayer");

  const layout = computeLayout();
  // layout: atoms positions + connections list
  // atoms: [{i,sym,x,y, role:"center|terminal"}]
  // bonds: [{a,b, x,y, orientation:"h|v"}] for ONE bond zone between connected atoms

  // atoms
  layout.atoms.forEach(a => {
    const node = document.createElement("div");
    node.className = "atom" + (a.role === "center" ? "" : " small");
    node.style.left = `${a.x}px`;
    node.style.top  = `${a.y}px`;
    node.dataset.atom = String(a.i);

    node.innerHTML = `<div class="sym">${a.sym}</div>`;
    layer.appendChild(node);

    // Lone pair slots: PAIRS (••) in boxes
    // Hydrogen: none
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

  // bond slots BETWEEN atoms (ONE per connection)
  layout.bondSlots.forEach(b => {
    const slot = document.createElement("div");
    slot.className = "bondSlot" + (b.orientation === "v" ? " vertical" : "");
    slot.style.left = `${b.x}px`;
    slot.style.top  = `${b.y}px`;
    slot.dataset.drop = "bond";
    slot.dataset.a = String(b.a);
    slot.dataset.b = String(b.b);

    const key = bondKey(b.a, b.b);
    const placed = state.bonds.get(key)?.order ?? 0;
    if (placed > 0){
      slot.classList.add("filled");
      // order 3 needs 3 lines: use extra span for top line
      slot.innerHTML = placed === 3
        ? `<div class="bondMark" data-order="3"><span></span></div>`
        : `<div class="bondMark" data-order="${placed}"></div>`;
    } else {
      slot.innerHTML = `<div class="hint">DROP BOND</div>`;
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

// Positions tuned to your drawings: bond slot is between atoms; LP slots are boxes around atoms.
// Hydrogen gets ONLY the bond slot (no LP slots).
function computeLayout(){
  const W = el.modelArea.clientWidth;
  const H = el.modelArea.clientHeight;
  const cx = Math.floor(W/2);
  const cy = Math.floor(H/2);

  const atoms = [];
  const bondSlots = [];

  const choice = state.lockedCentralChoice;

  const indices = current.atoms.map((sym, i) => ({ sym, i }));

  // diatomic layout OR "No central atom" chosen
  if (choice?.type === "none" || current.atoms.length === 2){
    const a0 = indices[0], a1 = indices[1];
    const leftX = cx - 170, rightX = cx + 120;
    const y = cy - 30;

    atoms.push(atomNode(a0.i, a0.sym, leftX, y, "terminal", "right"));
    atoms.push(atomNode(a1.i, a1.sym, rightX, y, "terminal", "left"));

    // ONE bond slot between
    bondSlots.push({
      a:a0.i, b:a1.i,
      x: cx - 55, y: cy - 34,
      orientation:"h"
    });

    return { atoms, bondSlots };
  }

  // For 3+ atoms: use chosen index as center (even if student chose a “bad” one)
  const centerIndex = (choice?.type === "index") ? choice.index : 0;

  // separate terminals
  const center = indices.find(x => x.i === centerIndex);
  const terminals = indices.filter(x => x.i !== centerIndex);

  // place center
  const centerX = cx - 28;
  const centerY = cy - 30;
  atoms.push(atomNode(center.i, center.sym, centerX, centerY, "center"));

  // decide positions based on count
  const count = terminals.length;

  if (count === 2){
    // linear: left + right
    const left = terminals[0], right = terminals[1];
    atoms.push(atomNode(left.i, left.sym, cx - 210, centerY, "terminal", "right"));
    atoms.push(atomNode(right.i, right.sym, cx + 160, centerY, "terminal", "left"));

    bondSlots.push({ a:left.i, b:center.i, x: cx - 130, y: centerY + 4, orientation:"h" });
    bondSlots.push({ a:center.i, b:right.i, x: cx + 30,  y: centerY + 4, orientation:"h" });

  } else if (count === 3){
    // trigonal-ish: top, left, right
    const top = terminals[0], left = terminals[1], right = terminals[2];

    atoms.push(atomNode(top.i, top.sym, centerX, cy - 160, "terminal", "bottom"));
    atoms.push(atomNode(left.i, left.sym, cx - 210, centerY + 70, "terminal", "right"));
    atoms.push(atomNode(right.i, right.sym, cx + 160, centerY + 70, "terminal", "left"));

    // one bond slot per connection
    bondSlots.push({ a:center.i, b:top.i,  x: centerX + 4, y: cy - 112, orientation:"v" });
    bondSlots.push({ a:left.i, b:center.i, x: cx - 130,   y: centerY + 104, orientation:"h" });
    bondSlots.push({ a:center.i, b:right.i, x: cx + 30,   y: centerY + 104, orientation:"h" });

  } else {
    // 4 terminals: top, left, right, bottom
    const top = terminals[0], left = terminals[1], right = terminals[2], bottom = terminals[3];

    atoms.push(atomNode(top.i, top.sym, centerX, cy - 170, "terminal", "bottom"));
    atoms.push(atomNode(left.i, left.sym, cx - 220, centerY, "terminal", "right"));
    atoms.push(atomNode(right.i, right.sym, cx + 170, centerY, "terminal", "left"));
    atoms.push(atomNode(bottom.i, bottom.sym, centerX, cy + 110, "terminal", "top"));

    bondSlots.push({ a:center.i, b:top.i,    x: centerX + 4, y: cy - 124, orientation:"v" });
    bondSlots.push({ a:left.i, b:center.i,   x: cx - 140,    y: centerY + 4, orientation:"h" });
    bondSlots.push({ a:center.i, b:right.i,  x: cx + 40,     y: centerY + 4, orientation:"h" });
    bondSlots.push({ a:center.i, b:bottom.i, x: centerX + 4, y: cy + 64, orientation:"v" });
  }

  return { atoms, bondSlots };
}

function atomNode(i, sym, x, y, role, towardCenterSide){
  // lone pair slot positions:
  // - boxes around atom (up to 3 for terminals like halogens)
  // - do NOT show any for hydrogen
  const lpSlots = [];

  if (sym !== "H"){
    // Base positions around the atom box
    // Atom box size: ~56; lp box size: 34x28
    const ax = x, ay = y;

    // "towardCenterSide" lets us avoid placing an LP slot in the bond direction if we want,
    // but we’ll keep it simple and place 3 slots for terminals and 4 for centers,
    // then the student can choose how many to fill.
    const isCenter = (role === "center");

    if (isCenter){
      // 4 potential LP slots around center
      lpSlots.push(lpPos("top", ax+11, ay-34));
      lpSlots.push(lpPos("right", ax+62, ay+14));
      lpSlots.push(lpPos("bottom", ax+11, ay+62));
      lpSlots.push(lpPos("left", ax-40, ay+14));
    } else {
      // terminals: 3 potential LP slots (top, bottom, outer side)
      lpSlots.push(lpPos("top", ax+11, ay-34));
      lpSlots.push(lpPos("bottom", ax+11, ay+62));

      if (towardCenterSide === "left"){
        // terminal is to the right of center; outer is right
        lpSlots.push(lpPos("outer", ax+62, ay+14));
      } else if (towardCenterSide === "right"){
        // terminal is to the left of center; outer is left
        lpSlots.push(lpPos("outer", ax-40, ay+14));
      } else if (towardCenterSide === "top"){
        lpSlots.push(lpPos("outer", ax+11, ay-70)); // extra outer
      } else if (towardCenterSide === "bottom"){
        lpSlots.push(lpPos("outer", ax+11, ay+98));
      } else {
        // default outer right
        lpSlots.push(lpPos("outer", ax+62, ay+14));
      }
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
  // delta positive = spend, negative = refund
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

  // spend only the difference
  if (delta > 0){
    if (!spendElectrons(delta)){
      showFeedback("warn", "Not enough electrons left",
        [`You don’t have enough electrons remaining to place that bond.`]
      );
      return;
    }
  } else if (delta < 0){
    spendElectrons(delta); // refund
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

// ===== Checking =====
el.btnCheck.addEventListener("click", () => {
  if (!state.centralLocked) return;
  const result = checkWork(false);
  showCheckResult(result);
});

el.btnShow.addEventListener("click", () => {
  if (!state.centralLocked) return;
  // fill in expected solution (still spending electrons correctly is not the goal here; it's “show model”)
  applyExpectedToState();
  renderModel();
  const result = checkWork(true);
  showCheckResult(result);
});

function applyExpectedToState(){
  state.bonds.clear();
  state.lonePairs.clear();
  state.bankRemain = state.bankTotal;
  el.bankRemain.textContent = String(state.bankRemain);

  const exp = resolveExpected();

  // bonds
  exp.bonds.forEach(b => {
    state.bonds.set(bondKey(b.a,b.b), { order:b.order });
    spendElectrons(costForBond(b.order));
  });

  // lone pairs
  Object.entries(exp.lonePairs).forEach(([idx, count]) => {
    const atomIndex = Number(idx);
    const sym = current.atoms[atomIndex];

    if (sym === "H") return;

    // Fill available slots in a predictable order: top, outer, bottom, left/right for center
    // (We don't need geometry-perfect; we just need the correct COUNT.)
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

  // If any remaining electrons exist in bank, keep them (but most expected models should use all)
  el.bankRemain.textContent = String(state.bankRemain);
}

function resolveExpected(){
  // Convert symbolic expectations into explicit by index
  const exp = current.expected;

  // If linear3 with lpBySymbol
  if (exp.type === "linear3" && exp.lpBySymbol){
    const lonePairs = {};
    current.atoms.forEach((sym, i) => {
      lonePairs[i] = exp.lpBySymbol[sym] ?? 0;
    });
    return { bonds: exp.bonds, lonePairs };
  }

  // If linear3 with lpByIndex
  if (exp.type === "linear3" && exp.lpByIndex){
    return { bonds: exp.bonds, lonePairs: exp.lpByIndex };
  }

  if (exp.type === "diatomic"){
    return { bonds: exp.bonds, lonePairs: exp.lonePairs };
  }

  if (exp.type === "tetra"){
    // bonds: center to each terminal index
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
    const terminals = allIndicesExcept(center);
    // use first 3 terminals (in case student chose weird central, list is still consistent with molecule definition)
    const terms = terminals.slice(0,3);
    const bonds = terms.map(t => ({ a:center, b:t, order:exp.bondOrder }));
    const lonePairs = {};
    lonePairs[center] = exp.centralLP;
    terms.forEach(t => lonePairs[t] = exp.terminalLP);
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

  // fallback
  return { bonds:[], lonePairs:{} };
}

function findFirstIndex(sym){
  const i = current.atoms.findIndex(s => s === sym);
  return i >= 0 ? i : 0;
}
function allIndicesExcept(idx){
  return current.atoms.map((_,i)=>i).filter(i=>i!==idx);
}

function checkWork(isReveal){
  const exp = resolveExpected();

  // central correctness (soft check)
  const expectedCentral = expectedCentralChoice();
  const chosen = state.lockedCentralChoice;

  let centralOk = true;
  if (expectedCentral === "none"){
    centralOk = (chosen?.type === "none");
  } else {
    // for these models, central should be the symbol expectedCentral
    if (chosen?.type !== "index") centralOk = false;
    else centralOk = (current.atoms[chosen.index] === expectedCentral);
  }

  // bond correctness
  const bondIssues = [];
  const expectedBondMap = new Map();
  exp.bonds.forEach(b => expectedBondMap.set(bondKey(b.a,b.b), b.order));

  // compare expected connections
  expectedBondMap.forEach((order, key) => {
    const got = state.bonds.get(key)?.order ?? 0;
    if (got !== order){
      bondIssues.push("Some bonds are not the correct type (single/double/triple).");
    }
  });

  // extra bonds placed
  for (const [key, v] of state.bonds.entries()){
    if (!expectedBondMap.has(key) && v.order > 0){
      bondIssues.push("You have a bond placed where this molecule doesn’t usually connect.");
      break;
    }
  }

  // lone pair correctness (count per atom)
  const lpIssues = [];
  const expectedLP = exp.lonePairs;

  const gotLPCounts = {};
  current.atoms.forEach((_, i) => gotLPCounts[i] = 0);
  for (const k of state.lonePairs.keys()){
    const atom = Number(k.split("|")[0]);
    gotLPCounts[atom] = (gotLPCounts[atom] ?? 0) + 1;
  }

  // hydrogen should always have 0 LP
  current.atoms.forEach((sym, i) => {
    if (sym === "H" && gotLPCounts[i] > 0){
      lpIssues.push("Hydrogen should not have any lone pairs.");
    }
  });

  // compare expected counts (only for atoms included in expectedLP)
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

  // electron usage
  const used = state.bankTotal - state.bankRemain;
  const electronIssues = [];
  if (state.bankRemain !== 0){
    electronIssues.push("You still have electrons remaining. A finished Lewis model usually uses all valence electrons.");
  }
  if (used > state.bankTotal){
    electronIssues.push("You used more electrons than are available (check the bank).");
  }

  // overall
  const ok = centralOk && bondIssues.length === 0 && lpIssues.length === 0 && state.bankRemain === 0;

  return {
    ok,
    centralOk,
    bondIssues: uniq(bondIssues),
    lpIssues: uniq(lpIssues),
    electronIssues: uniq(electronIssues),
    expectedCentral,
    chosenCentral: chosen,
    isReveal
  };
}

function expectedCentralChoice(){
  // What "should" be central for these practice molecules
  // diatomic + HF -> none
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

  // HS-friendly, not giving exact placements
  const bullets = [];

  // central feedback
  if (!result.centralOk){
    if (result.expectedCentral === "none"){
      bullets.push("Central atom: This one is usually drawn with <b>no central atom</b> (it’s a two-atom molecule).");
    } else {
      bullets.push(`Central atom: Re-check which atom is usually central in <b>${current.name}</b>.`);
    }
  }

  // bond feedback
  result.bondIssues.forEach(m => bullets.push(`Bonds: ${m}`));

  // lone pair feedback
  result.lpIssues.forEach(m => bullets.push(`Lone pairs: ${m}`));

  // electrons
  result.electronIssues.forEach(m => bullets.push(`Electron bank: ${m}`));

  // add a gentle nudge (no “do X on atom 2”)
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

function uniq(arr){
  return Array.from(new Set(arr));
}

// ===== init =====
resetAll(pickRandom());
