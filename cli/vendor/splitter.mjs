// Cloudflare workers-sdk b149147a1746d30fd8a868dbef7a4aac463444f1; Apache-2.0. See LICENSE-workers-sdk.
import { trimSqlQuery } from "./trimmer.mjs";
function mayContainMultipleStatements(sql) {
  const trimmed = sql.trimEnd();
  const semiColonIndex = trimmed.indexOf(";");
  return semiColonIndex !== -1 && semiColonIndex !== trimmed.length - 1;
}
function splitSqlQuery(sql) {
  const trimmedSql = trimSqlQuery(sql);
  if (!mayContainMultipleStatements(trimmedSql)) {
    return [trimmedSql];
  }
  const split = splitSqlIntoStatements(trimmedSql);
  if (split.length === 0) {
    return [trimmedSql];
  } else {
    return split;
  }
}
function normalizeSqlLineEndings(sql) {
  let normalized = "";
  let quoteEnd;
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    const nextChar = sql[index + 1];
    if (quoteEnd !== void 0) {
      normalized += char;
      if (char === quoteEnd) {
        if (nextChar === quoteEnd) {
          normalized += nextChar;
          index++;
        } else {
          quoteEnd = void 0;
        }
      }
      continue;
    }
    if (inLineComment) {
      if (char === "\r" && nextChar === "\n") {
        normalized += "\n";
        index++;
        inLineComment = false;
      } else {
        normalized += char;
        inLineComment = char !== "\n";
      }
      continue;
    }
    if (inBlockComment) {
      if (char === "\r" && nextChar === "\n") {
        normalized += "\n";
        index++;
      } else {
        normalized += char;
        if (char === "*" && nextChar === "/") {
          normalized += nextChar;
          index++;
          inBlockComment = false;
        }
      }
      continue;
    }
    if (char === "-" && nextChar === "-") {
      normalized += "--";
      index++;
      inLineComment = true;
      continue;
    }
    if (char === "/" && nextChar === "*") {
      normalized += "/*";
      index++;
      inBlockComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      normalized += char;
      quoteEnd = char;
      continue;
    }
    if (char === "[") {
      normalized += char;
      quoteEnd = "]";
      continue;
    }
    if (char === "\r" && nextChar === "\n") {
      normalized += "\n";
      index++;
      continue;
    }
    normalized += char;
  }
  return normalized;
}
function splitSqlIntoStatements(sql) {
  const statements = [];
  let str = "";
  const compoundStatementStack = [];
  const iterator = sql[Symbol.iterator]();
  let next = iterator.next();
  while (!next.done) {
    const char = next.value;
    if (compoundStatementStack[0]?.(str + char)) {
      compoundStatementStack.shift();
    }
    switch (char) {
      case `'`:
      case `"`:
      case "`":
        str += char + consumeUntilMarker(iterator, char);
        break;
      case `$`: {
        const dollarQuote = "$" + consumeWhile(iterator, isDollarQuoteIdentifier);
        str += dollarQuote;
        if (dollarQuote.endsWith("$")) {
          str += consumeUntilMarker(iterator, dollarQuote);
        }
        break;
      }
      case `-`:
        next = iterator.next();
        if (!next.done && next.value === "-") {
          consumeUntilMarker(iterator, "\n");
          str += "\n";
          break;
        } else {
          str += char;
          continue;
        }
      case `/`:
        next = iterator.next();
        if (!next.done && next.value === "*") {
          consumeUntilMarker(iterator, "*/");
          break;
        } else {
          str += char;
          continue;
        }
      case `;`:
        if (compoundStatementStack.length === 0) {
          statements.push(str);
          str = "";
        } else {
          str += char;
        }
        break;
      default:
        str += char;
        break;
    }
    if (isCompoundStatementStart(str)) {
      compoundStatementStack.unshift(isCompoundStatementEnd);
    }
    next = iterator.next();
  }
  statements.push(str);
  return statements.map((statement) => statement.trim()).filter((statement) => statement.length > 0);
}
function consumeWhile(iterator, predicate, window = 16) {
  let next = iterator.next();
  let str = "";
  let tail = "";
  while (!next.done) {
    str += next.value;
    tail = (tail + next.value).slice(-window);
    if (!predicate(tail)) {
      break;
    }
    next = iterator.next();
  }
  return str;
}
function consumeUntilMarker(iterator, endMarker) {
  return consumeWhile(
    iterator,
    (str) => !str.endsWith(endMarker),
    endMarker.length
  );
}
function isDollarQuoteIdentifier(str) {
  const lastChar = str.slice(-1);
  return (
    // The $ marks the end of the identifier
    lastChar !== "$" && // we allow numbers, underscore and letters with diacritical marks
    (/[0-9_]/i.test(lastChar) || lastChar.toLowerCase() !== lastChar.toUpperCase())
  );
}
function isCompoundStatementStart(str) {
  return /\s(BEGIN|CASE)\s$/i.test(str);
}
function isCompoundStatementEnd(str) {
  return /\sEND[;\s]$/i.test(str);
}
export {
  mayContainMultipleStatements,
  normalizeSqlLineEndings,
  splitSqlQuery
};
