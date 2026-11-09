// Лёгкий аудит-лог (SRS 4.9 / 4.16): в схеме БД пока нет таблицы audit_logs,
// поэтому пишем структурированные JSON-строки в stdout. Когда таблица появится,
// достаточно заменить тело write().
function audit(action, actor, details = {}) {
  if (process.env.AUDIT_SILENT === '1') return;
  const entry = {
    ts: new Date().toISOString(),
    action,
    actor: actor ? { id: actor.id, role: actor.role } : null,
    ...details,
  };
  console.log('[AUDIT]', JSON.stringify(entry));
}

module.exports = { audit };
