export const uid = () => Math.random().toString(36).slice(2, 10);
export const TYPES = { text: "Текст", number: "Число", select: "Выбор", check: "Галочка", date: "Дата" };
export const TAGS = [["rgba(224,120,128,.17)", "#f2a3aa"], ["rgba(232,190,100,.15)", "#ecca7c"], ["rgba(110,200,160,.15)", "#93dab8"], ["rgba(150,172,238,.17)", "#b6c4f4"], ["rgba(200,150,230,.15)", "#d6b0f2"]];
export const toData = (file, max = 1600) => new Promise((res) => {
  const img = new window.Image(), u = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(u); res(c.toDataURL("image/webp", 0.85));
  };
  img.src = u;
});
export const dbProps = () => {
  const sid = uid(), first = "К выполнению";
  return { kind: "db", view: "board", title: "", filters: [], sort: null,
    cols: [{ id: uid(), name: "Название", type: "text" }, { id: sid, name: "Статус", type: "select", opts: [first, "В работе", "Готово"] }, { id: uid(), name: "Дата", type: "date" }],
    rows: [{ id: uid(), [sid]: first }] };
};
