// Covalent Bonding Coach (Lewis Structures)
// - Supports: diatomic (2 atoms), linear triatomic (2 terminals), trigonal (3 terminals), tetra (4 terminals)
// - One bond tile per connection (bond zone between atoms)
// - Lone pairs in slots around atoms
// - Electron bank hidden until Step 0 count is correct
// - Student-friendly feedback

const VALENCE = { H:1, C:4, N:5, O:6, F:7, Br:7, P:5 };

// ---------------------------
// Molecule definitions
// ---------------------------
// Each molecule:
// - name
// - atoms: array of symbols
// - centralCandidates: array of valid central indices OR null for diatomic
// - connections: list of pairs [a,b] (atom indices) that should have a bond zone
// - answer:
//    bonds: { "a-b": order } where key is "min-max"
//    lonePairs: { [atomIndex]: count }  // count of lone pairs on that atom
const MOLECULES = [
  // Diatomic
  { name:"H2",  atoms:["H","H"],  centralCandidates:null,
    connections:[[0,1]],
    answer:{ bonds:{ "0-1":1 }, lonePairs:{ 0:0, 1:0 } }
  },
  { name:"F2",  atoms:["F","F"],  centralCandidates:null,
    connections:[[0,1]],
    answer:{ bonds:{ "0-1":1 }, lonePairs:{ 0:3, 1:3 } }
  },
  { name:"Br2", atoms:["Br","Br"], centralCandidates:null,
    connections:[[0,1]],
    answer:{ bonds:{ "0-1":1 }, lonePairs:{ 0:3, 1:3 } }
  },
  { name:"HF",  atoms:["H","F"],  centralCandidates:null,
    connections:[[0,1]],
    answer:{ bonds:{ "0-1":1 }, lonePairs:{ 0:0, 1:3 } }
  },
  { name:"O2",  atoms:["O","O"],  centralCandidates:null,
    connections:[[0,1]],
    answer:{ bonds:{ "0-1":2 }, lonePairs:{ 0:2, 1:2 } }
  },
  { name:"N2",  atoms:["N","N"],  centralCandidates:null,
    connections:[[0,1]],
    answer:{ bonds:{ "0-1":3 }, lonePairs:{ 0:1, 1:1 } }
  },

  // Linear triatomic / 2 terminals around central
  { name:"CO2", atoms:["O","C","O"], centralCandidates:[1],
    connections:[[1,0],[1,2]],
    answer:{ bonds:{ "0-1":2, "1-2":2 }, lonePairs:{ 0:2, 1:0, 2:2 } }
  },
  { name:"HCN", atoms:["H","C","N"], centralCandidates:[1],
    connections:[[1,0],[1,2]],
    answer:{ bonds:{ "0-1":1, "1-2":3 }, lonePairs:{ 0:0, 1:0, 2:1 } }
  },
  { name:"H2O", atoms:["H","O","H"], centralCandidates:[1],
    connections:[[1,0],[1,2]],
    answer:{ bonds:{ "0-1":1, "1-2":1 }, lonePairs:{ 0:0, 1:2, 2:0 } }
  },

  // 3 terminals around central
  { name:"NH3", atoms:["N","H","H","H"], centralCandidates:[0],
    connections:[[0,1],[0,2],[0,3]],
    answer:{ bonds:{ "0-1":1, "0-2":1, "0-3":1 }, lonePairs:{ 0:1, 1:0, 2:0, 3:0 } }
  },
  { name:"PF3", atoms:["P","F","F","F"], centralCandidates:[0],
    connections:[[0,1],[0,2],[0,3]],
    answer:{ bonds:{ "0-1":1, "0-2":1, "0-3":1 }, lonePairs:{ 0:1, 1:3, 2:3, 3:3 } }
  },

  // 4 terminals around central
  { name:"CF4", atoms:["C","F","F","F","F"], centralCandidates:[0],
    connections:[[0,1],[0,2],[0,3],[0,4]],
    answer:{ bonds:{ "0-1":1, "0-2":1, "0-3":1, "0-4":1 }, lonePairs:{ 0:0, 1:3, 2:3, 3:3, 4:3 } }
  },
  { name:"CBr4", atoms:["C","Br","Br","Br","Br"], centralCandidates:[0],
    connections:[[0,1],[0,2],[0,3],[0,4]],
    answer:{ bonds:{ "0-1":1, "0-2":1, "0-3":1, "0-4":1 }, lonePairs:{ 0:0, 1:3, 2:3, 3:3, 4:3 } }
  },
];

// ---------------------------
// State
// ---------------------------
const state = {
  mol: null,
  bankUnlocked: false,
  bankTotal: 0,
  bankLeft: 0,

  centralIdx: null,
  locked: false,

  // placements:
  // bondZones: key "a-b" => "bond1"|"bond2"|"bond3" (one tile per connection)
  bondZones: {},
  // lonePairs slots: key "atomIndex-dir" => "lp"
  lpSlots: {},

  // layout positions (percent-based for DOM, viewBox coords for SVG)
  layout: null, // { atoms: {idx:{xPct,yPct,x,y}}, bonds:[{a,b,xPct,yPct}] }
};

const SLOT_DIRS = ["Top","Right","Bottom","Left"];

// ---------------------------
// Helpers
// ---------------------------
function $(id){ return document.getElementById(id); }

function keyAB(a,b){
  const lo = Math.min(a,b);
  const hi = Math.max(a,b);
  return `${lo}-${hi}`;
}

function bondOrder(item){
  if (item==="bond1") return 1;
  if (item==="bond2") return 2;
  if (item==="bond3") return 3;
  return 0;
}

function bondCost(item){
  const o = bondOrder(item);
  if (o===1) return 2;
  if (o===2) return 4;
  if (o===3) return 6;
  return 0;
}

function totalValence(mol){
  return mol.atoms.reduce((sum, sym) => sum + (VALENCE[sym] ?? 0), 0);
}

function slotKey(atomIndex, dir){
  return `${atomIndex}-${dir}`;
}

function setFeedback(el, html, kind=null){
  el.className = "feedback" + (kind==="good" ? " good" : kind==="bad" ? " bad" : "");
  el.innerHTML = html;
}

function updateBankUI(){
  if (!state.bankUnlocked){
    $("bankTotal").textContent = "—";
    $("bankLeft").textContent = "—";
    $("bankTotal2").textContent = "—";
    $("bankLeft2").textContent = "—";
    return;
  }
  $("bankTotal").textContent = String(state.bankTotal);
  $("bankLeft").textContent = String(state.bankLeft);
  $("bankTotal2").textContent = String(state.bankTotal);
  $("bankLeft2").textContent = String(state.bankLeft);
}

function recalcBank(){
  if (!state.bankUnlocked){
    state.bankLeft = state.bankTotal;
    updateBankUI();
    return;
  }

  let spentBonds = 0;
  for (const k in state.bondZones){
    spentBonds += bondCost(state.bondZones[k]);
  }
  const spentLP = Object.values(state.lpSlots).length * 2;
  state.bankLeft = state.bankTotal - spentBonds - spentLP;
  updateBankUI();
}

function countLonePairsOnAtom(atomIndex){
  let c = 0;
  for (const dir of SLOT_DIRS){
    if (state.lpSlots[slotKey(atomIndex, dir)] === "lp") c++;
  }
  return c;
}

function clearBuild(){
  state.bondZones = {};
  state.lpSlots = {};
  recalcBank();
  renderModel();
}

// ---------------------------
// Layout builder
// ---------------------------
function buildLayout(mol, centralIdx){
  // Returns percent positions for atoms + bond zone positions, plus SVG coordinates.
  // SVG viewBox: 1000x600 (same for all layouts)
  const vb = { w:1000, h:600 };

  const atoms = {};
  const bonds = [];

  // diatomic: 2 atoms, one bond between them
  if (!mol.centralCandidates){
    atoms[0] = { xPct:35, yPct:50, x:350, y:300 };
    atoms[1] = { xPct:65, yPct:50, x:650, y:300 };
    bonds.push({ a:0, b:1, xPct:50, yPct:50, x:500, y:300 });
    return { atoms, bonds, vb };
  }

  // central-based
  const allIdx = mol.atoms.map((_,i)=>i);
  const terminals = allIdx.filter(i => i !== centralIdx);
  const tCount = terminals.length;

  // central position
  atoms[centralIdx] = { xPct:50, yPct:50, x:500, y:300 };

  if (tCount === 2){
    // linear triatomic / 2 terminals: left and right
    const left = terminals[0];
    const right = terminals[1];
    atoms[left]  = { xPct:30, yPct:50, x:300, y:300 };
    atoms[right] = { xPct:70, yPct:50, x:700, y:300 };

    bonds.push({ a:centralIdx, b:left,  xPct:40, yPct:50, x:400, y:300 });
    bonds.push({ a:centralIdx, b:right, xPct:60, yPct:50, x:600, y:300 });
    return { atoms, bonds, vb };
  }

  if (tCount === 3){
    // trigonal-ish: top, left, right around central (simple + clean)
    const top = terminals[0];
    const left = terminals[1];
    const right = terminals[2];

    atoms[top]   = { xPct:50, yPct:22, x:500, y:132 };
    atoms[left]  = { xPct:30, yPct:62, x:300, y:372 };
    atoms[right] = { xPct:70, yPct:62, x:700, y:372 };

    bonds.push({ a:centralIdx, b:top,   xPct:50, yPct:36, x:500, y:216 });
    bonds.push({ a:centralIdx, b:left,  xPct:40, yPct:56, x:400, y:336 });
    bonds.push({ a:centralIdx, b:right, xPct:60, yPct:56, x:600, y:336 });
    return { atoms, bonds, vb };
  }

  // 4 terminals: top, right, bottom, left
  const top = terminals[0];
  const right = terminals[1];
  const bottom = terminals[2];
  const left = terminals[3];

  atoms[top]    = { xPct:50, yPct:18, x:500, y:108 };
  atoms[right]  = { xPct:74, yPct:50, x:740, y:300 };
  atoms[bottom] = { xPct:50, yPct:82, x:500, y:492 };
  atoms[left]   = { xPct:26, yPct:50, x:260, y:300 };

  bonds.push({ a:centralIdx, b:top,    xPct:50, yPct:34, x:500, y:204 });
  bonds.push({ a:centralIdx, b:right,  xPct:62, yPct:50, x:620, y:300 });
  bonds.push({ a:centralIdx, b:bottom, xPct:50, yPct:66, x:500, y:396 });
  bonds.push({ a:centralIdx, b:left,   xPct:38, yPct:50, x:380, y:300 });
  return { atoms, bonds, vb };
}

// ---------------------------
// Central options + step behavior
// ---------------------------
function populateCentralOptions(){
  const sel = $("centralSelect");
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select…";
  sel.appendChild(opt0);

  state.mol.atoms.forEach((sym, idx) => {
    if (sym === "H") return; // never central
    const o = document.createElement("option");
    o.value = String(idx);
    o.textContent = `${sym} (atom ${idx+1})`;
    sel.appendChild(o);
  });
}

// ---------------------------
// Drag setup
// ---------------------------
function setupDragToolbox(){
  document.querySelectorAll(".tool").forEach(tool => {
    tool.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", tool.dataset.item);
    });
  });
}

// ---------------------------
// Model rendering (DOM + SVG)
// ---------------------------
function renderModel(){
  const area = $("modelArea");
  area.innerHTML = "";

  // SVG bonds
  const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("class","bondSvg");
  svg.setAttribute("viewBox","0 0 1000 600");
  svg.setAttribute("preserveAspectRatio","none");
  area.appendChild(svg);

  // If not ready, show message
  if (!state.bankUnlocked){
    const msg = document.createElement("div");
    msg.className = "muted";
    msg.style.padding = "10px";
    msg.textContent = "Complete Step 0 first, then the build area will unlock.";
    area.appendChild(msg);
    return;
  }

  if (state.mol.centralCandidates && !state.locked){
    const msg = document.createElement("div");
    msg.className = "muted";
    msg.style.padding = "10px";
    msg.textContent = "Lock a central atom to begin building the model.";
    area.appendChild(msg);
    return;
  }

  // layout
  const centralIdx = state.mol.centralCandidates ? state.centralIdx : null;
  state.layout = buildLayout(state.mol, centralIdx ?? 0);

  // draw placed bonds (SVG)
  for (const bond of state.layout.bonds){
    const k = keyAB(bond.a, bond.b);
    const item = state.bondZones[k];
    const order = bondOrder(item);
    if (order > 0){
      drawBond(svg, state.layout.atoms[bond.a], state.layout.atoms[bond.b], order);
    }
  }

  // atoms + lone pair slots
  Object.keys(state.layout.atoms).forEach(k => {
    const idx = Number(k);
    createAtom(area, idx, state.mol.atoms[idx], state.layout.atoms[idx], idx === state.centralIdx);
  });

  // bond zones
  for (const bond of state.layout.bonds){
    const k = keyAB(bond.a, bond.b);
    const item = state.bondZones[k] || null;
    createBondZone(area, bond.a, bond.b, bond, item);
  }
}

function drawBond(svg, p1, p2, order){
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny =  dx / len;

  // pull endpoints in so lines don't run through the atom core
  const pad = 60;
  const sx = p1.x + (dx/len)*pad;
  const sy = p1.y + (dy/len)*pad;
  const ex = p2.x - (dx/len)*pad;
  const ey = p2.y - (dy/len)*pad;

  const spacing = 12;
  for (let i=0; i<order; i++){
    let offset = 0;
    if (order === 2){
      offset = (i===0 ? -spacing/2 : spacing/2);
    } else if (order === 3){
      offset = (i===0 ? -spacing : i===1 ? 0 : spacing);
    }

    const x1 = sx + nx*offset;
    const y1 = sy + ny*offset;
    const x2 = ex + nx*offset;
    const y2 = ey + ny*offset;

    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#8C1D40");
    line.setAttribute("stroke-width", "7");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
  }
}

function createBondZone(parent, a, b, pos, item){
  const z = document.createElement("div");
  z.className = "bondZone" + (item ? " filled" : "");
  z.style.left = `${pos.xPct}%`;
  z.style.top  = `${pos.yPct}%`;

  if (item){
    z.innerHTML = `<div class="label">${item==="bond1"?"—":item==="bond2"?"=":"≡"}</div>`;
  } else {
    z.innerHTML = `<div class="hint">drop bond</div>`;
  }

  z.addEventListener("dragover", (e) => e.preventDefault());
  z.addEventListener("drop", (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.getData("text/plain");
    if (!dropped) return;

    if (!["bond1","bond2","bond3"].includes(dropped)){
      setFeedback($("checkFeedback"),
        `That item doesn’t go between atoms. <strong>Only bonds</strong> go in the bond space. Put <strong>lone pairs</strong> in the atom slots.`,
        "bad"
      );
      return;
    }

    state.bondZones[keyAB(a,b)] = dropped;
    recalcBank();
    renderModel();
  });

  z.addEventListener("click", () => {
    const k = keyAB(a,b);
    if (state.bondZones[k]){
      delete state.bondZones[k];
      recalcBank();
      renderModel();
    }
  });

  parent.appendChild(z);
}

function createAtom(parent, atomIndex, symbol, pos, isCenter){
  const wrap = document.createElement("div");
  wrap.className = "atomWrap";
  wrap.style.left = `${pos.xPct}%`;
  wrap.style.top  = `${pos.yPct}%`;
  parent.appendChild(wrap);

  const core = document.createElement("div");
  core.className = "atomCore" + (isCenter ? " center" : "");
  core.textContent = symbol;
  wrap.appendChild(core);

  // lone pair slots
  SLOT_DIRS.forEach(dir => {
    const s = document.createElement("div");
    s.className = `slot slot${dir}`;

    const k = slotKey(atomIndex, dir);
    const hasLP = state.lpSlots[k] === "lp";

    if (hasLP){
      s.classList.add("filled");
      s.innerHTML = `<span style="color:#8C1D40;font-weight:1000;">••</span>`;
    } else {
      s.innerHTML = `<span class="muted">drop</span>`;
    }

    s.addEventListener("dragover", (e) => e.preventDefault());
    s.addEventListener("drop", (e) => {
      e.preventDefault();
      const dropped = e.dataTransfer.getData("text/plain");
      if (!dropped) return;

      if (dropped !== "lp"){
        setFeedback($("checkFeedback"),
          `Bonds go <strong>between atoms</strong>. This slot is for <strong>lone pairs</strong> only.`,
          "bad"
        );
        return;
      }

      // hydrogen rule
      if (symbol === "H"){
        setFeedback($("checkFeedback"),
          `Hydrogen can’t have lone pairs. Try placing that lone pair on the other atom.`,
          "bad"
        );
        return;
      }

      state.lpSlots[k] = "lp";
      recalcBank();
      renderModel();
    });

    s.addEventListener("click", () => {
      if (state.lpSlots[k]){
        delete state.lpSlots[k];
        recalcBank();
        renderModel();
      }
    });

    wrap.appendChild(s);
  });
}

// ---------------------------
// Step 0: Count check
// ---------------------------
function checkCount(){
  const raw = $("countInput").value.trim();
  const n = Number(raw);

  if (!raw || !Number.isFinite(n) || n < 0){
    setFeedback($("countFeedback"), "Enter a valid number.", "bad");
    return;
  }

  const correct = state.bankTotal;

  if (n !== correct){
    setFeedback(
      $("countFeedback"),
      `Not yet. Try again. <br><span class="muted">Hint: Add the valence electrons from each atom in <strong>${state.mol.name}</strong>.</span>`,
      "bad"
    );
    return;
  }

  state.bankUnlocked = true;
  state.bankLeft = state.bankTotal;
  updateBankUI();

  setFeedback($("countFeedback"),
    `✅ Correct! Total valence electrons = <strong>${correct}</strong>. Your electron bank is now unlocked.`,
    "good"
  );

  // If diatomic, skip central atom step
  if (!state.mol.centralCandidates){
    $("centralStep").style.display = "none";
    $("builder").setAttribute("aria-disabled","false");
    setFeedback($("checkFeedback"),
      `Now build the structure. (This molecule has <strong>no central atom</strong>.)`,
      null
    );
    renderModel();
    return;
  }

  $("centralStep").style.display = "";
  $("centralStep").setAttribute("aria-disabled","false");
  setFeedback($("centralFeedback"),
    `Now choose the best central atom and click <strong>Lock central atom</strong>.`,
    null
  );
  renderModel();
}

function recount(){
  state.bankUnlocked = false;
  updateBankUI();

  $("countInput").value = "";
  setFeedback($("countFeedback"), "Enter the total valence electrons again.", null);

  $("centralStep").setAttribute("aria-disabled","true");
  $("builder").setAttribute("aria-disabled","true");

  state.centralIdx = null;
  state.locked = false;
  clearBuild();

  setFeedback($("centralFeedback"), "Complete Step 0 first.", null);
  setFeedback($("checkFeedback"), "Complete Step 0 first.", null);
  renderModel();
}

// ---------------------------
// Step 1: Central atom lock
// ---------------------------
function lockCentral(){
  if (!state.bankUnlocked){
    setFeedback($("centralFeedback"), "Complete Step 0 first.", "bad");
    return;
  }
  const val = $("centralSelect").value;
  if (!val){
    setFeedback($("centralFeedback"), "Select a central atom first.", "bad");
    return;
  }

  const idx = Number(val);

  if (state.mol.centralCandidates && !state.mol.centralCandidates.includes(idx)){
    const hint = bestCentralHint(state.mol);
    setFeedback($("centralFeedback"),
      `Not quite. Try again.<br><span class="muted">${hint}</span>`,
      "bad"
    );
    return;
  }

  state.centralIdx = idx;
  state.locked = true;

  $("builder").setAttribute("aria-disabled","false");
  setFeedback($("centralFeedback"),
    `✅ Central atom locked: <strong>${state.mol.atoms[idx]} (atom ${idx+1})</strong>. Now build the model.`,
    "good"
  );

  clearBuild();
}

function bestCentralHint(mol){
  // Student-friendly rules of thumb (not formal-charge talk)
  // - H never central (already enforced)
  // - Often least electronegative (excluding H) is central (C, then N, then O; halogens rarely central)
  const syms = mol.atoms.map(s=>s);
  if (syms.includes("C")) return "Rule of thumb: carbon is often central if it’s in the molecule.";
  if (syms.includes("N")) return "Rule of thumb: nitrogen is often central (and hydrogen is never central).";
  if (syms.includes("P")) return "Phosphorus is the central atom here.";
  return "Try the atom that can make the most bonds (and is not hydrogen).";
}

// ---------------------------
// Student-friendly checker
// ---------------------------
function checkStructure(){
  if (!state.bankUnlocked){
    setFeedback($("checkFeedback"), "Complete Step 0 first.", "bad");
    return;
  }
  if (state.mol.centralCandidates && !state.locked){
    setFeedback($("checkFeedback"), "Lock a central atom first.", "bad");
    return;
  }
  if (state.bankLeft < 0){
    setFeedback($("checkFeedback"),
      `Your electron bank went negative. That means you used <strong>too many electrons</strong>. Try removing a bond or a lone pair.`,
      "bad"
    );
    return;
  }

  const mol = state.mol;
  const expB = mol.answer.bonds;
  const expLP = mol.answer.lonePairs;

  // Compare bonds
  const bondHints = [];
  const lpHints = [];

  for (const conn of mol.connections){
    const k = keyAB(conn[0], conn[1]);
    const expectedOrder = expB[k] || 0;
    const gotOrder = bondOrder(state.bondZones[k]);

    if (gotOrder !== expectedOrder){
      bondHints.push({ k, expectedOrder, gotOrder, a:conn[0], b:conn[1] });
    }
  }

  // Compare lone pairs
  for (let i=0; i<mol.atoms.length; i++){
    const expected = expLP[i] ?? 0;
    const got = countLonePairsOnAtom(i);
    if (got !== expected){
      lpHints.push({ i, sym: mol.atoms[i], expected, got });
    }
  }

  // Friendly feedback build
  if (bondHints.length === 0 && lpHints.length === 0 && state.bankLeft === 0){
    setFeedback($("checkFeedback"),
      `✅ Nice work — your Lewis structure checks out, and you used the full electron bank.`,
      "good"
    );
    return;
  }

  // Build short, student-friendly guidance
  const lines = [];
  lines.push(`<strong>Not yet — you’re close.</strong>`);

  // 1) Bank guidance
  if (state.bankLeft > 0){
    lines.push(`• You still have <strong>${state.bankLeft} electrons</strong> left. Add <strong>${state.bankLeft/2}</strong> lone pair(s) in a place that makes sense.`);
  } else if (state.bankLeft === 0){
    lines.push(`• Your electron bank is used up (that’s good). Now fix where the bonds/lone pairs are.`);
  }

  // 2) Bonds guidance (high priority)
  if (bondHints.length){
    lines.push(`<br><strong>Try fixing bonds first:</strong>`);
    lines.push(`• ${bondAdvice(mol, bondHints)}`);
  }

  // 3) Lone pairs guidance
  if (lpHints.length){
    lines.push(`<br><strong>Then adjust lone pairs:</strong>`);
    const friendly = lpHints
      .slice(0,3)
      .map(h => {
        const atomName = `${h.sym} (atom ${h.i+1})`;
        if (h.got < h.expected) return `Add ${h.expected - h.got} lone pair(s) on <strong>${atomName}</strong>.`;
        return `Remove ${h.got - h.expected} lone pair(s) from <strong>${atomName}</strong>.`;
      });
    lines.push(`• ${friendly.join(" ")}`);
    if (lpHints.length > 3) lines.push(`• (Keep going — a couple more atoms need lone-pair changes.)`);
  }

  // 4) molecule-specific gentle reminder
  lines.push(`<br><span class="muted">${moleculeReminder(mol)}</span>`);

  setFeedback($("checkFeedback"), lines.join("<br>"), "bad");
}

function bondAdvice(mol, bondHints){
  // Very short “what to try” by molecule
  const name = mol.name;

  if (name === "CO2") return `CO2 usually has <strong>two double bonds</strong>: O=C=O. Try making both bonds <strong>double</strong>.`;
  if (name === "O2") return `O2 is usually a <strong>double bond</strong>: O=O.`;
  if (name === "N2") return `N2 is usually a <strong>triple bond</strong>: N≡N.`;
  if (name === "HCN") return `HCN is usually <strong>H—C≡N</strong> (single to H, triple to N).`;
  if (name === "H2O") return `H2O usually has <strong>two single bonds</strong>: H—O—H.`;
  if (name === "NH3") return `NH3 usually has <strong>three single bonds</strong> to H.`;
  if (name === "PF3") return `PF3 usually has <strong>three single bonds</strong> from P to F.`;
  if (name === "CF4") return `CF4 usually has <strong>four single bonds</strong> from C to F.`;
  if (name === "CBr4") return `CBr4 usually has <strong>four single bonds</strong> from C to Br.`;
  if (name === "F2" || name === "Br2" || name === "HF" || name === "H2") return `${name} usually has a <strong>single bond</strong>.`;

  // fallback: summarize one wrong bond (simple)
  const b = bondHints[0];
  const want = b.expectedOrder;
  const wantText = want===1 ? "single" : want===2 ? "double" : "triple";
  return `One bond should be <strong>${wantText}</strong>. Try changing a bond tile and re-check.`;
}

function moleculeReminder(mol){
  const name = mol.name;
  if (["F2","Br2"].includes(name)) return `Reminder: each halogen usually has <strong>3 lone pairs</strong>.`;
  if (name === "HF") return `Reminder: hydrogen has <strong>0 lone pairs</strong>, fluorine usually has <strong>3 lone pairs</strong>.`;
  if (name === "H2") return `Reminder: hydrogen has <strong>0 lone pairs</strong>.`;
  if (name === "O2") return `Reminder: each oxygen usually has <strong>2 lone pairs</strong>.`;
  if (name === "N2") return `Reminder: each nitrogen usually has <strong>1 lone pair</strong>.`;
  if (name === "CO2") return `Reminder: each oxygen usually has <strong>2 lone pairs</strong>.`;
  if (name === "HCN") return `Reminder: nitrogen usually has <strong>1 lone pair</strong>.`;
  if (name === "NH3") return `Reminder: nitrogen usually has <strong>1 lone pair</strong>.`;
  if (name === "H2O") return `Reminder: oxygen usually has <strong>2 lone pairs</strong>.`;
  if (name === "PF3") return `Reminder: each fluorine usually has <strong>3 lone pairs</strong>, and phosphorus has <strong>1 lone pair</strong>.`;
  if (name === "CF4") return `Reminder: each fluorine usually has <strong>3 lone pairs</strong>.`;
  if (name === "CBr4") return `Reminder: each bromine usually has <strong>3 lone pairs</strong>.`;
  return `Build bonds first, then use remaining electrons as lone pairs.`;
}

// ---------------------------
// Show answer
// ---------------------------
function showAnswer(){
  if (!state.bankUnlocked){
    setFeedback($("checkFeedback"), "Complete Step 0 first.", "bad");
    return;
  }
  if (state.mol.centralCandidates && !state.locked){
    setFeedback($("checkFeedback"), "Lock a central atom first.", "bad");
    return;
  }

  clearBuild();

  // Bonds
  for (const k in state.mol.answer.bonds){
    const order = state.mol.answer.bonds[k];
    state.bondZones[k] = order === 1 ? "bond1" : order === 2 ? "bond2" : "bond3";
  }

  // Lone pairs: place them into available slots (top/right/bottom/left)
  for (let i=0; i<state.mol.atoms.length; i++){
    const need = state.mol.answer.lonePairs[i] ?? 0;
    let placed = 0;

    // don't place LP on H (should be 0 anyway)
    if (state.mol.atoms[i] === "H") continue;

    for (const dir of SLOT_DIRS){
      if (placed >= need) break;
      state.lpSlots[slotKey(i, dir)] = "lp";
      placed++;
    }
  }

  recalcBank();
  renderModel();

  setFeedback($("checkFeedback"),
    `Here’s one correct model. Try rebuilding it on your own next time (clear placements and try again).`,
    null
  );
}

// ---------------------------
// Loading
// ---------------------------
function loadMolecule(){
  state.mol = MOLECULES[Math.floor(Math.random() * MOLECULES.length)];

  state.bankTotal = totalValence(state.mol);
  state.bankLeft = state.bankTotal;
  state.bankUnlocked = false;

  state.centralIdx = null;
  state.locked = false;

  state.bondZones = {};
  state.lpSlots = {};

  $("molTitle").textContent = `Molecule: ${state.mol.name}`;
  $("molPrompt").textContent = `Count electrons → build bonds → add lone pairs → check.`;

  $("countInput").value = "";

  $("centralStep").style.display = "";
  $("centralStep").setAttribute("aria-disabled","true");
  $("builder").setAttribute("aria-disabled","true");

  populateCentralOptions();

  updateBankUI();
  renderModel();

  setFeedback($("countFeedback"), `Enter the total valence electrons for <strong>${state.mol.name}</strong>, then click <strong>Check my count</strong>.`, null);
  setFeedback($("centralFeedback"), `Complete Step 0 first.`, null);
  setFeedback($("checkFeedback"), `Complete Step 0 first.`, null);

  // For diatomic, central step will be hidden after Step 0 check succeeds
}

// ---------------------------
// Events
// ---------------------------
function init(){
  setupDragToolbox();

  $("newBtn").addEventListener("click", loadMolecule);
  $("checkCountBtn").addEventListener("click", checkCount);
  $("recountBtn").addEventListener("click", recount);

  $("lockCentral").addEventListener("click", lockCentral);

  $("resetBuild").addEventListener("click", () => {
    if (!state.bankUnlocked) return;

    state.centralIdx = null;
    state.locked = false;

    $("builder").setAttribute("aria-disabled","true");
    clearBuild();

    setFeedback($("centralFeedback"), `Choose the central atom again, then lock it.`, null);
    setFeedback($("checkFeedback"), `Lock a central atom first.`, null);
    renderModel();
  });

  $("clearBtn").addEventListener("click", () => {
    clearBuild();
    setFeedback($("checkFeedback"), `Cleared placements. Rebuild the structure and check again.`, null);
  });

  $("checkBtn").addEventListener("click", checkStructure);
  $("showAnswerBtn").addEventListener("click", showAnswer);

  loadMolecule();
}

init();
