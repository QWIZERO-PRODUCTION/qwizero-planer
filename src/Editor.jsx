import { useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExt from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { toData } from "./util.js";
import { aiFormat } from "./ai.js";

const Img = ImageExt.configure({ allowBase64: true }).extend({
  addAttributes() {
    return { ...this.parent?.(), width: { default: null, parseHTML: (el) => el.style.width || null, renderHTML: (a) => (a.width ? { style: `width:${a.width}` } : {}) } };
  },
});

const ITEMS = [
  { t: "Заголовок 1", d: "Крупный раздел", k: ["h1", "заголовок"], r: (c) => c.toggleHeading({ level: 1 }).run() },
  { t: "Заголовок 2", d: "Средний раздел", k: ["h2", "заголовок"], r: (c) => c.toggleHeading({ level: 2 }).run() },
  { t: "Заголовок 3", d: "Малый раздел", k: ["h3", "заголовок"], r: (c) => c.toggleHeading({ level: 3 }).run() },
  { t: "Список", d: "Маркированный", k: ["список", "ul", "bullet"], r: (c) => c.toggleBulletList().run() },
  { t: "Нумерованный список", d: "1, 2, 3…", k: ["номер", "ol", "список"], r: (c) => c.toggleOrderedList().run() },
  { t: "Задачи", d: "Чек-лист с галочками", k: ["задач", "todo", "чек"], r: (c) => c.toggleTaskList().run() },
  { t: "Цитата", d: "Выделенная мысль", k: ["цитат", "quote"], r: (c) => c.toggleBlockquote().run() },
  { t: "Код", d: "Блок кода", k: ["код", "code"], r: (c) => c.toggleCodeBlock().run() },
  { t: "Таблица", d: "3×3 с заголовком", k: ["таблиц", "table"], r: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { t: "Разделитель", d: "Горизонтальная линия", k: ["раздел", "линия", "hr"], r: (c) => c.setHorizontalRule().run() },
  { t: "Фото", d: "Вставить изображение", k: ["фото", "картинк", "image"], r: (c, x) => { c.run(); x.file(); } },
  { t: "Оформить через ИИ", d: "Claude наведёт порядок", k: ["ии", "ai", "оформ"], r: (c, x) => { c.run(); x.ai(); } },
];

export default function Editor({ page, onHtml, cfg, onNeedKey }) {
  const ref = useRef(null), fileRef = useRef(null), slashRef = useRef(null), listRef = useRef([]), pickRef = useRef(null);
  const [slash, setSlash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const isImg = (fs) => fs && [...fs].some((f) => f.type.startsWith("image/"));
  const put = (fs) => [...fs].filter((f) => f.type.startsWith("image/")).forEach(async (f) => ref.current?.chain().focus().setImage({ src: await toData(f) }).run());

  const detect = (editor) => {
    const { state, view } = editor;
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock || $from.parent.type.name === "codeBlock") return setSlash(null);
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const m = /(?:^|\s)\/([^\s/]*)$/.exec(before);
    if (!m) return setSlash(null);
    const to = $from.pos, from = to - m[1].length - 1, c = view.coordsAtPos(to);
    setSlash((s) => ({ from, to, q: m[1], x: c.left, y: c.bottom + 6, i: s && s.q === m[1] ? s.i : 0 }));
  };

  const ed = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), Placeholder.configure({ placeholder: "Начни писать… «/» открывает меню блоков, Ctrl+V вставляет фото" }), Img, Table.configure({ resizable: true }), TableRow, TableHeader, TableCell],
    content: page.html,
    onUpdate: ({ editor }) => { onHtml(editor.getHTML()); detect(editor); },
    onSelectionUpdate: ({ editor }) => detect(editor),
    editorProps: {
      handlePaste: (_, e) => { const f = e.clipboardData?.files; if (isImg(f)) { put(f); return true; } return false; },
      handleDrop: (_, e) => { const f = e.dataTransfer?.files; if (isImg(f)) { put(f); return true; } return false; },
      handleKeyDown: (_, e) => {
        const s = slashRef.current, L = listRef.current;
        if (!s || !L.length) return false;
        if (e.key === "ArrowDown") { setSlash({ ...s, i: (s.i + 1) % L.length }); return true; }
        if (e.key === "ArrowUp") { setSlash({ ...s, i: (s.i + L.length - 1) % L.length }); return true; }
        if (e.key === "Enter") { pickRef.current(L[s.i]); return true; }
        if (e.key === "Escape") { setSlash(null); return true; }
        return false;
      },
    },
  });
  ref.current = ed;
  slashRef.current = slash;
  const q = slash ? slash.q.toLowerCase() : "";
  const list = slash ? ITEMS.filter((it) => !q || it.t.toLowerCase().includes(q) || it.k.some((k) => k.includes(q))) : [];
  listRef.current = list;
  if (!ed) return null;

  const format = async () => {
    if (!cfg.key) return onNeedKey();
    const { from, to, empty } = ed.state.selection;
    const text = empty ? ed.getText({ blockSeparator: "\n\n" }) : ed.state.doc.textBetween(from, to, "\n\n");
    if (!text.trim()) return setMsg("Сначала напиши текст, потом нажми «Оформить».");
    const imgs = empty ? (ed.getHTML().match(/<img[^>]*>/g) || []).join("") : "";
    setBusy(true); setMsg("");
    try {
      const out = await aiFormat(cfg.key, cfg.model, text);
      if (empty) ed.commands.setContent(out + imgs, true);
      else ed.chain().focus().insertContentAt({ from, to }, out).run();
    } catch (e) { setMsg("Ошибка ИИ: " + e.message); }
    setBusy(false);
  };
  pickRef.current = (it) => {
    const s = slashRef.current;
    setSlash(null);
    it.r(ed.chain().focus().deleteRange({ from: s.from, to: s.to }), { file: () => fileRef.current.click(), ai: format });
  };

  const c = () => ed.chain().focus();
  const B = (label, on, run, title) => <button title={title} className={on ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); run(); }}>{label}</button>;
  const iw = ed.getAttributes("image").width;
  return (
    <>
      <div className="bar">
        {B("H1", ed.isActive("heading", { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), "Заголовок 1")}
        {B("H2", ed.isActive("heading", { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), "Заголовок 2")}
        <i />
        {B("Ж", ed.isActive("bold"), () => c().toggleBold().run(), "Жирный")}
        {B("К", ed.isActive("italic"), () => c().toggleItalic().run(), "Курсив")}
        {B("Ч", ed.isActive("strike"), () => c().toggleStrike().run(), "Зачёркнутый")}
        <i />
        {B("Список", ed.isActive("bulletList"), () => c().toggleBulletList().run())}
        {B("1.", ed.isActive("orderedList"), () => c().toggleOrderedList().run(), "Нумерованный")}
        {B("Задачи", ed.isActive("taskList"), () => c().toggleTaskList().run())}
        <i />
        {B("Цитата", ed.isActive("blockquote"), () => c().toggleBlockquote().run())}
        {B("Код", ed.isActive("codeBlock"), () => c().toggleCodeBlock().run())}
        {B("▦", ed.isActive("table"), () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), "Таблица")}
        {B("—", false, () => c().setHorizontalRule().run(), "Разделитель")}
        {B("🖼 Фото", false, () => fileRef.current.click(), "Вставить фото")}
        <i />
        {B(busy ? "✨ Оформляю…" : "✨ Оформить", false, () => !busy && format(), "Claude оформит выделенный текст или всю страницу")}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { put(e.target.files); e.target.value = ""; }} />
      </div>
      {ed.isActive("image") && <div className="bar sub">Размер фото: {["25%", "50%", "75%", "100%"].map((w) => B(w, iw === w, () => c().updateAttributes("image", { width: w }).run()))}</div>}
      {ed.isActive("table") && <div className="bar sub">Таблица: {B("+ строка", false, () => c().addRowAfter().run())}{B("+ колонка", false, () => c().addColumnAfter().run())}{B("− строка", false, () => c().deleteRow().run())}{B("− колонка", false, () => c().deleteColumn().run())}{B("Удалить таблицу", false, () => c().deleteTable().run())}</div>}
      {msg && <p className="hint">{msg}</p>}
      <EditorContent editor={ed} className="doc" />
      {slash && list.length > 0 && (
        <div className="slash" style={{ left: slash.x, top: Math.min(slash.y, window.innerHeight - 300) }}>
          {list.map((it, i) => <button key={it.t} className={i === slash.i ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); pickRef.current(it); }}>{it.t}<small>{it.d}</small></button>)}
        </div>
      )}
    </>
  );
}
