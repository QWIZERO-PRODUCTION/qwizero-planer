import { useState } from "react";
import { uid, TYPES, TAGS } from "./util.js";

function Cell({ c, r, set }) {
  const v = r[c.id];
  if (c.type === "check") return <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} />;
  if (c.type === "select") return <select value={v ?? ""} onChange={(e) => set(e.target.value)}><option value="">—</option>{(c.opts || []).map((o) => <option key={o}>{o}</option>)}</select>;
  return <input type={c.type} value={v ?? ""} onChange={(e) => set(e.target.value)} />;
}

function Table({ page, patch, vis }) {
  const { cols, rows } = page;
  const up = (o) => patch(page.id, o);
  const setCell = (id, c, v) => up({ rows: rows.map((r) => (r.id === id ? { ...r, [c]: v } : r)) });
  const setCol = (id, o) => up({ cols: cols.map((c) => (c.id === id ? { ...c, ...o } : c)) });
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>
          {cols.map((c) => (
            <th key={c.id}>
              <input value={c.name} onChange={(e) => setCol(c.id, { name: e.target.value })} />
              <select value={c.type} onChange={(e) => setCol(c.id, { type: e.target.value, ...(e.target.value === "select" && !c.opts ? { opts: ["Вариант 1", "Вариант 2"] } : {}) })}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="x" title="Удалить колонку" onClick={() => up({ cols: cols.filter((x) => x.id !== c.id) })}>×</button>
              {c.type === "select" && <input className="opts" key={c.id + "o"} defaultValue={(c.opts || []).join(", ")} placeholder="варианты через запятую" onBlur={(e) => setCol(c.id, { opts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />}
            </th>
          ))}
          <th className="narrow"><button title="Новая колонка" onClick={() => up({ cols: [...cols, { id: uid(), name: "Колонка", type: "text" }] })}>+</button></th>
        </tr></thead>
        <tbody>
          {vis.map((r) => (
            <tr key={r.id}>
              {cols.map((c) => <td key={c.id}><Cell c={c} r={r} set={(v) => setCell(r.id, c.id, v)} /></td>)}
              <td className="narrow"><button className="x" title="Удалить строку" onClick={() => up({ rows: rows.filter((x) => x.id !== r.id) })}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="ghost" onClick={() => up({ rows: [...rows, { id: uid() }] })}>+ Новая строка</button>
    </div>
  );
}

function Board({ page, patch, vis }) {
  const sel = page.cols.find((c) => c.type === "select");
  const tcol = page.cols.find((c) => c.type === "text");
  const dcol = page.cols.find((c) => c.type === "date");
  if (!sel) return <p className="hint">Для доски нужна колонка типа «Выбор». Добавь её на вкладке «Таблица».</p>;
  const setRow = (id, o) => patch(page.id, { rows: page.rows.map((r) => (r.id === id ? { ...r, ...o } : r)) });
  const opts = sel.opts || [];
  const rename = (g, v) => {
    v = v.trim();
    if (!v || v === g || opts.includes(v)) return;
    patch(page.id, { cols: page.cols.map((c) => (c.id === sel.id ? { ...c, opts: opts.map((o) => (o === g ? v : o)) } : c)), rows: page.rows.map((r) => (r[sel.id] === g ? { ...r, [sel.id]: v } : r)) });
  };
  const addGroup = () => patch(page.id, { cols: page.cols.map((c) => (c.id === sel.id ? { ...c, opts: [...opts, "Группа " + (opts.length + 1)] } : c)) });
  return (
    <div className="board">
      {[...(sel.opts || []), ""].map((g, i) => {
        const t = TAGS[i % TAGS.length];
        const items = vis.filter((r) => (r[sel.id] || "") === g);
        if (g === "" && !items.length) return null;
        return (
          <div key={g || "none"} className="col" style={{ "--t": t[0], "--tc": t[1] }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => setRow(e.dataTransfer.getData("id"), { [sel.id]: g })}>
            <div className="col-h">
              {g ? <input className="tag" defaultValue={g} size={Math.max(4, g.length)} title="Переименовать группу" onBlur={(e) => rename(g, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} /> : <span className="tag">Без статуса</span>}
              <em>{items.length}</em>
            </div>
            {items.map((r) => (
              <div key={r.id} className="card" draggable onDragStart={(e) => e.dataTransfer.setData("id", r.id)}>
                <input value={tcol ? r[tcol.id] ?? "" : ""} placeholder="Без названия" onChange={(e) => tcol && setRow(r.id, { [tcol.id]: e.target.value })} />
                {dcol && r[dcol.id] && <small>{r[dcol.id]}</small>}
                <button className="x" onClick={() => patch(page.id, { rows: page.rows.filter((x) => x.id !== r.id) })}>×</button>
              </div>
            ))}
            <button className="addcard" onClick={() => patch(page.id, { rows: [...page.rows, { id: uid(), [sel.id]: g }] })}>+ Новая страница</button>
          </div>
        );
      })}
      <button className="addgroup" onClick={addGroup}>+ Новая группа</button>
    </div>
  );
}

function Gallery({ page, patch, vis }) {
  const tcol = page.cols.find((c) => c.type === "text");
  const others = page.cols.filter((c) => c !== tcol);
  const setRow = (id, o) => patch(page.id, { rows: page.rows.map((r) => (r.id === id ? { ...r, ...o } : r)) });
  return (
    <div className="gallery">
      {vis.map((r) => (
        <div key={r.id} className="gcard">
          <input value={tcol ? r[tcol.id] ?? "" : ""} placeholder="Без названия" onChange={(e) => tcol && setRow(r.id, { [tcol.id]: e.target.value })} />
          {others.map((c) => <div key={c.id} className="prop"><span title={c.name}>{c.name}</span><Cell c={c} r={r} set={(v) => setRow(r.id, { [c.id]: v })} /></div>)}
          <button className="x" onClick={() => patch(page.id, { rows: page.rows.filter((x) => x.id !== r.id) })}>×</button>
        </div>
      ))}
      <button className="gcard addcard" onClick={() => patch(page.id, { rows: [...page.rows, { id: uid() }] })}>+ Новая страница</button>
    </div>
  );
}

const OPS = [["contains", "содержит"], ["eq", "равно"], ["empty", "пусто"], ["notempty", "не пусто"]];
const match = (r, f, cols) => {
  const c = cols.find((x) => x.id === f.col);
  if (!c) return true;
  const v = r[f.col], s = v == null ? "" : String(v);
  if (f.op === "empty") return c.type === "check" ? !v : s === "";
  if (f.op === "notempty") return c.type === "check" ? !!v : s !== "";
  if (f.op === "eq") return c.type === "check" ? !!v === (f.val === "1") : s === (f.val || "");
  return s.toLowerCase().includes((f.val || "").toLowerCase());
};
const defaults = (c) => (c.type === "check" ? { op: "eq", val: "1" } : c.type === "select" ? { op: "eq", val: c.opts?.[0] || "" } : { op: "contains", val: "" });

export function DbView({ page, patch }) {
  const [q, setQ] = useState("");
  const [pp, setPP] = useState(null);
  const view = page.view || "table", cols = page.cols, filters = page.filters || [], sort = page.sort;
  const sel = cols.find((c) => c.type === "select");
  let vis = page.rows;
  if (q) vis = vis.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q.toLowerCase())));
  filters.forEach((f) => { vis = vis.filter((r) => match(r, f, cols)); });
  const sc = sort && cols.find((x) => x.id === sort.col);
  if (sc) {
    const key = (r) => { const v = r[sc.id]; if (sc.type === "check") return v ? 1 : 0; if (v === "" || v == null) return null; return sc.type === "number" ? Number(v) : String(v); };
    vis = [...vis].sort((a, b) => {
      const x = key(a), y = key(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const d = typeof x === "number" ? x - y : x.localeCompare(y, "ru", { numeric: true });
      return sort.dir === "desc" ? -d : d;
    });
  }
  const setF = (id, o) => patch(page.id, { filters: filters.map((f) => (f.id === id ? { ...f, ...o } : f)) });
  const addRow = () => patch(page.id, { rows: [...page.rows, { id: uid(), ...(view === "board" && sel?.opts?.[0] ? { [sel.id]: sel.opts[0] } : {}) }] });
  return (
    <>
      {pp && <div className="away" onClick={() => setPP(null)} />}
      <div className="dbbar">
        {[["table", "Таблица"], ["board", "Доска"], ["gallery", "Галерея"]].map(([k, l]) => <button key={k} className={"pill" + (view === k ? " on" : "")} onClick={() => patch(page.id, { view: k })}>{l}</button>)}
        <span className="grow" />
        <div className="rel">
          <button className={"pill" + (filters.length ? " has" : "")} onClick={() => setPP(pp === "f" ? null : "f")}>Фильтр{filters.length ? ` · ${filters.length}` : ""}</button>
          {pp === "f" && (
            <div className="popover wide">
              {filters.map((f) => {
                const c = cols.find((x) => x.id === f.col) || cols[0];
                const ops = c.type === "check" || c.type === "select" ? OPS.slice(1) : OPS;
                return (
                  <div className="frow" key={f.id}>
                    <select value={f.col} onChange={(e) => setF(f.id, { col: e.target.value, ...defaults(cols.find((x) => x.id === e.target.value)) })}>{cols.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                    <select value={f.op} onChange={(e) => setF(f.id, { op: e.target.value })}>{ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    {(f.op === "contains" || f.op === "eq") && (c.type === "select" ? <select value={f.val} onChange={(e) => setF(f.id, { val: e.target.value })}>{(c.opts || []).map((o) => <option key={o}>{o}</option>)}</select>
                      : c.type === "check" ? <select value={f.val} onChange={(e) => setF(f.id, { val: e.target.value })}><option value="1">Да</option><option value="0">Нет</option></select>
                        : <input value={f.val} onChange={(e) => setF(f.id, { val: e.target.value })} placeholder="значение" />)}
                    <button className="x" onClick={() => patch(page.id, { filters: filters.filter((x) => x.id !== f.id) })}>×</button>
                  </div>
                );
              })}
              <button className="ghost" onClick={() => patch(page.id, { filters: [...filters, { id: uid(), col: cols[0].id, ...defaults(cols[0]) }] })}>+ Добавить фильтр</button>
            </div>
          )}
        </div>
        <div className="rel">
          <button className={"pill" + (sc ? " has" : "")} onClick={() => setPP(pp === "s" ? null : "s")}>Сортировка{sc ? " · " + (sort.dir === "desc" ? "↓" : "↑") : ""}</button>
          {pp === "s" && (
            <div className="popover">
              <select className="field" value={sort?.col || ""} onChange={(e) => patch(page.id, { sort: e.target.value ? { col: e.target.value, dir: sort?.dir || "asc" } : null })}><option value="">Без сортировки</option>{cols.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              {sc && <select className="field" value={sort.dir} onChange={(e) => patch(page.id, { sort: { ...sort, dir: e.target.value } })}><option value="asc">По возрастанию ↑</option><option value="desc">По убыванию ↓</option></select>}
            </div>
          )}
        </div>
        <input placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary sm" onClick={addRow}>Новая</button>
      </div>
      {view === "board" ? <Board page={page} patch={patch} vis={vis} /> : view === "gallery" ? <Gallery page={page} patch={patch} vis={vis} /> : <Table page={page} patch={patch} vis={vis} />}
    </>
  );
}
