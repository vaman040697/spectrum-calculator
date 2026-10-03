/* Local math previews. No network request and no evaluation of input text. */
(function (root) {
  "use strict";
  const escape = text => String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const tag = (name, contents, attrs = "") => "<" + name + attrs + ">" + contents + "</" + name + ">";
  const row = (...items) => tag("mrow", items.join(""));
  const op = value => tag("mo", escape(value));

  function parse(source) {
    const text = String(source).trim().replace(/−/g, "-").replace(/×|·/g, "*")
      .replace(/÷/g, "/").replace(/\*\*/g, "^");
    if (!text || text.length > 600) throw new Error("Enter an expression");
    const tokens = [];
    let pos = 0;
    while (pos < text.length) {
      if (/\s/.test(text[pos])) { pos++; continue; }
      const rest = text.slice(pos);
      const match = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/) ||
        rest.match(/^[A-Za-z]+[0-9]*|^[πθ]/) || rest.match(/^(?:<=|>=|!=|[+\-*/^_=(),:<>])/);
      if (!match) throw new Error("Unrecognized notation");
      tokens.push(match[0]); pos += match[0].length;
    }
    let cursor = 0;
    const peek = () => tokens[cursor];
    const take = () => tokens[cursor++];
    const expect = token => { if (take() !== token) throw new Error("Complete the expression"); };
    const number = t => t && /^(?:\d|\.)/.test(t);
    const identifier = t => t && /^[A-Za-zπθ]/.test(t);
    const binary = (operator, left, right) => ({type:"binary", operator, left, right});
    function atom() {
      const t = take();
      if (t === "(") { const value = list(); expect(")"); return {type:"group", value}; }
      if (number(t)) return {type:"number", value:t};
      if (identifier(t)) {
        if (peek() === "(" && (t.length > 1 || t === "f")) {
          take(); const args = [];
          if (peek() !== ")") {
            args.push(relation());
            while (peek() === ",") { take(); args.push(relation()); }
          }
          expect(")");
          return {type:"function", name:t, args};
        }
        return {type:"identifier", value:t};
      }
      throw new Error("Complete the expression");
    }
    function power() {
      let left = atom();
      if (peek() === "_") { take(); left = binary("_", left, atom()); }
      if (peek() === "^") { take(); left = binary("^", left, unary()); }
      return left;
    }
    function unary() {
      if (peek() === "+" || peek() === "-") return {type:"unary", operator:take(), value:unary()};
      return power();
    }
    function product() {
      let left = unary();
      while (true) {
        const t = peek();
        if (t === "*" || t === "/") { take(); left = binary(t, left, unary()); }
        else if (t === "(" || identifier(t) || number(t)) left = binary("implicit", left, unary());
        else break;
      }
      return left;
    }
    function sum() {
      let left = product();
      while (peek() === "+" || peek() === "-") left = binary(take(), left, product());
      return left;
    }
    function relation() {
      let left = sum();
      while (["=", "<", ">", "<=", ">=", "!=", ":"].includes(peek())) left = binary(take(), left, sum());
      return left;
    }
    function list() {
      const items = [relation()];
      while (peek() === ",") { take(); items.push(relation()); }
      return items.length === 1 ? items[0] : {type:"list", items};
    }
    const leadingEquals = peek() === "=";
    if (leadingEquals) take();
    const tree = list();
    if (cursor !== tokens.length) throw new Error("Complete the expression");
    return leadingEquals ? {type:"unary", operator:"=", value:tree} : tree;
  }

  function render(node) {
    const ungroup = n => render(n.type === "group" ? n.value : n);
    if (node.type === "number") {
      const scientific = node.value.match(/^(.+)[eE]([+-]?\d+)$/);
      return scientific ? row(tag("mn", escape(scientific[1])), op("×"),
        tag("msup", tag("mn", "10") + tag("mn", String(Number(scientific[2]))))) : tag("mn", escape(node.value));
    }
    if (node.type === "identifier") return tag("mi", escape(({pi:"π",theta:"θ"})[node.value.toLowerCase()] || node.value));
    if (node.type === "group") return row(op("("), render(node.value), op(")"));
    if (node.type === "list") return row(...node.items.map(render).flatMap((v, i) => i ? [op(","), v] : [v]));
    if (node.type === "unary") return row(op(node.operator === "-" ? "−" : node.operator), render(node.value));
    if (node.type === "function") {
      const name = node.name.toLowerCase();
      if (name === "sqrt" && node.args.length === 1) return tag("msqrt", render(node.args[0]));
      if (name === "cbrt" && node.args.length === 1) return tag("mroot", render(node.args[0]) + tag("mn","3"));
      if (name === "abs" && node.args.length === 1) return row(op("|"), render(node.args[0]), op("|"));
      return row(tag("mi", escape(node.name), ' mathvariant="normal"'), op("("),
        ...node.args.map(render).flatMap((v,i) => i ? [op(","),v] : [v]), op(")"));
    }
    if (node.operator === "^" || node.operator === "_") return tag(node.operator === "^" ? "msup" : "msub", render(node.left) + ungroup(node.right));
    if (node.operator === "/") return tag("mfrac", ungroup(node.left) + ungroup(node.right));
    const operators = {"-":"−","*":"·",implicit:"\u2062","<=":"≤",">=":"≥","!=":"≠"};
    return row(render(node.left), op(operators[node.operator] || node.operator), render(node.right));
  }

  function mathML(value) {
    return '<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" aria-label="' +
      escape(value) + '">' + render(parse(value)) + "</math>";
  }
  const api = {parse, mathML};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SpectrumMath = api;
  if (typeof document === "undefined") return;

  const watched = new Map();
  let nextHelpId = 0;
  const selector = '.expression-input, .math-source, input[type="number"], .matrix input, #plot-xrange, #plot-yrange, .tool-row input';
  function syncEditor(input, entry) {
    if (!entry.display) return;
    const editing = document.activeElement === input;
    const rendered = entry.valid && !!input.value.trim() && !editing;
    entry.shell.classList.toggle("is-rendered", rendered);
    entry.shell.classList.toggle("is-editing", editing);
    entry.display.hidden = !rendered;
    entry.help.hidden = !editing;
    entry.preview.hidden = rendered || !input.value.trim() || entry.simple;
  }
  function update(input, force = false) {
    const entry = watched.get(input);
    if (!entry) return;
    if (!force && entry.value === input.value) { syncEditor(input, entry); return; }
    entry.value = input.value;
    const preview = entry.preview;
    preview.classList.remove("math-incomplete");
    try {
      const markup = mathML(input.value);
      preview.innerHTML = markup;
      preview.setAttribute("aria-label", "Math preview: " + input.value);
      if (entry.displayMath) entry.displayMath.innerHTML = markup;
      entry.valid = true;
    } catch {
      preview.textContent = input.value.trim() ? "Complete the expression to preview it" : "";
      preview.removeAttribute("aria-label");
      preview.classList.add("math-incomplete");
      entry.valid = false;
    }
    // Repeating an ordinary number adds clutter without improving its notation.
    entry.simple = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input.value.trim());
    preview.hidden = !input.value.trim() || entry.simple;
    syncEditor(input, entry);
  }
  function attach(input) {
    if (watched.has(input)) { update(input); return; }
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    const expression = input.matches('.expression-input, .math-source') && input.type !== "number";
    if (expression && !input.parentElement.classList.contains("math-input-shell")) {
      const shell = document.createElement("div");
      shell.className = "math-input-shell";
      input.before(shell); shell.append(input);
    }
    const preview = document.createElement("div");
    preview.className = "math-preview";
    // A single formula bar handles cells, keeping the spreadsheet grid compact.
    input.after(preview);
    const entry = {preview, value:null};
    watched.set(input, entry);
    if (expression) {
      entry.shell = input.parentElement;
      entry.shell.classList.add("math-editor");
      entry.display = document.createElement("div");
      entry.display.className = "math-display";
      // The native input stays focusable and labelled. This layer is visual only.
      entry.display.setAttribute("aria-hidden", "true");
      entry.displayMath = document.createElement("span");
      entry.displayMath.className = "math-typeset";
      const editHint = document.createElement("span");
      editHint.className = "math-edit-hint"; editHint.textContent = "Edit";
      entry.display.append(entry.displayMath, editHint);
      entry.help = document.createElement("div");
      entry.help.className = "math-edit-help";
      entry.help.textContent = "Use ^ for powers, / for fractions. Enter to finish editing.";
      entry.help.id = "math-help-" + (++nextHelpId);
      const describedBy = input.getAttribute("aria-describedby");
      input.setAttribute("aria-describedby", [describedBy, entry.help.id].filter(Boolean).join(" "));
      entry.shell.append(entry.display, entry.help);
      input.addEventListener("focus", () => update(input));
      input.addEventListener("blur", () => update(input));
      input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.isComposing) {
          event.preventDefault(); event.stopPropagation(); input.blur();
        }
      });
    }
    input.addEventListener("input", () => update(input));
    input.addEventListener("change", () => update(input));
    update(input);
  }
  function refresh() {
    document.querySelectorAll(selector).forEach(attach);
    for (const [input, entry] of watched) {
      if (!input.isConnected) { watched.delete(input); continue; }
      update(input);
    }
  }
  api.refresh = refresh;
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    document.body.classList.toggle("advanced-app", !!document.getElementById("lab-plot"));
    document.body.classList.toggle("calculator-app", !!document.getElementById("graph-workspace"));
    // Replace unfinished previews from the previous implementation.
    document.querySelectorAll(".math-preview").forEach(node => node.remove());
    document.querySelectorAll(".field").forEach(field => {
      const label = field.querySelector("label");
      const input = field.querySelector("input,select,textarea");
      if (label && input?.id) label.htmlFor = input.id;
    });
    document.querySelectorAll(".matrix input").forEach(input => {
      const labels = {m11:"Matrix row 1 column 1",m12:"Matrix row 1 column 2",m21:"Matrix row 2 column 1",m22:"Matrix row 2 column 2",
        v1x:"Vector a, x",v1y:"Vector a, y",v1z:"Vector a, z",v2x:"Vector b, x",v2y:"Vector b, y",v2z:"Vector b, z"};
      input.setAttribute("aria-label", labels[input.id] || input.id);
      // Grid cells need a wrapper so the preview doesn't become another matrix entry.
      const shell = document.createElement("div"); shell.className = "math-input-shell";
      input.before(shell); shell.append(input);
    });
    const sheet = document.getElementById("sheet-table");
    if (sheet) {
      const bar = document.createElement("div"); bar.className = "sheet-formula-bar";
      const label = document.createElement("span"); label.textContent = "Selected cell";
      const formula = document.createElement("div"); formula.className = "math-preview";
      formula.textContent = "Select a cell to preview its formula";
      bar.append(label, formula); sheet.parentElement.before(bar);
      const showCell = event => {
        if (!event.target.matches("[data-cell]")) return;
        label.textContent = event.target.dataset.cell;
        try { formula.innerHTML = mathML(event.target.value); }
        catch { formula.textContent = event.target.value || "Empty cell"; }
      };
      sheet.addEventListener("focusin", showCell); sheet.addEventListener("input", showCell);
      document.getElementById("sheet-clear")?.addEventListener("click", () => {
        label.textContent = "Selected cell"; formula.textContent = "Select a cell to preview its formula";
      });
      document.getElementById("sheet-demo")?.addEventListener("click", () => {
        label.textContent = "Selected cell"; formula.textContent = "Select an example cell to preview its formula";
      });
    }
    refresh();
    document.addEventListener("click", () => queueMicrotask(refresh));
    document.addEventListener("change", () => queueMicrotask(refresh));
    new MutationObserver(records => {
      if (records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches?.(selector) || n.querySelector?.(selector))))) refresh();
    }).observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof globalThis === "undefined" ? this : globalThis);
