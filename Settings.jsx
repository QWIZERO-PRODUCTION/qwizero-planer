import { useState } from "react";
import { uid } from "./util.js";
import { toast, push } from "./notify.js";

export default function Settings({ cfg, setCfg }) {
  const [msg, setMsg] = useState("");
  const test = async () => {
    toast("qwizero-planer", "Проверка уведомлений");
    const id = await push(cfg.topic, "qwizero-planer", "Проверка уведомлений");
    setMsg(id ? "Отправлено. Смотри на айфон." : "Не удалось отправить на айфон. Проверь интернет и тему.");
  };
  return (
    <div className="scroll">
      <h3>Нейросеть для оформления</h3>
      <p>Вставь ключ Claude API (console.anthropic.com). Он хранится только на этом ПК. Кнопка «✨ Оформить» в тексте отправляет выделенный текст (или всю страницу) в Claude.</p>
      <input className="field" type="password" value={cfg.key || ""} placeholder="sk-ant-…" onChange={(e) => setCfg({ ...cfg, key: e.target.value.trim() })} />
      <input className="field" value={cfg.model || ""} placeholder="модель (по умолчанию claude-sonnet-5-5)" onChange={(e) => setCfg({ ...cfg, model: e.target.value.trim() })} />
      <h3>Уведомления на iPhone</h3>
      <p>1. Установи из App Store бесплатное приложение <b>ntfy</b>.<br />2. В нём нажми «+» и подпишись на тему из поля ниже.<br />3. Не показывай тему другим.</p>
      <input className="field" value={cfg.topic || ""} placeholder="тема не создана" onChange={(e) => setCfg({ ...cfg, topic: e.target.value.trim() })} />
      <div className="mrow">
        <button className="ghost" onClick={() => setCfg({ ...cfg, topic: "qp-" + uid() + uid() + uid() })}>Создать тему</button>
        <button className="primary" onClick={test} disabled={!cfg.topic}>Проверить</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}
