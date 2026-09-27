import {
	createClient as create_client,
	type Client,
} from '@libsql/client';
import { expect, test, vi } from 'vite-plus/test';

vi.mock('@libsql/client', async (import_original) => ({
	...(await import_original<typeof import('@libsql/client')>()),
	createClient: vi.fn(),
}));
vi.mock('./token-manager.js', () => ({
	get_database_token: () => Promise.resolve('fake-token'),
}));
vi.mock('../config.js', () => ({
	get_config: () => ({ TURSO_ORGANIZATION: 'test' }),
}));

import {
	close_database_clients,
	describe_table,
	execute_query,
	execute_read_only_query,
} from './database.js';

test('executes generated SQL against an isolated in-memory libSQL database', async () => {
	const { createClient: create_local_client } =
		await vi.importActual<typeof import('@libsql/client')>(
			'@libsql/client',
		);
	const local_client: Client = create_local_client({
		url: 'file::memory:',
	});
	vi.mocked(create_client).mockReturnValue(local_client);
	try {
		await execute_query(
			'test',
			'CREATE TABLE "odd""; table" (value INTEGER)',
		);
		for (const value of [1, 2, 3])
			await execute_query(
				'test',
				'INSERT INTO "odd""; table" VALUES (?)',
				{ '1': value },
			);
		const paged = await execute_read_only_query(
			'test',
			'WITH c AS (SELECT value FROM "odd""; table") SELECT * FROM c ORDER BY value LIMIT 3; -- end',
			{},
			1,
			1,
		);
		expect(paged.rows.map((row) => row.value)).toEqual([2, 3]);
		const metadata = await describe_table('test', 'odd"; table');
		expect(metadata).toMatchObject([
			{ name: 'value', type: 'INTEGER' },
		]);
		const explained = await execute_read_only_query(
			'test',
			'EXPLAIN QUERY PLAN SELECT * FROM "odd""; table"',
		);
		expect(explained.rows.length).toBeGreaterThan(0);
		await expect(
			execute_read_only_query('test', 'PRAGMA user_version=7'),
		).rejects.toThrow();
		const version_before = await execute_read_only_query(
			'test',
			'PRAGMA user_version',
		);
		expect(version_before.rows[0].user_version).toBe(0);
		await execute_query('test', 'PRAGMA user_version=7');
		const version_after = await execute_read_only_query(
			'test',
			'PRAGMA user_version',
		);
		expect(version_after.rows[0].user_version).toBe(7);
		await expect(
			execute_read_only_query(
				'test',
				'SELECT 1; DROP TABLE "odd""; table"',
			),
		).rejects.toThrow();
		await execute_query(
			'test',
			'WITH c AS (SELECT 1 AS value) DELETE FROM "odd""; table" WHERE value IN (SELECT value FROM c)',
		);
		const remaining = await execute_read_only_query(
			'test',
			'SELECT * FROM "odd""; table" ORDER BY value',
		);
		expect(remaining.rows.map((row) => row.value)).toEqual([2, 3]);
	} finally {
		close_database_clients();
	}
});
