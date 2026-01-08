// Covalent Bonding Coach — clean, stable model builder
// Key guarantees:
// 1) Only ONE bond drop zone between connected atoms.
// 2) Model does NOT appear until electrons confirmed + central atom locked.
// 3) Lone pairs are placed as PAIRS (••) into LP drop boxes.
// 4) Hydrogen has no lone-pair boxes.
// 5) Friendly feedback that doesn't give away the full fix.

const VALENCE = { H:1, F:7, Cl:7, Br:7, C:4, N:5, O:6, P:5 };
const COST = { bond1:2, bond2:4, bond3:6, lp:2 };

const MOLECULES = [
  // Diatomic
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

  // HF (linear, no central "choice" needed but we still let them lock F or H; only F is "best")
  { name:"HF", type:"diatomic", atoms:["H","F"], central:null,
    target:{ bonds:[{a:0,b:1,order:1}], lonePairs:{0:0,1:3} } },

  // Linear triatomic
  { name:"CO2", type:"linear3", atoms:["O","C","O"], central:1,
    target:{ bonds:[{a:1,b:0,order:2},{a:1,b:2,order:2}], lonePairs:{0:2,1:0,2:2} } },
  { name:"HCN", type:"linear3", atoms:["H","C","N"], central:1,
    target:{ bonds:[{a:1,b:0,order:1},{a:1,b:2,order:3}], lonePairs:{0:0,1:0,2:1} } },

  // Trigonal (PF3 / NH3)
  { name:"PF3", type:"trigonal", atoms:["P","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:3,2:3,3:3} } },
  { name:"NH3", type:"trigonal", atoms:["N","H","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs:{0:1,1:0,2:0,3:0} } },

  // Bent
  { name:"H2O", type:"bent", atoms:["O","H","H"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1}], lonePairs:{0:2,1:0,2:0} } },

  // Tetrahedral
  { name:"CF4", type:"tetra", atoms:["C","F","F","F","F"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs:{0:0,1:3,2:3,3:3,4:3} } },
  { name:"CBr4", type:"tetra", atoms:["C","Br","Br","Br","Br"], central:0,
    target:{ bonds:[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs:{0:0,1:3,2:3,3:3,4:3} } },
];

const el = {
  molName: document.getElementById("molName"),
  molHint: document.getElementById("molHint"),
  btnNew: document.getElementById("btnNew"),
  electronInput: document.getElementById("electronInput"),
  btnCheckElectrons: document.getElementById("btnCheckElectrons"),
  electronMsg: document.getElementById("electronMsg"),
  centralSelect: document.getElementById("centralSelect"),
  btnLockCentral: document.getElementById("btnLockCentral"),
  btnReset: document.getElementById("btnReset"),
  centralMsg: document.getElementById("centralMsg"),
  bankTotal: document.getElementById("bankTotal"),
  bankRemain: document.getElementById("bankRemain"),
  bankNote: document.getElementById("bankNote"),
  stage: document.getElementById("stage"),
  stageOverlay: document.getElementById("stageOverlay"),
  btnCheckModel: document.getElementById("btnCheckModel"),
  btnShowAnswer: document.getElementById("btnShowAnswer"),
  btnClear: document.getElementById("btnClear"),
  feedback: document.getElementById("feedback"),
};

let state = null;

function formatFormula(str){
  // CO2 -> CO<sub>2</sub>, CBr4 -> CBr<sub>4</sub>, etc.
  return str.replace(/(\d+)/g, "<sub>$1</sub>");
}

function totalValence(mol){
  return mol.atoms.reduce((sum, sym) => sum + (VALENCE[sym] ?? 0), 0);
}

function resetBuild(keepMolecule=false){
  const mol = keepMolecule ? state.mol : pickMolecule();
  state = {
    mol,
    electronsChecked: false,
    bankTotal: null,
    bankRemain: null,
    chosenCentral: null,     // index or null (diatomic)
    lockedCentral: false,
    placed: {
      bonds: new Map(),      // key "a-b" => order (1/2/3)
      lonePairs: new Map(),  // key "atomIdx|slotId" => true
    },
    layout: null,
  };

  renderHeader();
  renderStep1();
  clearStage();
  lockStage(true, "Confirm total valence electrons and lock the central atom to begin.");
  setButtonsEnabled(false);
  el.feedback.style.display="none";
  el.feedback.className="msg msg-soft";
  el.feedback.textContent="";
}

function pickMolecule(){
  const i = Math.floor(Math.random() * MOLECULES.length);
  return MOLECULES[i];
}

function renderHeader(){
  el.molName.innerHTML = formatFormula(state.mol.name);
  el.molHint.textContent = "Confirm electrons, choose a central atom, then build.";
}

function renderStep1(){
  el.electronInput.value = "";
  el.electronMsg.style.display="none";
  el.centralSelect.innerHTML = `<option value="">Select…</option>`;
  el.centralSelect.disabled = true;
  el.btnLockCentral.disabled = true;

  // bank hidden until correct
  el.bankTotal.textContent = "—";
  el.bankRemain.textContent = "—";
  el.bankNote.style.display = "block";

  // central options: ALL atoms + special diatomic option
  const mol = state.mol;

  // If diatomic, include "No central atom (diatomic)"
  if (mol.type === "diatomic") {
    const opt = document.createElement("option");
    opt.value = "__none__";
    opt.textContent = "No central atom (diatomic)";
    el.centralSelect.appendChild(opt);
  }

  mol.atoms.forEach((sym, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${sym} (atom ${idx+1})`;
    el.centralSelect.appendChild(opt);
  });

  el.centralMsg.className = "msg msg-soft";
  el.centralMsg.textContent = "Check the total electrons first.";
}

function setButtonsEnabled(on){
  el.btnCheckModel.disabled = !on;
  el.btnShowAnswer.disabled = !on;
  el.btnClear.disabled = !on;
}

function lockStage(isLocked, text){
  el.stageOverlay.style.display = isLocked ? "flex" : "none";
  el.stageOverlay.textContent = text || "";
}

function clearStage(){
  el.stage.innerHTML = `<div id="stageOverlay" class="stage-overlay"></div>`;
  el.stageOverlay = document.getElementById("stageOverlay");
}

function showMsg(targetEl, text, kind="warn"){
  targetEl.style.display = "block";
  targetEl.className = `msg ${kind==="ok"?"msg-ok":kind==="bad"?"msg-bad":"msg-warn"}`;
  targetEl.textContent = text;
}

function electronCheck(){
  const mol = state.mol;
  const correct = totalValence(mol);
  const entered = Number(el.electronInput.value);

  if (!Number.isFinite(entered)) {
    showMsg(el.electronMsg, "Enter a number for total valence electrons.", "warn");
    state.electronsChecked = false;
    return;
  }

  if (entered === correct) {
    state.electronsChecked = true;
    state.bankTotal = correct;
    state.bankRemain = correct;

    showMsg(el.electronMsg, `Correct. ${correct} total valence electrons.`, "ok");

    el.bankTotal.textContent = String(correct);
    el.bankRemain.textContent = String(correct);
    el.bankNote.style.display = "none";

    el.centralSelect.disabled = false;
    el.btnLockCentral.disabled = false;
    el.centralMsg.className = "msg msg-soft";
    el.centralMsg.textContent = "Nice. Now choose/lock the central atom to reveal the model.";
  } else {
    state.electronsChecked = false;
    showMsg(el.electronMsg, `Not quite. Try again. (Hint: add valence electrons for each atom in ${mol.name}.)`, "warn");
    el.centralSelect.disabled = true;
    el.btnLockCentral.disabled = true;

    el.bankTotal.textContent = "—";
    el.bankRemain.textContent = "—";
    el.bankNote.style.display = "block";

    el.centralMsg.className = "msg msg-soft";
    el.centralMsg.textContent = "Check the total electrons first.";
  }
}

function lockCentral(){
  if (!state.electronsChecked) return;

  const val = el.centralSelect.value;
  if (!val) {
    el.centralMsg.className="msg msg-warn";
    el.centralMsg.textContent="Pick an option first.";
    return;
  }

  if (val === "__none__") {
    state.chosenCentral = null;
  } else {
    state.chosenCentral = Number(val);
  }

  state.lockedCentral = true;

  // Build layout only now
  state.layout = computeLayout(state.mol, state.chosenCentral);
  renderModel();

  lockStage(false);
  setButtonsEnabled(true);

  el.centralMsg.className = "msg msg-ok";
  el.centralMsg.textContent = `Central atom locked: ${val==="__none__" ? "No central atom" : state.mol.atoms[state.chosenCentral]}. Now build the model.`;
}

function computeLayout(mol, chosenCentral){
  // Layout gives:
  // atoms: [{x,y,sym,idx}]
  // bonds: [{a,b,x,y}] ONE per connection
  // lpSlots: array of {atomIdx, slotId, x,y} (pair slots only)
  const stageW = el.stage.clientWidth || 700;
  const stageH = 320;

  const atoms = [];
  const bonds = [];
  const lpSlots = [];

  const addLP = (atomIdx, x, y, slotId) => {
    lpSlots.push({ atomIdx, x, y, slotId });
  };

  const isH = (sym) => sym === "H";

  // Helper: add lone-pair slot "boxes" around atom unless Hydrogen
  const addLPBoxesAround = (atomIdx, x, y, sym, blockedSide=null) => {
    if (isH(sym)) return; // Hydrogen has no LP boxes

    // We place up to 4 boxes around an atom. Students can use as many as needed.
    // We avoid the bond-facing side for diatomic so LP doesn't sit next to bond.
    const offsets = [
      {id:"top",    dx: 16, dy:-24},
      {id:"bottom", dx: 16, dy: 62},
      {id:"left",   dx:-22, dy: 18},
      {id:"right",  dx: 54, dy: 18},
    ];

    offsets.forEach(o=>{
      if (blockedSide && o.id === blockedSide) return;
      addLP(atomIdx, x+o.dx, y+o.dy, o.id);
    });
  };

  // Bonds list comes from molecule type + chosen central
  // For the supported set, we already know the "connections" (who bonds to who)
  // We create skeleton positions first, then compute bond-zone positions.

  if (mol.type === "diatomic"){
    // two atoms left/right
    const yAtom = Math.round(stageH * 0.48);
    const xLeft = Math.round(stageW * 0.30);
    const xRight = Math.round(stageW * 0.70);

    atoms.push({idx:0, sym:mol.atoms[0], x:xLeft-27, y:yAtom-27});
    atoms.push({idx:1, sym:mol.atoms[1], x:xRight-27, y:yAtom-27});

    // ONE bond zone between atoms
    const bx = Math.round((xLeft + xRight)/2 - 49);
    const by = Math.round(yAtom - 22);
    bonds.push({a:0,b:1,x:bx,y:by});

    // Lone pair boxes: block bond-facing side
    addLPBoxesAround(0, xLeft-27, yAtom-27, mol.atoms[0], "right");
    addLPBoxesAround(1, xRight-27, yAtom-27, mol.atoms[1], "left");

    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "linear3"){
    // positions: left, center, right in a line
    const y = Math.round(stageH * 0.48);
    const xC = Math.round(stageW * 0.50);
    const xL = Math.round(stageW * 0.30);
    const xR = Math.round(stageW * 0.70);

    // Use actual order in mol.atoms (e.g., O C O or H C N)
    atoms.push({idx:0, sym:mol.atoms[0], x:xL-27, y:y-27});
    atoms.push({idx:1, sym:mol.atoms[1], x:xC-27, y:y-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xR-27, y:y-27});

    bonds.push({a:1,b:0,x:Math.round((xL+xC)/2-49),y:Math.round(y-22)});
    bonds.push({a:1,b:2,x:Math.round((xC+xR)/2-49),y:Math.round(y-22)});

    atoms.forEach(a=> addLPBoxesAround(a.idx, a.x, a.y, a.sym, null));
    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "bent"){
    // O in center, H left/right slightly down
    const xC = Math.round(stageW * 0.50);
    const yC = Math.round(stageH * 0.42);
    const xL = Math.round(stageW * 0.35);
    const xR = Math.round(stageW * 0.65);
    const yT = Math.round(stageH * 0.58);

    atoms.push({idx:0, sym:mol.atoms[0], x:xC-27, y:yC-27}); // central O
    atoms.push({idx:1, sym:mol.atoms[1], x:xL-27, y:yT-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xR-27, y:yT-27});

    bonds.push({a:0,b:1,x:Math.round((xC+xL)/2-49),y:Math.round((yC+yT)/2-22)});
    bonds.push({a:0,b:2,x:Math.round((xC+xR)/2-49),y:Math.round((yC+yT)/2-22)});

    atoms.forEach(a=> addLPBoxesAround(a.idx, a.x, a.y, a.sym, null));
    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "trigonal"){
    // central at center, three terminals around (top, left, right OR left/right/bottom)
    const xC = Math.round(stageW * 0.55);
    const yC = Math.round(stageH * 0.45);

    // atoms: [central, t1, t2, t3]
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

    // ONE bond zone per terminal
    const bondBetween = (aIdx,bIdx)=>{
      const A = atoms.find(x=>x.idx===aIdx);
      const B = atoms.find(x=>x.idx===bIdx);
      const ax = A.x+27, ay=A.y+27;
      const bx = B.x+27, by=B.y+27;
      bonds.push({
        a:aIdx, b:bIdx,
        x: Math.round((ax+bx)/2 - 49),
        y: Math.round((ay+by)/2 - 22)
      });
    };
    bondBetween(0,1);
    bondBetween(0,2);
    bondBetween(0,3);

    atoms.forEach(a=> addLPBoxesAround(a.idx, a.x, a.y, a.sym, null));
    return { atoms, bonds, lpSlots };
  }

  if (mol.type === "tetra"){
    // central at center, four terminals up/left/right/down
    const xC = Math.round(stageW * 0.55);
    const yC = Math.round(stageH * 0.45);

    atoms.push({idx:0, sym:mol.atoms[0], x:xC-27, y:yC-27});

    const xUp = xC;
    const yUp = Math.round(stageH * 0.22);
    const xLeft = Math.round(stageW * 0.35);
    const yLeft = yC;
    const xRight = Math.round(stageW * 0.75);
    const yRight = yC;
    const xDown = xC;
    const yDown = Math.round(stageH * 0.70);

    atoms.push({idx:1, sym:mol.atoms[1], x:xUp-27, y:yUp-27});
    atoms.push({idx:2, sym:mol.atoms[2], x:xLeft-27, y:yLeft-27});
    atoms.push({idx:3, sym:mol.atoms[3], x:xRight-27, y:yRight-27});
    atoms.push({idx:4, sym:mol.atoms[4], x:xDown-27, y:yDown-27});

    const bondBetween = (aIdx,bIdx)=>{
      const A = atoms.find(x=>x.idx===aIdx);
      const B = atoms.find(x=>x.idx===bIdx);
      const ax = A.x+27, ay=A.y+27;
      const bx = B.x+27, by=B.y+27;
      bonds.push({
        a:aIdx, b:bIdx,
        x: Math.round((ax+bx)/2 - 49),
        y: Math.round((ay+by)/2 - 22)
      });
    };
    bondBetween(0,1);
    bondBetween(0,2);
    bondBetween(0,3);
    bondBetween(0,4);

    atoms.forEach(a=> addLPBoxesAround(a.idx, a.x, a.y, a.sym, null));
    return { atoms, bonds, lpSlots };
  }

  // fallback: show nothing
  return { atoms:[], bonds:[], lpSlots:[] };
}

function renderModel(){
  clearStage();
  const { atoms, bonds, lpSlots } = state.layout;

  // atoms
  atoms.forEach(a=>{
    const d = document.createElement("div");
    d.className = "atom";
    d.style.left = `${a.x}px`;
    d.style.top = `${a.y}px`;
    d.textContent = a.sym;
    d.dataset.atom = String(a.idx);
    el.stage.appendChild(d);
  });

  // ONE bond drop zone per connection
  bonds.forEach((b, i)=>{
    const d = document.createElement("div");
    d.className = "drop-bond";
    d.style.left = `${b.x}px`;
    d.style.top = `${b.y}px`;
    d.dataset.kind = "bond";
    d.dataset.a = String(b.a);
    d.dataset.b = String(b.b);

    // label or bond svg if filled
    renderBondZone(d, b.a, b.b);

    wireDropZone(d);
    el.stage.appendChild(d);
  });

  // lone pair drop boxes (••)
  lpSlots.forEach((s, i)=>{
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

function bondKey(a,b){
  const x = Math.min(a,b);
  const y = Math.max(a,b);
  return `${x}-${y}`;
}

function setBankRemain(){
  el.bankRemain.textContent = String(state.bankRemain);
}

function canSpend(cost){
  return state.bankRemain !== null && state.bankRemain >= cost;
}

function spend(cost){
  state.bankRemain -= cost;
  if (state.bankRemain < 0) state.bankRemain = 0;
  setBankRemain();
}

function refund(cost){
  state.bankRemain += cost;
  if (state.bankRemain > state.bankTotal) state.bankRemain = state.bankTotal;
  setBankRemain();
}

function renderBondZone(zoneEl, a, b){
  const key = bondKey(a,b);
  const order = state.placed.bonds.get(key);

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

  // Determine angle based on atom positions
  const A = state.layout.atoms.find(x=>x.idx===Math.min(a,b) ? x : x);
  const A2 = state.layout.atoms.find(x=>x.idx===a);
  const B2 = state.layout.atoms.find(x=>x.idx===b);

  const ax = A2.x+27, ay=A2.y+27;
  const bx = B2.x+27, by=B2.y+27;
  const angle = Math.atan2(by-ay, bx-ax) * 180 / Math.PI;

  // Draw 1/2/3 parallel lines centered, then rotate group
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

  // click-to-remove
  zoneEl.onclick = () => {
    const current = state.placed.bonds.get(key);
    if (!current) return;
    state.placed.bonds.delete(key);
    refund(current === 1 ? COST.bond1 : current === 2 ? COST.bond2 : COST.bond3);
    zoneEl.onclick = null;
    renderBondZone(zoneEl, a, b);
  };
}

function renderLPZone(zoneEl, atomIdx, slotId){
  const key = `${atomIdx}|${slotId}`;
  const filled = state.placed.lonePairs.get(key);

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
    if (!state.placed.lonePairs.get(key)) return;
    state.placed.lonePairs.delete(key);
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

    // Must be in build mode
    if (!state.lockedCentral) return;

    // Decide what can go where
    const kind = zoneEl.dataset.kind;

    if (kind === "bond"){
      if (!(tool==="bond1" || tool==="bond2" || tool==="bond3")) return;

      const a = Number(zoneEl.dataset.a);
      const b = Number(zoneEl.dataset.b);
      const key = bondKey(a,b);
      if (state.placed.bonds.get(key)) return; // already filled

      const cost = COST[tool];
      if (!canSpend(cost)){
        flashFeedback("You don’t have enough electrons left for that placement. Remove something first.", "bad");
        return;
      }

      spend(cost);
      const order = tool==="bond1"?1:tool==="bond2"?2:3;
      state.placed.bonds.set(key, order);
      renderBondZone(zoneEl, a, b);
      return;
    }

    if (kind === "lp"){
      if (tool !== "lp") return;

      const atomIdx = Number(zoneEl.dataset.atom);
      const slotId = zoneEl.dataset.slot;
      const key = `${atomIdx}|${slotId}`;
      if (state.placed.lonePairs.get(key)) return; // already filled

      const cost = COST.lp;
      if (!canSpend(cost)){
        flashFeedback("You don’t have enough electrons left for that lone pair. Remove something first.", "bad");
        return;
      }

      spend(cost);
      state.placed.lonePairs.set(key, true);
      renderLPZone(zoneEl, atomIdx, slotId);
      return;
    }
  });
}

function flashFeedback(text, kind="soft"){
  el.feedback.style.display = "block";
  el.feedback.className = `msg ${kind==="ok"?"msg-ok":kind==="bad"?"msg-bad":"msg-soft"}`;
  el.feedback.textContent = text;
}

function countPlacedLonePairsByAtom(){
  const counts = {};
  for (const k of state.placed.lonePairs.keys()){
    const atomIdx = Number(k.split("|")[0]);
    counts[atomIdx] = (counts[atomIdx] || 0) + 1;
  }
  return counts;
}

function checkModel(){
  const mol = state.mol;
  const target = mol.target;

  const placedLP = countPlacedLonePairsByAtom();

  // bonds
  let bondMistakes = 0;
  for (const tb of target.bonds){
    const key = bondKey(tb.a, tb.b);
    const got = state.placed.bonds.get(key) || 0;
    if (got !== tb.order) bondMistakes++;
  }
  // extra bonds not in target
  for (const [key, order] of state.placed.bonds.entries()){
    const [a,b] = key.split("-").map(Number);
    const exists = target.bonds.some(tb => bondKey(tb.a,tb.b) === key);
    if (!exists) bondMistakes++;
  }

  // lone pairs
  let lpMistakes = 0;
  for (const idxStr of Object.keys(target.lonePairs)){
    const idx = Number(idxStr);
    const need = target.lonePairs[idx];
    const got = placedLP[idx] || 0;
    if (need !== got) lpMistakes++;
  }

  // bank: should be 0 when correct for our target set
  const bankOk = (state.bankRemain === 0);

  if (bondMistakes===0 && lpMistakes===0 && bankOk){
    flashFeedback(
      "Nice work!\n• Your bonds and lone pairs match a typical Lewis structure for this molecule.\n• Your electron bank is at 0 (all valence electrons are accounted for).",
      "ok"
    );
    return;
  }

  // Friendly, non-spoiler hints (NO exact counts, NO “put X on atom Y”)
  const hints = [];
  if (bondMistakes>0){
    hints.push("• Check your bonds first. Make sure each connection has the right bond strength (single/double/triple).");
  }
  if (lpMistakes>0){
    hints.push("• Then check lone pairs. Some atoms may still be missing lone pairs, or may have too many.");
  }
  if (!bankOk){
    if (state.bankRemain > 0){
      hints.push("• You still have electrons left. Use lone pairs to finish outer shells.");
    } else {
      hints.push("• You spent too many electrons. Remove something and try again.");
    }
  }

  flashFeedback("Not yet — you’re close.\n" + hints.join("\n"), "bad");
}

function showAnswer(){
  // Fill placements to match target (for teacher demo)
  clearPlacements();

  const mol = state.mol;
  const target = mol.target;

  // place bonds
  target.bonds.forEach(tb=>{
    const key = bondKey(tb.a,tb.b);
    const tool = tb.order===1?"bond1":tb.order===2?"bond2":"bond3";
    const cost = COST[tool];
    if (canSpend(cost)){
      spend(cost);
      state.placed.bonds.set(key, tb.order);
    }
  });

  // place lone pairs in first available LP slots for each atom
  const slotsByAtom = {};
  state.layout.lpSlots.forEach(s=>{
    slotsByAtom[s.atomIdx] = slotsByAtom[s.atomIdx] || [];
    slotsByAtom[s.atomIdx].push(s.slotId);
  });

  for (const idxStr of Object.keys(target.lonePairs)){
    const atomIdx = Number(idxStr);
    const need = target.lonePairs[atomIdx];
    const slots = slotsByAtom[atomIdx] || [];
    for (let i=0;i<need && i<slots.length;i++){
      const key = `${atomIdx}|${slots[i]}`;
      if (canSpend(COST.lp)){
        spend(COST.lp);
        state.placed.lonePairs.set(key, true);
      }
    }
  }

  // rerender
  renderModel();
  flashFeedback("Showing one typical correct Lewis structure for this molecule.", "soft");
}

function clearPlacements(){
  // Refund everything
  for (const [k, order] of state.placed.bonds.entries()){
    refund(order===1?COST.bond1:order===2?COST.bond2:COST.bond3);
  }
  for (const k of state.placed.lonePairs.keys()){
    refund(COST.lp);
  }

  state.placed.bonds.clear();
  state.placed.lonePairs.clear();
  renderModel();
  flashFeedback("Cleared placements. Rebuild the model.", "soft");
}

function clearAllToStart(){
  // Used by Reset build button
  resetBuild(true);
}

function initToolbox(){
  document.querySelectorAll(".tool").forEach(toolEl=>{
    toolEl.addEventListener("dragstart",(e)=>{
      e.dataTransfer.setData("text/plain", toolEl.dataset.tool);
    });
  });
}

// Wire buttons
el.btnNew.addEventListener("click", ()=> resetBuild(false));
el.btnReset.addEventListener("click", ()=> clearAllToStart());
el.btnCheckElectrons.addEventListener("click", ()=> electronCheck());
el.btnLockCentral.addEventListener("click", ()=> lockCentral());
el.btnCheckModel.addEventListener("click", ()=> checkModel());
el.btnShowAnswer.addEventListener("click", ()=> showAnswer());
el.btnClear.addEventListener("click", ()=> clearPlacements());

// Start
initToolbox();
resetBuild(false);
