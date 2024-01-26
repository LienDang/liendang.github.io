/* Lab: "Decode your food".
   Looks up a food's proteins live in UniProt (the public protein database), encodes the start of one
   as a gene, then transcribes and translates it back, with point mutations, synonymous-codon
   shuffling and an interactive codon wheel. */
(() => {
  const root = document.getElementById("lab");
  if (!root) return;

  // Standard genetic code (NCBI table 1), indexed by first, second and third base in TCAG order
  const BASES = "TCAG";
  const AMINO = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  const CODE = {};
  const CODONS_FOR = {};
  for (let i = 0; i < 64; i++) {
    const codon = BASES[i >> 4] + BASES[(i >> 2) & 3] + BASES[i & 3];
    CODE[codon] = AMINO[i];
    (CODONS_FOR[AMINO[i]] ||= []).push(codon);
  }

  const AA = {
    A: ["Ala", "Alanine", "nonpolar"],
    R: ["Arg", "Arginine", "positive"],
    N: ["Asn", "Asparagine", "polar"],
    D: ["Asp", "Aspartate", "negative"],
    C: ["Cys", "Cysteine", "polar"],
    Q: ["Gln", "Glutamine", "polar"],
    E: ["Glu", "Glutamate", "negative"],
    G: ["Gly", "Glycine", "nonpolar"],
    H: ["His", "Histidine", "positive"],
    I: ["Ile", "Isoleucine", "nonpolar"],
    L: ["Leu", "Leucine", "nonpolar"],
    K: ["Lys", "Lysine", "positive"],
    M: ["Met", "Methionine", "nonpolar"],
    F: ["Phe", "Phenylalanine", "nonpolar"],
    P: ["Pro", "Proline", "nonpolar"],
    S: ["Ser", "Serine", "polar"],
    T: ["Thr", "Threonine", "polar"],
    W: ["Trp", "Tryptophan", "nonpolar"],
    Y: ["Tyr", "Tyrosine", "polar"],
    V: ["Val", "Valine", "nonpolar"],
    "*": ["Stop", "Stop", "stop"],
  };
  const CLASSES = {
    nonpolar: ["Nonpolar", "Side chains that avoid water; they tend to pack inside a folded protein."],
    polar: ["Polar", "Side chains that interact with water; often found on a protein's surface."],
    positive: ["Positive", "Basic side chains that can carry a positive charge."],
    negative: ["Negative", "Acidic side chains that carry a negative charge."],
  };
  // One fixed codon per amino acid for the default encoding; "Shuffle codons" picks synonyms at random
  const PREFERRED = {
    A: "GCC", C: "TGC", D: "GAC", E: "GAG", F: "TTC", G: "GGC", H: "CAC", I: "ATC", K: "AAG", L: "CTG",
    M: "ATG", N: "AAC", P: "CCC", Q: "CAG", R: "CGC", S: "AGC", T: "ACC", V: "GTG", W: "TGG", Y: "TAC", "*": "TAA",
  };
  /* ---------- live lookup in UniProt, the public protein database ---------- */

  const UNIPROT_API = "https://rest.uniprot.org/uniprotkb/search";
  const SHOW_PROTEINS = 6;
  // Which proteins to look at first: allergens, seed storage and storage proteins are the ones we mostly eat
  const FOCUS = {
    food: "(keyword:KW-0020 OR keyword:KW-0708 OR keyword:KW-0758)",
    milk: "keyword:KW-0494",
    muscle: "keyword:KW-0514",
    egg: "(protein_name:ovalbumin OR protein_name:ovotransferrin OR protein_name:ovomucoid OR protein_name:lysozyme OR protein_name:vitellogenin)",
    honey: 'protein_name:"major royal jelly protein"',
  };
  // Foods that aren't an organism's name: where they come from. The proteins themselves still come live from UniProt.
  const SOURCES = {
    milk: { org: 9913, focus: "milk", from: "cow's milk" },
    egg: { org: 9031, focus: "egg", from: "chicken eggs" },
    beef: { org: 9913, focus: "muscle", from: "cattle muscle" },
    pork: { org: 9823, focus: "muscle", from: "pig muscle" },
    chicken: { org: 9031, focus: "muscle", from: "chicken muscle" },
    bread: { org: 4565, focus: "food", from: "wheat" },
    tofu: { org: 3847, focus: "food", from: "soybeans" },
    honey: { org: 7460, focus: "honey", from: "honeybees" },
    corn: { org: 4577, focus: "food", from: "maize" },
    mushroom: { org: 5341, focus: "food", from: "button mushrooms" },
    chocolate: { org: 3641, focus: "food", from: "cacao" },
    wine: { org: 29760, focus: "food", from: "grapes" },
  };
  // Other names, including Vietnamese (matched without accents), for the word UniProt or SOURCES knows
  const SYNONYMS = {
    cheese: "milk", yogurt: "milk", yoghurt: "milk", whey: "milk", "egg white": "egg", omelette: "egg", omelet: "egg",
    steak: "beef", bacon: "pork", ham: "pork", pasta: "bread", noodle: "bread", flour: "bread", gluten: "bread",
    soy: "tofu", soya: "tofu", soybean: "tofu", "soy milk": "tofu", edamame: "tofu", maize: "corn", popcorn: "corn",
    cocoa: "chocolate", cacao: "chocolate", fry: "potato", "peanut butter": "peanut",
    trung: "egg", sua: "milk", "pho mai": "milk", com: "rice", gao: "rice", "banh mi": "bread", "bot mi": "bread",
    "dau phu": "tofu", "dau hu": "tofu", "dau nanh": "tofu", "dau phong": "peanut", lac: "peanut", tom: "shrimp",
    cua: "crab", muc: "squid", "ca hoi": "salmon", "ca ngu": "tuna", ga: "chicken", "thit ga": "chicken",
    "thit bo": "beef", heo: "pork", "thit heo": "pork", "thit lon": "pork", tao: "apple", chuoi: "banana",
    xoai: "mango", cam: "orange", nho: "grape", "dau tay": "strawberry", "ca chua": "tomato", toi: "garlic",
    hanh: "onion", "ca phe": "coffee", tra: "tea", "mat ong": "honey", "khoai tay": "potato", ngo: "corn",
    bap: "corn", thom: "pineapple", khom: "pineapple", nam: "mushroom", "hanh nhan": "almond", vung: "sesame",
    "yen mach": "oat", "socola": "chocolate",
  };
  const SUGGESTIONS = ["milk", "egg", "rice", "tofu", "bread", "banana", "salmon", "shrimp", "kiwi", "coffee", "peanut", "apple", "honey", "beef"];
  // Foods the Lab knows by name. Analytics only ever sees one of these, or "other": never what the visitor typed.
  const KNOWN_FOODS = new Set([...Object.keys(SOURCES), ...Object.values(SYNONYMS), ...SUGGESTIONS]);

  // Accent-insensitive, so "Đậu phụ" finds "dau phu"
  const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/["\\]/g, "").replace(/\s+/g, " ").trim();
  const singular = (q) => (q.endsWith("ies") ? q.slice(0, -3) + "y" : q.endsWith("oes") ? q.slice(0, -2) : /[^su]s$/.test(q) ? q.slice(0, -1) : q);

  function resolveFood(raw) {
    const q = normalize(raw);
    if (q.length < 2) return null;
    const term = SYNONYMS[q] || SYNONYMS[singular(q)] || (SOURCES[q] ? q : singular(q));
    return { key: term, term, typed: raw.trim(), source: SOURCES[term] || null };
  }

  // UniProt matches any organism whose name contains the word ("banana prawn", "golden apple snail"):
  // keep common names that are, or end with, the food ("sweet orange"), and scientific names that start with it ("musa")
  function organismMatches(org, term) {
    const common = normalize(org.commonName || "");
    const scientific = normalize(org.scientificName || "");
    return common === term || common.endsWith(` ${term}`) || scientific === term || scientific.startsWith(`${term} `);
  }

  function queriesFor(food) {
    const who = food.source ? `organism_id:${food.source.org}` : `organism_name:"${food.term}" AND taxonomy_id:2759`;
    const base = `(${who}) AND reviewed:true AND fragment:false`;
    return [`${base} AND ${FOCUS[food.source ? food.source.focus : "food"]}`, base];
  }

  async function searchUniProt(query, signal) {
    const params = new URLSearchParams({
      query, format: "json", size: "40", sort: "annotation_score desc",
      fields: "accession,protein_name,organism_name,ft_signal,sequence,cc_function",
    });
    const response = await fetch(`${UNIPROT_API}?${params}`, { signal });
    if (!response.ok) throw new Error(`UniProt answered ${response.status}`);
    const total = Number(response.headers.get("X-Total-Results")) || 0;
    return { results: (await response.json()).results || [], total };
  }

  function toProtein(entry) {
    const d = entry.proteinDescription || {};
    const signal = (entry.features || []).find((f) => f.type === "Signal");
    const fn = (entry.comments || []).find((c) => c.commentType === "FUNCTION");
    return {
      acc: entry.primaryAccession,
      name: (d.recommendedName || (d.submissionNames || [])[0] || {}).fullName?.value || "",
      organism: entry.organism || {},
      seq: entry.sequence?.value || "",
      signal: signal && { start: signal.location.start.value, end: signal.location.end.value, cleaved: !/not cleaved/i.test(signal.description || "") },
      fn: fn?.texts?.[0]?.value || "",
    };
  }

  // The Lab encodes the first 21 amino acids, starting at the gene's own Met
  const usable = (p) => p.name && /^M[ACDEFGHIKLMNPQRSTVWY]{20}/.test(p.seq);

  const searches = new Map();
  let inflight = null;

  async function findProteins(food, signal) {
    if (searches.has(food.key)) return searches.get(food.key);
    let found = { proteins: [], total: 0, query: queriesFor(food)[1] };
    for (const query of queriesFor(food)) {
      const { results, total } = await searchUniProt(query, signal);
      const seen = new Set();
      const proteins = results
        .map(toProtein)
        .filter((p) => usable(p) && (food.source || organismMatches(p.organism, food.term)))
        .filter((p) => !seen.has(p.name) && seen.add(p.name))
        .slice(0, SHOW_PROTEINS);
      if (proteins.length) {
        found = { proteins, total, query };
        break;
      }
    }
    searches.set(food.key, found);
    return found;
  }

  function summary(text) {
    const clean = text.replace(/\s*\((?:PubMed|By similarity|Ref\.)[^)]*\)/g, "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    let first = clean.match(/^.*?[.!?](?=\s+[A-Z(]|$)/)?.[0] || clean;
    if (first.length > 240) first = first.slice(0, 237).replace(/\s+\S*$/, "") + "…";
    return /[.!?…]$/.test(first) ? first : `${first}.`;
  }

  function signalText(p) {
    const s = p.signal;
    if (!s) return "UniProt lists no signal peptide, so it most likely stays inside the cell that made it.";
    if (!s.cleaved) return `Its signal sequence sits inside the protein (amino acids ${s.start}–${s.end}) and is never cut off.`;
    const tag = "a tag that sends the new protein out of the cell or into storage. It's cut off in the finished protein.";
    if (s.start === 1 && s.end >= 21) return `All 21 shown belong to its ${s.end}-amino-acid signal peptide, ${tag}`;
    return `Amino acids ${s.start}–${s.end} are a signal peptide, ${tag}`;
  }

  const COMPLEMENT = { A: "T", T: "A", C: "G", G: "C" };
  const NEXT_BASE = { A: "C", C: "G", G: "T", T: "A" };
  const STEP_MS = 420;

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("lab-form"), word: $("lab-word"), play: $("lab-play"), shuffle: $("lab-shuffle"), undo: $("lab-undo"),
    track: $("codon-track"), protein: $("protein"), reads: $("protein-reads"),
    bar: $("comp-bar"), legend: $("comp-legend"), wheel: $("codon-wheel"), inspect: $("lab-inspect"),
    change: $("lab-change"), bases: $("stat-bases"), gc: $("stat-gc"), length: $("stat-aa"), python: $("lab-python-call"),
    foods: $("lab-foods"), foodNote: $("lab-food-note"), foodList: $("lab-food-list"), card: root.querySelector(".lab-card"),
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    word: [], original: "", dna: "", status: "idle", pending: null, found: null, protein: 0, seen: false,
    revealed: Infinity, timer: null, focusPos: 0, keyboard: false,
  };
  // What the visitor does in the Lab, for analytics.js to count; nothing here carries what they typed
  const track = (name, params = {}) => root.dispatchEvent(new CustomEvent("lab:track", { detail: { name, params } }));
  // A food is named only if the Lab already knows it; anything else the visitor typed is just "other"
  const foodLabel = (food) => (KNOWN_FOODS.has(food.key) ? food.key : "other");
  const SETTLE_MS = 2000;
  let settleTimer = null;

  const rna = (dna) => dna.replaceAll("T", "U");
  const plural = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
  const code = (s) => `<code>${s}</code>`;
  const message = (title, body) => `<p class="lab-panel-head">${title}</p><p>${body}</p>`;
  const DEFAULT_INSPECT = message("Point at anything", "Hover or tap a codon, a bead or the wheel to see what it codes for.");
  const DEFAULT_CHANGE = message(
    "Try a mutation",
    "Click any letter on the coding DNA strand to change it (A → C → G → T), or shuffle the codons: same protein, different DNA."
  );

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const encode = (letters, pick) => "ATG" + letters.map(pick).join("") + pick("*");
  const preferredCodon = (aa) => PREFERRED[aa];
  const randomCodon = (aa) => CODONS_FOR[aa][Math.floor(Math.random() * CODONS_FOR[aa].length)];

  // Reading frame starts at base 1: no ATG there means no protein; translation ends at the first stop
  function translate(dna) {
    const codons = [];
    for (let i = 0; i + 3 <= dna.length; i += 3) codons.push(dna.slice(i, i + 3));
    const hasStart = codons[0] === "ATG";
    const protein = [];
    let stopAt = -1;
    if (hasStart) {
      for (let k = 0; k < codons.length; k++) {
        const aa = CODE[codons[k]];
        if (aa === "*") {
          stopAt = k;
          break;
        }
        protein.push(aa);
      }
    }
    return { codons, hasStart, protein, stopAt };
  }

  function codonStatus(t, k) {
    if (!t.hasStart) return "idle";
    if (k < t.protein.length) return "coding";
    return k === t.stopAt ? "stop" : "idle";
  }

  /* ---------- rendering ---------- */

  function render() {
    const t = translate(state.dna);
    renderTrack(t);
    renderProtein(t);
    renderComposition(t);
    renderStats(t);
    els.python.textContent = `translate("${state.dna}")  # "${t.protein.join("")}"`;
    const mutations = [...state.dna].filter((b, i) => b !== state.original[i]).length;
    els.undo.hidden = mutations === 0;
    els.undo.textContent = `Undo ${plural(mutations, "mutation", "mutations")}`;
    return t;
  }

  function renderTrack(t) {
    const frag = document.createDocumentFragment();
    const labels = el("div", "codon track-labels");
    labels.setAttribute("aria-hidden", "true");
    ["Coding DNA", "", "Template DNA", "transcribe ↓", "mRNA", "translate ↓", "Amino acid", ""].forEach((text) =>
      labels.append(el("span", "track-label", text))
    );
    frag.append(labels);

    t.codons.forEach((codon, k) => {
      const status = codonStatus(t, k);
      const aa = CODE[codon];
      const col = el("div", `codon is-${status}`);
      col.dataset.k = k;
      col.dataset.codon = codon;
      const coding = el("div", "strand coding");
      const rungs = el("div", "rungs");
      const template = el("div", "strand template");
      const messenger = el("div", "strand mrna");
      for (let j = 0; j < 3; j++) {
        const pos = k * 3 + j;
        const base = codon[j];
        const button = el("button", "base", base);
        button.type = "button";
        button.dataset.pos = pos;
        button.tabIndex = pos === state.focusPos ? 0 : -1;
        button.setAttribute("aria-label", `Base ${pos + 1} of ${state.dna.length}: ${base}. Press to mutate.`);
        if (base !== state.original[pos]) button.classList.add("is-mutated");
        coding.append(button);
        rungs.append(el("i"));
        template.append(el("span", "base", COMPLEMENT[base]));
        messenger.append(el("span", "base", base === "T" ? "U" : base));
      }
      const read = status !== "idle";
      const chip = el("span", `aa c-${read ? AA[aa][2] : "idle"}`, read ? AA[aa][0] : "·");
      const tag = el("span", "codon-tag", k === 0 && t.hasStart ? "start" : status === "stop" ? "stop" : "");
      col.append(coding, rungs, template, el("span"), messenger, el("span"), chip, tag);
      frag.append(col);
    });
    els.track.replaceChildren(frag);
  }

  function renderProtein(t) {
    const frag = document.createDocumentFragment();
    if (!t.hasStart) {
      frag.append(el("p", "protein-empty", "No start codon (ATG), so the ribosome never begins. No protein is made."));
    } else {
      t.protein.forEach((aa, k) => {
        const bead = el("span", `bead c-${AA[aa][2]}`, aa);
        bead.dataset.k = k;
        bead.title = AA[aa][1];
        if (k >= state.revealed) bead.classList.add("is-hidden");
        frag.append(bead);
      });
      const end = el("span", "protein-end", t.stopAt >= 0 ? "stop" : "no stop: keeps reading →");
      if (state.revealed !== Infinity) end.classList.add("is-hidden");
      frag.append(end);
    }
    els.protein.replaceChildren(frag);

    // "Reads ..." line: the protein, with changes from the original marked
    const original = translate(state.original).protein.slice(1);
    const current = t.protein.slice(1);
    const word = el("strong");
    current.forEach((aa, i) => word.append(aa === original[i] ? aa : el("mark", null, aa)));
    if (current.length < original.length) word.append(el("del", null, original.slice(current.length).join("")));
    if (!t.hasStart) els.reads.replaceChildren("Reads nothing: restore the start codon.");
    else {
      word.prepend("M");
      els.reads.replaceChildren("Reads ", word);
    }
    els.reads.classList.toggle("is-hidden", state.revealed !== Infinity);
  }

  function renderComposition(t) {
    const counts = { nonpolar: 0, polar: 0, positive: 0, negative: 0 };
    t.protein.forEach((aa) => counts[AA[aa][2]]++);
    const bar = document.createDocumentFragment();
    const legend = document.createDocumentFragment();
    for (const [cls, [label]] of Object.entries(CLASSES)) {
      if (counts[cls]) {
        const seg = el("span", `comp-seg c-${cls}`);
        seg.style.flexGrow = counts[cls];
        seg.dataset.cls = cls;
        bar.append(seg);
      }
      const item = el("li", `c-${cls}`);
      item.dataset.cls = cls;
      item.append(el("i"), `${label} `, el("b", null, counts[cls]));
      legend.append(item);
    }
    const stop = el("li", "c-stop");
    stop.append(el("i"), "Stop");
    legend.append(stop);
    els.bar.replaceChildren(bar);
    els.bar.setAttribute(
      "aria-label",
      t.protein.length
        ? `Amino acid classes: ${Object.entries(counts).map(([c, n]) => `${CLASSES[c][0]} ${n}`).join(", ")}`
        : "No protein"
    );
    els.legend.replaceChildren(legend);
  }

  function renderStats(t) {
    const gc = [...state.dna].filter((b) => b === "G" || b === "C").length;
    els.bases.textContent = state.dna.length;
    els.gc.textContent = `${Math.round((gc / state.dna.length) * 100)}%`;
    els.length.textContent = t.protein.length;
  }

  function link(text, href) {
    const a = el("a", null, text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function renderResults() {
    const note = els.foodNote;
    const icon = el("span", "food-note-icon");
    icon.setAttribute("aria-hidden", "true");
    const body = el("div", "food-note-body");
    const p = el("p");
    const typed = state.pending?.typed || els.word.value.trim();
    note.hidden = false;
    note.classList.toggle("is-loading", state.status === "loading");

    if (state.status === "loading") {
      icon.textContent = "🔎";
      p.append("Searching UniProt for “", el("strong", null, typed), "”…");
    } else if (state.status === "error") {
      icon.textContent = "⚠️";
      const retry = el("button", "protein-chip", "Try again");
      retry.type = "button";
      retry.dataset.retry = "";
      p.append("Couldn't reach UniProt just now. ", retry);
    } else if (state.status === "empty") {
      icon.textContent = "🤔";
      p.append("UniProt has no reviewed proteins for “", el("strong", null, typed), "” yet. Check the spelling, try another food, or ");
      p.append(link("search UniProt ↗", `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(typed)}`), ".");
    } else if (state.found) {
      const { food, proteins, total, query } = state.found;
      const protein = proteins[state.protein];
      icon.textContent = "🧬";
      const head = el("p", "food-note-head");
      // Say where they come from only when it adds something: "milk (cow's milk)", "salmon (Atlantic salmon)", not "banana (banana)"
      const from = food.source
        ? [food.source.from]
        : [...new Set(proteins.map((x) => x.organism.commonName || x.organism.scientificName))].filter((n) => normalize(n) !== food.term);
      const title = el("span");
      title.append(el("strong", null, `Proteins in ${food.typed.toLowerCase()}`), from.length ? ` (${from.slice(0, 2).join(", ")})` : "", ", live from UniProt:");
      head.append(title, " ");
      proteins.forEach((x, i) => {
        const b = el("button", "protein-chip", x.name);
        b.type = "button";
        b.dataset.protein = i;
        b.setAttribute("aria-pressed", String(i === state.protein));
        head.append(b, " ");
      });
      head.append(link(`see all ${total.toLocaleString()} on UniProt ↗`, `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(query)}`));
      const org = protein.organism;
      const what = el("p");
      what.append(el("strong", null, protein.name), " · ", el("em", null, org.scientificName || ""), org.commonName ? ` (${org.commonName.toLowerCase()})` : "", ". ");
      what.append(summary(protein.fn) || "UniProt has no function summary for it yet.");
      p.append(
        "These are its first 21 amino acids, exactly as the gene encodes them; only the protein matches, because the DNA here uses the Lab's own codons. ",
        `${signalText(protein)} `,
        link("Full entry ↗", `https://www.uniprot.org/uniprotkb/${protein.acc}/entry`)
      );
      body.append(head, what);
    } else {
      note.hidden = true;
      return;
    }
    body.append(p);
    note.replaceChildren(icon, body);
  }

  /* ---------- codon wheel ---------- */

  function buildWheel() {
    const NS = "http://www.w3.org/2000/svg";
    const RNA = "UCAG";
    const R = [30, 60, 94, 122, 160];
    const point = (r, a) => {
      const t = (a * Math.PI) / 180;
      return [(r * Math.sin(t)).toFixed(2), (-r * Math.cos(t)).toFixed(2)];
    };
    const wedge = (r0, r1, a0, a1) => {
      const [x0, y0] = point(r1, a0);
      const [x1, y1] = point(r1, a1);
      const [x2, y2] = point(r0, a1);
      const [x3, y3] = point(r0, a0);
      return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
    };
    const add = (tag, attrs) => {
      const node = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      els.wheel.append(node);
      return node;
    };
    const label = (r, a, text, className) => {
      const [x, y] = point(r, a);
      add("text", { x, y, class: className }).textContent = text;
    };
    const dnaCodon = (i) => BASES[i >> 4] + BASES[(i >> 2) & 3] + BASES[i & 3];

    add("circle", { r: R[0], class: "w0" });
    for (let i = 0; i < 4; i++) {
      add("path", { d: wedge(R[0], R[1], i * 90, i * 90 + 90), class: "w w1", "data-b": RNA[i] });
      label((R[0] + R[1]) / 2, i * 90 + 45, RNA[i], "t1");
    }
    for (let i = 0; i < 16; i++) {
      add("path", { d: wedge(R[1], R[2], i * 22.5, i * 22.5 + 22.5), class: "w w2", "data-b": RNA[i >> 2] + RNA[i & 3] });
      label((R[1] + R[2]) / 2, i * 22.5 + 11.25, RNA[i & 3], "t2");
    }
    for (let i = 0; i < 64; i++) {
      add("path", { d: wedge(R[2], R[3], i * 5.625, i * 5.625 + 5.625), class: "w w3", "data-codon": dnaCodon(i), "data-aa": AMINO[i] });
      label((R[2] + R[3]) / 2, i * 5.625 + 2.8125, RNA[i & 3], "t3");
    }
    // Outer ring: one wedge per run of codons that share an amino acid within a block of four
    for (let block = 0; block < 16; block++) {
      let start = 0;
      for (let j = 1; j <= 4; j++) {
        const i = block * 4;
        if (j < 4 && AMINO[i + j] === AMINO[i + start]) continue;
        const aa = AMINO[i + start];
        const codons = [];
        for (let c = start; c < j; c++) codons.push(dnaCodon(i + c));
        add("path", {
          d: wedge(R[3], R[4], (i + start) * 5.625, (i + j) * 5.625),
          class: `w w4 c-${AA[aa][2]}`,
          "data-aa": aa,
          "data-codons": codons.join(" "),
        });
        label((R[3] + R[4]) / 2 + 2, ((i + start + i + j) / 2) * 5.625, aa === "*" ? "■" : aa, aa === "*" ? "t4 t-stop" : "t4");
        start = j;
      }
    }
  }

  function lightWheel(codon) {
    const r = rna(codon);
    els.wheel.classList.add("has-focus");
    els.wheel.querySelector(`.w1[data-b="${r[0]}"]`).classList.add("on");
    els.wheel.querySelector(`.w2[data-b="${r.slice(0, 2)}"]`).classList.add("on");
    els.wheel.querySelector(`.w3[data-codon="${codon}"]`).classList.add("on");
    els.wheel.querySelectorAll(".w4").forEach((w) => {
      if (w.dataset.codons.split(" ").includes(codon)) w.classList.add("on");
    });
  }

  /* ---------- inspecting (hover, tap, keyboard focus) ---------- */

  function clearHighlight() {
    root.querySelectorAll(".is-hover, .is-match, .is-dim, .on").forEach((n) => n.classList.remove("is-hover", "is-match", "is-dim", "on"));
    els.wheel.classList.remove("has-focus");
  }

  function codonsList(aa) {
    return CODONS_FOR[aa].map((c) => code(rna(c))).join(" ");
  }

  function inspectCodon(codon, k) {
    clearHighlight();
    if (k != null) {
      els.track.querySelector(`.codon[data-k="${k}"]`)?.classList.add("is-hover");
      els.protein.querySelector(`.bead[data-k="${k}"]`)?.classList.add("is-hover");
    } else {
      els.track.querySelectorAll(`.codon[data-codon="${codon}"]`).forEach((c) => c.classList.add("is-match"));
    }
    lightWheel(codon);
    const aa = CODE[codon];
    const [abbr, name, cls] = AA[aa];
    const where = k != null ? `Codon ${k + 1}: ` : "";
    const target = aa === "*" ? "<strong>Stop</strong>" : `<strong>${name}</strong> (${abbr}, ${aa})`;
    let body =
      aa === "*"
        ? `A stop codon ends translation. There are three: ${codonsList(aa)}.`
        : `${CLASSES[cls][0]}. ${name} has ${plural(CODONS_FOR[aa].length, "codon", "codons")}: ${codonsList(aa)}.`;
    if (k === 0 && codon === "ATG") body += " Here it's also the start codon, which tells the ribosome where to begin.";
    els.inspect.innerHTML = message(`${where}${code(codon)} → mRNA ${code(rna(codon))} → ${target}`, body);
  }

  function inspectAmino(aa) {
    clearHighlight();
    els.wheel.classList.add("has-focus");
    els.wheel.querySelectorAll(`.w3[data-aa="${aa}"], .w4[data-aa="${aa}"]`).forEach((w) => w.classList.add("on"));
    const cols = [...els.track.querySelectorAll(".codon[data-codon]")].filter((c) => CODE[c.dataset.codon] === aa);
    cols.forEach((c) => c.classList.add("is-match"));
    els.protein.querySelectorAll(".bead").forEach((b) => b.textContent === aa && b.classList.add("is-match"));
    const [abbr, name, cls] = AA[aa];
    const inGene = `In your gene: ${plural(cols.length, "time", "times")}.`;
    els.inspect.innerHTML =
      aa === "*"
        ? message("Stop codons", `${codonsList(aa)} end translation. ${inGene}`)
        : message(`${name} (${abbr}, ${aa})`, `${CLASSES[cls][0]}. ${plural(CODONS_FOR[aa].length, "codon", "codons")}: ${codonsList(aa)}. ${inGene}`);
  }

  function inspectClass(cls) {
    clearHighlight();
    const beads = [...els.protein.querySelectorAll(".bead")];
    const members = beads.filter((b) => b.classList.contains(`c-${cls}`));
    beads.forEach((b) => !members.includes(b) && b.classList.add("is-dim"));
    root.querySelectorAll(`[data-cls="${cls}"]`).forEach((n) => n.classList.add("is-match"));
    const letters = members.map((b) => b.textContent).join(" ");
    els.inspect.innerHTML = message(
      `${CLASSES[cls][0]}: ${members.length} of ${beads.length}`,
      `${CLASSES[cls][1]}${letters ? ` In your protein: ${letters}.` : ""}`
    );
  }

  function resetInspect() {
    if (state.timer) return;
    clearHighlight();
    els.inspect.innerHTML = DEFAULT_INSPECT;
  }

  /* ---------- actions ---------- */

  // Look up a food's proteins and load the first one. Typing (live) doesn't replay a food that's already showing.
  // `method` says how the visitor asked (typed, chip, retry); the automatic first lookup has none and isn't tracked.
  async function decode(raw, { live = false, method = null } = {}) {
    const food = resolveFood(raw);
    if (!food) return;
    if (state.found?.food.key === food.key && state.status === "ok") {
      if (!live) play();
      return;
    }
    // Typed-as-you-go lookups wait until the typing settles; Enter, chips and retries count at once
    const report = (result) => {
      if (!method) return;
      clearTimeout(settleTimer);
      const send = () => track("lab_lookup", { food: foodLabel(food), method, result });
      if (live) settleTimer = setTimeout(send, SETTLE_MS);
      else send();
    };
    inflight?.abort();
    const controller = (inflight = new AbortController());
    state.pending = food;
    state.status = "loading";
    renderResults();
    try {
      const found = await findProteins(food, controller.signal);
      if (controller.signal.aborted) return;
      if (!found.proteins.length) {
        state.status = "empty";
        renderResults();
        report("none");
        return;
      }
      state.found = { food, ...found };
      state.status = "ok";
      showProtein(0, true);
      report("found");
    } catch (err) {
      if (err.name === "AbortError") return;
      state.status = "error";
      renderResults();
      report("error");
    }
  }

  function showProtein(index, animate) {
    stopPlayback(false);
    state.protein = index;
    state.word = state.found.proteins[index].seq.slice(1, 21).split("");
    state.original = state.dna = encode(state.word, preferredCodon);
    state.focusPos = Math.min(state.focusPos, state.dna.length - 1);
    els.card.classList.remove("is-empty");
    render();
    renderResults();
    els.change.innerHTML = DEFAULT_CHANGE;
    if (animate && state.seen) play();
  }

  function shuffle() {
    if (!state.found) return;
    stopPlayback(false);
    const before = state.dna;
    let next = before;
    for (let tries = 0; tries < 12 && next === before; tries++) next = encode(state.word, randomCodon);
    const changed = [...next].filter((b, i) => b !== before[i]).length;
    state.original = state.dna = next;
    render();
    track("lab_shuffle");
    els.change.innerHTML = changed
      ? message(
          "Same protein, new DNA",
          `${changed} of ${next.length} bases changed, but the protein is exactly the same. 61 codons code for just 20 amino acids, so most amino acids can be written several ways.`
        )
      : message("Nothing to shuffle", "M and W each have a single codon, so this DNA can only be written one way.");
  }

  function mutate(pos) {
    stopPlayback(false);
    const before = translate(state.dna);
    const k = Math.floor(pos / 3);
    const oldCodon = before.codons[k];
    state.dna = state.dna.slice(0, pos) + NEXT_BASE[state.dna[pos]] + state.dna.slice(pos + 1);
    state.focusPos = pos;
    const after = render();
    const [effect, detail] = describeMutation(pos, k, oldCodon, after.codons[k], before, after);
    els.change.innerHTML = message(effect, detail);
    track("lab_mutate", { effect });
  }

  // The effect's name and its explanation, for message()
  function describeMutation(pos, k, oldCodon, newCodon, before, after) {
    const change = `Base ${pos + 1}: ${code(oldCodon)} → ${code(newCodon)}.`;
    const oldAA = CODE[oldCodon];
    const newAA = CODE[newCodon];
    const describe = (aa) => `${AA[aa][1]} (${CLASSES[AA[aa][2]][0].toLowerCase()})`;
    const read = (t) => codonStatus(t, k) !== "idle";

    if (k === 0 && before.hasStart && !after.hasStart) {
      return ["Start codon lost", `${change} Without ATG at the start, the ribosome has nowhere to begin, so no protein is made.`];
    }
    if (k === 0 && !before.hasStart && after.hasStart) {
      return ["Start codon restored", `${change} The ribosome can begin again.`];
    }
    if (!read(before) && !read(after)) {
      const why = after.hasStart ? "it comes after the stop codon" : "there's no start codon";
      return ["No effect on the protein", `${change} The ribosome never reads this codon: ${why}.`];
    }
    if (oldAA === "*" && newAA === "*") {
      return ["Silent mutation", `${change} Both are stop codons, so translation still ends here.`];
    }
    if (oldAA === newAA) {
      return [
        "Silent mutation",
        `${change} Both codons code for ${AA[newAA][1]}, so the protein doesn't change. Most amino acids have more than one codon.`
      ];
    }
    if (newAA === "*") {
      return [
        "Nonsense mutation",
        `${change} That's a stop codon, so translation ends early: the protein shrinks from ${before.protein.length} to ${after.protein.length} amino acids.`
      ];
    }
    if (oldAA === "*") {
      const runOn = after.stopAt < 0 ? "It runs off the end of the gene." : `It keeps reading until the next stop, at codon ${after.stopAt + 1}.`;
      return ["Stop codon lost", `${change} It now codes for ${AA[newAA][1]}, so nothing tells the ribosome to stop. ${runOn}`];
    }
    const sameClass = AA[oldAA][2] === AA[newAA][2];
    return [
      "Missense mutation",
      `${change} ${describe(oldAA)} becomes ${describe(newAA)} at position ${k + 1} of the protein. ${
        sameClass ? "Same class of amino acid, so the effect may be mild." : "A different class of amino acid, which can change how the protein folds."
      }`
    ];
  }

  function undo() {
    stopPlayback(false);
    state.dna = state.original;
    render();
    els.change.innerHTML = message("Back to the original", "All mutations undone.");
    track("lab_undo");
  }

  /* ---------- playback: the ribosome walks the gene codon by codon ---------- */

  function play() {
    stopPlayback(false);
    const t = translate(state.dna);
    const steps = t.hasStart ? (t.stopAt >= 0 ? t.stopAt + 1 : t.codons.length) : 0;
    if (!steps || reduceMotion.matches) {
      render();
      return;
    }
    state.revealed = 0;
    render();
    root.classList.add("is-playing");
    els.play.textContent = "■ Stop";
    let k = 0;
    const step = () => {
      clearHighlight();
      if (k >= steps) {
        stopPlayback(true);
        return;
      }
      els.track.querySelector(`.codon[data-k="${k}"]`).classList.add("is-hover");
      lightWheel(t.codons[k]);
      els.protein.querySelector(`.bead[data-k="${k}"]`)?.classList.remove("is-hidden");
      k += 1;
      state.timer = setTimeout(step, STEP_MS);
    };
    step();
  }

  function stopPlayback(rerender) {
    const wasPlaying = state.timer != null || state.revealed !== Infinity;
    clearTimeout(state.timer);
    state.timer = null;
    state.revealed = Infinity;
    root.classList.remove("is-playing");
    els.play.textContent = "▶ Translate";
    if (wasPlaying && rerender) {
      render();
      resetInspect();
    }
  }

  /* ---------- events ---------- */

  document.addEventListener("keydown", () => (state.keyboard = true), true);
  document.addEventListener("pointerdown", () => (state.keyboard = false), true);

  let typingTimer = null;
  els.word.addEventListener("input", () => {
    clearTimeout(typingTimer);
    clearTimeout(settleTimer);
    if (normalize(els.word.value).length < 2) return;
    typingTimer = setTimeout(() => decode(els.word.value, { live: true, method: "typed" }), 550);
  });
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(typingTimer);
    decode(els.word.value, { method: "typed" });
  });
  els.foods.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-food]");
    if (!chip) return;
    clearTimeout(typingTimer);
    els.word.value = chip.dataset.food;
    decode(chip.dataset.food, { method: "chip" });
  });
  els.foodNote.addEventListener("click", (e) => {
    const protein = e.target.closest("[data-protein]");
    if (protein) {
      showProtein(Number(protein.dataset.protein), true);
      const known = foodLabel(state.found.food) !== "other";
      track("lab_protein", { protein: known ? state.found.proteins[state.protein].acc : "other" });
    }
    if (e.target.closest("[data-retry]")) decode(els.word.value, { method: "retry" });
  });
  // The button is also the form's submit button (Enter in the input plays); handle clicks here only
  els.play.addEventListener("click", (e) => {
    e.preventDefault();
    if (state.timer) stopPlayback(true);
    else if (state.found) {
      play();
      track("lab_translate");
    } else decode(els.word.value, { method: "typed" });
  });
  els.shuffle.addEventListener("click", shuffle);
  els.undo.addEventListener("click", undo);

  els.track.addEventListener("click", (e) => {
    const button = e.target.closest(".base[data-pos]");
    if (!button) return;
    const hadFocus = document.activeElement === button;
    mutate(Number(button.dataset.pos));
    if (hadFocus) els.track.querySelector(`.base[data-pos="${state.focusPos}"]`)?.focus();
  });
  els.track.addEventListener("keydown", (e) => {
    const button = e.target.closest(".base[data-pos]");
    if (!button) return;
    const pos = Number(button.dataset.pos);
    const moves = { ArrowRight: pos + 1, ArrowLeft: pos - 1, Home: 0, End: state.dna.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    state.focusPos = Math.max(0, Math.min(state.dna.length - 1, moves[e.key]));
    els.track.querySelectorAll(".base[data-pos]").forEach((b) => (b.tabIndex = Number(b.dataset.pos) === state.focusPos ? 0 : -1));
    els.track.querySelector(`.base[data-pos="${state.focusPos}"]`).focus();
  });
  els.track.addEventListener("focusin", (e) => {
    const col = e.target.closest(".codon[data-k]");
    if (col && state.keyboard && !state.timer) inspectCodon(col.dataset.codon, Number(col.dataset.k));
  });
  els.track.addEventListener("focusout", (e) => {
    if (!els.track.contains(e.relatedTarget)) resetInspect();
  });

  els.track.addEventListener("mouseover", (e) => {
    const col = e.target.closest(".codon[data-k]");
    if (col && !state.timer) inspectCodon(col.dataset.codon, Number(col.dataset.k));
  });
  els.protein.addEventListener("mouseover", (e) => {
    const bead = e.target.closest(".bead");
    if (!bead || state.timer) return;
    const k = Number(bead.dataset.k);
    inspectCodon(translate(state.dna).codons[k], k);
  });
  const onWheel = (e) => {
    const w = e.target.closest(".w3, .w4");
    if (!w || state.timer) return;
    if (w.classList.contains("w3")) inspectCodon(w.dataset.codon, null);
    else inspectAmino(w.dataset.aa);
    if (e.type === "click") track("lab_inspect", { part: "codon wheel", item: w.dataset.codon || w.dataset.aa });
  };
  els.wheel.addEventListener("mouseover", onWheel);
  els.wheel.addEventListener("click", onWheel);
  const onClass = (e) => {
    const item = e.target.closest("[data-cls]");
    if (!item || state.timer) return;
    inspectClass(item.dataset.cls);
    if (e.type === "click") track("lab_inspect", { part: "amino acid classes", item: item.dataset.cls });
  };
  for (const node of [els.bar, els.legend]) {
    node.addEventListener("mouseover", onClass);
    node.addEventListener("click", onClass);
  }
  for (const node of [els.track, els.protein, els.wheel, els.bar, els.legend]) node.addEventListener("mouseleave", resetInspect);

  /* ---------- start ---------- */

  buildWheel();
  els.foodList.replaceChildren(...SUGGESTIONS.map((name) => Object.assign(el("option"), { value: name })));
  els.inspect.innerHTML = DEFAULT_INSPECT;
  decode(els.word.value, { live: true });

  // Play the translation once, the first time the lab scrolls into view (or as soon as the first protein arrives)
  const onSeen = () => {
    state.seen = true;
    if (state.found) play();
  };
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          onSeen();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(els.card);
  } else {
    state.seen = true;
  }
})();
