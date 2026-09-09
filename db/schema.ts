import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const roster = sqliteTable('school_roster', {id:text('id').primaryKey(),first:text('first_name').notNull(),last:text('last_name').notNull(),grade:text('grade').notNull()});
export const sessions=sqliteTable('staff_sessions',{hash:text('token_hash').primaryKey(),sub:text('google_sub').notNull(),email:text('email').notNull(),expires:integer('expires_at').notNull()});
export const challenges=sqliteTable('auth_challenges',{hash:text('nonce_hash').primaryKey(),expires:integer('expires_at').notNull()});
export const limits=sqliteTable('request_limits',{key:text('bucket_key').primaryKey(),hits:integer('hits').notNull(),expires:integer('expires_at').notNull()});
export const settings=sqliteTable('school_settings',{key:text('key').primaryKey(),value:text('value').notNull()});
