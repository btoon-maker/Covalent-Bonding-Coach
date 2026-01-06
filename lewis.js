// Lewis Builder (neutral molecules, intro set)
// Enforces:
// Step 0) student counts electron bank BEFORE building
// Step 1) student chooses central atom BEFORE building
// Bank decreases with: bonds (2/4/6) and lone pairs (2 each)
// Adds: auto-prompts (nudges) only

const VALENCE = { H:1, C:4, N:5, O:6, F:7, Cl:7, Br:7, I:7, S:6, P:5 };

const MOLECULES = [
  {
    name: "H2O",
    atoms: ["O","H","H"],
    centralIndex: 0,
    answer: {
      bonds: [{a:0,b:1,order:1},{a:0,b:2,order:1}],
      lonePairs: {0:2,1:0,2:0}
    }
  },
  {
    name: "CO2",
    atoms: ["C","O","O"],
    centralIndex: 0,
    answer: {
      bonds: [{a:0,b:1,order:2},{a:0,b:2,order:2}],
      lonePairs: {0:0,1:2,2:2}
    }
  },
  {
    name: "NH3",
    atoms: ["N","H","H","H"],
    centralIndex: 0,
    answer: {
      bonds: [{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}],
      lonePairs: {0:1,1:0,2:0,3:0}
    }
  },
  {
    name: "CH4",
    atoms: ["C","H","H","H","H"],
    centralIndex: 0,
    answer: {
      bonds: [{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1},{a:0,b:4,order:1}],
      lonePairs: {0:0,1:0,2:0,3:0,4:0}
    }
  },
  {
    name: "O2",
    atoms: ["O","O"],
    centralIndex: 0, // symmetric; accept either (handled below)
    symmetricCentral: true,
    answer: {
      bonds: [{a:0,b:1,order:2}],
      lonePairs: {0:2,1:2}
    }
  },
  {
    name: "N2",
    atoms: ["N","N"],
    centralIndex: 0, // symmetric; accept either (handled below)
    symmetricCentral: true,
    answer: {
      bonds: [{a:0,b:1,order:3}],
      lonePairs: {0:1,1:1}
    }
  }
];

const state = {
  mol: null,
  lockedTotal: null,
  bankLeft: null,

  centralChosen: null,
  centralLocked: false,

  // student build
  bonds: [], // {a,b,order}
  lonePairs: {}, // idx -> count
  selectedAtom: null,
  connectFrom: null
};

function $(id){ return document.getElementById(id); }

function setFeedback(el, msg, kind=null){
  el.className = "feedback" + (kind==="good" ? " good" : kind==="bad" ? " bad" : "");
  el.innerHTML = msg;
}

function setCoach(msg){
  $("coachPrompts").innerHTML = msg;
}

function calcTotalValence(mol){
  return mol.atoms.reduce((sum, sym) => sum + (VALENCE[sym] ?? 0), 0);
}

function bondCost(order){ return order * 2; }  // single=2, double=4, triple=6
function lonePairCost(){ return 2; }

function findBond(a,b){
  const [x,y] = a < b ? [a,b] : [b,a];
  return state.bonds.find(bd => (bd.a===x && bd.b===y));
}

function setBond(a,b,order){
  const [x,y] = a < b ? [a,b] : [b,a];
  const existing = findBond(x,y);
  if (existing) existing.order = order;
  else state.bonds.push({a:x,b:y,order});
}

function totalSpent(){
  let spent = 0;
  for (const bd of state.bonds) spent += bondCost(bd.order);
  for (const k of Object.keys(state.lonePairs)) spent += (state.lonePairs[k] * lonePairCost());
  return spent;
}

function updateBank(){
  state.bankLeft = state.lockedTotal - totalSpent();
  $("bankLeft").textContent = String(state.bankLeft);
}

function targetForAtom(sym){
  return sym === "H" ? 2 : 8;
}

function electronCountAroundAtom(i){
  // Each bond order contributes 2 electrons around each atom
  let e = 0;
  for (const bd of state.bonds){
    if (bd.a===i || bd.b===i) e += (2 * bd.order);
  }
  e += (state.lonePairs[i] || 0) * 2;
  return e;
}

function disconnectedAtoms(){
  const n = state.mol.atoms.length;
  if (n <= 1) return [];
  const connected = new Array(n).fill(false);
  for (const bd of state.bonds){
    connected[bd.a] = true;
    connected[bd.b] = true;
  }
  // if there is at least one bond, central should be connected too—this is fine
  const disc = [];
  for (let i=0;i<n;i++){
    if (!connected[i]) disc.push(i);
  }
  // if no bonds at all, disc is everyone -> still useful prompt
  return disc;
}

function atomsNotSatisfied(){
  const issues = [];
  state.mol.atoms.forEach((sym, i) => {
    const around = electronCountAroundAtom(i);
    const target = targetForAtom(sym);
    if (around !== target){
      issues.push({ i, sym, around, target });
    }
  });
  return issues;
}

function suggestDoubleBondCandidate(){
  // Heuristic: if bank is 0 (or low) and someone is short, suggest upgrading a bond from central to a terminal.
  if (state.centralChosen === null) return null;
  const central = state.centralChosen;

  const issues = atomsNotSatisfied().filter(x => x.sym !== "H"); // don’t tell them to double bond H
  if (!issues.length) return null;

  // pick a non-central atom that is short
  const candidate = issues.find(x => x.i !== central) || issues[0];
  if (!candidate) return null;

  // must have a bond with central
  const bd = findBond(central, candidate.i);
  if (!bd) return null;

  if (bd.order >= 3) return null;
  return { from: central, to: candidate.i, currentOrder: bd.order };
}

function autoPrompt(){
  if (state.lockedTotal === null){
    setCoach("Start by <strong>counting total valence electrons</strong> and locking your electron bank.");
    return;
  }
  if (!state.centralLocked){
    setCoach("Next: <strong>choose and lock the central atom</strong> before building the skeleton.");
    return;
  }

  // building stage prompts
  if (state.bankLeft < 0){
    setCoach("⚠️ Your electron bank is <strong>negative</strong>. Remove a lone pair or reduce a bond order.");
    return;
  }

  const disc = disconnectedAtoms();
  if (state.bonds.length === 0){
    setCoach("Build your <strong>skeleton</strong> first: start by placing single bonds from the central atom to the outside atoms.");
    return;
  }
  if (disc.length > 0){
    const names = disc.map(i => `${state.mol.atoms[i]} (atom ${i+1})`).join(", ");
    setCoach(`Some atoms aren’t connected yet: <strong>${names}</strong>. Add bonds so every atom is part of the molecule.`);
    return;
  }

  const issues = atomsNotSatisfied();
  if (issues.length){
    // If electrons remain, suggest lone pairs
    if (state.bankLeft > 0){
      // prefer non-H atoms short of octet
      const t = issues.find(x => x.sym !== "H") || issues[0];
      setCoach(`You still have <strong>${state.bankLeft}</strong> electrons left. Add <strong>lone pairs</strong> to help ${t.sym} (atom ${t.i+1}) reach its target (${t.target}).`);
      return;
    }

    // If out of electrons, suggest multiple bond (heuristic)
    if (state.bankLeft === 0){
      const sug = suggestDoubleBondCandidate();
      if (sug){
        const a = state.mol.atoms[sug.from], b = state.mol.atoms[sug.to];
        const next = sug.currentOrder + 1;
        const word = next === 2 ? "double" : "triple";
        setCoach(`You’re out of electrons, but an atom still needs more. Consider upgrading the bond between <strong>${a} (atom ${sug.from+1})</strong> and <strong>${b} (atom ${sug.to+1})</strong> to a <strong>${word} bond</strong>.`);
        return;
      }
      const t = issues.find(x => x.sym !== "H") || issues[0];
      setCoach(`You’re out of electrons, but ${t.sym} (atom ${t.i+1}) still isn’t satisfied. Consider a <strong>double/triple bond</strong> where appropriate.`);
      return;
    }
  }

  if (state.bankLeft !== 0){
    setCoach(`You have <strong>${state.bankLeft}</strong> electrons remaining. Use the bank until it reaches <strong>0</strong> (for these practice molecules).`);
    return;
  }

  setCoach("Looking good. Click <strong>Check structure</strong> when you’re ready.");
}

/* ---------- Rendering ---------- */

function renderProblem(){
  $("problemText").innerHTML = `
    <strong>Molecule:</strong> ${state.mol.name}<br>
    <span class="muted">Step 0: count total valence electrons. Step 1: choose central atom. Then build.</span>
  `;

  $("studentTotal").value = "";
  $("valenceHint").hidden = true;
  setFeedback($("totalFeedback"), "Enter your calculated total, then lock it in.", null);

  // Reset locks
  state.lockedTotal = null;
  state.bankLeft = null;
  state.centralChosen = null;
  state.centralLocked = false;

  // Disable steps
  $("centralStep").setAttribute("aria-disabled", "true");
  $("builder").setAttribute("aria-disabled", "true");
  $("bankLeft").textContent = "—";
  $("centralLockedText").textContent = "—";

  // Reset build
  state.bonds = [];
  state.lonePairs = {};
  state.selectedAtom = null;
  state.connectFrom = null;

  populateCentralSelect();
  renderAtoms();
  renderStructure();
  setFeedback($("centralFeedback"), "Lock your electron bank first, then choose the central atom.", null);
  setFeedback($("checkFeedback"), "Lock your electron bank and central atom first.", null);
  setCoach("Start by <strong>counting total valence electrons</strong> (Step 0).");
}

function populateCentralSelect(){
  const sel = $("centralSelect");
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select…";
  sel.appendChild(opt0);

  // candidates: any non-H atom indices (if all H, still list none)
  const candidates = state.mol.atoms
    .map((sym, idx) => ({sym, idx}))
    .filter(x => x.sym !== "H");

  candidates.forEach(c => {
    const o = document.createElement("option");
    o.value = String(c.idx);
    o.textContent = `${c.sym} (atom ${c.idx+1})`;
    sel.appendChild(o);
  });
}

function renderAtoms(){
  const box = $("atoms");
  box.innerHTML = "";
  state.mol.atoms.forEach((sym, idx) => {
    const btn = document.createElement("button");
    btn.className = "atomBtn" + (state.selectedAtom===idx ? " selected" : "");
    btn.type = "button";
    btn.innerHTML = `
      <span>${sym} <span class="atomSmall">(atom ${idx+1})</span></span>
      <span class="atomSmall">valence: ${VALENCE[sym] ?? "?"}</span>
    `;
    btn.addEventListener("click", () => {
      state.selectedAtom = idx;
      $("selectedAtomName").textContent = `${sym} (atom ${idx+1})`;
      renderAtoms();
      renderStructure();
      autoPrompt();
    });
    box.appendChild(btn);
  });

  $("selectedAtomName").textContent =
    state.selectedAtom===null ? "None" : `${state.mol.atoms[state.selectedAtom]} (atom ${state.selectedAtom+1})`;
}

function renderBondsText(){
  if (!state.bonds.length) return `<span class="muted">(none yet)</span>`;
  const sym = (i) => state.mol.atoms[i];
  const dash = (o) => o===1 ? "—" : o===2 ? "==" : "≡";
  return state.bonds
    .map(bd => `${sym(bd.a)}${dash(bd.order)}${sym(bd.b)} (order ${bd.order})`)
    .join(", ");
}

function renderStructure(){
  const area = $("structure");
  area.innerHTML = "";

  const row = document.createElement("div");
  row.className = "nodeRow";

  state.mol.atoms.forEach((sym, idx) => {
    const node = document.createElement("div");
    node.className = "node" + (state.connectFrom===idx ? " active" : "");
    node.innerHTML = `
      <span>${sym}</span>
      <div class="badges">
        <span class="badge">LP: ${state.lonePairs[idx] || 0}</span>
        <span class="badge">e⁻: ${electronCountAroundAtom(idx)}</span>
      </div>
    `;

    node.addEventListener("click", () => {
      if (state.lockedTotal === null || !state.centralLocked) return;

      // bond placing: click atom A then atom B
      if (state.connectFrom === null){
        state.connectFrom = idx;
      } else if (state.connectFrom === idx){
        state.connectFrom = null;
      } else {
        const order = Number($("bondOrder").value);
        setBond(state.connectFrom, idx, order);
        state.connectFrom = null;
        updateBank();
      }
      renderStructure();
      renderAtoms();
      autoPrompt();
    });

    row.appendChild(node);
  });

  area.appendChild(row);

  const list = document.createElement("div");
  list.style.marginTop = "12px";
  list.innerHTML = `<strong>Current bonds:</strong> ${renderBondsText()}`;
  area.appendChild(list);

  if (state.lockedTotal !== null && state.bankLeft < 0){
    const warn = document.createElement("div");
    warn.style.marginTop = "10px";
    warn.innerHTML = `<span style="font-weight:900;color:#8C1D40;">Warning:</span> Your bank is negative — you used too many electrons.`;
    area.appendChild(warn);
  }
}

/* ---------- Step locks ---------- */

function lockInTotal(){
  const raw = $("studentTotal").value.trim();
  const student = Number(raw);
  if (!Number.isFinite(student)){
    setFeedback($("totalFeedback"), "Type a number (example: <strong>8</strong>).", "bad");
    return;
  }

  const correct = calcTotalValence(state.mol);

  if (student !== correct){
    setFeedback(
      $("totalFeedback"),
      `Not quite. Your bank should be <strong>${correct}</strong> total valence electrons for ${state.mol.name}. Try again.`,
      "bad"
    );
    return;
  }

  state.lockedTotal = correct;
  state.bankLeft = correct;

  $("bankLeft").textContent = String(state.bankLeft);

  setFeedback(
    $("totalFeedback"),
    `✅ Correct. Electron bank locked at <strong>${correct}</strong>. Now choose the central atom (Step 1).`,
    "good"
  );

  // enable central step
  $("centralStep").setAttribute("aria-disabled", "false");
  setFeedback($("centralFeedback"), "Choose the central atom, then lock it in.", null);
  autoPrompt();
}

function lockCentral(){
  if (state.lockedTotal === null) return;

  const val = $("centralSelect").value;
  if (!val){
    setFeedback($("centralFeedback"), "Select a central atom first.", "bad");
    return;
  }

  const chosenIdx = Number(val);
  if (!Number.isFinite(chosenIdx)){
    setFeedback($("centralFeedback"), "Select a valid central atom.", "bad");
    return;
  }

  // Accept either atom for symmetric diatomics
  const correctIdx = state.mol.centralIndex;
  const ok = state.mol.symmetricCentral ? (chosenIdx === 0 || chosenIdx === 1) : (chosenIdx === correctIdx);

  if (!ok){
    setFeedback($("centralFeedback"), "Not quite. Try choosing the atom that best serves as the center of the skeleton.", "bad");
    return;
  }

  state.centralChosen = chosenIdx;
  state.centralLocked = true;

  $("centralLockedText").textContent = `${state.mol.atoms[chosenIdx]} (atom ${chosenIdx+1})`;

  setFeedback($("centralFeedback"), "✅ Central atom locked. Now build your skeleton with bonds.", "good");

  // enable builder
  $("builder").setAttribute("aria-disabled", "false");

  // reset any structure remnants just in case
  state.bonds = [];
  state.lonePairs = {};
  state.selectedAtom = null;
  state.connectFrom = null;
  updateBank();
  renderAtoms();
  renderStructure();
  setFeedback($("checkFeedback"), "Build bonds + lone pairs, then click <strong>Check structure</strong>.", null);
  autoPrompt();
}

/* ---------- Build actions ---------- */

function addLonePair(){
  if (state.lockedTotal === null || !state.centralLocked) return;
  if (state.selectedAtom === null){
    setFeedback($("checkFeedback"), "Select an atom first, then add a lone pair.", "bad");
    return;
  }
  state.lonePairs[state.selectedAtom] = (state.lonePairs[state.selectedAtom] || 0) + 1;
  updateBank();
  renderStructure();
  renderAtoms();
  autoPrompt();
}

function removeLonePair(){
  if (state.lockedTotal === null || !state.centralLocked) return;
  if (state.selectedAtom === null){
    setFeedback($("checkFeedback"), "Select an atom first.", "bad");
    return;
  }
  const cur = state.lonePairs[state.selectedAtom] || 0;
  if (cur <= 0) return;
  state.lonePairs[state.selectedAtom] = cur - 1;
  updateBank();
  renderStructure();
  renderAtoms();
  autoPrompt();
}

function clearAll(){
  if (state.lockedTotal === null || !state.centralLocked) return;
  state.bonds = [];
  state.lonePairs = {};
  state.connectFrom = null;
  updateBank();
  renderStructure();
  renderAtoms();
  setFeedback($("checkFeedback"), "Cleared. Rebuild your structure.", null);
  autoPrompt();
}

/* ---------- Checks ---------- */

function checkStructure(){
  if (state.lockedTotal === null){
    setFeedback($("checkFeedback"), "Lock in your electron bank first (Step 0).", "bad");
    autoPrompt();
    return;
  }
  if (!state.centralLocked){
    setFeedback($("checkFeedback"), "Lock in your central atom first (Step 1).", "bad");
    autoPrompt();
    return;
  }

  if (state.bankLeft < 0){
    setFeedback($("checkFeedback"), "❌ Your electron bank went negative. Remove a lone pair or reduce a bond order.", "bad");
    autoPrompt();
    return;
  }

  const disc = disconnectedAtoms();
  if (state.mol.atoms.length > 1 && disc.length){
    setFeedback($("checkFeedback"), "❌ One or more atoms are not bonded to anything yet.", "bad");
    autoPrompt();
    return;
  }

  const issues = atomsNotSatisfied();
  const problems = [];

  issues.forEach(x => {
    problems.push(`${x.sym} (atom ${x.i+1}) has <strong>${x.around}</strong> e⁻ around it (target ${x.target}).`);
  });

  if (state.bankLeft !== 0){
    problems.push(`Electron bank remaining is <strong>${state.bankLeft}</strong>. For these practice molecules, you should use all electrons.`);
  }

  if (problems.length){
    setFeedback(
      $("checkFeedback"),
      `❌ Not yet. Fix these:<ul>${problems.map(p => `<li>${p}</li>`).join("")}</ul>`,
      "bad"
    );
    autoPrompt();
    return;
  }

  setFeedback($("checkFeedback"), "✅ Nice! Electron bank usage, bonds, and octets/duets check out.", "good");
  autoPrompt();
}

function showAnswer(){
  if (state.lockedTotal === null){
    setFeedback($("checkFeedback"), "Lock your bank first, then you can view one correct answer.", "bad");
    autoPrompt();
    return;
  }
  if (!state.centralLocked){
    setFeedback($("checkFeedback"), "Lock your central atom first, then you can view one correct answer.", "bad");
    autoPrompt();
    return;
  }

  const ans = state.mol.answer;
  state.bonds = ans.bonds.map(b => ({...b}));
  state.lonePairs = {...ans.lonePairs};
  state.connectFrom = null;
  updateBank();
  renderStructure();
  renderAtoms();
  setFeedback($("checkFeedback"), "Here’s one correct answer. Study where the electrons went.", null);
  autoPrompt();
}

/* ---------- New molecule ---------- */

function newMolecule(){
  state.mol = MOLECULES[Math.floor(Math.random() * MOLECULES.length)];
  renderProblem();
}

function init(){
  $("newProblem").addEventListener("click", newMolecule);
  $("lockInTotal").addEventListener("click", lockInTotal);
  $("lockCentral").addEventListener("click", lockCentral);

  $("showValenceHint").addEventListener("click", () => {
    $("valenceHint").hidden = !$("valenceHint").hidden;
  });

  $("addLP").addEventListener("click", addLonePair);
  $("removeLP").addEventListener("click", removeLonePair);
  $("clearAll").addEventListener("click", clearAll);

  $("check").addEventListener("click", checkStructure);
  $("showAnswer").addEventListener("click", showAnswer);

  // start
  newMolecule();
}

init();
