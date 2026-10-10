const SYS = `Ты оформляешь заметки для приложения-блокнота. Получишь сырой текст. Верни ТОЛЬКО HTML-фрагмент, без пояснений и без markdown-ограждений.
Разрешённые теги: h1, h2, h3, p, ul, ol, li, blockquote, pre, code, hr, strong, em, s, table, thead, tbody, tr, th, td.
Чек-листы делай так: <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>пункт</p></li></ul>
Правила: сохрани смысл, язык и все факты автора, ничего не выдумывай и не добавляй. Выдели структуру: заголовки для разделов, списки для перечислений, чек-листы для дел и задач, таблицы для сравнений и данных, цитаты для ключевых мыслей, жирный для важных терминов. Не злоупотребляй оформлением: короткий текст оставь простым.`;

export async function aiFormat(key, model, text) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: model || "claude-sonnet-5-5", max_tokens: 4000, system: SYS, messages: [{ role: "user", content: text }] }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || "HTTP " + r.status);
  const out = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return out.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
}
