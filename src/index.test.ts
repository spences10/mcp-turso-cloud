import { spawnSync as spawn_sync } from 'node:child_process';
import { readFileSync as read_file_sync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath as file_url_to_path } from 'node:url';
import { expect, test } from 'vite-plus/test';

const entry_path = file_url_to_path(
	new URL('../dist/index.js', import.meta.url),
);
const package_info = JSON.parse(
	read_file_sync(new URL('../package.json', import.meta.url), 'utf8'),
);

test('built CLI initializes and lists tools without database access', () => {
	const messages = [
		{
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-03-26',
				capabilities: {},
				clientInfo: { name: 'tooling-smoke-test', version: '1.0.0' },
			},
		},
		{ jsonrpc: '2.0', method: 'notifications/initialized' },
		{ jsonrpc: '2.0', id: 2, method: 'tools/list' },
	];
	const result = spawn_sync(process.execPath, [entry_path], {
		encoding: 'utf8',
		timeout: 10_000,
		cwd: tmpdir(),
		env: {
			TURSO_API_TOKEN: 'smoke-test-not-a-real-token',
			TURSO_ORGANIZATION: 'smoke-test',
		},
		input:
			messages.map((message) => JSON.stringify(message)).join('\n') +
			'\n',
	});

	expect(result.error).toBeUndefined();
	expect(result.status, result.stderr).toBe(0);
	const responses = result.stdout
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(responses).toHaveLength(2);
	expect(responses[0]).toMatchObject({
		id: 1,
		result: {
			serverInfo: {
				name: package_info.name,
				version: package_info.version,
			},
		},
	});
	expect(responses[1]).toMatchObject({
		id: 2,
		result: { tools: expect.any(Array) },
	});
	const tool_names = responses[1].result.tools.map(
		(tool: { name: string }) => tool.name,
	);
	expect(tool_names).toEqual(
		expect.arrayContaining([
			'list_databases',
			'create_database',
			'delete_database',
			'generate_database_token',
			'list_tables',
			'execute_read_only_query',
			'execute_query',
			'describe_table',
			'vector_search',
		]),
	);
});

test('built CLI rejects missing configuration', () => {
	const result = spawn_sync(process.execPath, [entry_path], {
		encoding: 'utf8',
		timeout: 10_000,
		env: {},
	});

	expect(result.error).toBeUndefined();
	expect(result.status).toBe(1);
	expect(result.stdout).toBe('');
	expect(result.stderr).toContain('Missing required configuration');
});
