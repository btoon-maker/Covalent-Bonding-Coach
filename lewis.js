/* Covalent Bonding Coach - Lewis model builder
   - Bonds drop ONLY between connected atoms (one drop zone per connection)
   - Lone pairs are "••" placed in BOXES around atoms
   - Lone-pair slots do NOT appear on the bond-facing side (fixes F2 left lone pair beside bond)
   - Skeleton does not show until total electrons correct + central locked (or diatomic option)
*/

const COST = { single: 2, double: 4, triple: 6, lone: 2 };
const BOND_GLYPH = { single: "—", double: "=", triple: "≡" };

const MOLECULES = [
  // diatomics
  makeDiatomic("F2", ["F","F"], 14, { bond:"single", lp:[3,3] }),
  makeDiatomic("O2", ["O","O"], 12, { bond:"double", lp:[2,2] }),
  makeDiatomic("N2", ["N","N"], 10, { bond:"triple", lp:[1,1] }),
  makeDiatomic("H2", ["H","H"], 2,  { bond:"single", lp:[0,0] }),
  makeDiatomic("Br2",["Br","Br"],14,{ bond:"single", lp:[3,3] }),

  // linear / small
  makeLinear3("HF", ["H","F"], 8, { bond:"single", lpRight:3 }),
  makeLinear3("CO2", ["O","C","O"], 16, { bonds:["double","double"], lp:[2,0,2] }),
  makeLinear3("HCN", ["H","C","N"], 10, { bonds:["single","triple"], lp:[0,0,1] }),

  // central-atom structures
  makeCentral4("CF4",  ["C","F","F","F","F"], 32, { bonds:["single","single","single","single"], lpTerm:3, lpCentral:0 }),
  makeCentral4("CBr4", ["C","Br","Br","Br","Br"], 32, { bonds:["single","single","single","single"], lpTerm:3, lpCentral:0 }),
  makeCentral3("PF3",  ["P","F","F","F"], 26, { bonds:["single","single","single"], lpTerm:3, lpCentral:1 }),
  makeCentral3("NH3",  ["N","H","H","H"], 8,  { bonds:["single","single","single"], lpTerm:0, lpCentral:1 }),
  makeCentral2("H2O",  ["O","H","H"], 8,  { bonds:["single","single"], lpTerm:0, lpCentral:2 }),
];

function makeDiatomic(name, atoms, totalE, spec){
  return {
    name,
    atoms,
    totalE,
    type:"diatomic",
    centralOptions:["No central atom (diatomic)", ...atoms],
    target:{
      connections:[{a:0,b:1,bond:spec.bond}],
      lonePairs:[spec.lp[0], spec.lp[1]],
    }
  };
}

function makeLinear3(name, atoms, totalE, spec){
  // if atoms length 2 (HF), treat as diatomic layout but with "No central atom" option
  if(atoms.length === 2){
    return {
      name,
      atoms,
      totalE,
      type:"diatomic",
      centralOptions:["No central atom (diatomic)", ...atoms],
      target:{
        connections:[{a:0,b:1,bond:spec.bond || "single"}],
        lonePairs:[0, spec.lpRight ?? 3]
      }
    };
  }
  // 3-atom linear
  return {
    name,
    atoms,
    totalE,
    type:"linear3",
    centralOptions:[...atoms], // all options
    target:{
      connections:[
        {a:0,b:1,bond:spec.bonds[0]},
        {a:1,b:2,bond:spec.bonds[1]},
      ],
      lonePairs: spec.lp,
    }
  };
}

function makeCentral4(name, atoms, totalE, spec){
  // atoms[0] intended central (but students can choose any)
  return {
    name,
    atoms,
    totalE,
    type:"central4",
    centralOptions:[...atoms], // all options
    target:{
      intendedCentral:0,
      connections:[
        {a:0,b:1,bond:spec.bonds[0]},
        {a:0,b:2,bond:spec.bonds[1]},
        {a:0,b:3,bond:spec.bonds[2]},
        {a:0,b:4,bond:spec.bonds[3]},
      ],
      lonePairs: [
        spec.lpCentral,
        spec.lpTerm, spec.lpTerm, spec.lpTerm, spec.lpTerm
      ]
    }
  };
}

function makeCentral3(name, atoms, totalE, spec){
  return {
    name,
    atoms,
    totalE,
    type:"central3",
    centralOptions:[...atoms],
    target:{
      intendedCentral:0,
      connections:[
        {a:0,b:1,bond:spec.bonds[0]},
        {a:0,b:2,bond:spec.bonds[1]},
        {a:0,b:3,bond:spec.bonds[2]},
      ],
      lonePairs:[
        spec.lpCentral,
        spec.lpTerm, spec.lpTerm, spec.lpTerm
      ]
    }
  };
}

function makeCentral2(name, atoms, totalE, spec){
  return {
    name,
    atoms,
    totalE,
    type:"central2",
    centralOptions:[...atoms],
    target:{
      intendedCentral:0,
      connections:[
        {a:0,b:1,bond:spec.bonds[0]},
        {a:0,b:2,bond:spec.bonds[1]},
      ],
      lonePairs:[
        spec.lpCentral,
        spec.lpTerm, spec.lpTerm
      ]
    }
  };
}

/* ---------- DOM ---------- */

const el = {
  btnNew: document.getElementById("btnNew"),
  molName: document.getElementById("molName"),
  molHint: document.getElementById("molHint"),

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

  btnCheckMol: document.getElementById("btnCheckMol"),
  btnShowCorrect: document.getElementById("btnShowCorrect"),
  btnClear: document.getElementById("btnClear"),

  stage: document.getElementById("modelStage"),
  feedback: document.getElementById("feedback"),
};

let state = {
  mol: null,
  valenceConfirmed: false,
  lockedCentral: false,
  chosenCentralIndex: null,
  bankTotal: 0,
  bankRemain: 0,
  // placements:
  bondPlaced: {}, // key "a-b" => "single|double|triple"
  lonePlaced: {}, // atomIndex => {top:boolean,right:boolean,bottom:boolean,left:boolean} as "••"
  showCorrect: false
};

function init(){
  wireToolboxDrag();
  el.btnNew.addEventListener("click", pickRandomMolecule);
  el.btnCheckValence.addEventListener("click", checkValence);
  el.btnLockCentral.addEventListener("click", lockCentral);
  el.btnReset.addEventListener("click", resetBuild);
  el.btnClear.addEventListener("click", clearPlacements);
  el.btnCheckMol.addEventListener("click", checkMolecule);
  el.btnShowCorrect.addEventListener("click", showCorrectModel);

  pickRandomMolecule();
}

function pickRandomMolecule(){
  const mol = MOLECULES[Math.floor(Math.random() * MOLECULES.length)];
  loadMolecule(mol);
}

function loadMolecule(mol){
  state.mol = mol;
  state.valenceConfirmed = false;
  state.lockedCentral = false;
  state.chosenCentralIndex = null;
  state.bankTotal = 0;
  state.bankRemain = 0;
  state.bondPlaced = {};
  state.lonePlaced = {};
  state.showCorrect = false;

  el.molName.textContent = formatFormula(mol.name);
  el.molHint.textContent = "Confirm electrons, choose a central atom, then build.";

  el.valenceInput.value = "";
  hideMsg(el.valenceMsg);

  // central select
  el.centralSelect.innerHTML = `<option value="">Select…</option>`;
  (mol.centralOptions || mol.atoms).forEach((opt, idx) => {
    const o = document.createElement("option");
    o.value = String(idx);
    o.textContent = opt.includes("No central") ? opt : `${opt} (atom ${idx+1})`;
    el.centralSelect.appendChild(o);
  });
  el.centralSelect.disabled = true;
  el.btnLockCentral.disabled = true;

  // buttons disabled until ready
  el.btnCheckMol.disabled = true;
  el.btnShowCorrect.disabled = true;
  el.btnClear.disabled = true;

  // bank
  el.bankTotal.textContent = "—";
  el.bankRemain.textContent = "—";
  el.bankMsg.style.display = "block";
  el.bankMsg.className = "msg msg-warn";
  el.bankMsg.textContent = "Electron bank will appear after you correctly confirm the total valence electrons.";

  el.centralMsg.className = "msg msg-neutral";
  el.centralMsg.textContent = "Check the total electrons first.";

  // stage placeholder
  el.stage.innerHTML = `<div class="stage-placeholder muted">Confirm total valence electrons and lock the central atom to begin.</div>`;

  hideFeedback();
}

function formatFormula(s){
  // simple formatting: digits to subscript
  return s.replace(/(\d+)/g, "<sub>$1</sub>");
}

/* ---------- Step 1 ---------- */

function showMsg(container, kind, text){
  container.style.display = "block";
  container.className = `msg ${kind}`;
  container.textContent = text;
}
function hideMsg(container){
  container.style.display = "none";
  container.textContent = "";
}

function checkValence(){
  const entered = Number(el.valenceInput.value);
  if(!Number.isFinite(entered) || entered <= 0){
    showMsg(el.valenceMsg, "msg-warn", "Enter a positive whole number.");
    return;
  }
  const correct = state.mol.totalE;

  if(entered === correct){
    state.valenceConfirmed = true;
    showMsg(el.valenceMsg, "msg-good", `Correct. ${correct} total valence electrons.`);
    // enable central selection
    el.centralSelect.disabled = false;
    el.btnLockCentral.disabled = false;

    // show bank
    state.bankTotal = correct;
    state.bankRemain = correct;
    el.bankTotal.textContent = String(correct);
    el.bankRemain.textContent = String(correct);
    el.bankMsg.style.display = "block";
    el.bankMsg.className = "msg msg-good";
    el.bankMsg.textContent = "Nice. Now choose and lock the central atom to reveal the model.";

    el.centralMsg.className = "msg msg-neutral";
    el.centralMsg.textContent = "Choose a central atom, then click “Lock central atom.”";
  } else {
    state.valenceConfirmed = false;
    showMsg(el.valenceMsg, "msg-warn", `Not quite. Try again. (Hint: add valence electrons for each atom in ${state.mol.name}.)`);
  }
}

function lockCentral(){
  if(!state.valenceConfirmed) return;

  const v = el.centralSelect.value;
  if(v === ""){
    el.centralMsg.className = "msg msg-warn";
    el.centralMsg.textContent = "Pick an option from the dropdown first.";
    return;
  }

  // For diatomic molecules, option 0 is "No central atom (diatomic)"
  // For others, index is actual atom index
  if(state.mol.type === "diatomic"){
    if(v === "0"){
      state.chosenCentralIndex = null; // no central
    } else {
      state.chosenCentralIndex = Number(v) - 1;
    }
  } else {
    state.chosenCentralIndex = Number(v);
  }

  state.lockedCentral = true;

  el.centralMsg.className = "msg msg-good";
  el.centralMsg.textContent =
    state.chosenCentralIndex === null
      ? "Central atom locked: No central atom. Now build the model."
      : `Central atom locked: ${state.mol.atoms[state.chosenCentralIndex]}. Now build the model.`;

  // enable step 2 buttons
  el.btnCheckMol.disabled = false;
  el.btnShowCorrect.disabled = false;
  el.btnClear.disabled = false;

  // render model skeleton
  renderModel();
  hideFeedback();
}

function resetBuild(){
  // keep same molecule, reset everything
  loadMolecule(state.mol);
}

/* ---------- Drag/drop plumbing ---------- */

function wireToolboxDrag(){
  document.querySelectorAll(".tool").forEach(tool => {
    tool.addEventListener("dragstart", (e) => {
      const item = tool.dataset.item;
      e.dataTransfer.setData("text/plain", item);
      e.dataTransfer.effectAllowed = "copy";
    });
  });
}

function allowDrop(zone){
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
}

function handleDropInto(zone, kind){
  // kind: "bond" or "lone"
  return (e) => {
    e.preventDefault();
    const item = e.dataTransfer.getData("text/plain"); // single/double/triple/lone

    if(kind === "bond"){
      if(!["single","double","triple"].includes(item)) return;
      placeBond(zone, item);
    } else if(kind === "lone"){
      if(item !== "lone") return;
      placeLonePair(zone);
    }
  };
}

function spend(cost){
  if(state.bankRemain - cost < 0) return false;
  state.bankRemain -= cost;
  el.bankRemain.textContent = String(state.bankRemain);
  return true;
}
function refund(cost){
  state.bankRemain += cost;
  el.bankRemain.textContent = String(state.bankRemain);
}

/* ---------- Model rendering ---------- */

function clearPlacements(){
  if(!state.lockedCentral) return;
  state.bondPlaced = {};
  state.lonePlaced = {};
  state.bankRemain = state.bankTotal;
  el.bankRemain.textContent = String(state.bankRemain);
  state.showCorrect = false;
  renderModel();
  hideFeedback();
}

function showCorrectModel(){
  if(!state.lockedCentral) return;
  state.showCorrect = true;

  // Fill placements to target
  state.bondPlaced = {};
  state.lonePlaced = {};
  state.bankRemain = state.bankTotal;

  const t = state.mol.target;
  t.connections.forEach(conn => {
    const key = bondKey(conn.a, conn.b);
    state.bondPlaced[key] = conn.bond;
    state.bankRemain -= COST[conn.bond];
  });

  t.lonePairs.forEach((count, idx) => {
    // place as many lone pairs as slots allow (should be enough for our layouts)
    state.lonePlaced[idx] = { top:false,right:false,bottom:false,left:false };
    const order = ["top","bottom","left","right"];
    let placed = 0;
    for(const pos of order){
      if(placed >= count) break;
      if(canHaveLoneSlot(idx, pos)){
        state.lonePlaced[idx][pos] = true;
        state.bankRemain -= COST.lone;
        placed++;
      }
    }
  });

  el.bankRemain.textContent = String(state.bankRemain);
  renderModel();
  hideFeedback();
}

function renderModel(){
  if(!state.lockedCentral){
    el.stage.innerHTML = `<div class="stage-placeholder muted">Confirm total valence electrons and lock the central atom to begin.</div>`;
    return;
  }

  el.stage.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "model-wrap";
  el.stage.appendChild(wrap);

  const atoms = state.mol.atoms;

  // positions depend on type + chosen central (students can choose wrong — still render)
  const layout = computeLayout(state.mol, state.chosenCentralIndex);

  // atoms
  const atomEls = atoms.map((sym, i) => {
    const a = document.createElement("div");
    a.className = "atom";
    a.style.left = layout.atoms[i].x + "px";
    a.style.top = layout.atoms[i].y + "px";
    a.textContent = sym;
    wrap.appendChild(a);

    // lone slots
    addLonePairSlots(a, i, layout.blockLoneSide[i]);
    return a;
  });

  // bond zones (one per connection)
  layout.bonds.forEach(bz => {
    const z = document.createElement("div");
    z.className = "bondzone";
    z.style.left = bz.x + "px";
    z.style.top = bz.y + "px";
    z.dataset.a = String(bz.a);
    z.dataset.b = String(bz.b);

    const key = bondKey(bz.a, bz.b);
    const placed = state.bondPlaced[key];
    if(placed){
      z.classList.add("filled");
      z.innerHTML = `<span class="bond-glyph">${BOND_GLYPH[placed]}</span>`;
    } else {
      z.textContent = "DROP BOND";
    }

    allowDrop(z);
    z.addEventListener("drop", handleDropInto(z, "bond"));

    // click to remove
    z.addEventListener("click", () => {
      const k = bondKey(Number(z.dataset.a), Number(z.dataset.b));
      const cur = state.bondPlaced[k];
      if(cur){
        delete state.bondPlaced[k];
        refund(COST[cur]);
        renderModel();
      }
    });

    wrap.appendChild(z);
  });

  // Fill lone pair slots from state
  atoms.forEach((sym, idx) => {
    const lp = state.lonePlaced[idx] || {top:false,right:false,bottom:false,left:false};
    const atomEl = atomEls[idx];
    atomEl.querySelectorAll(".lp-slot").forEach(slot => {
      const pos = slot.dataset.pos;
      if(lp[pos]){
        slot.classList.add("filled");
        slot.textContent = "••";
      } else {
        slot.classList.remove("filled");
        slot.textContent = ""; // cleaner
      }
    });
  });
}

function addLonePairSlots(atomEl, atomIndex, blockSide){
  // Hydrogen: no lone pair slots
  if(state.mol.atoms[atomIndex] === "H") return;

  // clear if re-render
  atomEl.querySelectorAll(".lp-slot").forEach(n => n.remove());

  const positions = ["top","right","bottom","left"].filter(p => p !== blockSide);

  positions.forEach(pos => {
    const slot = document.createElement("div");
    slot.className = `lp-slot lp-${pos}`;
    slot.dataset.type = "lone";
    slot.dataset.atom = String(atomIndex);
    slot.dataset.pos = pos;

    allowDrop(slot);
    slot.addEventListener("drop", handleDropInto(slot, "lone"));

    // click to remove
    slot.addEventListener("click", () => {
      const a = Number(slot.dataset.atom);
      const p = slot.dataset.pos;
      if(state.lonePlaced[a]?.[p]){
        state.lonePlaced[a][p] = false;
        refund(COST.lone);
        renderModel();
      }
    });

    atomEl.appendChild(slot);
  });
}

function placeBond(zone, bondType){
  const a = Number(zone.dataset.a);
  const b = Number(zone.dataset.b);
  const key = bondKey(a,b);

  // if already filled, do nothing
  if(state.bondPlaced[key]) return;

  const cost = COST[bondType];
  if(!spend(cost)) {
    showFeedback("warn", "Not enough electrons left", [
      "Your electron bank is too low for that placement.",
      "Try removing something or re-check your total electrons."
    ]);
    return;
  }

  state.bondPlaced[key] = bondType;
  renderModel();
}

function placeLonePair(slot){
  const a = Number(slot.dataset.atom);
  const p = slot.dataset.pos;

  if(!state.lonePlaced[a]) state.lonePlaced[a] = {top:false,right:false,bottom:false,left:false};
  if(state.lonePlaced[a][p]) return;

  if(!spend(COST.lone)){
    showFeedback("warn", "Not enough electrons left", [
      "Your electron bank is too low for that placement.",
      "Try removing something first."
    ]);
    return;
  }

  state.lonePlaced[a][p] = true;
  renderModel();
}

function bondKey(a,b){
  const x = Math.min(a,b);
  const y = Math.max(a,b);
  return `${x}-${y}`;
}

/* ---------- Layout logic ---------- */

function computeLayout(mol, chosenCentralIdx){
  // returns { atoms:[{x,y}], bonds:[{a,b,x,y}], blockLoneSide:[side|null per atom] }
  const atoms = mol.atoms;
  const w = 760; // virtual stage width for positions (CSS scales via container)
  const h = 320;

  // base center
  const cx = 340;
  const cy = 140;

  // map indices based on chosen central (students can pick wrong)
  // We'll still use intended layouts but place "chosen" as central where possible.
  // If diatomic, ignore.
  let central = chosenCentralIdx;
  if(mol.type !== "diatomic" && (central === null || central === undefined || Number.isNaN(central))){
    central = 0;
  }

  const atomPos = atoms.map(()=>({x:0,y:0}));
  const bonds = [];
  const block = atoms.map(()=>null);

  if(mol.type === "diatomic"){
    // two atoms left/right, one bondzone between
    atomPos[0] = { x: 170, y: 125 };
    atomPos[1] = { x: 470, y: 125 };

    // bond zone between
    bonds.push({ a:0, b:1, x: 300, y: 132 });

    // block lone-pair slots on bond-facing side
    // left atom bond-facing side is right; right atom bond-facing side is left
    block[0] = "right";
    block[1] = "left";
    // Hydrogen: doesn't matter, addLonePairSlots skips H
    return { atoms: atomPos, bonds, blockLoneSide:block };
  }

  if(mol.type === "linear3"){
    // three atoms in a line
    atomPos[0] = { x: 150, y: 125 };
    atomPos[1] = { x: 340, y: 125 };
    atomPos[2] = { x: 530, y: 125 };

    bonds.push({ a:0, b:1, x: 240, y: 132 });
    bonds.push({ a:1, b:2, x: 430, y: 132 });

    // bond-facing blocks
    block[0] = "right";
    block[1] = null; // middle can have lone pairs top/bottom (we’ll block none; OK for CO2/HCN typical)
    block[2] = "left";
    return { atoms: atomPos, bonds, blockLoneSide:block };
  }

  if(mol.type === "central2"){
    // central with two terminals left/right
    const c = central;
    const terminals = atoms.map((_,i)=>i).filter(i=>i!==c);

    atomPos[c] = { x: 340, y: 125 };
    // place terminals left/right
    atomPos[terminals[0]] = { x: 170, y: 125 };
    atomPos[terminals[1]] = { x: 510, y: 125 };

    bonds.push({ a:c, b:terminals[0], x: 250, y: 132 });
    bonds.push({ a:c, b:terminals[1], x: 420, y: 132 });

    // block terminal sides facing central
    block[terminals[0]] = "right";
    block[terminals[1]] = "left";
    // block central left+right? No — central needs lone pairs (H2O), so keep top/bottom available
    // We DO block nothing on central so students have room.
    return { atoms: atomPos, bonds, blockLoneSide:block };
  }

  if(mol.type === "central3"){
    // trig layout: central middle, terminals left/right/bottom (leaves top for central lone pair)
    const c = central;
    const terminals = atoms.map((_,i)=>i).filter(i=>i!==c);

    atomPos[c] = { x: 340, y: 120 };
    atomPos[terminals[0]] = { x: 190, y: 180 };
    atomPos[terminals[1]] = { x: 490, y: 180 };
    atomPos[terminals[2]] = { x: 340, y: 240 };

    bonds.push({ a:c, b:terminals[0], x: 255, y: 156 });
    bonds.push({ a:c, b:terminals[1], x: 425, y: 156 });
    bonds.push({ a:c, b:terminals[2], x: 340, y: 186 });

    // block terminal sides facing central (approx)
    block[terminals[0]] = "right";
    block[terminals[1]] = "left";
    block[terminals[2]] = "top";
    return { atoms: atomPos, bonds, blockLoneSide:block };
  }

  if(mol.type === "central4"){
    // cross layout: central in middle, four terminals up/down/left/right
    const c = central;
    const terminals = atoms.map((_,i)=>i).filter(i=>i!==c);

    atomPos[c] = { x: 340, y: 135 };

    // assign terminals: up, right, down, left
    const tUp = terminals[0], tRight = terminals[1], tDown = terminals[2], tLeft = terminals[3];
    atomPos[tUp]   = { x: 340, y: 40 };
    atomPos[tRight]= { x: 530, y: 135 };
    atomPos[tDown] = { x: 340, y: 230 };
    atomPos[tLeft] = { x: 150, y: 135 };

    bonds.push({ a:c, b:tUp,    x: 340, y: 88 });
    bonds.push({ a:c, b:tRight, x: 430, y: 142 });
    bonds.push({ a:c, b:tDown,  x: 340, y: 182 });
    bonds.push({ a:c, b:tLeft,  x: 240, y: 142 });

    // block terminal sides facing central
    block[tUp] = "bottom";
    block[tDown] = "top";
    block[tLeft] = "right";
    block[tRight] = "left";
    return { atoms: atomPos, bonds, blockLoneSide:block };
  }

  // fallback
  atomPos.forEach((p,i)=>{ p.x = 140 + i*90; p.y = 125; });
  return { atoms: atomPos, bonds, blockLoneSide:block };
}

function canHaveLoneSlot(atomIndex, pos){
  if(state.mol.atoms[atomIndex] === "H") return false;
  const layout = computeLayout(state.mol, state.chosenCentralIndex);
  const block = layout.blockLoneSide[atomIndex];
  return block !== pos;
}

/* ---------- Checking ---------- */

function checkMolecule(){
  if(!state.lockedCentral) return;

  const t = state.mol.target;

  // structure check
  const bondIssues = [];
  t.connections.forEach(conn => {
    const key = bondKey(conn.a, conn.b);
    const placed = state.bondPlaced[key] || null;
    if(placed !== conn.bond){
      bondIssues.push({a:conn.a,b:conn.b});
    }
  });

  // lone pair counts check
  const loneIssues = [];
  for(let i=0;i<t.lonePairs.length;i++){
    const need = t.lonePairs[i];
    const have = countLonePairs(i);
    if(have !== need){
      loneIssues.push(i);
    }
  }

  const structureRight = bondIssues.length === 0 && loneIssues.length === 0;
  const bankRight = (state.bankRemain === 0);

  if(structureRight && bankRight){
    showFeedback("good", "Nice work!", [
      "Your bonds and lone pairs match a typical Lewis structure for this molecule.",
      "Your electron bank is at 0 (all valence electrons are accounted for)."
    ]);
    return;
  }

  // Friendly, non-spoiler feedback:
  const tips = [];

  if(!bankRight){
    if(state.bankRemain > 0){
      tips.push(`You still have <b>${state.bankRemain}</b> electron(s) left in the bank. That usually means a missing bond or missing lone pair(s).`);
    } else {
      tips.push("Your electron bank went below 0 — that means too many electrons were spent. Remove something and try again.");
    }
  }

  if(bondIssues.length > 0){
    const names = bondIssues.slice(0,2).map(x => `${state.mol.atoms[x.a]}–${state.mol.atoms[x.b]}`);
    tips.push(`Re-check the <b>bond type</b> between: <b>${names.join(", ")}</b>. (Single vs double vs triple.)`);
    tips.push("Tip: build the skeleton (single bonds) first, then upgrade bond order if needed.");
  }

  if(loneIssues.length > 0){
    tips.push("Re-check <b>lone pairs</b>. Focus on the <b>outer atoms</b> first (not the central atom).");
    tips.push("Tip: halogens usually want 3 lone pairs; oxygen often wants 2; nitrogen often wants 1.");
  }

  // central atom choice coaching (doesn't reveal solution)
  if(state.mol.type !== "diatomic" && state.mol.target.intendedCentral !== undefined){
    if(state.chosenCentralIndex !== state.mol.target.intendedCentral){
      tips.push("Double-check your <b>central atom</b> choice. The central atom is usually the one that can make the most connections (and is not hydrogen).");
    }
  }

  showFeedback("bad", "Not yet — keep going.", tips);
}

function countLonePairs(atomIndex){
  const lp = state.lonePlaced[atomIndex];
  if(!lp) return 0;
  return ["top","right","bottom","left"].reduce((acc,p)=>acc + (lp[p] ? 1 : 0), 0);
}

/* ---------- Feedback UI ---------- */

function showFeedback(kind, title, bullets){
  el.feedback.style.display = "block";
  el.feedback.className = `feedback ${kind}`;
  el.feedback.innerHTML = `
    <h4>${title}</h4>
    <ul>${bullets.map(b=>`<li>${b}</li>`).join("")}</ul>
  `;
}
function hideFeedback(){
  el.feedback.style.display = "none";
  el.feedback.innerHTML = "";
}

/* ---------- Start ---------- */
init();
