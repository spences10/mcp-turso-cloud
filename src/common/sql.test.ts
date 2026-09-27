import { describe, expect, test } from 'vite-plus/test';
import {
	analyze_query,
	quote_identifier,
	require_read_query,
} from './sql.js';

describe('read-only routing', () => {
	test.each([
		'SELECT 1',
		'  -- a query\n SELECT 1; -- trailing comment',
		'SELECT \'DROP; UPDATE; -- not SQL\', "odd;column" FROM t',
		'/* metadata */ PRAGMA main.table_info("odd; table")',
		"PRAGMA table_info('a''b')",
		'PRAGMA user_version',
		'PRAGMA journal_mode',
		'PRAGMA integrity_check(10)',
		'WITH c AS (SELECT 1) SELECT * FROM c',
		'WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM c WHERE x < 3) SELECT * FROM c',
		'WITH a AS NOT MATERIALIZED (SELECT 1), b AS MATERIALIZED (SELECT * FROM a) SELECT * FROM b',
		'WITH a AS (WITH b AS (SELECT 1) SELECT * FROM b) SELECT * FROM a',
		'EXPLAIN SELECT 1',
		'EXPLAIN QUERY PLAN WITH c AS (SELECT 1) SELECT * FROM c',
	])('accepts %s', (sql) => {
		expect(require_read_query(sql).read_only).toBe(true);
	});
	test.each([
		'INSERT INTO t VALUES (1)',
		'DELETE FROM t',
		'PRAGMA user_version=2',
		'PRAGMA user_version(2)',
		'PRAGMA journal_mode=WAL',
		"PRAGMA journal_mode('WAL')",
		'PRAGMA writable_schema=ON',
		'PRAGMA optimize',
		'PRAGMA wal_checkpoint',
		'PRAGMA made_up',
		'WITH c AS (SELECT 1) DELETE FROM t',
		'WITH c AS (SELECT 1) UPDATE t SET x=2',
		'WITH c AS (SELECT 1) INSERT INTO t SELECT * FROM c',
		'WITH c AS (DELETE FROM t RETURNING *) SELECT * FROM c',
		'EXPLAIN DELETE FROM t',
		'SELECT 1; DROP TABLE t',
		'PRAGMA table_info(t); PRAGMA user_version=2',
		"SELECT load_extension('module')",
		'SELECT "load_extension"(\'module\')',
		"SELECT [writefile]('path', 'value')",
		"SELECT `readfile`('path')",
		'SELECT 1 /* unfinished',
		"SELECT 'unfinished",
		'SELECT (1',
		'-- only a comment',
		'SELECT\0 1',
	])('rejects %s', (sql) => {
		expect(() => require_read_query(sql)).toThrow();
	});
	test('keeps safe writes on the write route and removes only the final delimiter', () => {
		expect(
			analyze_query('WITH c AS (SELECT 1) DELETE FROM t; -- end')
				.read_only,
		).toBe(false);
		expect(analyze_query("SELECT ';'; /* end */").sql).toBe(
			"SELECT ';'",
		);
		expect(analyze_query('PRAGMA user_version=2').read_only).toBe(
			false,
		);
	});
	test('bounds query size and nesting', () => {
		expect(() =>
			analyze_query('EXPLAIN '.repeat(102) + 'SELECT 1'),
		).toThrow('nesting');
		expect(() =>
			analyze_query('SELECT ' + '1'.repeat(10000)),
		).toThrow();
		expect(() =>
			analyze_query(
				'SELECT ' + '('.repeat(101) + '1' + ')'.repeat(101),
			),
		).toThrow();
	});
});

test('quotes identifiers without treating them as SQL', () => {
	expect(quote_identifier('a"b; DROP TABLE t')).toBe(
		'"a""b; DROP TABLE t"',
	);
	for (const value of ['', 'a\0b', 'x'.repeat(65)])
		expect(() => quote_identifier(value)).toThrow();
});
