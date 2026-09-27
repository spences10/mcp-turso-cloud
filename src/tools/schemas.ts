import { z } from 'zod';

export const database_name_schema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z0-9_-]+$/);
export const database_schema = database_name_schema
	.optional()
	.describe(
		'Database name; uses the current or default database when omitted',
	);
export const identifier_schema = z
	.string()
	.min(1)
	.max(64)
	.refine(
		(value) => !value.includes('\0'),
		'Identifiers cannot contain null bytes',
	);
export const limit_schema = z
	.number()
	.int()
	.min(1)
	.max(10000)
	.default(1000);
export const offset_schema = z
	.number()
	.int()
	.min(0)
	.max(1000000)
	.default(0);
export const query_schema = z.object({
	query: z
		.string()
		.min(1)
		.max(10000)
		.describe('One SQL statement; supply values using params'),
	params: z
		.record(
			z.string().min(1).max(128),
			z.union([
				z.string().max(1_000_000),
				z.number(),
				z.boolean(),
				z.null(),
			]),
		)
		.default({}),
	database: database_schema,
});
export const read_query_schema = query_schema.extend({
	limit: limit_schema.describe(
		'Maximum returned rows, default 1000, capped at 10000',
	),
	offset: offset_schema.describe(
		'Rows to skip within the query result',
	),
});
export const list_schema = z.object({
	limit: limit_schema,
	offset: offset_schema,
});
export const database_list_schema = list_schema.extend({
	database: database_schema,
});
export const describe_table_schema = z.object({
	table: identifier_schema,
	database: database_schema,
});
export const vector_search_schema = z.object({
	table: identifier_schema,
	vector_column: identifier_schema,
	query_vector: z.array(z.number()).min(1).max(4096),
	limit: z.number().int().min(1).max(1000).default(10),
	database: database_schema,
});
