/* Covalent Bonding Coach
   - Confirm total valence electrons first (bank unlocks)
   - Central atom selection when applicable
   - Drag/drop bonds into bond zones BETWEEN atoms
   - Bonds render as SVG lines so vertical/diagonal are always correct
   - High-school-friendly feedback (no “do X here” giveaway)
*/

const VE = { H:1, C:4, N:5, O:6, F:7, P:5, Br:7 };

const MOLECULES = [
  { formula:"Br2", atoms:["Br","Br"], geometry:"diatomic", centralNeeded:false, expectedBonds:[{a:0,b:1,order:1}], expectedLP:[3,3] },
  { formula:"F2",  atoms:["F","F"],   geometry:"diatomic", centralNeeded:false, expectedBonds:[{a:0,b:1,order:1}], expectedLP:[3,3] },
  { formula:"H2",  atoms:["H","H"],   geometry:"diatomic", centralNeeded:false, expectedBonds:[{a:0,b:1,order:1}], expectedLP:[0,0] },
  { formula:"HF",  atoms:["H","F"],   geometry:"diatomic", centralNeeded:false, expectedBonds:[{a:0,b:1,order:1}], expectedLP:[0,3] },
  { formula:"N2",  atoms:["N","N"],   geometry:"diatomic", centralNeeded:false, expectedBonds:[{a:0,b:1,order:3}], expectedLP:[1,1] },
  { formula:"O2",  atoms:["O","O"],   geometry:"diatomic", centralNeeded:false, expectedBonds:[{a:0,b:1,order:2}], expectedLP:[2,2] },

  { formula:"CO2", atoms:["O","C","O"], geometry:"linear3", centralNeeded:true, centralIndex:1,
    expectedBonds:[{a:0,b:1,order:2},{a:1,b:2,order:2}], expectedLP:[2,0,2] },

  { formula:"HCN", atoms:["H","C","N"], geometry:"linear3", centralNeeded:true, centralIndex:1,
    expectedBonds:[{a:0,b:1,order:1},{a:1,b:2,order:3}], expectedLP:[0,0,1] },

  { formula:"H2O", atoms:["H","O","H"], geometry:"bent", centralNeeded:true, centralIndex:1,
    expectedBonds:[{a:0,b:1,order:1},{a:1,b:2,order:1}], expectedLP:[0,2,0] },

  { formula:"NH3", atoms:["H","N","H","H"], geometry:"triPyr", centralNeeded:true, centralIndex:1,
    expectedBonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:1,b:3,order:1}], expectedLP:[0,1,0,0] },

  { formula:"PF3", atoms:["F","P","F","F"], geometry:"triPyr", centralNeeded:true, centralIndex:1,
    expectedBonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:1,b:3,order:1}], expectedLP:[3,1,3,3] },

  { formula:"CF4", atoms:["F","C","F","F","F"], geometry:"tetra", centralNeeded:true, centralIndex:1,
    expectedBonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:1,b:3,order:1},{a:1,b:4,order:1}], expectedLP:[3,0,3,3,3] },

  { formula:"CBr4", atoms:["Br","C","Br","Br","Br"], geometry:"tetra", centralNeeded:true, centralIndex:1,
    expectedBonds:[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:1,b:3,order:1},{a:1,b:4,order:1}], expectedLP:[3,0,3,3,3] },
];

const el = (id)=>document.getElementById(id);

const molName = el("molName");
const molPrompt = el("molPrompt");

const veInput = el("veInput");
const veCheckBtn = el("veCheckBtn");
const veMsg = el("veMsg");

const centralSelect = el("centralSelect");
const lockCentralBtn = el("lockCentralBtn");
const resetBuildBtn = el("resetBuildBtn");

const centralMsg = el("centralMsg");

const bankTotal = el("bankTotal");
const bankRemain = el("bankRemain");
const bankLockedMsg = el("bankLockedMsg");

const modelStage = el("modelStage");
const bondSvg = el("bondSvg");

const checkBtn = el("checkBtn");
const showBtn = el("showBtn");
const clearBtn = el("clearBtn");

const statusMsg = el("statusMsg");
const feedback = el("feedback");

const newBtn = el("newBtn");

let state = {
  mol:null,
  totalVE:null,
  confirmedVE:false,
  centralLocked:false,
  chosenCentral:null,
  remaining:null,

  // placements
  bonds: new Map(), // key "a-b" => order 0/1/2/3
  lonePairs: new Map(), // key "atomIndex:slot" => true
};

// ---------- utilities ----------
function sumValence(atoms){
  return atoms.reduce((s,a)=>s + (VE[a] ?? 0), 0);
}
function bondCost(order){
  if(order===1) return 2;
  if(order===2) return 4;
  if(order===3) return 6;
  return 0;
}
function lpCost(){ return 2; }

function bondKey(a,b){
  const x = Math.min(a,b), y = Math.max(a,b);
  return `${x}-${y}`;
}

function clearFeedback(){
  feedback.style.display = "none";
  feedback.className = "feedback";
  feedback.innerHTML = "";
}

function showFeedback(kind, title, bullets){
  feedback.style.display = "block";
  feedback.className = `feedback ${kind==="good"?"good":"bad"}`;
  const ul = bullets?.length
    ? `<ul>${bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>`
    : "";
  feedback.innerHTML = `<h3>${escapeHtml(title)}</h3>${ul}`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

// ---------- molecule layout templates ----------
function layoutFor(mol){
  // returns {atoms:[{x,y}], bonds:[{a,b, zx,zy, zw,zh}], lpSlots:[{atom, slots:[{x,y}]}]}
  // Coordinates in stage percent-like but we'll convert to px via stage size.
  const g = mol.geometry;
  const n = mol.atoms.length;

  const atoms = [];
  const bondZones = [];

  // helper push atom
  const A = (x,y)=>atoms.push({x,y});
  // helper zone
  const Z = (a,b, x,y, w=120,h=54)=>bondZones.push({a,b,x,y,w,h});

  if(g==="diatomic"){
    A(340,260); A(660,260);
    Z(0,1,500,260);
  } else if(g==="linear3"){
    A(260,260); A(500,260); A(740,260);
    Z(0,1,380,260);
    Z(1,2,620,260);
  } else if(g==="bent"){
    // H - O - H, bent
    A(310,310); A(500,240); A(690,310);
    Z(0,1,410,280);
    Z(1,2,590,280);
  } else if(g==="triPyr"){
    // 4 atoms: terminal - central - terminal - terminal (triangle-ish)
    // indices: 0 terminal left, 1 central, 2 terminal right, 3 terminal bottom
    A(300,250); A(500,250); A(700,250); A(500,410);
    Z(0,1,400,250);
    Z(1,2,600,250);
    Z(1,3,500,330); // vertical-ish bond zone below central
  } else if(g==="tetra"){
    // 5 atoms: 0 top, 1 central, 2 right, 3 bottom, 4 left
    A(500,110); A(500,260); A(700,260); A(500,420); A(300,260);
    Z(0,1,500,185); // between top and center
    Z(1,2,600,260); // center-right
    Z(1,3,500,340); // center-bottom
    Z(1,4,400,260); // center-left
  } else {
    // fallback: line
    for(let i=0;i<n;i++){
      A(220 + i*(560/(Math.max(1,n-1))), 260);
      if(i>0) Z(i-1,i, 220 + (i-0.5)*(560/(Math.max(1,n-1))), 260);
    }
  }

  // lone pair slots: 4 around each atom (top,right,bottom,left) as small drop zones
  const lpSlots = atoms.map((p, idx)=>{
    const r = 58;
    return {
      atom: idx,
      slots: [
        {x:p.x, y:p.y - r},
        {x:p.x + r, y:p.y},
        {x:p.x, y:p.y + r},
        {x:p.x - r, y:p.y},
      ]
    };
  });

  return { atoms, bondZones, lpSlots };
}

// ---------- render ----------
function resetAll(){
  state.confirmedVE = false;
  state.centralLocked = false;
  state.chosenCentral = null;
  state.totalVE = null;
  state.remaining = null;
  state.bonds = new Map();
  state.lonePairs = new Map();

  veInput.value = "";
  veMsg.style.display = "none";

  bankTotal.textContent = "—";
  bankRemain.textContent = "—";
  bankLockedMsg.style.display = "block";

  centralSelect.innerHTML = `<option value="">Select…</option>`;
  centralSelect.disabled = true;
  lockCentralBtn.disabled = true;

  checkBtn.disabled = true;
  showBtn.disabled = true;
  clearBtn.disabled = true;

  statusMsg.className = "msg msg-neutral";
  statusMsg.textContent = "Confirm total valence electrons and lock the central atom to begin.";

  centralMsg.className = "msg msg-neutral";
  centralMsg.textContent = "Check the total electrons first.";

  clearFeedback();
  renderModel();
}

function setMolecule(mol){
  state.mol = mol;

  molName.textContent = mol.formula;
  molPrompt.textContent = `Confirm total valence electrons, choose the central atom (if applicable), then build.`;

  resetAll();

  // pre-fill central options once VE is confirmed
}

function renderModel(){
  // clear stage except svg
  const keepSvg = bondSvg;
  modelStage.innerHTML = "";
  modelStage.appendChild(keepSvg);
  bondSvg.innerHTML = "";

  if(!state.mol) return;

  const { atoms, bondZones, lpSlots } = layoutFor(state.mol);

  // atoms
  atoms.forEach((p, idx)=>{
    const d = document.createElement("div");
    d.className = "atom";
    d.style.left = `${p.x - 30}px`;
    d.style.top  = `${p.y - 30}px`;
    d.dataset.atom = String(idx);
    d.innerHTML = `<div class="sym">${escapeHtml(state.mol.atoms[idx])}</div>`;
    modelStage.appendChild(d);
  });

  // bond zones (between atoms)
  bondZones.forEach((z)=>{
    const key = bondKey(z.a,z.b);
    const order = state.bonds.get(key) ?? 0;

    const dz = document.createElement("div");
    dz.className = `bond-zone ${order? "filled":""}`;
    dz.style.left = `${z.x - (z.w/2)}px`;
    dz.style.top  = `${z.y - (z.h/2)}px`;
    dz.style.width = `${z.w}px`;
    dz.style.height = `${z.h}px`;

    dz.dataset.zone = key;

    dz.textContent = order ? (order===1 ? "—" : order===2 ? "=" : "≡") : "DROP BOND";
    dz.title = "Drop a bond here";

    if(state.centralLocked && state.confirmedVE){
      enableDrop(dz, "bond");
    } else {
      dz.style.opacity = "0.55";
    }

    dz.addEventListener("click", ()=>{
      if(!state.centralLocked || !state.confirmedVE) return;
      removeBond(key);
    });

    modelStage.appendChild(dz);
  });

  // lone pair slots around atoms
  lpSlots.forEach(({atom, slots})=>{
    slots.forEach((s, i)=>{
      const k = `${atom}:${i}`;
      const filled = state.lonePairs.get(k) === true;

      const lp = document.createElement("div");
      lp.className = `drop-lp ${filled?"filled":""}`;
      lp.style.left = `${s.x - 23}px`;
      lp.style.top  = `${s.y - 15}px`;
      lp.dataset.lp = k;

      lp.textContent = filled ? "••" : "drop";
      lp.title = "Drop a lone pair here";

      if(state.centralLocked && state.confirmedVE){
        enableDrop(lp, "lp");
      } else {
        lp.style.opacity = "0.55";
      }

      lp.addEventListener("click", ()=>{
        if(!state.centralLocked || !state.confirmedVE) return;
        removeLonePair(k);
      });

      modelStage.appendChild(lp);
    });
  });

  // draw bonds as SVG lines between atom centers based on current bond orders
  drawSvgBonds(atoms);

  // note: when central not locked, keep svg empty
  if(!state.centralLocked) bondSvg.innerHTML = "";
}

function drawSvgBonds(atomPts){
  bondSvg.innerHTML = "";
  const w = 1000, h = 520;
  bondSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  for(const [key, order] of state.bonds.entries()){
    if(!order) continue;
    const [aS,bS] = key.split("-");
    const a = Number(aS), b = Number(bS);
    const p1 = atomPts[a];
    const p2 = atomPts[b];
    if(!p1 || !p2) continue;

    // multiple lines offset perpendicular to the bond direction
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx,dy) || 1;
    const ux = dx/len, uy = dy/len;
    const px = -uy, py = ux; // perpendicular unit

    const gap = 6; // spacing between parallel lines
    const counts = order===1 ? [0] : order===2 ? [-gap/2, gap/2] : [-gap, 0, gap];

    counts.forEach(off=>{
      const x1 = p1.x + px*off;
      const y1 = p1.y + py*off;
      const x2 = p2.x + px*off;
      const y2 = p2.y + py*off;

      const line = document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", "#8C1D40");
      line.setAttribute("stroke-width", "6");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("opacity", "0.92");
      bondSvg.appendChild(line);
    });
  }
}

// ---------- drag/drop ----------
let dragTool = null;

function setupToolDrag(){
  document.querySelectorAll(".tool").forEach(t=>{
    t.addEventListener("dragstart", (e)=>{
      dragTool = t.dataset.tool;
      e.dataTransfer.setData("text/plain", dragTool);
      e.dataTransfer.effectAllowed = "copy";
    });
    t.addEventListener("dragend", ()=>{
      dragTool = null;
    });
  });
}

function enableDrop(node, type){
  node.addEventListener("dragover", (e)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  node.addEventListener("drop", (e)=>{
    e.preventDefault();
    const tool = e.dataTransfer.getData("text/plain") || dragTool;
    if(!tool) return;

    if(type==="bond"){
      if(tool==="bond1"||tool==="bond2"||tool==="bond3"){
        const key = node.dataset.zone;
        const order = tool==="bond1"?1:tool==="bond2"?2:3;
        placeBond(key, order);
      }
    }
    if(type==="lp"){
      if(tool==="lp"){
        const k = node.dataset.lp;
        placeLonePair(k);
      }
    }
  }, { once:false });
}

function placeBond(key, order){
  if(!state.confirmedVE || !state.centralLocked) return;

  const prev = state.bonds.get(key) ?? 0;
  const delta = bondCost(order) - bondCost(prev);

  if(state.remaining - delta < 0){
    statusMsg.className = "msg msg-warn";
    statusMsg.textContent = "Not enough electrons remaining for that bond choice. Try a smaller bond or remove something first.";
    return;
  }

  state.bonds.set(key, order);
  state.remaining -= delta;

  updateBankUI();
  statusMsg.className = "msg msg-neutral";
  statusMsg.textContent = "Bond placed. Keep building (or click Check molecule).";
  clearFeedback();
  renderModel();
}

function removeBond(key){
  const prev = state.bonds.get(key) ?? 0;
  if(!prev) return;
  state.bonds.delete(key);
  state.remaining += bondCost(prev);
  updateBankUI();
  clearFeedback();
  renderModel();
}

function placeLonePair(k){
  if(state.lonePairs.get(k)===true) return;

  if(state.remaining - lpCost() < 0){
    statusMsg.className = "msg msg-warn";
    statusMsg.textContent = "Not enough electrons remaining to add a lone pair.";
    return;
  }

  state.lonePairs.set(k,true);
  state.remaining -= lpCost();
  updateBankUI();
  statusMsg.className = "msg msg-neutral";
  statusMsg.textContent = "Lone pair placed.";
  clearFeedback();
  renderModel();
}

function removeLonePair(k){
  if(state.lonePairs.get(k)!==true) return;
  state.lonePairs.delete(k);
  state.remaining += lpCost();
  updateBankUI();
  clearFeedback();
  renderModel();
}

// ---------- Step 1 logic ----------
function buildCentralOptions(){
  centralSelect.innerHTML = `<option value="">Select…</option>`;
  const mol = state.mol;
  if(!mol) return;

  // If central not needed (diatomic), auto-lock and skip selection
  if(!mol.centralNeeded){
    centralSelect.disabled = true;
    lockCentralBtn.disabled = true;
    state.chosenCentral = null;
    state.centralLocked = true;

    centralMsg.className = "msg msg-good";
    centralMsg.textContent = "No central atom needed for this molecule. You can build now.";

    enableBuilding();
    return;
  }

  // Offer all non-H atoms; if only one candidate, still let them choose (practice)
  const opts = [];
  mol.atoms.forEach((sym, idx)=>{
    if(sym !== "H") opts.push({sym, idx});
  });

  opts.forEach(o=>{
    const opt = document.createElement("option");
    opt.value = String(o.idx);
    opt.textContent = `${o.sym} (atom ${o.idx+1})`;
    centralSelect.appendChild(opt);
  });

  centralSelect.disabled = false;
  lockCentralBtn.disabled = false;

  centralMsg.className = "msg msg-neutral";
  centralMsg.textContent = "Choose the best central atom, then lock it.";
}

function updateBankUI(){
  bankTotal.textContent = String(state.totalVE ?? "—");
  bankRemain.textContent = String(state.remaining ?? "—");
}

function enableBuilding(){
  checkBtn.disabled = false;
  showBtn.disabled = false;
  clearBtn.disabled = false;

  statusMsg.className = "msg msg-neutral";
  statusMsg.textContent = "Build the model using bonds between atoms and lone pairs around atoms.";

  renderModel();
}

function resetBuildOnly(){
  state.bonds = new Map();
  state.lonePairs = new Map();
  if(state.confirmedVE){
    state.remaining = state.totalVE;
    updateBankUI();
  }
  clearFeedback();
  renderModel();

  statusMsg.className = "msg msg-neutral";
  statusMsg.textContent = "Build reset. Start placing bonds between atoms again.";
}

// ---------- checking ----------
function countPlacedLonePairs(){
  const perAtom = new Array(state.mol.atoms.length).fill(0);
  for(const k of state.lonePairs.keys()){
    const [a] = k.split(":");
    perAtom[Number(a)] += 1;
  }
  return perAtom;
}

function getPlacedBondOrders(){
  // returns array matching expected bonds with placed order (0 if missing)
  const map = new Map();
  for(const [k, order] of state.bonds.entries()) map.set(k, order);
  return map;
}

function checkMoleculeFriendly(){
  const mol = state.mol;
  if(!mol) return;

  // Basic completeness checks
  const placedLP = countPlacedLonePairs();
  const placedBondMap = getPlacedBondOrders();

  const expected = mol.expectedBonds.map(b=>{
    return { key: bondKey(b.a,b.b), order: b.order };
  });

  const missingBonds = expected.filter(e => (placedBondMap.get(e.key) ?? 0) === 0);
  const wrongOrder = expected.filter(e => {
    const o = placedBondMap.get(e.key) ?? 0;
    return o !== 0 && o !== e.order;
  });

  // Lone pair counts: compare totals per atom but don't “tell exact”
  const expectedLP = mol.expectedLP;
  const lpTooFew = [];
  const lpTooMany = [];
  for(let i=0;i<expectedLP.length;i++){
    if(placedLP[i] < expectedLP[i]) lpTooFew.push(i);
    if(placedLP[i] > expectedLP[i]) lpTooMany.push(i);
  }

  // Remaining electrons should be 0 in this simplified model set
  const bankOff = state.remaining !== 0;

  const anyProblem = missingBonds.length || wrongOrder.length || lpTooFew.length || lpTooMany.length || bankOff;

  if(!anyProblem){
    showFeedback("good", "Nice work — that Lewis model matches!", [
      "Your electron bank is fully used and the bonding/lone pairs match the target molecule."
    ]);
    return;
  }

  // Friendly hints — do not give exact “add X here”
  const hints = [];

  if(missingBonds.length){
    hints.push("Start by making sure every atom is connected with a bond (no “floating” atoms).");
  }

  if(wrongOrder.length){
    // molecule-specific gentle nudge
    if(mol.formula==="CO2"){
      hints.push("CO₂ often needs multiple bonds so carbon can reach an octet.");
    } else if(mol.formula==="O2"){
      hints.push("O₂ usually needs a multiple bond to fill both oxygen octets.");
    } else if(mol.formula==="N2"){
      hints.push("N₂ usually needs a stronger (multiple) bond to fill both nitrogen octets.");
    } else if(mol.formula==="HCN"){
      hints.push("HCN typically has one single bond and one multiple bond to complete octets.");
    } else {
      hints.push("Re-check whether any bond should be single vs double vs triple to complete octets.");
    }
  }

  if(lpTooFew.length || lpTooMany.length){
    hints.push("After bonding, use lone pairs to complete the outer shells (H has none).");
  }

  if(bankOff){
    if(state.remaining > 0){
      hints.push("You still have electrons left in your bank — those usually become lone pairs.");
    } else {
      hints.push("You spent too many electrons — remove something or choose smaller bond orders.");
    }
  }

  // Add one “common pattern” hint for certain molecules
  const special = {
    "CF4":"Carbon typically makes 4 single bonds.",
    "CBr4":"Carbon typically makes 4 single bonds.",
    "NH3":"Nitrogen often has 3 bonds and 1 lone pair.",
    "PF3":"Phosphorus often has 3 bonds and 1 lone pair.",
    "H2O":"Oxygen often has 2 bonds and 2 lone pairs.",
    "HF":"Hydrogen has 1 bond; fluorine usually has 3 lone pairs.",
    "F2":"Halogens usually have 1 bond and 3 lone pairs.",
    "Br2":"Halogens usually have 1 bond and 3 lone pairs."
  };
  if(special[mol.formula]) hints.push(special[mol.formula]);

  showFeedback("bad", "Not yet — you're close.", hints);
}

function showCorrectModel(){
  const mol = state.mol;
  if(!mol) return;

  // wipe placements
  state.bonds = new Map();
  state.lonePairs = new Map();
  state.remaining = state.totalVE;

  // place expected bonds
  mol.expectedBonds.forEach(b=>{
    state.bonds.set(bondKey(b.a,b.b), b.order);
    state.remaining -= bondCost(b.order);
  });

  // place expected lone pairs into first available slots (up to 4 per atom)
  mol.expectedLP.forEach((lpCount, atomIdx)=>{
    for(let i=0;i<lpCount;i++){
      const k = `${atomIdx}:${i}`; // use top/right/bottom/left in order
      state.lonePairs.set(k,true);
      state.remaining -= lpCost();
    }
  });

  updateBankUI();
  renderModel();
  showFeedback("good", "Correct model shown.", [
    "Study the bond orders and where lone pairs appear, then try a New molecule to practice again."
  ]);
}

// ---------- events ----------
veCheckBtn.addEventListener("click", ()=>{
  if(!state.mol) return;
  clearFeedback();

  const expected = sumValence(state.mol.atoms);
  const val = Number(veInput.value);

  // fix: treat blank/NaN
  if(!Number.isFinite(val)){
    veMsg.style.display="block";
    veMsg.className="msg msg-warn";
    veMsg.textContent="Enter a number first.";
    return;
  }

  if(val === expected){
    state.confirmedVE = true;
    state.totalVE = expected;
    state.remaining = expected;

    veMsg.style.display="block";
    veMsg.className="msg msg-good";
    veMsg.textContent="Correct. Electron bank unlocked.";

    bankLockedMsg.style.display = "none";
    updateBankUI();

    buildCentralOptions();
    statusMsg.className = "msg msg-neutral";
    statusMsg.textContent = state.mol.centralNeeded
      ? "Now choose and lock the central atom."
      : "You can build now.";

    renderModel();
  } else {
    veMsg.style.display="block";
    veMsg.className="msg msg-warn";
    // helpful but not giving away full answer
    veMsg.textContent=`Not quite. Hint: add the valence electrons for each atom in ${state.mol.formula}.`;
  }
});

lockCentralBtn.addEventListener("click", ()=>{
  if(!state.confirmedVE) return;
  if(!state.mol) return;

  // if central not needed, already handled
  const pick = centralSelect.value;
  if(!pick){
    centralMsg.className="msg msg-warn";
    centralMsg.textContent="Pick a central atom first.";
    return;
  }

  state.chosenCentral = Number(pick);
  state.centralLocked = true;

  centralMsg.className="msg msg-good";
  centralMsg.textContent=`Central atom locked: ${state.mol.atoms[state.chosenCentral]} (atom ${state.chosenCentral+1}). Now build the model.`;

  enableBuilding();
});

resetBuildBtn.addEventListener("click", ()=>{
  resetAll();
  // keep molecule, but reset step 1 too
  if(state.mol){
    molName.textContent = state.mol.formula;
    molPrompt.textContent = `Confirm total valence electrons, choose the central atom (if applicable), then build.`;
  }
});

clearBtn.addEventListener("click", ()=>{
  if(!state.confirmedVE || !state.centralLocked) return;
  resetBuildOnly();
});

checkBtn.addEventListener("click", ()=>{
  if(!state.confirmedVE || !state.centralLocked) return;
  checkMoleculeFriendly();
});

showBtn.addEventListener("click", ()=>{
  if(!state.confirmedVE || !state.centralLocked) return;
  showCorrectModel();
});

newBtn.addEventListener("click", ()=>{
  pickRandomMolecule();
});

// ---------- initialization ----------
function pickRandomMolecule(){
  const mol = MOLECULES[Math.floor(Math.random()*MOLECULES.length)];
  setMolecule(mol);
}

function init(){
  setupToolDrag();
  pickRandomMolecule();
}

init();
