import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExt from "@tiptap/extension-image";
import { kvGet, kvSet } from "./store.js";
import { toast, push, cancelPush } from "./notify.js";
import logo from "./logo.png";
import { uid, toData, dbProps } from "./util.js";
import Editor from "./Editor.jsx";
import { DbView } from "./Db.jsx";
import Settings from "./Settings.jsx";

const ICONS = ["📝", "📌", "🎯", "📚", "💡", "✅", "🗂️", "⭐", "🔥", "🌙", "🎨", "🧠", "💼", "🏠", "✈️", "🎵"];
const G = ["linear-gradient(120deg,#2a2f4a,#6f7fc4 55%,#e8a98f)", "linear-gradient(135deg,#1d2030,#4b5688 60%,#9fb0e0)", "linear-gradient(120deg,#2b2430,#7a5a73,#e8b9a5)", "linear-gradient(135deg,#16181f,#33384f 50%,#6a7399)", "linear-gradient(120deg,#1f2b2e,#3f6f70,#a8d8c8)"];
const coverBg = (c) => (c.g != null ? G[c.g] : `url(${c.img}) center/cover`);
const local = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const mapPatch = (id, o) => (ps) => ps.map((p) => (p.id === id ? { ...p, ...o } : p));
const welcome = () => ({ id: uid(), title: "Первая страница", icon: "✨", html: "<p>Вставляй фото через Ctrl+V или перетаскивай прямо в текст. Двойной щелчок по странице в панели слева переименовывает её.</p>", parent: null, open: true });


function Importer({ onDone }) {
  const [txt, setTxt] = useState("");
  const go = () => {
    const lines = txt.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return;
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const grid = lines.map((l) => l.split(sep).map((s) => s.trim().replace(/^"|"$/g, "")));
    const cols = grid[0].map((n) => ({ id: uid(), name: n || "Колонка", type: "text" }));
    const rows = grid.slice(1).map((g) => { const r = { id: uid() }; cols.forEach((c, i) => { r[c.id] = g[i] ?? ""; }); return r; });
    cols.forEach((c) => { if (rows.length && rows.every((r) => r[c.id] !== "" && !isNaN(Number(r[c.id])))) c.type = "number"; });
    onDone(cols, rows);
  };
  return (
    <>
      <h3>Импорт таблицы</h3>
      <p>В Google Таблицах выдели ячейки, нажми Ctrl+C и вставь сюда. Первая строка станет заголовками.</p>
      <textarea autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Вставь таблицу…" />
      <div className="mrow"><button className="primary" onClick={go}>Создать базу</button></div>
    </>
  );
}

function Search({ pages, onPick }) {
  const [q, setQ] = useState("");
  const t = q.toLowerCase();
  const list = pages.filter((p) => !t || (p.title || "").toLowerCase().includes(t) || (p.html || "").replace(/<[^>]+>/g, " ").toLowerCase().includes(t)).slice(0, 8);
  return (
    <>
      <input autoFocus className="field" placeholder="Поиск по страницам…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && list[0] && onPick(list[0].id)} />
      <div className="results">{list.map((p) => <button key={p.id} onClick={() => onPick(p.id)}>{p.icon || (p.kind === "db" ? "▦" : "▤")} {p.title || "Без названия"}</button>)}{!list.length && <p className="hint">Ничего не найдено</p>}</div>
    </>
  );
}

export default function App() {
  const [pages, setPages] = useState([]);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState(null);
  const [cfg, setCfg] = useState({ topic: "" });
  const [modal, setModal] = useState(null);
  const [side, setSide] = useState(true);
  const [ren, setRen] = useState(null);
  const [pop, setPop] = useState(null);
  const [banner, setBanner] = useState(null);
  const ref = useRef([]), cfgRef = useRef(cfg);

  useEffect(() => {
    (async () => {
      let d = await kvGet("pages");
      if (!d) { try { d = JSON.parse(localStorage.getItem("qwizero-planer.v1")); } catch {} }
      if (!Array.isArray(d) || !d.length) d = [welcome()];
      setPages(d); setSel(d[0].id); setCfg((await kvGet("cfg")) || { topic: "" }); setReady(true);
    })();
  }, []);
  useEffect(() => {
    ref.current = pages;
    if (!ready) return;
    const t = setTimeout(() => kvSet("pages", pages), 500);
    return () => clearTimeout(t);
  }, [pages, ready]);
  useEffect(() => { cfgRef.current = cfg; if (ready) kvSet("cfg", cfg); }, [cfg, ready]);

  useEffect(() => {
    const tick = async () => {
      const now = Date.now();
      for (const p of ref.current) {
        if (!p.remind) continue;
        if (p.remind <= now) {
          if (!p.fired) { setPages(mapPatch(p.id, { fired: true })); toast(p.title || "Без названия", "Напоминание"); setBanner(p); }
        } else if (!p.pid && cfgRef.current.topic && p.remind - now < 72 * 36e5) {
          setPages(mapPatch(p.id, { pid: "…" }));
          const id = await push(cfgRef.current.topic, "Напоминание", p.title || "Без названия", p.remind);
          setPages(mapPatch(p.id, { pid: id }));
        }
      }
    };
    const t = setInterval(tick, 20000); tick();
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const k = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); setModal("search"); }
      if (e.key === "Escape") { setModal(null); setPop(null); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  if (!ready) return <div className="app" />;
  const cur = pages.find((p) => p.id === sel) || pages[0];
  const patch = (id, o) => setPages(mapPatch(id, o));
  const addPage = (parent, o = {}) => {
    const p = { id: uid(), title: "", html: "", parent, open: true, ...o };
    setPages((ps) => [...ps.map((x) => (x.id === parent ? { ...x, open: true } : x)), p]);
    setSel(p.id);
  };
  const setRemind = (p, v) => { cancelPush(cfg.topic, p.pid); patch(p.id, { remind: v, fired: false, pid: null }); };
  const del = (id) => {
    const gone = new Set([id]);
    let grew = true;
    while (grew) { grew = false; pages.forEach((p) => { if (p.parent && gone.has(p.parent) && !gone.has(p.id)) { gone.add(p.id); grew = true; } }); }
    if (!window.confirm("Удалить страницу и всё, что внутри?")) return;
    pages.filter((p) => gone.has(p.id)).forEach((p) => cancelPush(cfg.topic, p.pid));
    const rest = pages.filter((p) => !gone.has(p.id));
    if (!rest.length) { const n = welcome(); setPages([n]); setSel(n.id); return; }
    setPages(rest);
    if (gone.has(sel)) setSel(rest[0].id);
  };

  const tree = (parent, depth) => pages.filter((p) => p.parent === parent).map((p) => {
    const kids = pages.some((k) => k.parent === p.id);
    return (
      <div key={p.id}>
        <div className={"row" + (p.id === cur.id ? " sel" : "")} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setSel(p.id)}>
          <span className="caret" onClick={(e) => { e.stopPropagation(); patch(p.id, { open: !p.open }); }}>{kids ? (p.open ? "▾" : "▸") : ""}</span>
          <span className="kind">{p.icon || (p.kind === "db" ? "▦" : "▤")}</span>
          <span className="name" onDoubleClick={() => setRen(p.id)}>
            {ren === p.id
              ? <input autoFocus defaultValue={p.title} onClick={(e) => e.stopPropagation()} onBlur={(e) => { patch(p.id, { title: e.target.value }); setRen(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} />
              : p.title || "Без названия"}
          </span>
          <span className="acts">
            <button title="Переименовать" onClick={(e) => { e.stopPropagation(); setRen(p.id); }}>✎</button>
            <button title="Вложенная страница" onClick={(e) => { e.stopPropagation(); addPage(p.id); }}>+</button>
            <button title="Удалить" onClick={(e) => { e.stopPropagation(); del(p.id); }}>×</button>
          </span>
        </div>
        {p.open && tree(p.id, depth + 1)}
      </div>
    );
  });

  return (
    <div className={"app" + (side ? "" : " collapsed")}>
      <aside>
        <div className="top">
          <button className="sq" title="Свернуть панель" onClick={() => setSide(false)}>⟨</button>
          <button className="sq" title="Новая страница" onClick={() => addPage(null)}>✎</button>
        </div>
        <button className="search" onClick={() => setModal("search")}>Поиск <kbd>Ctrl+K</kbd></button>
        <div className="nav">
          <button onClick={() => addPage(null, dbProps())}>▦&nbsp; Новая база</button>
          <button onClick={() => setModal("import")}>⇩&nbsp; Импорт из таблицы</button>
        </div>
        <div className="sec">Приватные</div>
        <div className="tree">{tree(null, 0)}</div>
        <div className="foot"><img src={logo} alt="" /><span>qwizero-planer</span><button className="sq" title="Уведомления" onClick={() => setModal("settings")}>⚙</button></div>
      </aside>
      <main>
        {!side && <button className="sq float" onClick={() => setSide(true)} title="Показать панель">☰</button>}
        {cur.cover && <div className="cover" style={{ background: coverBg(cur.cover) }} />}
        <div className={"page" + (cur.kind === "db" ? " wide" : "") + (cur.cover ? " hascover" : "")} key={cur.id}>
          <div className="head">
            <div className="rel">
              <button className="icon" onClick={() => setPop(pop === "icon" ? null : "icon")}>{cur.icon || "☺"}</button>
              {pop === "icon" && <div className="popover grid">{ICONS.map((i) => <button key={i} onClick={() => { patch(cur.id, { icon: i }); setPop(null); }}>{i}</button>)}<button onClick={() => { patch(cur.id, { icon: "" }); setPop(null); }}>✕</button></div>}
            </div>
            <input className="title" value={cur.title} placeholder="Без названия" onChange={(e) => patch(cur.id, { title: e.target.value })} />
            <div className="rel">
              <button className={"bell" + (cur.cover ? " on" : "")} title="Обложка" onClick={() => setPop(pop === "cover" ? null : "cover")}>🏞</button>
              {pop === "cover" && (
                <div className="popover">
                  <label>Обложка</label>
                  <div className="gradrow">{G.map((g, i) => <button key={i} className="swatch" style={{ background: g }} onClick={() => patch(cur.id, { cover: { g: i } })} />)}</div>
                  <label className="ghost upl">Загрузить фото<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) patch(cur.id, { cover: { img: await toData(f, 2000) } }); e.target.value = ""; }} /></label>
                  {cur.cover && <button className="ghost" onClick={() => { patch(cur.id, { cover: null }); setPop(null); }}>Убрать</button>}
                </div>
              )}
            </div>
            <div className="rel">
              <button className={"bell" + (cur.remind ? " on" : "")} title="Напоминание" onClick={() => setPop(pop === "bell" ? null : "bell")}>🔔</button>
              {pop === "bell" && (
                <div className="popover">
                  <label>Напомнить</label>
                  <input type="datetime-local" className="field" value={cur.remind ? local(cur.remind) : ""} onChange={(e) => setRemind(cur, e.target.value ? new Date(e.target.value).getTime() : null)} />
                  {cur.remind && <button className="ghost" onClick={() => { setRemind(cur, null); setPop(null); }}>Убрать</button>}
                  {!cfg.topic && <small>Чтобы напоминание приходило на айфон, настрой его в ⚙ внизу слева.</small>}
                </div>
              )}
            </div>
          </div>
          {cur.kind === "db" ? <DbView page={cur} patch={patch} /> : <Editor page={cur} cfg={cfg} onNeedKey={() => setModal("settings")} onHtml={(html) => patch(cur.id, { html })} />}
        </div>
      </main>
      {modal && (
        <div className="veil" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal === "search" && <Search pages={pages} onPick={(id) => { setSel(id); setModal(null); }} />}
            {modal === "import" && <Importer onDone={(cols, rows) => { setModal(null); addPage(null, { kind: "db", view: "table", title: "Импорт", cols, rows }); }} />}
            {modal === "settings" && <Settings cfg={cfg} setCfg={setCfg} />}
          </div>
        </div>
      )}
      {banner && (
        <div className="banner">
          <div><b>🔔 Напоминание</b><span>{banner.title || "Без названия"}</span></div>
          <button className="primary sm" onClick={() => { setSel(banner.id); setBanner(null); }}>Открыть</button>
          <button className="x" onClick={() => setBanner(null)}>×</button>
        </div>
      )}
    </div>
  );
}
