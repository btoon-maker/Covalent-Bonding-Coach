/* Covalent Bonding Coach — Lewis Structures (Option B)
   - Student must confirm total valence electrons before bank appears
   - One bond tile placed ONCE between atoms (not twice)
   - Vertical bonds rotate tile for readability
   - Feedback is student-friendly and NOT answer-giving
*/

const MOLECULES = [
  // diatomic
  { formula:"H2",  atoms:["H","H"], central:null, bonds:[[0,1,1]], lonePairs:{0:0,1:0}, totalVE:2 },
  { formula:"F2",  atoms:["F","F"], central:null, bonds:[[0,1,1]], lonePairs:{0:3,1:3}, totalVE:14 },
  { formula:"O2",  atoms:["O","O"], central:null, bonds:[[0,1,2]], lonePairs:{0:2,1:2}, totalVE:12 },
  { formula:"N2",  atoms:["N","N"], central:null, bonds:[[0,1,3]], lonePairs:{0:1,1:1}, totalVE:10 },
  { formula:"Br2", atoms:["Br","Br"], central:null, bonds:[[0,1,1]], lonePairs:{0:3,1:3}, totalVE:14 },

  // two atoms (one central effectively)
  { formula:"HF", atoms:["H","F"], central:null, bonds:[[0,1,1]], lonePairs:{0:0,1:3}, totalVE:8 },

  // triatomic
  { formula:"H2O", atoms:["O","H","H"], central:0, terminals:[1,2], layout:"bent",
    bonds:[[0,1,1],[0,2,1]], lonePairs:{0:2,1:0,2:0}, totalVE:8 },

  { formula:"CO2", atoms:["O","C","O"], central:1, terminals:[0,2], layout:"linear",
    bonds:[[1,0,2],[1,2,2]], lonePairs:{0:2,1:0,2:2}, totalVE:16 },

  { formula:"HCN", atoms:["H","C","N"], central:1, terminals:[0,2], layout:"linear",
    bonds:[[1,0,1],[1,2,3]], lonePairs:{0:0,1:0,2:1}, totalVE:10 },

  { formula:"NH3", atoms:["N","H","H","H"], central:0, terminals:[1,2,3], layout:"trigonal",
    bonds:[[0,1,1],[0,2,1],[0,3,1]], lonePairs:{0:1,1:0,2:0,3:0}, totalVE:8 },

  { formula:"PF3", atoms:["P","F","F","F"], central:0, terminals:[1,2,3], layout:"trigonal",
    bonds:[[0,1,1],[0,2,1],[0,3,1]], lonePairs:{0:1,1:3,2:3,3:3}, totalVE:26 },

  { formula:"CF4", atoms:["C","F","F","F","F"], central:0, terminals:[1,2,3,4], layout:"tetra",
    bonds:[[0,1,1],[0,2,1],[0,3,1],[0,4,1]], lonePairs:{0:0,1:3,2:3,3:3,4:3}, totalVE:32 },

  { formula:"CBr4", atoms:["C","Br","Br","Br","Br"], central:0, terminals:[1,2,3,4], layout:"tetra",
    bonds:[[0,1,1],[0,2,1],[0,3,1],[0,4,1]], lonePairs:{0:0,1:3,2:3,3:3,4:3}, totalVE:32 },
];

// rough valence electrons (main-group typical)
const VE = { H:1, C:4, N:5, O:6, F:7, P:5, Br:7 };

// rules for “complete outer shell”
function neededElectrons(sym){
  return sym === "H" ? 2 : 8;
}

const els = {
  molName: document.getElementById("molName"),
  molPrompt: document.getElementById("molPrompt"),
  newMolBtn: document.getElementById("newMolBtn"),

  studentTotal: document.getElementById("studentTotal"),
  checkTotalBtn: document.getElementById("checkTotalBtn"),
  totalFeedback: document.getElementById("totalFeedback"),

  centralSelect: document.getElementById("centralSelect"),
  lockCentralBtn: document.getElementById("lockCentralBtn"),
  resetBtn: document.getElementById("resetBtn"),
  centralFeedback: document.getElementById("centralFeedback"),

  bankTotal: document.getElementById("bankTotal"),
  bankRemain: document.getElementById("bankRemain"),
  bankLockedMsg: document.getElementById("bankLockedMsg"),

  model: document.getElementById("model"),
  bondSvg: document.getElementById("bondSvg"),

  checkBtn: document.getElementById("checkBtn"),
  showBtn: document.getElementById("showBtn"),
  clearBtn: document.getElementById("clearBtn"),

  feedback: document.getElementById("feedback"),
};

const state = {
  mol: null,
  verifiedTotal: false,
  lockedCentral: false,
  totalVE: null,
  remaining: null,

  // placements
  bonds: new Map(), // key "a-b" sorted => order 0..3
  lonePairs: new Map(), // key "atomIndex:slotId" => 1 if occupied

  layout: null,
};

// ---------- Molecule selection ----------
function pickRandomMol(){
  const m = MOLECULES[Math.floor(Math.random()*MOLECULES.length)];
  loadMolecule(m);
}

function loadMolecule(mol){
  state.mol = mol;
  state.verifiedTotal = false;
  state.lockedCentral = false;
  state.totalVE = null;
  state.remaining = null;
  state.bonds.clear();
  state.lonePairs.clear();
  state.layout = null;

  els.molName.textContent = mol.formula;
  els.molPrompt.textContent = "Confirm total valence electrons, choose the central atom (if applicable), then build.";
  els.studentTotal.value = "";
  els.totalFeedback.className = "notice muted";
  els.totalFeedback.innerHTML = `Enter your total, then click <strong>Check</strong>.`;

  // bank hidden/unset
  els.bankTotal.textContent = "—";
  els.bankRemain.textContent = "—";
  els.bankLockedMsg.style.display = "block";

  // central UI
  els.centralSelect.innerHTML = `<option value="">Select…</option>`;
  els.centralSelect.disabled = true;
  els.lockCentralBtn.disabled = true;
  els.resetBtn.disabled = true;
  els.centralFeedback.className = "notice muted";
  els.centralFeedback.textContent = "Check the total electrons first.";

  // step 2 buttons
  els.checkBtn.disabled = true;
  els.showBtn.disabled = true;
  els.clearBtn.disabled = true;

  els.feedback.className = "feedback muted";
  els.feedback.textContent = "Lock a central atom to begin building.";

  // model placeholder
  els.model.innerHTML = `<div class="muted">Lock a central atom to begin building the model.</div>`;
  clearSvg();

  // populate possible central atoms after verify
}

els.newMolBtn.addEventListener("click", pickRandomMol);

// ---------- Electron total verification ----------
els.checkTotalBtn.addEventListener("click", () => {
  const entered = Number(els.studentTotal.value);
  if (!Number.isFinite(entered) || entered < 0){
    els.totalFeedback.className = "notice warn";
    els.totalFeedback.textContent = "Please enter a valid number.";
    return;
  }

  const correct = state.mol.totalVE ?? calcTotalVE(state.mol);
  if (entered === correct){
    state.verifiedTotal = true;
    state.totalVE = correct;
    state.remaining = correct;

    els.totalFeedback.className = "notice";
    els.totalFeedback.innerHTML = `✅ Nice. Total valence electrons confirmed: <strong>${correct}</strong>.`;

    els.bankLockedMsg.style.display = "none";
    renderBank();

    enableCentralSelection();
  } else {
    state.verifiedTotal = false;
    els.totalFeedback.className = "notice warn";
    els.totalFeedback.innerHTML = `Not quite. Try again. (Hint: add valence electrons for each atom in <strong>${state.mol.formula}</strong>.)`;
  }
});

function calcTotalVE(mol){
  return mol.atoms.reduce((sum, sym) => sum + (VE[sym] ?? 0), 0);
}

function enableCentralSelection(){
  // If diatomic or defined central=null, we treat as “no central”
  const mol = state.mol;

  els.centralSelect.disabled = false;
  els.lockCentralBtn.disabled = false;
  els.resetBtn.disabled = false;

  els.centralSelect.innerHTML = `<option value="">Select…</option>`;

  if (mol.atoms.length === 2){
    // no central
    els.centralSelect.innerHTML += `<option value="none">No central atom (diatomic)</option>`;
    els.centralSelect.value = "none";
    els.centralFeedback.className = "notice";
    els.centralFeedback.textContent = "This molecule is diatomic. Lock the structure to build the bond + lone pairs.";
  } else {
    // allow picking any non-H as central, and include the recommended one (if provided)
    mol.atoms.forEach((sym, i) => {
      const disabled = sym === "H" ? "disabled" : "";
      const tag = (mol.central === i) ? " (recommended)" : "";
      els.centralSelect.innerHTML += `<option value="${i}" ${disabled}>${sym} (atom ${i+1})${tag}</option>`;
    });
    els.centralFeedback.className = "notice";
    els.centralFeedback.textContent = "Choose the best central atom (H is never central), then lock it.";
  }
}

// ---------- Lock / Reset ----------
els.lockCentralBtn.addEventListener("click", () => {
  if (!state.verifiedTotal){
    els.centralFeedback.className = "notice warn";
    els.centralFeedback.textContent = "Confirm total valence electrons first.";
    return;
  }
  const v = els.centralSelect.value;
  if (!v){
    els.centralFeedback.className = "notice warn";
    els.centralFeedback.textContent = "Pick a central atom first.";
    return;
  }

  state.lockedCentral = true;

  els.checkBtn.disabled = false;
  els.showBtn.disabled = false;
  els.clearBtn.disabled = false;

  els.feedback.className = "feedback";
  els.feedback.textContent = "Drag bonds between atoms and lone pairs around atoms. Then click “Check molecule.”";

  buildModel();
});

els.resetBtn.addEventListener("click", () => {
  // reset everything for current molecule
  loadMolecule(state.mol);
});

els.clearBtn.addEventListener("click", () => {
  if (!state.lockedCentral) return;
  state.bonds.clear();
  state.lonePairs.clear();
  state.remaining = state.totalVE;
  renderBank();
  buildModel(); // rebuild to clear slots and svg
  els.feedback.className = "feedback";
  els.feedback.textContent = "Cleared. Rebuild, then check.";
});

// ---------- Drag + Drop from toolbox ----------
let dragPayload = null;

document.querySelectorAll(".tool").forEach(tool => {
  tool.addEventListener("dragstart", (e) => {
    const type = tool.dataset.type;
    dragPayload = {
      type,
      order: type === "bond" ? Number(tool.dataset.order) : null,
      cost: Number(tool.dataset.cost),
      label: tool.querySelector(".toolIcon")?.textContent?.trim() || ""
    };
    e.dataTransfer.setData("text/plain", JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = "copy";
  });
});

// ---------- Model building ----------
function buildModel(){
  const mol = state.mol;

  // compute layout positions for atoms and bond zones
  state.layout = makeLayout(mol);

  // render atoms + slots + bond zones
  els.model.innerHTML = "";
  clearSvg();

  const structure = document.createElement("div");
  structure.className = "structure";

  // atoms
  state.layout.atoms.forEach((pos, idx) => {
    const atom = document.createElement("div");
    atom.className = "atom";
    atom.style.left = `${pos.x}px`;
    atom.style.top  = `${pos.y}px`;
    atom.textContent = mol.atoms[idx];
    structure.appendChild(atom);

    // lone pair slots around atom
    const slots = ["top","right","bottom","left"];
    slots.forEach((slotName) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      const id = `${idx}:${slotName}`;

      // position around the atom
      const s = slotOffset(slotName);
      slot.style.left = `${pos.x + s.dx}px`;
      slot.style.top  = `${pos.y + s.dy}px`;

      const has = state.lonePairs.has(id);
      if (has){
        slot.classList.add("filled");
        slot.textContent = "••";
      } else {
        slot.innerHTML = `<div class="hint">drop</div>`;
      }

      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      });

      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!dragPayload || dragPayload.type !== "lp") return;
        if (state.lonePairs.has(id)) return; // already filled
        if (!spend(dragPayload.cost)) return;

        state.lonePairs.set(id, 1);
        renderBank();
        buildModel();
      });

      slot.addEventListener("click", () => {
        // remove lone pair if present
        if (!state.lonePairs.has(id)) return;
        state.lonePairs.delete(id);
        refund(2);
        renderBank();
        buildModel();
      });

      structure.appendChild(slot);
    });
  });

  // bond zones
  state.layout.bondZones.forEach((bz) => {
    const zone = document.createElement("div");
    const key = bondKey(bz.a, bz.b);
    const order = state.bonds.get(key) || 0;

    zone.className = "bondZone" + (order ? " filled" : "");
    zone.style.left = `${bz.x}px`;
    zone.style.top  = `${bz.y}px`;

    if (bz.vertical) zone.classList.add("vertical");

    if (order){
      zone.innerHTML = `<div class="label">${orderToSymbol(order)}</div>`;
    } else {
      zone.innerHTML = `<div class="hint">DROP<br>BOND</div>`;
    }

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragPayload || dragPayload.type !== "bond") return;

      const newOrder = dragPayload.order;
      const existing = state.bonds.get(key) || 0;

      // adjust bank based on difference
      const existingCost = orderCost(existing);
      const newCost = orderCost(newOrder);
      const delta = newCost - existingCost;

      if (delta > 0){
        if (!spend(delta)) return;
      } else if (delta < 0){
        refund(-delta);
      }

      state.bonds.set(key, newOrder);
      renderBank();
      buildModel();
    });

    zone.addEventListener("click", () => {
      // remove bond if present
      const existing = state.bonds.get(key) || 0;
      if (!existing) return;
      refund(orderCost(existing));
      state.bonds.delete(key);
      renderBank();
      buildModel();
    });

    structure.appendChild(zone);
  });

  els.model.appendChild(structure);

  // Draw bond lines as SVG for placed bonds
  drawBondLines();
}

function makeLayout(mol){
  // structure box is ~620 wide x 300 tall (see CSS)
  // We'll place central in middle; terminals around depending on count
  const w = 620, h = 300;
  const center = { x: (w/2)-28, y: (h/2)-28 }; // atom is 56x56
  const atoms = Array(mol.atoms.length).fill(null).map(() => ({x:0,y:0}));

  // decide central index
  let cIndex;
  const cSel = els.centralSelect.value;
  if (mol.atoms.length === 2){
    cIndex = 0; // treat atom 0 as left for layout
  } else if (cSel === "none"){
    cIndex = 0;
  } else {
    cIndex = Number(cSel);
  }

  // place central
  if (mol.atoms.length >= 3){
    atoms[cIndex] = {...center};
  }

  // For diatomic, place two atoms left/right
  if (mol.atoms.length === 2){
    atoms[0] = { x: (w/2)-140, y: (h/2)-28 };
    atoms[1] = { x: (w/2)+84,  y: (h/2)-28 };
    return {
      atoms,
      bondZones: [
        bondZoneBetween(0,1, atoms[0], atoms[1])
      ]
    };
  }

  // terminals list (if provided, else all except central)
  const terminals = mol.terminals ?? mol.atoms.map((_,i)=>i).filter(i=>i!==cIndex);

  // positions around central
  const offsets = (terminals.length === 2)
    ? [{dx:-170,dy:0},{dx:170,dy:0}] // linear-ish
    : (terminals.length === 3)
      ? [{dx:-170,dy:0},{dx:170,dy:0},{dx:0,dy:150}]
      : [{dx:-170,dy:0},{dx:170,dy:0},{dx:0,dy:-150},{dx:0,dy:150}];

  terminals.forEach((t,i)=>{
    atoms[t] = { x: center.x + offsets[i].dx, y: center.y + offsets[i].dy };
  });

  // bond zones between central and terminals (one per connection)
  const bondZones = terminals.map((t)=> bondZoneBetween(cIndex, t, atoms[cIndex], atoms[t]));

  return { atoms, bondZones };
}

function bondZoneBetween(a, b, pA, pB){
  const midX = (pA.x + pB.x)/2;
  const midY = (pA.y + pB.y)/2;

  // if mostly vertical, rotate tile
  const vertical = Math.abs((pA.y - pB.y)) > Math.abs((pA.x - pB.x));

  return {
    a, b,
    x: midX + 14, // nudge since atom top-left used
    y: midY + 6,
    vertical
  };
}

function slotOffset(name){
  // relative to atom top-left
  switch(name){
    case "top": return {dx:7,  dy:-30};
    case "right": return {dx:56, dy:13};
    case "bottom": return {dx:7, dy:56};
    case "left": return {dx:-42, dy:13};
  }
  return {dx:0,dy:0};
}

function bondKey(a,b){
  return (a<b) ? `${a}-${b}` : `${b}-${a}`;
}
function orderToSymbol(order){
  if (order===1) return "—";
  if (order===2) return "=";
  if (order===3) return "≡";
  return "";
}
function orderCost(order){
  if (order===1) return 2;
  if (order===2) return 4;
  if (order===3) return 6;
  return 0;
}

// ---------- Bank ----------
function renderBank(){
  els.bankTotal.textContent = String(state.totalVE);
  els.bankRemain.textContent = String(state.remaining);
}

function spend(n){
  if (state.remaining == null) return false;
  if (state.remaining - n < 0){
    els.feedback.className = "feedback bad";
    els.feedback.textContent = "You don’t have enough electrons left in your bank for that move. Remove something first.";
    return false;
  }
  state.remaining -= n;
  return true;
}

function refund(n){
  if (state.remaining == null) return;
  state.remaining += n;
}

// ---------- SVG bond lines ----------
function clearSvg(){
  while (els.bondSvg.firstChild) els.bondSvg.removeChild(els.bondSvg.firstChild);
}

function drawBondLines(){
  clearSvg();
  const mol = state.mol;
  const layout = state.layout;
  if (!layout) return;

  // bonds exist only for defined bond zones
  layout.bondZones.forEach((bz) => {
    const key = bondKey(bz.a, bz.b);
    const order = state.bonds.get(key) || 0;
    if (!order) return;

    const a = layout.atoms[bz.a];
    const b = layout.atoms[bz.b];

    // atom centers
    const x1 = a.x + 28;
    const y1 = a.y + 28;
    const x2 = b.x + 28;
    const y2 = b.y + 28;

    // draw 1-3 parallel lines
    const lines = bondLineCoords(x1,y1,x2,y2,order);

    lines.forEach(({ax,ay,bx,by})=>{
      const line = document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1", ax);
      line.setAttribute("y1", ay);
      line.setAttribute("x2", bx);
      line.setAttribute("y2", by);
      line.setAttribute("stroke", "#8C1D40");
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      els.bondSvg.appendChild(line);
    });
  });
}

function bondLineCoords(x1,y1,x2,y2,order){
  // perpendicular offset for parallel lines
  const dx = x2-x1, dy = y2-y1;
  const len = Math.max(1, Math.hypot(dx,dy));
  const ux = dx/len, uy = dy/len;
  // perpendicular unit
  const px = -uy, py = ux;

  const spacing = 6;
  if (order === 1){
    return [{ax:x1,ay:y1,bx:x2,by:y2}];
  }
  if (order === 2){
    return [
      {ax:x1+px*spacing, ay:y1+py*spacing, bx:x2+px*spacing, by:y2+py*spacing},
      {ax:x1-px*spacing, ay:y1-py*spacing, bx:x2-px*spacing, by:y2-py*spacing},
    ];
  }
  // triple
  return [
    {ax:x1,ay:y1,bx:x2,by:y2},
    {ax:x1+px*spacing*1.4, ay:y1+py*spacing*1.4, bx:x2+px*spacing*1.4, by:y2+py*spacing*1.4},
    {ax:x1-px*spacing*1.4, ay:y1-py*spacing*1.4, bx:x2-px*spacing*1.4, by:y2-py*spacing*1.4},
  ];
}

// ---------- Checking ----------
els.checkBtn.addEventListener("click", () => {
  if (!state.lockedCentral) return;
  const result = checkCurrent();
  showCheckFeedback(result);
});

els.showBtn.addEventListener("click", () => {
  if (!state.lockedCentral) return;
  applyCorrectModel();
});

function checkCurrent(){
  const mol = state.mol;
  const layout = state.layout;

  // electron usage check
  const spent = state.totalVE - state.remaining;

  // determine bond orders for expected connections
  const expectedBonds = mol.bonds.map(([a,b,o]) => ({a,b,o}));

  // actual bonds on expected edges
  let bondMismatch = false;
  expectedBonds.forEach(({a,b,o})=>{
    const actual = state.bonds.get(bondKey(a,b)) || 0;
    if (actual !== o) bondMismatch = true;
  });

  // connectivity check: every atom should have at least one bond unless it's diatomic/hydrogen special
  let disconnected = false;
  const bondCountByAtom = Array(mol.atoms.length).fill(0);
  expectedBonds.forEach(({a,b})=>{
    const actual = state.bonds.get(bondKey(a,b)) || 0;
    if (actual>0){
      bondCountByAtom[a] += actual;
      bondCountByAtom[b] += actual;
    }
  });
  for (let i=0;i<mol.atoms.length;i++){
    if (mol.atoms.length===1) continue;
    if (bondCountByAtom[i]===0) disconnected = true;
  }

  // octet/duet check based on placed bonds + lone pairs
  const lpCountByAtom = Array(mol.atoms.length).fill(0);
  state.lonePairs.forEach((_, key)=>{
    const [ai] = key.split(":");
    lpCountByAtom[Number(ai)] += 1;
  });

  // approximate electrons around each atom:
  // each bond order contributes 2 electrons shared; count “ownership” as bondOrder*2 per atom side (Lewis check style)
  // plus lone pairs *2 electrons
  const eAround = Array(mol.atoms.length).fill(0);
  expectedBonds.forEach(({a,b})=>{
    const actual = state.bonds.get(bondKey(a,b)) || 0;
    eAround[a] += actual*2;
    eAround[b] += actual*2;
  });
  for (let i=0;i<mol.atoms.length;i++){
    eAround[i] += lpCountByAtom[i]*2;
  }

  let outerShellIssue = false;
  for (let i=0;i<mol.atoms.length;i++){
    const sym = mol.atoms[i];
    const need = neededElectrons(sym);
    if (eAround[i] !== need) outerShellIssue = true;
  }

  // remaining electrons sanity
  const overSpent = state.remaining < 0;
  const leftover = state.remaining > 0;

  const correct =
    !bondMismatch &&
    !disconnected &&
    !outerShellIssue &&
    !overSpent &&
    state.remaining === 0;

  return {
    correct,
    bondMismatch,
    disconnected,
    outerShellIssue,
    overSpent,
    leftover,
    remaining: state.remaining,
    spent
  };
}

function showCheckFeedback(r){
  if (r.correct){
    els.feedback.className = "feedback good";
    els.feedback.innerHTML = `✅ <strong>Nice!</strong> This structure matches the target and uses the full electron bank.`;
    return;
  }

  // Student-friendly, non-giveaway diagnostics
  const bullets = [];

  if (r.overSpent){
    bullets.push("You spent more electrons than you have. Remove a bond or lone pair.");
  } else if (r.leftover){
    bullets.push(`You still have <strong>${r.remaining}</strong> electrons left. Use them as lone pairs after your skeleton is connected.`);
  }

  if (r.disconnected){
    bullets.push("One or more atoms are not connected by a bond yet. Make sure every atom is attached to the structure.");
  }

  if (r.bondMismatch){
    bullets.push("At least one bond type (single/double/triple) doesn’t match what this molecule needs. Re-check whether any bond should be stronger or weaker.");
  }

  if (r.outerShellIssue){
    bullets.push("Some atoms do not have a full outer shell yet (H needs 2, most others need 8). Adjust bonds and/or lone pairs.");
  }

  // If none triggered (rare), generic
  if (!bullets.length){
    bullets.push("Something is off. Re-check connectivity, bond types, and outer shells.");
  }

  els.feedback.className = "feedback bad";
  els.feedback.innerHTML = `❌ <strong>Not yet — you’re close.</strong><ul class="bullets">${bullets.map(b=>`<li>${b}</li>`).join("")}</ul>`;
}

function applyCorrectModel(){
  const mol = state.mol;

  // reset placements + bank to total
  state.bonds.clear();
  state.lonePairs.clear();
  state.remaining = state.totalVE;

  // apply correct bond orders
  mol.bonds.forEach(([a,b,o])=>{
    state.bonds.set(bondKey(a,b), o);
    state.remaining -= orderCost(o);
  });

  // apply correct lone pairs using up to 4 slots per atom (top/right/bottom/left)
  const slotOrder = ["top","right","bottom","left"];
  Object.entries(mol.lonePairs).forEach(([ai, lp])=>{
    const atomIndex = Number(ai);
    for (let i=0;i<lp;i++){
      const slotName = slotOrder[i % 4];
      state.lonePairs.set(`${atomIndex}:${slotName}`, 1);
      state.remaining -= 2;
    }
  });

  renderBank();
  buildModel();
  els.feedback.className = "feedback";
  els.feedback.textContent = "Correct model shown. Try a new molecule when ready.";
}

// ---------- init ----------
pickRandomMol();
