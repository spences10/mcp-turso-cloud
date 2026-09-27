import {
	createClient as create_client,
	type Client,
	type InValue,
	type ResultSet,
} from '@libsql/client';
import { ToolUsageError, TursoApiError } from '../common/errors.js';
import {
	analyze_query,
	quote_identifier,
	require_read_query,
} from '../common/sql.js';
import { get_config } from '../config.js';
import { get_database_token } from './token-manager.js';

export type QueryParams = Record<string, InValue>;

function convert_parameters(
	params: QueryParams,
): QueryParams | InValue[] {
	const keys = Object.keys(params);
	if (!keys.length) return {};
	if (keys.length > 1000)
		throw new ToolUsageError(
			'At most 1000 SQL parameters are supported.',
		);
	const numeric_keys = keys.filter((key) => /^\d+$/.test(key));
	if (!numeric_keys.length) return params;
	if (
		numeric_keys.length !== keys.length ||
		!keys.every((key) => /^[1-9]\d*$/.test(key))
	) {
		throw new ToolUsageError(
			'Use named parameters or contiguous positional keys starting at 1, not a mixture.',
		);
	}
	if (Math.max(...keys.map(Number)) !== keys.length) {
		throw new ToolUsageError(
			'Positional parameter keys must be contiguous and start at 1.',
		);
	}
	return Array.from(
		{ length: keys.length },
		(_value, index) => params[String(index + 1)],
	);
}

const client_cache = new Map<
	string,
	{ client: Client; token: string }
>();

export async function get_database_client(
	database_name: string,
	permission: 'full-access' | 'read-only',
): Promise<Client> {
	const cache_key = `${database_name}:${permission}`;
	const token = await get_database_token(database_name, permission);
	const cached = client_cache.get(cache_key);
	if (cached?.token === token) return cached.client;
	cached?.client.close();
	const client = create_client({
		url: `https://${database_name}-${get_config().TURSO_ORGANIZATION}.turso.io`,
		authToken: token,
	});
	client_cache.set(cache_key, { client, token });
	return client;
}

export function close_database_clients(): void {
	for (const { client } of client_cache.values()) client.close();
	client_cache.clear();
}

async function execute_statement(
	database_name: string,
	query: string,
	params: QueryParams,
	permission: 'full-access' | 'read-only',
): Promise<ResultSet> {
	const args = convert_parameters(params);
	try {
		const client = await get_database_client(
			database_name,
			permission,
		);
		return await client.execute({ sql: query, args });
	} catch (error) {
		if (
			error instanceof TursoApiError ||
			error instanceof ToolUsageError
		)
			throw error;
		throw new TursoApiError(
			`Failed to execute query for database ${database_name}: ${error instanceof Error ? error.message : 'Unknown database error'}`,
			500,
		);
	}
}

export async function execute_read_only_query(
	database_name: string,
	query: string,
	params: QueryParams = {},
	limit = 1000,
	offset = 0,
): Promise<ResultSet> {
	const plan = require_read_query(query);
	if (
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > 10000 ||
		!Number.isInteger(offset) ||
		offset < 0 ||
		offset > 1000000
	) {
		throw new ToolUsageError(
			'Read limit must be 1–10000 and offset 0–1000000, both integers.',
		);
	}
	// Wrap rather than append: preserves existing LIMIT/OFFSET and ignores
	// misleading LIMIT keywords inside strings, comments, or nested queries.
	const sql = plan.can_paginate
		? `SELECT * FROM (\n${plan.sql}\n) AS "_mcp_page" LIMIT ${limit + 1} OFFSET ${offset}`
		: plan.sql;
	const result = await execute_statement(
		database_name,
		sql,
		params,
		'read-only',
	);
	return plan.can_paginate
		? result
		: {
				...result,
				rows: result.rows.slice(offset, offset + limit + 1),
			};
}

export async function execute_query(
	database_name: string,
	query: string,
	params: QueryParams = {},
): Promise<ResultSet> {
	const plan = analyze_query(query);
	if (plan.read_only) {
		throw new ToolUsageError(
			'Read-only SQL must use execute_read_only_query.',
			[
				'Use execute_read_only_query for SELECT, read-only WITH, EXPLAIN, and metadata PRAGMAs.',
			],
		);
	}
	return execute_statement(
		database_name,
		plan.sql,
		params,
		'full-access',
	);
}

export async function list_tables(
	database_name: string,
	limit = 1000,
	offset = 0,
): Promise<string[]> {
	const result = await execute_read_only_query(
		database_name,
		"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		{},
		limit,
		offset,
	);
	return result.rows.map((row) => row.name as string);
}

export async function describe_table(
	database_name: string,
	table_name: string,
) {
	const result = await execute_read_only_query(
		database_name,
		`PRAGMA table_info(${quote_identifier(table_name)})`,
		{},
		10000,
	);
	return result.rows.map((row) => ({
		name: row.name as string,
		type: row.type as string,
		notnull: row.notnull as number,
		dflt_value: row.dflt_value as string | null,
		pk: row.pk as number,
	}));
}
