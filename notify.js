import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
// Нативное уведомление Windows
export async function toast(title, body) {
  try {
    let ok = await isPermissionGranted();
    if (!ok) ok = (await requestPermission()) === "granted";
    if (ok) sendNotification({ title, body });
  } catch {}
}
// Пуш на iPhone через ntfy.sh. atMs — когда доставить (сервер сам хранит и доставит, даже если ПК выключен)
export async function push(topic, title, body, atMs) {
  if (!topic) return null;
  const q = new URLSearchParams({ title });
  if (atMs) q.set("delay", String(Math.floor(atMs / 1000)));
  try {
    const r = await fetch(`https://ntfy.sh/${topic}?${q}`, { method: "POST", body });
    if (!r.ok) return null;
    return (await r.json()).id || "ok";
  } catch { return null; }
}
export async function cancelPush(topic, id) {
  if (!topic || !id || id === "…" || id === "ok") return;
  try { await fetch(`https://ntfy.sh/${topic}/${id}`, { method: "DELETE" }); } catch {}
}
