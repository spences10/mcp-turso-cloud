import {
	afterEach as after_each,
	beforeEach as before_each,
	describe,
	expect,
	test,
	vi,
} from 'vite-plus/test';
import { result_set } from '../../tests/fixtures.js';

const { create_client, execute, close, get_token } = vi.hoisted(
	() => ({
		create_client: vi.fn(),
		execute: vi.fn(),
		close: vi.fn(),
		get_token: vi.fn(),
	}),
);
vi.mock('@libsql/client', () => ({ createClient: create_client }));
vi.mock('./token-manager.js', () => ({
	get_database_token: get_token,
}));
vi.mock('../config.js', () => ({
	get_config: () => ({ TURSO_ORGANIZATION: 'test' }),
}));

import {
	close_database_clients,
	describe_table,
	execute_query,
	execute_read_only_query,
	get_database_client,
} from './database.js';

before_each(() => {
	vi.clearAllMocks();
	create_client.mockImplementation(() => ({ execute, close }));
	get_token.mockImplementation(
		(_database: string, permission: string) =>
			Promise.resolve(`fake-${permission}`),
	);
	execute.mockResolvedValue(result_set([{ value: 1 }]));
});
after_each(() => close_database_clients());

describe('remote permission boundary', () => {
	test.each([
		'SELECT 1',
		'WITH c AS (SELECT 1) SELECT * FROM c',
		'EXPLAIN SELECT 1',
		'PRAGMA user_version',
	])('always uses read-only credentials for %s', async (query) => {
		await get_database_client('test', 'full-access');
		await execute_read_only_query('test', query);
		expect(get_token).toHaveBeenLastCalledWith('test', 'read-only');
		expect(create_client).toHaveBeenLastCalledWith(
			expect.objectContaining({ authToken: 'fake-read-only' }),
		);
	});
	test.each([
		'PRAGMA user_version=3',
		'PRAGMA journal_mode(WAL)',
		'WITH c AS (SELECT 1) DELETE FROM t',
		'SELECT 1; DELETE FROM t',
	])('rejects %s before acquiring a client', async (query) => {
		await expect(
			execute_read_only_query('test', query),
		).rejects.toThrow();
		expect(get_token).not.toHaveBeenCalled();
		expect(execute).not.toHaveBeenCalled();
	});
	test('does not retry permission errors using full-access credentials', async () => {
		execute.mockRejectedValue(new Error('SQLITE_AUTH'));
		await expect(
			execute_read_only_query('test', 'SELECT 1'),
		).rejects.toThrow('SQLITE_AUTH');
		expect(get_token).toHaveBeenCalledTimes(1);
		expect(get_token).toHaveBeenCalledWith('test', 'read-only');
	});
	test('routes mutating PRAGMAs and CTE writes to full-access', async () => {
		await execute_query('test', 'PRAGMA user_version=2');
		await execute_query('test', 'WITH c AS (SELECT 1) DELETE FROM t');
		expect(get_token).toHaveBeenNthCalledWith(
			1,
			'test',
			'full-access',
		);
		expect(get_token).toHaveBeenNthCalledWith(
			2,
			'test',
			'full-access',
		);
		await expect(
			execute_query('test', 'WITH c AS (SELECT 1) SELECT * FROM c'),
		).rejects.toThrow('execute_read_only_query');
		expect(execute).toHaveBeenCalledTimes(2);
	});
	test('renews cached clients when their token changes', async () => {
		await execute_read_only_query('test', 'SELECT 1');
		await execute_read_only_query('test', 'SELECT 1');
		expect(create_client).toHaveBeenCalledTimes(1);
		get_token.mockResolvedValue('fake-renewed');
		await execute_read_only_query('test', 'SELECT 1');
		expect(close).toHaveBeenCalledTimes(1);
		expect(create_client).toHaveBeenCalledTimes(2);
	});
});

test('pagination wraps existing LIMIT and uses a lookahead row', async () => {
	await execute_read_only_query(
		'test',
		"SELECT 'limit' AS value LIMIT 20; -- comment",
		{},
		5,
		2,
	);
	expect(execute).toHaveBeenCalledWith({
		sql: expect.stringMatching(
			/SELECT \* FROM \(\nSELECT 'limit' AS value LIMIT 20\n\).*LIMIT 6 OFFSET 2$/,
		),
		args: {},
	});
});

test('metadata/explain pagination does not rewrite SQL', async () => {
	execute.mockResolvedValue(
		result_set([
			{ value: 0 },
			{ value: 1 },
			{ value: 2 },
			{ value: 3 },
		]),
	);
	const result = await execute_read_only_query(
		'test',
		'PRAGMA user_version',
		{},
		1,
		1,
	);
	expect(result.rows).toEqual([{ value: 1 }, { value: 2 }]);
	expect(execute).toHaveBeenCalledWith({
		sql: 'PRAGMA user_version',
		args: {},
	});
});

test('quotes metadata identifiers', async () => {
	await describe_table('test', 'odd"; DROP TABLE t;--');
	expect(execute).toHaveBeenCalledWith({
		sql: 'PRAGMA table_info("odd""; DROP TABLE t;--")',
		args: {},
	});
	expect(get_token).toHaveBeenCalledWith('test', 'read-only');
});

test.each<Record<string, number>>([
	{ '0': 1 },
	{ '2': 1 },
	{ '999999999': 1 },
	{ '1': 1, named: 2 },
	{ '01': 1 },
])('rejects invalid parameter indexes %j', async (params) => {
	await expect(
		execute_read_only_query('test', 'SELECT ?', params),
	).rejects.toThrow('parameter');
	expect(execute).not.toHaveBeenCalled();
});

test('supports existing positional and named bindings', async () => {
	await execute_read_only_query('test', 'SELECT ?', {
		'1': "value';--",
	});
	expect(execute).toHaveBeenLastCalledWith({
		sql: expect.any(String),
		args: ["value';--"],
	});
	await execute_read_only_query('test', 'SELECT :value', {
		value: 2,
	});
	expect(execute).toHaveBeenLastCalledWith({
		sql: expect.any(String),
		args: { value: 2 },
	});
});
