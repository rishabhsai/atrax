import {splitSqlQuery} from '../cli/vendor/splitter.mjs';

function object(value,keys,label) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))) throw new Error(`Invalid ${label}`);
}
function identifier(value) {
  if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(value)||/^(sqlite|__atrax)/i.test(value)) throw new Error('Migration identifiers must be ordinary, non-reserved SQL names');
  return `"${value}"`;
}
/** Online additions never change existing row shapes, constraints, or data. */
export function compileAdditiveMigration(source) {
  const value=JSON.parse(source);object(value,['version','operations'],'additive migration');
  if(value.version!==1||!Array.isArray(value.operations)||!value.operations.length||value.operations.length>100) throw new Error('An additive migration needs version 1 and 1–100 operations');
  return value.operations.map(operation=>{
    if(operation?.createTable) {
      object(operation,['createTable'],'migration operation');
      const table=operation.createTable;object(table,['name','columns'],'table');
      if(!Array.isArray(table.columns)||!table.columns.length||table.columns.length>100) throw new Error('A new table needs columns');
      const names=new Set();let primaryKeys=0;
      const columns=table.columns.map(column=>{
        object(column,['name','type','primaryKey','notNull'],'column');
        const name=identifier(column.name);
        if(names.has(name)) throw new Error('Duplicate column name');names.add(name);
        if(!['TEXT','INTEGER','REAL','BLOB'].includes(column.type)) throw new Error('Unsupported column type');
        for(const key of ['primaryKey','notNull']) if(column[key]!==undefined&&typeof column[key]!=='boolean') throw new Error('Column constraints must be booleans');
        if(column.primaryKey&&++primaryKeys>1) throw new Error('Only one primary key column is supported');
        return `${name} ${column.type}${column.primaryKey?' PRIMARY KEY':''}${column.notNull?' NOT NULL':''}`;
      });
      return `CREATE TABLE ${identifier(table.name)} (${columns.join(', ')})`;
    }
    if(operation?.createIndex) {
      object(operation,['createIndex'],'migration operation');const index=operation.createIndex;
      object(index,['name','table','columns'],'index');
      if(!Array.isArray(index.columns)||!index.columns.length||index.columns.length>16) throw new Error('An index needs columns');
      return `CREATE INDEX ${identifier(index.name)} ON ${identifier(index.table)} (${index.columns.map(identifier).join(', ')})`;
    }
    throw new Error('Online migrations support createTable and nonunique createIndex only');
  });
}
export function migrationStatements(name,source) {
  if(typeof name!=='string'||!/^\d+[^/\\]*\.(sql|json)$/.test(name)) throw new Error('Migrations must have numbered .sql or .json names');
  if(typeof source!=='string') throw new Error('Migration source is required');
  return name.endsWith('.json') ? compileAdditiveMigration(source) : splitSqlQuery(source).filter(statement=>statement.trim());
}
export function isOnlineMigration(migration) {
  if(!migration.name.endsWith('.json')) return false;
  compileAdditiveMigration(migration.source);return true;
}
/** Histories are immutable prefixes. Retaining an additive tail enables code rollback. */
export function planMigrationHistory(current,target,{rollback=false,online=current.length>0}={}) {
  const shared=Math.min(current.length,target.length);
  for(let i=0;i<shared;i++) if(current[i].name!==target[i].name||current[i].hash!==target[i].hash) throw new Error('Previously applied migration history cannot change');
  if(target.length<current.length) {
    if(!rollback||current.slice(target.length).some(migration=>!isOnlineMigration(migration))) throw new Error('Code rollback requires an unchanged history with only additive migrations retained');
    return {apply:[],retain:current.slice(target.length),history:current};
  }
  const apply=target.slice(current.length);
  if(online&&apply.some(migration=>!isOnlineMigration(migration))) throw new Error('Live migrations must use the declarative additive JSON contract');
  return {apply,retain:[],history:target};
}
