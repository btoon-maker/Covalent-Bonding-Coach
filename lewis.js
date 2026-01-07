// Slot-based Covalent Bonding Coach
// - Student selects central atom
// - Model shows central + two terminals (left/right)
// - Each atom has 4 drop slots
// - Toolbox items: bond1, bond2, bond3, lp (lone pair)
// - Electron bank decreases as items are placed
// - Checks correctness vs answer key (starts with CO2; easy to add more)

const VALENCE = { H:1, C:4, N:5, O:6, F:7, Cl:7, Br:7, I:7, S:6, P:5 };

const MOLECULES = [
  {
    name: "CO2",
    atoms: ["C","O","O"],          // one central + 2 terminals
    centralCandidates: [0],        // indices allowed as central
    answer: {
      // bond order required between central and each terminal:
      bonds: { left: 2, right: 2 }, // double + double
      // lone pairs required on each atom, by direction slots:
      lonePairs: {
        // For CO2: each O has 2 lone pairs, carbon has 0.
        // We'll enforce LP count per atom (not specific slot positions)
        atomCounts: { 0:0, 1:2, 2:2 }
      }
    }
  }
];

const SLOT_DIRS = ["Top","Right","Bottom","Left"]; // 4 slots around each atom

const state = {
  mol: null,
  centralIdx: null,
  locked: false,

  // placements stored per atom per slot direction
  // e.g., placements["0-Top"] = "lp" or "bond2"
  placements: {},

  bankTotal: 0,
  bankLeft: 0,
};

function $(id){ return document.getElementById(id); }

function setFeedback(el, msg, kind=null){
  el.className = "feedback" + (kind==="good" ? " good" : kind==="bad" ? " bad" : "");
  el.innerHTML = msg;
}

function totalValence(mol){
  return mol.atoms.reduce((sum, sym) => sum + (VALENCE[sym] ?? 0), 0);
}

function costOfItem(item){
  if (item === "lp") return 2;
  if (item === "bond1") return 2;
  if (item === "bond2") return 4;
  if (item === "bond3") return 6;
  return 0;
}

function recalcBank(){
  const spent = Object.values(state.placements).reduce((s, item) => s + costOfItem(item), 0);
  state.bankLeft = state.bankTotal - spent;
  $("bankTotal").textContent = String(state.bankTotal);
  $("bankLeft").textContent = String(state.bankLeft);
}

function clearPlacements(){
  state.placements = {};
  recalcBank();
  renderModel();
}

function centralOptions(){
  const sel = $("centralSelect");
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select…";
  sel.appendChild(opt0);

  state.mol.atoms.forEach((sym, idx) => {
    // don't allow H as central in this basic tool
    if (sym === "H") return;
    const o = document.createElement("option");
    o.value = String(idx);
    o.textContent = `${sym} (atom ${idx+1})`;
    sel.appendChild(o);
  });
}

function loadMolecule(){
  state.mol = MOLECULES[Math.floor(Math.random() * MOLECULES.length)];
  state.centralIdx = null;
  state.locked = false;

  state.bankTotal = totalValence(state.mol);
  state.bankLeft = state.bankTotal;
  state.placements = {};

  $("molTitle").textContent = `Molecule: ${state.mol.name}`;
  $("molPrompt").textContent = `Choose the central atom, then drag bonds and lone pairs into the slots.`;

  $("builder").setAttribute("aria-disabled","true");
  setFeedback($("centralFeedback"), `Electron bank is <strong>${state.bankTotal}</strong>. Now choose the central atom.`, null);
  setFeedback($("checkFeedback"), "Lock a central atom first.", null);

  centralOptions();
  recalcBank();
  renderModel(); // shows blank until locked
}

function lockCentral(){
  const val = $("centralSelect").value;
  if (!val){
    setFeedback($("centralFeedback"), "Select a central atom first.", "bad");
    return;
  }
  const idx = Number(val);
  if (!Number.isFinite(idx)){
    setFeedback($("centralFeedback"), "Select a valid central atom.", "bad");
    return;
  }

  // Validate central choice if molecule defines candidates
  if (state.mol.centralCandidates && !state.mol.centralCandidates.includes(idx)){
    setFeedback($("centralFeedback"), "Not quite. Try choosing the best central atom for this molecule.", "bad");
    return;
  }

  state.centralIdx = idx;
  state.locked = true;

  $("builder").setAttribute("aria-disabled","false");
  setFeedback($("centralFeedback"), `✅ Central atom locked: <strong>${state.mol.atoms[idx]} (atom ${idx+1})</strong>. Now build the model.`, "good");
  setFeedback($("checkFeedback"), "Drag items into slots. Click <strong>Check molecule</strong> when ready.", null);

  clearPlacements();
}

function setupDragToolbox(){
  document.querySelectorAll(".tool").forEach(tool => {
    tool.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", tool.dataset.item);
    });
  });
}

function slotKey(atomIndex, dir){
  return `${atomIndex}-${dir}`;
}

function setSlot(atomIndex, dir, item){
  const key = slotKey(atomIndex, dir);
  // toggle behavior: if same item dropped again, replace (no toggle). Removal is by click.
  state.placements[key] = item;
  recalcBank();
  renderModel();
}

function removeSlot(atomIndex, dir){
  const key = slotKey(atomIndex, dir);
  if (state.placements[key]){
    delete state.placements[key];
    recalcBank();
    renderModel();
  }
}

function renderModel(){
  const area = $("modelArea");
  area.innerHTML = "";

  if (!state.locked){
    const msg = document.createElement("div");
    msg.className = "muted";
    msg.style.padding = "10px";
    msg.textContent = "Lock a central atom to begin building the model.";
    area.appendChild(msg);
    return;
  }

  // Determine terminal atoms (for this version: exactly 2 terminals)
  const allIdx = state.mol.atoms.map((_, i) => i);
  const terminals = allIdx.filter(i => i !== state.centralIdx);

  // If molecule isn’t exactly 3 atoms, this layout would need expansion later.
  const leftIdx = terminals[0];
  const rightIdx = terminals[1];

  // Place atoms on canvas
  // central
  createAtom(area, state.centralIdx, state.mol.atoms[state.centralIdx], { x: 50, y: 50 }, "center");
  // left and right
  createAtom(area, leftIdx, state.mol.atoms[leftIdx], { x: 10, y: 50 }, "left");
  createAtom(area, rightIdx, state.mol.atoms[rightIdx], { x: 90, y: 50 }, "right");

  // Auto-visual cue: center-to-left and center-to-right "connection hint"
  // (The actual bonds are placed in the facing slots: left atom Right slot, center Left slot; right atom Left slot, center Right slot)
}

function createAtom(parent, atomIndex, symbol, posPct, role){
  const wrap = document.createElement("div");
  wrap.className = "atomWrap";
  // position atomWrap center on % positions
  // modelArea is relative; we’ll place with translate
  wrap.style.left = `${posPct.x}%`;
  wrap.style.top = `${posPct.y}%`;
  wrap.style.transform = "translate(-50%, -50%)";
  parent.appendChild(wrap);

  const core = document.createElement("div");
  core.className = "atomCore";
  core.textContent = symbol;
  wrap.appendChild(core);

  // slots
  SLOT_DIRS.forEach(dir => {
    const slot = document.createElement("div");
    slot.className = `slot slot${dir}`;
    slot.dataset.atom = String(atomIndex);
    slot.dataset.dir = dir;

    const key = slotKey(atomIndex, dir);
    const item = state.placements[key];

    if (item){
      slot.classList.add("filled");
      slot.innerHTML = renderItemIcon(item);
    } else {
      slot.innerHTML = `<span class="muted">drop</span>`;
    }

    // Drop handling
    slot.addEventListener("dragover", (e) => e.preventDefault());
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      const itemDropped = e.dataTransfer.getData("text/plain");
      if (!itemDropped) return;

      // Optional rule: discourage bonds in top/bottom slots for terminals, but don’t block (teachers may want flexibility)
      setSlot(atomIndex, dir, itemDropped);
    });

    // Click-to-remove
    slot.addEventListener("click", () => removeSlot(atomIndex, dir));

    wrap.appendChild(slot);
  });

  // Small role marker (optional; kept subtle)
  if (role === "center"){
    core.style.borderColor = "rgba(140,29,64,.45)";
    core.style.boxShadow = "0 0 0 3px rgba(140,29,64,.08)";
  }
}

function renderItemIcon(item){
  if (item === "lp") return `<div class="slotText"><span style="color:#8C1D40;font-weight:1000;">••</span></div>`;
  if (item === "bond1") return `<div class="slotText"><span style="font-weight:1000;">—</span></div>`;
  if (item === "bond2") return `<div class="slotText"><span style="font-weight:1000;">=</span></div>`;
  if (item === "bond3") return `<div class="slotText"><span style="font-weight:1000;">≡</span></div>`;
  return "";
}

/* ---------- Checking logic ---------- */

function countLonePairsOnAtom(atomIndex){
  let c = 0;
  for (const dir of SLOT_DIRS){
    const key = slotKey(atomIndex, dir);
    if (state.placements[key] === "lp") c++;
  }
  return c;
}

function bondOrderBetweenCentralAnd(atomIndex){
  // We interpret bonds only via facing slots:
  // - central Left slot paired with left atom Right slot
  // - central Right slot paired with right atom Left slot
  // If they mismatch, it's incorrect.
  const central = state.centralIdx;
  const terminals = state.mol.atoms.map((_,i)=>i).filter(i=>i!==central);
  const leftIdx = terminals[0];
  const rightIdx = terminals[1];

  const keyCLeft = slotKey(central, "Left");
  const keyCRight = slotKey(central, "Right");
  const keyLRight = slotKey(leftIdx, "Right");
  const keyRLeft = slotKey(rightIdx, "Left");

  const toOrder = (item) => item==="bond1"?1 : item==="bond2"?2 : item==="bond3"?3 : 0;

  if (atomIndex === leftIdx){
    const a = toOrder(state.placements[keyCLeft]);
    const b = toOrder(state.placements[keyLRight]);
    if (a === 0 && b === 0) return { order:0, mismatch:false };
    return { order: a, mismatch: a !== b || a===0 };
  }
  if (atomIndex === rightIdx){
    const a = toOrder(state.placements[keyCRight]);
    const b = toOrder(state.placements[keyRLeft]);
    if (a === 0 && b === 0) return { order:0, mismatch:false };
    return { order: a, mismatch: a !== b || a===0 };
  }
  return { order:0, mismatch:false };
}

function checkMolecule(){
  if (!state.locked){
    setFeedback($("checkFeedback"), "Lock a central atom first.", "bad");
    return;
  }

  // bank check
  if (state.bankLeft < 0){
    setFeedback($("checkFeedback"), "❌ Your electron bank is negative. Remove some placements.", "bad");
    return;
  }

  const central = state.centralIdx;
  const terminals = state.mol.atoms.map((_,i)=>i).filter(i=>i!==central);
  if (terminals.length !== 2){
    setFeedback($("checkFeedback"), "This demo version expects a central atom and two terminals.", "bad");
    return;
  }

  const leftIdx = terminals[0];
  const rightIdx = terminals[1];

  // mismatch check for bonds
  const leftBond = bondOrderBetweenCentralAnd(leftIdx);
  const rightBond = bondOrderBetweenCentralAnd(rightIdx);

  if (leftBond.mismatch || rightBond.mismatch){
    setFeedback(
      $("checkFeedback"),
      "❌ Your bond placements don’t match on both sides of the connection. Put the same bond type in the two facing slots (example: central-left slot AND left atom-right slot).",
      "bad"
    );
    return;
  }

  // enforce required bond orders (for CO2 in this version)
  const req = state.mol.answer.bonds;
  const errors = [];

  if (leftBond.order !== req.left) errors.push(`Left bond should be <strong>order ${req.left}</strong>.`);
  if (rightBond.order !== req.right) errors.push(`Right bond should be <strong>order ${req.right}</strong>.`);

  // Lone pair counts
  const neededLP = state.mol.answer.lonePairs.atomCounts;
  const lpCentral = countLonePairsOnAtom(central);
  const lpLeft = countLonePairsOnAtom(leftIdx);
  const lpRight = countLonePairsOnAtom(rightIdx);

  if (lpCentral !== neededLP[central]) errors.push(`Central atom needs <strong>${neededLP[central]}</strong> lone pairs (you have ${lpCentral}).`);
  if (lpLeft !== neededLP[leftIdx]) errors.push(`Left atom needs <strong>${neededLP[leftIdx]}</strong> lone pairs (you have ${lpLeft}).`);
  if (lpRight !== neededLP[rightIdx]) errors.push(`Right atom needs <strong>${neededLP[rightIdx]}</strong> lone pairs (you have ${lpRight}).`);

  // bank usage for the expected structure (for these simple neutral examples, should use all electrons)
  if (state.bankLeft !== 0) errors.push(`You should use the full electron bank for this molecule (remaining: <strong>${state.bankLeft}</strong>).`);

  if (errors.length){
    setFeedback($("checkFeedback"), `❌ Not yet.<ul>${errors.map(e=>`<li>${e}</li>`).join("")}</ul>`, "bad");
    return;
  }

  setFeedback($("checkFeedback"), "✅ Correct! Bonds, lone pairs, and electron bank all check out.", "good");
}

function showAnswer(){
  if (!state.locked){
    setFeedback($("checkFeedback"), "Lock a central atom first.", "bad");
    return;
  }

  clearPlacements();

  const central = state.centralIdx;
  const terminals = state.mol.atoms.map((_,i)=>i).filter(i=>i!==central);
  const leftIdx = terminals[0];
  const rightIdx = terminals[1];

  const reqB = state.mol.answer.bonds;
  const toItem = (o)=> o===1?"bond1": o===2?"bond2":"bond3";

  // place matching bond items in facing slots
  state.placements[slotKey(central, "Left")] = toItem(reqB.left);
  state.placements[slotKey(leftIdx, "Right")] = toItem(reqB.left);

  state.placements[slotKey(central, "Right")] = toItem(reqB.right);
  state.placements[slotKey(rightIdx, "Left")] = toItem(reqB.right);

  // lone pairs: place anywhere except the bond-facing slot first, then fill remaining slots
  const lpCounts = state.mol.answer.lonePairs.atomCounts;

  function fillLP(atomIndex, avoidDir){
    let need = lpCounts[atomIndex] || 0;
    for (const dir of SLOT_DIRS){
      if (need <= 0) break;
      if (dir === avoidDir) continue;
      state.placements[slotKey(atomIndex, dir)] = "lp";
      need--;
    }
  }

  fillLP(central, null);
  fillLP(leftIdx, "Right");
  fillLP(rightIdx, "Left");

  recalcBank();
  renderModel();
  setFeedback($("checkFeedback"), "Here’s one correct model. Study where bonds and lone pairs went.", null);
}

/* ---------- Init ---------- */

function init(){
  setupDragToolbox();

  $("newBtn").addEventListener("click", loadMolecule);
  $("lockCentral").addEventListener("click", lockCentral);
  $("resetBuild").addEventListener("click", () => {
    state.centralIdx = null;
    state.locked = false;
    $("builder").setAttribute("aria-disabled","true");
    setFeedback($("centralFeedback"), "Choose the central atom again, then lock it.", null);
    setFeedback($("checkFeedback"), "Lock a central atom first.", null);
    clearPlacements();
    renderModel();
  });

  $("clearBtn").addEventListener("click", () => {
    clearPlacements();
    setFeedback($("checkFeedback"), "Cleared placements. Rebuild the model.", null);
  });

  $("checkBtn").addEventListener("click", checkMolecule);
  $("showAnswerBtn").addEventListener("click", showAnswer);

  loadMolecule();
}

init();
