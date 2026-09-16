// Cloudflare workers-sdk b149147a1746d30fd8a868dbef7a4aac463444f1; Apache-2.0. See LICENSE-workers-sdk.
function trimSqlQuery(sql) {
  if (!mayContainTransaction(sql)) {
    return sql;
  }
  const trimmedSql = sql.replace("BEGIN TRANSACTION;", "").replace("COMMIT;", "");
  if (mayContainTransaction(trimmedSql)) {
    throw new Error(
      "Wrangler could not process the provided SQL file, as it contains several transactions.\nD1 runs your SQL in a transaction for you.\nPlease export an SQL file from your SQLite database and try again."
    );
  }
  return trimmedSql;
}
function mayContainTransaction(sql) {
  return sql.includes("BEGIN TRANSACTION");
}
export {
  mayContainTransaction,
  trimSqlQuery
};
