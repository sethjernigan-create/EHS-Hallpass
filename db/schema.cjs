var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var schema_exports = {};
__export(schema_exports, {
  challenges: () => challenges,
  limits: () => limits,
  roster: () => roster,
  sessions: () => sessions,
  settings: () => settings
});
module.exports = __toCommonJS(schema_exports);
var import_sqlite_core = require("drizzle-orm/sqlite-core");
const roster = (0, import_sqlite_core.sqliteTable)("school_roster", { id: (0, import_sqlite_core.text)("id").primaryKey(), first: (0, import_sqlite_core.text)("first_name").notNull(), last: (0, import_sqlite_core.text)("last_name").notNull(), grade: (0, import_sqlite_core.text)("grade").notNull() });
const sessions = (0, import_sqlite_core.sqliteTable)("staff_sessions", { hash: (0, import_sqlite_core.text)("token_hash").primaryKey(), sub: (0, import_sqlite_core.text)("google_sub").notNull(), email: (0, import_sqlite_core.text)("email").notNull(), expires: (0, import_sqlite_core.integer)("expires_at").notNull() });
const challenges = (0, import_sqlite_core.sqliteTable)("auth_challenges", { hash: (0, import_sqlite_core.text)("nonce_hash").primaryKey(), expires: (0, import_sqlite_core.integer)("expires_at").notNull() });
const limits = (0, import_sqlite_core.sqliteTable)("request_limits", { key: (0, import_sqlite_core.text)("bucket_key").primaryKey(), hits: (0, import_sqlite_core.integer)("hits").notNull(), expires: (0, import_sqlite_core.integer)("expires_at").notNull() });
const settings = (0, import_sqlite_core.sqliteTable)("school_settings", { key: (0, import_sqlite_core.text)("key").primaryKey(), value: (0, import_sqlite_core.text)("value").notNull() });
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  challenges,
  limits,
  roster,
  sessions,
  settings
});
