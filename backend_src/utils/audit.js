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
