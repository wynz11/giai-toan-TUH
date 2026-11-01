"use strict";

const Core = (() => {
  const EPS = 1e-8;

  const key = (i, j) => `${i},${j}`;
  const pair = s => s.split(",").map(Number);

  const mat = (m, n, v = 0) =>
    Array.from({ length: m }, () => Array(n).fill(v));

  const clone = x => x.map(r => r.slice());

  const sum = a => a.reduce((s, v) => s + v, 0);

  const must = (ok, msg) => {
    if (!ok) throw Error(msg);
  };

  class UF {
    constructor(n) {
      this.p = Array.from({ length: n }, (_, i) => i);
    }

    find(x) {
      return this.p[x] === x
        ? x
        : (this.p[x] = this.find(this.p[x]));
    }

    join(a, b) {
      a = this.find(a);
      b = this.find(b);

      if (a === b) return false;

      this.p[b] = a;
      return true;
    }
  }

  function prepare(data) {
    const { cost, supply, demand } = data;

    const m = supply.length;
    const n = demand.length;

    must(
      m >= 2 && m <= 12 && n >= 2 && n <= 12,
      "Số nguồn và đích phải từ 2 đến 12."
    );

    must(
      cost.length === m &&
      cost.every(r => r.length === n),
      "Ma trận chi phí không đúng kích thước."
    );

    must(
      [...supply, ...demand, ...cost.flat()]
        .every(v => Number.isFinite(v) && v >= 0),
      "Mọi dữ liệu phải là số không âm."
    );

    must(
      sum(supply) > EPS && sum(demand) > EPS,
      "Tổng cung và tổng cầu phải lớn hơn 0."
    );

    const original = {
      m,
      n,
      cost: clone(cost),
      supply: supply.slice(),
      demand: demand.slice()
    };

    const p = {
      ...original,
      m,
      n,
      cost: clone(cost),
      supply: supply.slice(),
      demand: demand.slice(),
      dummy: null
    };

    const A = sum(supply);
    const B = sum(demand);

    if (A > B + EPS) {
      const M = A - B;

      p.demand.push(M);
      p.cost.forEach(r => r.push(0));
      p.n++;

      p.dummy = {
        type: "destination",
        M,
        large: A,
        small: B,
        index: p.n - 1
      };
    }

    if (B > A + EPS) {
      const M = B - A;

      p.supply.push(M);
      p.cost.push(Array(p.n).fill(0));
      p.m++;

      p.dummy = {
        type: "source",
        M,
        large: B,
        small: A,
        index: p.m - 1
      };
    }

    return { p, original };
  }

  // Góc Tây Bắc hoặc Chi phí nhỏ nhất
  function initial(p, method) {
    const a = p.supply.slice();
    const b = p.demand.slice();
    const x = mat(p.m, p.n);

    let remain = sum(a);
    let steps = 0;

    while (remain > EPS) {
      let pos = null;
      let best = Infinity;

      for (let i = 0; i < p.m; i++) {
        for (let j = 0; j < p.n; j++) {
          if (a[i] <= EPS || b[j] <= EPS) continue;

          if (method === "northwest") {
            if (pos === null) pos = [i, j];
          } else if (p.cost[i][j] < best - EPS) {
            best = p.cost[i][j];
            pos = [i, j];
          }
        }
      }

      must(
        pos !== null,
        "Không tìm được ô để lập phương án ban đầu."
      );

      const [i, j] = pos;
      const q = Math.min(a[i], b[j]);

      x[i][j] += q;

      a[i] -= q;
      b[j] -= q;
      remain -= q;

      if (Math.abs(a[i]) < EPS) a[i] = 0;
      if (Math.abs(b[j]) < EPS) b[j] = 0;

      must(
        ++steps <= p.m + p.n,
        "Phương án ban đầu có lỗi."
      );
    }

    return x;
  }

  // Kiểm tra suy biến và bổ sung 0*
  function basisStart(p, x) {
    const uf = new UF(p.m + p.n);

    const basis = new Set();
    const added = [];

    for (let i = 0; i < p.m; i++) {
      for (let j = 0; j < p.n; j++) {
        if (x[i][j] > EPS) {
          must(
            uf.join(i, p.m + j),
            "Các ô phân phối dương tạo chu trình."
          );

          basis.add(key(i, j));
        }
      }
    }

    const before = basis.size;

    for (let i = 0; i < p.m; i++) {
      for (let j = 0; j < p.n; j++) {
        if (
          !basis.has(key(i, j)) &&
          uf.join(i, p.m + j)
        ) {
          basis.add(key(i, j));
          added.push([i, j]);
        }
      }
    }

    must(
      basis.size === p.m + p.n - 1,
      "Không lập được hệ cơ sở đầy đủ."
    );

    return { basis, added, before };
  }

  const iSub = x =>
    String(x).replace(
      /[0-9]/g,
      d => "₀₁₂₃₄₅₆₇₈₉"[+d]
    );

  // Tính thế vị u và v
  function potentials(p, basis) {
    const u = Array(p.m).fill(null);
    const v = Array(p.n).fill(null);
    const lines = [];

    u[0] = 0;

    for (let t = 0; t < p.m + p.n; t++) {
      let change = false;

      for (const s of basis) {
        const [i, j] = pair(s);
        const c = p.cost[i][j];

        if (u[i] !== null && v[j] === null) {
          v[j] = c - u[i];

          lines.push(
            `v${iSub(j + 1)} = ${c} − (${u[i]}) = ${v[j]}`
          );

          change = true;
        } else if (v[j] !== null && u[i] === null) {
          u[i] = c - v[j];

          lines.push(
            `u${iSub(i + 1)} = ${c} − (${v[j]}) = ${u[i]}`
          );

          change = true;
        }
      }

      if (!change) break;
    }

    must(
      u.every(z => z !== null) &&
      v.every(z => z !== null),
      "Hệ cơ sở không liên thông."
    );

    return { u, v, lines };
  }

  // Xây dựng chu trình MODI
  function cycle(p, basis, enter) {
    const g = Array.from(
      { length: p.m + p.n },
      () => []
    );

    for (const s of basis) {
      const [i, j] = pair(s);

      g[i].push([p.m + j, [i, j]]);
      g[p.m + j].push([i, [i, j]]);
    }

    const src = enter[0];
    const dst = p.m + enter[1];

    const prev = Array(g.length).fill(null);
    const q = [src];

    prev[src] = [-1, null];

    for (
      let h = 0;
      h < q.length && !prev[dst];
      h++
    ) {
      for (const [to, c] of g[q[h]]) {
        if (!prev[to]) {
          prev[to] = [q[h], c];
          q.push(to);
        }
      }
    }

    must(
      prev[dst] !== null,
      "Không dựng được chu trình MODI."
    );

    const rest = [];

    for (let node = dst; node !== src;) {
      const [parent, c] = prev[node];

      rest.push(c);
      node = parent;
    }

    rest.reverse();

    const cells = [enter, ...rest];

    must(
      cells.length >= 4 &&
      cells.length % 2 === 0,
      "Chu trình không hợp lệ."
    );

    return {
      cells,
      plus: cells.filter((_, k) => k % 2 === 0),
      minus: cells.filter((_, k) => k % 2 === 1)
    };
  }

  // Tính Delta
  function evaluate(p, basis) {
    const pot = potentials(p, basis);

    const delta = mat(p.m, p.n, null);
    const expressions = [];
    const positive = [];

    for (let i = 0; i < p.m; i++) {
      for (let j = 0; j < p.n; j++) {
        if (basis.has(key(i, j))) continue;

        const d =
          pot.u[i] +
          pot.v[j] -
          p.cost[i][j];

        delta[i][j] = d;

        expressions.push(
          `Δ${iSub(i + 1)}${iSub(j + 1)} = ` +
          `${pot.u[i]} + (${pot.v[j]}) − ` +
          `${p.cost[i][j]} = ${d}`
        );

        if (d > EPS) {
          positive.push({ i, j, d });
        }
      }
    }

    return {
      ...pot,
      delta,
      expressions,
      positive
    };
  }

  function objective(p, x) {
    return p.cost.reduce(
      (s, r, i) =>
        s + r.reduce(
          (t, c, j) => t + c * x[i][j],
          0
        ),
      0
    );
  }

  // Giải MODI đến tối ưu
  function solve(data, method) {
    must(
      ["northwest", "least"].includes(method),
      "Phương pháp không hợp lệ."
    );

    const { p, original } = prepare(data);

    const start = initial(p, method);
    const first = basisStart(p, start);

    let x = clone(start);
    let basis = new Set(first.basis);
    let antiCycle = false;

    const history = [];
    const seen = new Set();

    for (let round = 1; round <= 1500; round++) {
      const signature =
        [...basis].sort().join(";") +
        "|" +
        x.map(r =>
          r.map(v => v.toFixed(8)).join(",")
        ).join(";");

      must(
        !seen.has(signature),
        "Phát hiện vòng lặp suy biến; chưa thể kết luận tối ưu."
      );

      seen.add(signature);

      const ev = evaluate(p, basis);

      const rec = {
        round,
        x: clone(x),
        basis: new Set(basis),
        z: objective(p, x),
        ...ev
      };

      if (!ev.positive.length) {
        history.push(rec);

        const alternatives = [];

        for (let i = 0; i < p.m; i++) {
          for (let j = 0; j < p.n; j++) {
            if (
              ev.delta[i][j] !== null &&
              Math.abs(ev.delta[i][j]) < EPS
            ) {
              const c = cycle(p, basis, [i, j]);

              if (
                Math.min(
                  ...c.minus.map(
                    ([a, b]) => x[a][b]
                  )
                ) > EPS
              ) {
                alternatives.push([i, j]);
              }
            }
          }
        }

        return {
          p,
          original,
          start,
          first,
          history,
          x,
          basis,
          z: objective(p, x),
          alternatives
        };
      }

      if (
        [...basis].some(s => {
          const [i, j] = pair(s);
          return x[i][j] < EPS;
        })
      ) {
        antiCycle = true;
      }

      const entering = antiCycle
        ? ev.positive[0]
        : ev.positive.reduce(
            (a, b) => b.d > a.d + EPS ? b : a
          );

      const c = cycle(
        p,
        basis,
        [entering.i, entering.j]
      );

      const theta = Math.min(
        ...c.minus.map(
          ([i, j]) => x[i][j]
        )
      );

      const ties = c.minus.filter(
        ([i, j]) =>
          Math.abs(x[i][j] - theta) < EPS
      );

      ties.sort(
        (a, b) =>
          a[0] - b[0] || a[1] - b[1]
      );

      const leave = ties[0];

      const next = clone(x);
      const nextBasis = new Set(basis);

      for (const [i, j] of c.plus) {
        next[i][j] += theta;
      }

      for (const [i, j] of c.minus) {
        next[i][j] -= theta;

        if (Math.abs(next[i][j]) < EPS) {
          next[i][j] = 0;
        }
      }

      nextBasis.add(
        key(entering.i, entering.j)
      );

      nextBasis.delete(key(...leave));

      must(
        nextBasis.size === p.m + p.n - 1 &&
        next.every(r =>
          r.every(v => v >= -EPS)
        ),
        "Điều chỉnh MODI không hợp lệ."
      );

      rec.pivot = {
        enter: [entering.i, entering.j],
        d: entering.d,
        cycle: c,
        theta,
        leave,
        ties,
        next: clone(next),
        nextBasis: new Set(nextBasis),
        nextZ: objective(p, next),
        antiCycle
      };

      history.push(rec);

      x = next;
      basis = nextBasis;

      if (theta < EPS) {
        antiCycle = true;
      }
    }

    throw Error(
      "Vượt số vòng MODI cho phép."
    );
  }

  return {
    solve,
    mat,
    sum,
    objective,
    EPS,
    key
  };
})();

const $ = id => document.getElementById(id);

const sub = s =>
  String(s).replace(
    /[0-9]/g,
    d => "₀₁₂₃₄₅₆₇₈₉"[+d]
  );

const fmt = x =>
  (
    Math.abs(x) < Core.EPS
      ? 0
      : Number(x.toFixed(6))
  ).toLocaleString("vi-VN");

const cellName = (i, j) =>
  `(${i + 1},${j + 1})`;

const safe = x =>
  String(x).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );

let m = 3;
let n = 3;

let entries = {
  cost: Core.mat(m, n),
  supply: Array(m).fill(0),
  demand: Array(n).fill(0)
};

function readInputs() {
  const val = id => $(id)?.value ?? "";

  entries = {
    cost: Array.from(
      { length: m },
      (_, i) => Array.from(
        { length: n },
        (_, j) => val(`c-${i}-${j}`)
      )
    ),

    supply: Array.from(
      { length: m },
      (_, i) => val(`a-${i}`)
    ),

    demand: Array.from(
      { length: n },
      (_, j) => val(`b-${j}`)
    )
  };
}

function drawInputs() {
  $("m-value").textContent = m;
  $("n-value").textContent = n;

  let h = `
    <table class="transport">
      <thead>
        <tr>
          <th class="meta">Nguồn / Đích</th>
          <th class="meta">Cung</th>
  `;

  for (let j = 0; j < n; j++) {
    h += `<th>B${sub(j + 1)}</th>`;
  }

  h += `
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>Cầu</th>
          <th>—</th>
  `;

  for (let j = 0; j < n; j++) {
    h += `
      <td class="input-cell demand">
        <input
          type="number"
          min="0"
          step="any"
          id="b-${j}"
          value="${safe(entries.demand[j])}"
        >
      </td>
    `;
  }

  h += "</tr>";

  for (let i = 0; i < m; i++) {
    h += `
      <tr>
        <th class="source">A${sub(i + 1)}</th>

        <td class="input-cell supply">
          <input
            type="number"
            min="0"
            step="any"
            id="a-${i}"
            value="${safe(entries.supply[i])}"
          >
        </td>
    `;

    for (let j = 0; j < n; j++) {
      h += `
        <td class="input-cell">
          <input
            type="number"
            min="0"
            step="any"
            id="c-${i}-${j}"
            value="${safe(entries.cost[i][j])}"
          >
        </td>
      `;
    }

    h += "</tr>";
  }

  $("input-table").innerHTML =
    h + "</tbody></table>";

  $("input-table")
    .querySelectorAll("input")
    .forEach(input =>
      input.addEventListener(
        "input",
        updateTotals
      )
    );

  updateTotals();
}

function updateTotals() {
  const a = Array.from(
    { length: m },
    (_, i) => Number($(`a-${i}`).value) || 0
  );

  const b = Array.from(
    { length: n },
    (_, j) => Number($(`b-${j}`).value) || 0
  );

  $("input-totals").textContent =
    `Tổng cung: ${fmt(Core.sum(a))} · ` +
    `Tổng cầu: ${fmt(Core.sum(b))}`;
}

function resize(a, b) {
  readInputs();

  const old = entries;

  m = Math.max(2, Math.min(12, a));
  n = Math.max(2, Math.min(12, b));

  entries = {
    cost: Array.from(
      { length: m },
      (_, i) => Array.from(
        { length: n },
        (_, j) => old.cost[i]?.[j] ?? 0
      )
    ),

    supply: Array.from(
      { length: m },
      (_, i) => old.supply[i] ?? 0
    ),

    demand: Array.from(
      { length: n },
      (_, j) => old.demand[j] ?? 0
    )
  };

  drawInputs();
}

function parseInputs() {
  readInputs();

  const read = (v, label) => {
    if (String(v).trim() === "") {
      throw Error(
        `${label} không được để trống.`
      );
    }

    const x = Number(v);

    if (!Number.isFinite(x) || x < 0) {
      throw Error(
        `${label} phải là số không âm.`
      );
    }

    return x;
  };

  return {
    supply: entries.supply.map(
      (v, i) => read(v, `Cung A${i + 1}`)
    ),

    demand: entries.demand.map(
      (v, j) => read(v, `Cầu B${j + 1}`)
    ),

    cost: entries.cost.map(
      (r, i) => r.map(
        (v, j) =>
          read(v, `Chi phí ${cellName(i, j)}`)
      )
    )
  };
}

function block(id, title, html, tag) {
  return `
    <section class="panel" id="${id}">
      <span class="step-tag">${safe(tag)}</span>
      <h3 class="section-title">${safe(title)}</h3>
      ${html}
    </section>
  `;
}

function formulas(lines) {
  return `
    <div class="formulas">
      ${lines.map(
        s => `<div class="formula">${safe(s)}</div>`
      ).join("")}
    </div>
  `;
}

function renderTable(
  p,
  x,
  basis = new Set(),
  opt = {}
) {
  const plus = new Set(
    (opt.cycle?.plus || []).map(
      ([i, j]) => Core.key(i, j)
    )
  );

  const minus = new Set(
    (opt.cycle?.minus || []).map(
      ([i, j]) => Core.key(i, j)
    )
  );

  const pot = Boolean(opt.u && opt.v);

  let h = `
    <div class="table-scroll">
      <div class="scroll-wrap">
        <table class="transport">
          <thead>
            <tr>
              <th class="meta">Nguồn / Đích</th>
              <th class="meta">Cung</th>
  `;

  for (let j = 0; j < p.n; j++) {
    const dummy =
      p.dummy?.type === "destination" &&
      p.dummy.index === j;

    h += `
      <th>
        B${sub(j + 1)}
        ${dummy ? "(giả)" : ""}
      </th>
    `;
  }

  if (pot) h += "<th>uᵢ</th>";

  h += `
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Cầu</th>
              <th>Tổng: ${fmt(Core.sum(p.demand))}</th>
  `;

  for (let j = 0; j < p.n; j++) {
    h += `
      <th class="demand">
        ${fmt(p.demand[j])}
      </th>
    `;
  }

  if (pot) h += "<th>—</th>";

  h += "</tr>";

  for (let i = 0; i < p.m; i++) {
    const dummy =
      p.dummy?.type === "source" &&
      p.dummy.index === i;

    h += `
      <tr>
        <th class="source">
          A${sub(i + 1)}
          ${dummy ? "(giả)" : ""}
        </th>

        <th class="supply">
          ${fmt(p.supply[i])}
        </th>
    `;

    for (let j = 0; j < p.n; j++) {
      const k = Core.key(i, j);

      const basic = basis.has(k);
      const isPlus = plus.has(k);
      const isMinus = minus.has(k);

      const isZero =
        Math.abs(x[i][j]) < Core.EPS;

      const cls = [
        "cell",
        basic ? "basic" : "",
        isPlus ? "plus" : "",
        isMinus ? "minus" : ""
      ].filter(Boolean).join(" ");

      const qty = basic && isZero
        ? "0*"
        : isZero
          ? "0"
          : fmt(x[i][j]);

      const style = basic && isZero
        ? "zero-star"
        : isZero
          ? "normal-zero"
          : "";

      const sign = isPlus
        ? "+"
        : isMinus
          ? "−"
          : "";

      h += `
        <td class="${cls}" data-cell="${k}">
          <span class="cost">
            c = ${fmt(p.cost[i][j])}
          </span>

          <span class="qty ${style}">
            ${qty}
          </span>

          ${sign
            ? `<span class="corner-sign">${sign}</span>`
            : ""}
        </td>
      `;
    }

    if (pot) {
      h += `
        <th class="pot">
          u${sub(i + 1)} = ${fmt(opt.u[i])}
        </th>
      `;
    }

    h += "</tr>";
  }

  if (pot) {
    h += `
      <tr>
        <th>vⱼ</th>
        <th>—</th>
    `;

    for (let j = 0; j < p.n; j++) {
      h += `
        <th class="pot">
          v${sub(j + 1)} = ${fmt(opt.v[j])}
        </th>
      `;
    }

    h += "<th>—</th></tr>";
  }

  return h + "</tbody></table></div></div>";
}

function renderDelta(p, q) {
  let h = `
    <div class="table-scroll">
      <table class="delta-table">
        <thead>
          <tr>
            <th>Nguồn / Đích</th>
  `;

  for (let j = 0; j < p.n; j++) {
    h += `<th>B${sub(j + 1)}</th>`;
  }

  h += "</tr></thead><tbody>";

  for (let i = 0; i < p.m; i++) {
    h += `
      <tr>
        <th>A${sub(i + 1)}</th>
    `;

    for (let j = 0; j < p.n; j++) {
      const d = q.delta[i][j];

      const selected =
        q.pivot?.enter[0] === i &&
        q.pivot?.enter[1] === j;

      const cls = d === null
        ? "na"
        : selected
          ? "selected"
          : d > Core.EPS
            ? "positive"
            : "";

      h += `
        <td class="${cls}">
          ${d === null ? "—" : fmt(d)}
        </td>
      `;
    }

    h += "</tr>";
  }

  return h + "</tbody></table></div>";
}

function drawCycles() {
  document.querySelectorAll(
    "[data-cycle]"
  ).forEach(holder => {
    const wrap = holder.querySelector(
      ".scroll-wrap"
    );

    if (!wrap) return;

    wrap.querySelector(
      ".route-overlay"
    )?.remove();

    const cells = JSON.parse(
      holder.dataset.cycle
    );

    const box = wrap.getBoundingClientRect();

    const points = cells.map(([i, j]) => {
      const el = wrap.querySelector(
        `[data-cell="${Core.key(i, j)}"]`
      );

      if (!el) return null;

      const r = el.getBoundingClientRect();

      return [
        r.left - box.left + r.width / 2,
        r.top - box.top + r.height * 0.72
      ];
    });

    if (points.some(p => p === null)) return;

    const d = [
      ...points,
      points[0]
    ].map(
      ([x, y], i) =>
        `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`
    ).join(" ");

    const ns =
      "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(
      ns,
      "svg"
    );

    const path = document.createElementNS(
      ns,
      "path"
    );

    svg.classList.add("route-overlay");

    svg.setAttribute(
      "viewBox",
      `0 0 ${box.width} ${box.height}`
    );

    path.setAttribute("d", d);

    svg.appendChild(path);
    wrap.appendChild(svg);
  });
}

function renderAnswer(ans, method) {
  const {
    p,
    original,
    start,
    first,
    history
  } = ans;

  const methodName = method === "northwest"
    ? "Góc Tây Bắc"
    : "Chi phí nhỏ nhất";

  $("result-subtitle").textContent =
    methodName + " → MODI";

  const blocks = [];
  const nav = [];

  const add = (id, title, html, tag) => {
    blocks.push(
      block(id, title, html, tag)
    );

    nav.push(
      `<a href="#${id}">${safe(title)}</a>`
    );
  };

  const A = Core.sum(original.supply);
  const B = Core.sum(original.demand);
  const M = p.dummy?.M || 0;

  let balancing = `
    <div class="info-grid">
      <div>
        Tổng cung
        <strong>${fmt(A)}</strong>
      </div>

      <div>
        Tổng cầu
        <strong>${fmt(B)}</strong>
      </div>

      <div>
        Chênh lệch
        <strong>${fmt(M)}</strong>
      </div>
    </div>
  `;

  if (p.dummy) {
    balancing += `
      <div class="alert warning">
        ${
          p.dummy.type === "source"
            ? "Tổng cầu lớn hơn tổng cung: thêm nguồn giả."
            : "Tổng cung lớn hơn tổng cầu: thêm đích giả."
        }

        Chi phí các tuyến giả bằng 0.
      </div>
    `;

    balancing += formulas([
      `M = ${fmt(p.dummy.large)} − ` +
      `${fmt(p.dummy.small)} = ${fmt(M)}`
    ]);

    balancing += `
      <h4 class="subheading">
        Bảng sau cân bằng
      </h4>

      ${renderTable(
        p,
        Core.mat(p.m, p.n)
      )}
    `;
  } else {
    balancing += `
      <div class="alert success">
        Tổng cung bằng tổng cầu,
        không cần thêm nguồn hay đích giả.
      </div>
    `;
  }

  add(
    "s-balance",
    "1. Kiểm tra cân bằng cung – cầu",
    balancing,
    "CÂN BẰNG"
  );

  const positive = new Set();

  for (let i = 0; i < p.m; i++) {
    for (let j = 0; j < p.n; j++) {
      if (start[i][j] > Core.EPS) {
        positive.add(Core.key(i, j));
      }
    }
  }

  const firstHtml = `
    <p>
      Phương án cơ bản xuất phát theo
      phương pháp <b>${methodName}</b>:
    </p>

    ${renderTable(p, start, positive)}

    ${formulas([
      `Z₀ = ${fmt(Core.objective(p, start))}`
    ])}
  `;

  add(
    "s-initial",
    "2. Bảng phân phối ban đầu",
    firstHtml,
    "PHÂN PHỐI"
  );

  const needed = p.m + p.n - 1;

  let degeneracy = formulas([
    `m + n − 1 = ${p.m} + ${p.n} − 1 = ${needed}`,
    `Số ô phân phối dương = ${first.before}`
  ]);

  if (first.added.length) {
    degeneracy += `
      <div class="alert warning">
        Phương án ban đầu suy biến,
        cần bổ sung ô cơ sở 0* mà không tạo
        chu trình cơ sở.
      </div>
    `;

    degeneracy += `
      <h4 class="subheading">
        Trước bổ sung
      </h4>

      ${renderTable(p, start, positive)}
    `;

    degeneracy += formulas(
      first.added.map(
        ([i, j]) =>
          `Thêm ô ${cellName(i, j)} = 0*`
      )
    );

    degeneracy += `
      <h4 class="subheading">
        Sau bổ sung
      </h4>

      ${renderTable(p, start, first.basis)}
    `;

    degeneracy += `
      <div class="alert success">
        Đã bổ sung đủ m + n − 1 ô cơ sở,
        tiếp tục phương pháp thế vị.
      </div>
    `;
  } else {
    degeneracy += `
      <div class="alert success">
        Đủ số ô cơ sở,
        phương án không suy biến.
      </div>
    `;
  }

  add(
    "s-degenerate",
    "3. Kiểm tra suy biến",
    degeneracy,
    "HỆ CƠ SỞ"
  );

  for (const q of history) {
    const k = q.round;

    const potHtml =
      formulas([
        "Chọn u₁ = 0. Với mỗi ô cơ sở, uᵢ + vⱼ = cᵢⱼ.",
        ...q.lines
      ]) +
      renderTable(
        p,
        q.x,
        q.basis,
        {
          u: q.u,
          v: q.v
        }
      );

    add(
      `s-pot-${k}`,
      `4.${k} Tính thế vị – lần ${k}`,
      potHtml,
      `MODI ${k}`
    );

    let dh =
      formulas([
        "Δᵢⱼ = uᵢ + vⱼ − cᵢⱼ, với mọi ô ngoài cơ sở.",
        ...q.expressions
      ]) +
      renderDelta(p, q);

    if (!q.pivot) {
      dh += `
        <div class="alert success">
          Mọi Δ ≤ 0.
          Phương án đạt tối ưu.
        </div>
      `;
    } else {
      dh += `
        <div class="alert warning">
          Ô vào cơ sở:
          ${cellName(...q.pivot.enter)},
          Δ = ${fmt(q.pivot.d)}.

          ${
            q.pivot.antiCycle
              ? "Dùng quy tắc chống lặp suy biến."
              : "Chọn Δ dương lớn nhất."
          }
        </div>
      `;
    }

    add(
      `s-delta-${k}`,
      `5.${k} Tính Δ – lần ${k}`,
      dh,
      `MODI ${k}`
    );

    if (!q.pivot) continue;

    const t = q.pivot;
    const cy = t.cycle;

    const route = cy.cells.map(
      (c, i) =>
        `${cellName(...c)}${i % 2 ? "⁻" : "⁺"}`
    ).join(" → ");

    const cycleHtml = `
      <p>
        Chu trình:
        ${route} → ${cellName(...cy.cells[0])}
      </p>

      <div data-cycle='${JSON.stringify(cy.cells)}'>
        ${renderTable(
          p,
          q.x,
          q.basis,
          { cycle: cy }
        )}
      </div>

      ${formulas([
        `K⁺ = {${cy.plus.map(
          a => cellName(...a)
        ).join(", ")}}`,

        `K⁻ = {${cy.minus.map(
          a => cellName(...a)
        ).join(", ")}}`,

        `θ = min(${cy.minus.map(
          ([i, j]) => fmt(q.x[i][j])
        ).join(", ")}) = ${fmt(t.theta)}`
      ])}
    `;

    add(
      `s-cycle-${k}`,
      `6.${k} Chu trình – lần ${k}`,
      cycleHtml,
      `MODI ${k}`
    );

    const zeros = [...t.nextBasis]
      .map(s => s.split(",").map(Number))
      .filter(
        ([i, j]) =>
          Math.abs(t.next[i][j]) < Core.EPS
      );

    let update = `
      <p>
        Cộng θ tại các ô K⁺;
        trừ θ tại các ô K⁻.

        Ô ${cellName(...t.leave)}
        được chọn rời cơ sở,
        ở bảng sau hiển thị 0.
      </p>

      ${renderTable(
        p,
        t.next,
        t.nextBasis
      )}
    `;

    if (zeros.length) {
      update += `
        <div class="alert warning">
          <b>Giải thích 0*:</b>
          Cần ${needed} ô cơ sở (m + n − 1).

          Các ô
          ${zeros.map(
            a => cellName(...a)
          ).join(", ")}

          có lượng 0 nhưng vẫn thuộc cơ sở,
          nên ghi 0*.

          Các ô này được dùng tính thế vị
          ở lần tiếp theo.
        </div>
      `;
    }

    if (t.ties.length > 1) {
      update += `
        <p class="muted-note">
          Nhiều ô K⁻ cùng đạt θ:
          chỉ một ô được chọn rời cơ sở;
          các ô bằng 0 còn lại
          được giữ trong cơ sở.
        </p>
      `;
    }

    if (t.theta < Core.EPS) {
      update += `
        <div class="alert warning">
          θ = 0: đổi hệ cơ sở suy biến,
          lượng phân phối không thay đổi.
        </div>
      `;
    }

    update += formulas([
      `Z trước = ${fmt(q.z)}`,
      `Z sau = ${fmt(t.nextZ)}`
    ]);

    add(
      `s-update-${k}`,
      `7.${k} Bảng phân phối mới – lần ${k}`,
      update,
      `MODI ${k}`
    );
  }

  let final = `
    <div class="final-result">
      Phương án vận tải tối ưu

      <strong>
        Zmin = ${fmt(ans.z)}
      </strong>
    </div>

    <h4 class="subheading">
      Bảng phân phối tối ưu
    </h4>

    ${renderTable(
      p,
      ans.x,
      ans.basis
    )}
  `;

  const shipments = [];

  for (let i = 0; i < p.m; i++) {
    for (let j = 0; j < p.n; j++) {
      if (ans.x[i][j] > Core.EPS) {
        shipments.push(
          `x${sub(i + 1)}${sub(j + 1)} = ` +
          fmt(ans.x[i][j])
        );
      }
    }
  }

  final += `
    <div class="chips">
      ${shipments.map(
        s => `<span class="chip">${s}</span>`
      ).join("")}
    </div>
  `;

  if (ans.alternatives.length) {
    final += `
      <div class="alert warning">
        Có nhiều phương án phân phối tối ưu.
      </div>
    `;
  } else {
    final += `
      <div class="alert success">
        Không phát hiện phương án
        phân phối tối ưu khác.
      </div>
    `;
  }

  add(
    "s-final",
    "8. Kết luận",
    final,
    "TỐI ƯU"
  );

  $("result-nav").innerHTML = nav.join("");
  $("result-body").innerHTML = blocks.join("");
}

function showResult(on) {
  $("screen-input").classList.toggle(
    "hidden",
    on
  );

  $("screen-results").classList.toggle(
    "hidden",
    !on
  );

  window.scrollTo(0, 0);

  if (on) {
    requestAnimationFrame(drawCycles);
  }
}

$("m-minus").onclick = () => resize(m - 1, n);
$("m-plus").onclick = () => resize(m + 1, n);

$("n-minus").onclick = () => resize(m, n - 1);
$("n-plus").onclick = () => resize(m, n + 1);

$("btn-reset").onclick = () => {
  entries = {
    cost: Core.mat(m, n),
    supply: Array(m).fill(0),
    demand: Array(n).fill(0)
  };

  drawInputs();

  $("input-error").classList.add("hidden");
};

$("btn-solve").onclick = () => {
  try {
    $("input-error").classList.add("hidden");

    const method = document.querySelector(
      'input[name="method"]:checked'
    ).value;

    const answer = Core.solve(
      parseInputs(),
      method
    );

    renderAnswer(answer, method);
    showResult(true);

  } catch (e) {
    $("input-error").textContent = e.message;
    $("input-error").classList.remove("hidden");
  }
};

$("btn-back").onclick = () => showResult(false);

$("btn-another").onclick = () => showResult(false);

window.addEventListener(
  "resize",
  drawCycles
);

drawInputs();