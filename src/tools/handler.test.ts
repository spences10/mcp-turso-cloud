import {
	afterEach as after_each,
	beforeEach as before_each,
	expect,
	test,
	vi,
} from 'vite-plus/test';
import { result_set } from '../../tests/fixtures.js';

const { execute, get_token, list_databases } = vi.hoisted(() => ({
	execute: vi.fn(),
	get_token: vi.fn(),
	list_databases: vi.fn(),
}));
vi.mock('@libsql/client', () => ({
	createClient: () => ({ execute, close: vi.fn() }),
}));
vi.mock('../clients/token-manager.js', () => ({
	get_database_token: get_token,
}));
vi.mock('../config.js', () => ({
	get_config: () => ({ TURSO_ORGANIZATION: 'test' }),
}));
vi.mock('../clients/organization.js', () => ({
	list_databases,
	create_database: vi.fn(),
	delete_database: vi.fn(),
	generate_database_token: vi.fn(),
}));

import { close_database_clients } from '../clients/database.js';
import {
	create_mcp_server,
	type TursoMcpServer,
} from '../mcp-server.js';
import {
	get_current_database,
	set_current_database,
} from './context.js';

let server: TursoMcpServer;
let request_id = 0;

before_each(async () => {
	vi.clearAllMocks();
	set_current_database(undefined);
	get_token.mockResolvedValue('fake-read-token');
	execute.mockResolvedValue(result_set([{ value: 1 }]));
	server = create_mcp_server({ name: 'test', version: '1' });
	await server.receive({
		jsonrpc: '2.0',
		id: ++request_id,
		method: 'initialize',
		params: {
			protocolVersion: '2025-03-26',
			capabilities: {},
			clientInfo: { name: 'tests', version: '1' },
		},
	});
});
after_each(() => close_database_clients());

async function call_tool(
	name: string,
	args: Record<string, unknown> = {},
) {
	const response = await server.receive({
		jsonrpc: '2.0',
		id: ++request_id,
		method: 'tools/call',
		params: { name, arguments: args },
	});
	const envelope = response as {
		error?: unknown;
		result?: { isError?: boolean; content: { text: string }[] };
	};
	const text = envelope.result?.content[0]?.text;
	return {
		...envelope,
		data: text?.startsWith('{') ? JSON.parse(text) : text,
	};
}

test('preserves all nine tool names and emits constrained JSON schemas', async () => {
	const response = await server.receive({
		jsonrpc: '2.0',
		id: ++request_id,
		method: 'tools/list',
	});
	const tools = (
		response as {
			result: {
				tools: {
					name: string;
					inputSchema: Record<string, unknown>;
				}[];
			};
		}
	).result.tools;
	expect(tools.map((tool) => tool.name).sort()).toEqual([
		'create_database',
		'delete_database',
		'describe_table',
		'execute_query',
		'execute_read_only_query',
		'generate_database_token',
		'list_databases',
		'list_tables',
		'vector_search',
	]);
	expect(
		tools.find((tool) => tool.name === 'execute_read_only_query')
			?.inputSchema,
	).toMatchObject({
		properties: {
			limit: { type: 'integer', minimum: 1, maximum: 10000 },
			query: { maxLength: 10000 },
		},
	});
});

test.each([
	'PRAGMA user_version=2',
	'PRAGMA journal_mode(WAL)',
	'WITH c AS (SELECT 1) DELETE FROM t',
	'SELECT 1; DROP TABLE t',
])('rejects unsafe reads through tools/call: %s', async (query) => {
	const response = await call_tool('execute_read_only_query', {
		database: 'test',
		query,
	});
	expect(response.result?.isError).toBe(true);
	expect(response.data).toMatchObject({
		error: 'tool_usage_error',
		suggestions: expect.any(Array),
	});
	expect(get_token).not.toHaveBeenCalled();
	expect(execute).not.toHaveBeenCalled();
	expect(get_current_database()).toBeUndefined();
});

test.each([
	'EXPLAIN SELECT 1',
	'WITH c AS (SELECT 1) SELECT * FROM c',
	'PRAGMA table_info(t)',
])('accepts read queries through tools/call: %s', async (query) => {
	const response = await call_tool('execute_read_only_query', {
		database: 'test',
		query,
	});
	expect(response.result?.isError).toBeUndefined();
	expect(get_token).toHaveBeenCalledWith('test', 'read-only');
	expect(response.data.result.rows).toEqual([{ value: 1 }]);
	expect(get_current_database()).toBe('test');
});

test.each([
	{ query: 'SELECT 1', limit: 0 },
	{ query: 'SELECT 1', limit: 10001 },
	{ query: 'SELECT 1', limit: 1.5 },
	{ query: 'SELECT 1', offset: -1 },
	{ query: 'SELECT 1', params: { value: {} } },
	{ query: 'SELECT 1', database: '../bad' },
	{ query: '' },
])('rejects invalid arguments before execution: %j', async (args) => {
	const response = await call_tool('execute_read_only_query', {
		database: 'test',
		...args,
	});
	expect(Boolean(response.error || response.result?.isError)).toBe(
		true,
	);
	expect(execute).not.toHaveBeenCalled();
});

test('reports bounded read pages with an honest next offset', async () => {
	execute.mockResolvedValue(
		result_set([{ value: 1 }, { value: 2 }, { value: 3 }]),
	);
	const response = await call_tool('execute_read_only_query', {
		database: 'test',
		query: 'SELECT value FROM t',
		limit: 2,
		offset: 5,
	});
	expect(response.data).toMatchObject({
		result: { rows: [{ value: 1 }, { value: 2 }], truncated: true },
		pagination: {
			limit: 2,
			offset: 5,
			returned_count: 2,
			has_more: true,
			next_offset: 7,
		},
	});
});

test('reports missing database context as an actionable usage error', async () => {
	const response = await call_tool('execute_read_only_query', {
		query: 'SELECT 1',
	});
	expect(response.data).toMatchObject({
		error: 'tool_usage_error',
		suggestions: expect.any(Array),
	});
	expect(execute).not.toHaveBeenCalled();
});

test('an oversized first row cannot cause an endless pagination loop', async () => {
	execute.mockResolvedValue(
		result_set([{ value: 'x'.repeat(600000) }]),
	);
	const response = await call_tool('execute_read_only_query', {
		database: 'test',
		query: 'SELECT value FROM t',
	});
	expect(response.data.pagination).toMatchObject({
		has_more: true,
		returned_count: 0,
		next_offset: null,
	});
	expect(response.data.result.truncation_reason).toBe('byte_limit');
});

test('write path rejects reads but accepts mutating PRAGMAs', async () => {
	const read_response = await call_tool('execute_query', {
		database: 'test',
		query: 'WITH c AS (SELECT 1) SELECT * FROM c',
	});
	expect(read_response.result?.isError).toBe(true);
	expect(execute).not.toHaveBeenCalled();
	const write_response = await call_tool('execute_query', {
		database: 'test',
		query: 'PRAGMA user_version=3',
	});
	expect(write_response.result?.isError).toBeUndefined();
	expect(get_token).toHaveBeenCalledWith('test', 'full-access');
});

test('vector search quotes identifiers and binds the vector/limit as values', async () => {
	const response = await call_tool('vector_search', {
		database: 'test',
		table: 'docs"; DROP TABLE t;--',
		vector_column: 'v"ector',
		query_vector: [0.1, 0.2],
		limit: 2,
	});
	expect(response.result?.isError).toBeUndefined();
	expect(execute).toHaveBeenCalledWith({
		sql: expect.stringContaining(
			'vector_distance("v""ector", vector_from_json(?))',
		),
		args: ['[0.1,0.2]', 2],
	});
	expect(execute.mock.calls[0][0].sql).toContain(
		'FROM "docs""; DROP TABLE t;--"',
	);
	expect(get_token).toHaveBeenCalledWith('test', 'read-only');
});

test.each([
	{ query_vector: [] },
	{ query_vector: [Infinity] },
	{ query_vector: [1], limit: -1 },
	{ query_vector: [1], table: 'a\0b' },
])('rejects invalid vector arguments: %j', async (args) => {
	const response = await call_tool('vector_search', {
		database: 'test',
		table: 'docs',
		vector_column: 'embedding',
		...args,
	});
	expect(Boolean(response.error || response.result?.isError)).toBe(
		true,
	);
	expect(execute).not.toHaveBeenCalled();
});

test('list tools apply pagination without renaming response fields', async () => {
	list_databases.mockResolvedValue([
		{ name: 'one' },
		{ name: 'two' },
	]);
	const databases = await call_tool('list_databases', { limit: 1 });
	expect(databases.data).toMatchObject({
		databases: [{ name: 'one' }],
		pagination: { has_more: true, next_offset: 1 },
	});
	execute.mockResolvedValue(
		result_set([{ name: 'one' }, { name: 'two' }]),
	);
	const tables = await call_tool('list_tables', {
		database: 'test',
		limit: 1,
	});
	expect(tables.data).toMatchObject({
		tables: ['one'],
		pagination: { has_more: true, next_offset: 1 },
	});
});
