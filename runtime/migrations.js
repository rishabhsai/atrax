/** Migration statements and their immutable checksum commit in one D1 batch. */
export async function applyMigrations(db,migrations,deploymentId) {
  await db.prepare('CREATE TABLE IF NOT EXISTS __atrax_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, deployment_id TEXT NOT NULL, applied_at INTEGER NOT NULL)').run();
  const existing=(await db.prepare('SELECT name,hash FROM __atrax_migrations ORDER BY name').all()).results;
  for(const applied of existing) {
    const wanted=migrations.find(m=>m.name===applied.name);
    if(!wanted || wanted.hash!==applied.hash) throw new Error(`Applied migration changed or disappeared: ${applied.name}`);
  }
  for(const migration of migrations) {
    if(existing.some(value=>value.name===migration.name)) continue;
    await db.batch([
      ...migration.statements.map(sql=>db.prepare(sql)),
      db.prepare('INSERT INTO __atrax_migrations(name,hash,deployment_id,applied_at) VALUES(?,?,?,?)').bind(migration.name,migration.hash,deploymentId,Date.now()),
    ]);
  }
}
