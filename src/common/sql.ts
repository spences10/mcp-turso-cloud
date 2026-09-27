import { ToolUsageError } from './errors.js';

interface SqlToken {
	text: string;
	kind: 'word' | 'quoted' | 'symbol';
	start: number;
	end: number;
}

export interface QueryPlan {
	sql: string;
	read_only: boolean;
	can_paginate: boolean;
}

const read_pragmas = new Set([
	'application_id',
	'collation_list',
	'compile_options',
	'database_list',
	'data_version',
	'encoding',
	'foreign_key_check',
	'foreign_key_list',
	'freelist_count',
	'function_list',
	'index_info',
	'index_list',
	'index_xinfo',
	'integrity_check',
	'journal_mode',
	'module_list',
	'page_count',
	'page_size',
	'pragma_list',
	'quick_check',
	'schema_version',
	'table_info',
	'table_list',
	'table_xinfo',
	'user_version',
]);
const argument_pragmas = new Set([
	'foreign_key_check',
	'foreign_key_list',
	'index_info',
	'index_list',
	'index_xinfo',
	'integrity_check',
	'quick_check',
	'table_info',
	'table_xinfo',
]);

function invalid_sql(message: string): never {
	throw new ToolUsageError(message, [
		'Use one complete SQL statement, with values supplied through params.',
	]);
}

// This lexer supports routing, not database authorization. Read execution
// must also use a read-only Turso token, regardless of the SQL text.
function tokenize_sql(query: string): SqlToken[] {
	const tokens: SqlToken[] = [];
	let index = 0;
	let depth = 0;
	while (index < query.length) {
		const char = query[index];
		if (/\s/.test(char)) {
			index++;
			continue;
		}
		if (query.startsWith('--', index)) {
			const end = query.indexOf('\n', index + 2);
			index = end < 0 ? query.length : end + 1;
			continue;
		}
		if (query.startsWith('/*', index)) {
			const end = query.indexOf('*/', index + 2);
			if (end < 0) invalid_sql('Unterminated SQL comment.');
			index = end + 2;
			continue;
		}
		const start = index;
		if (
			char === "'" ||
			char === '"' ||
			char === '`' ||
			char === '['
		) {
			const closing = char === '[' ? ']' : char;
			index++;
			let closed = false;
			while (index < query.length) {
				if (query[index++] !== closing) continue;
				if (closing !== ']' && query[index] === closing) {
					index++;
					continue;
				}
				closed = true;
				break;
			}
			if (!closed)
				invalid_sql('Unterminated SQL string or identifier.');
			tokens.push({
				text: query.slice(start, index),
				kind: 'quoted',
				start,
				end: index,
			});
			continue;
		}
		if (/[a-z_]/i.test(char)) {
			while (index < query.length && /[a-z0-9_$]/i.test(query[index]))
				index++;
			tokens.push({
				text: query.slice(start, index).toLowerCase(),
				kind: 'word',
				start,
				end: index,
			});
			continue;
		}
		index++;
		if (char === '(' && ++depth > 100)
			invalid_sql('SQL nesting exceeds 100 levels.');
		if (char === ')' && --depth < 0)
			invalid_sql('Unbalanced SQL parentheses.');
		tokens.push({ text: char, kind: 'symbol', start, end: index });
	}
	if (depth !== 0) invalid_sql('Unbalanced SQL parentheses.');
	return tokens;
}

function is_keyword(
	token: SqlToken | undefined,
	word: string,
): boolean {
	return token?.kind === 'word' && token.text === word;
}

function after_group(tokens: SqlToken[], start: number): number {
	if (tokens[start]?.text !== '(')
		invalid_sql('Expected a parenthesized SQL expression.');
	let depth = 0;
	for (let index = start; index < tokens.length; index++) {
		if (tokens[index].kind !== 'symbol') continue;
		if (tokens[index].text === '(') depth++;
		if (tokens[index].text === ')' && --depth === 0) return index + 1;
	}
	return invalid_sql('Unbalanced SQL parentheses.');
}

function pragma_is_read_only(tokens: SqlToken[]): boolean {
	let index = 1;
	if (tokens[index + 1]?.text === '.') index += 2;
	const name = tokens[index];
	// Quoted/unknown PRAGMAs are deliberately not classified as safe.
	if (name?.kind !== 'word' || !read_pragmas.has(name.text))
		return false;
	index++;
	if (index === tokens.length) return true;
	if (!argument_pragmas.has(name.text) || tokens[index]?.text !== '(')
		return false;
	const end = after_group(tokens, index);
	// Metadata PRAGMAs take a single identifier, string, or integer argument.
	const args = tokens.slice(index + 1, end - 1);
	const simple_arg =
		args.length === 1 ||
		args.every((token) => /^\d$/.test(token.text));
	return end === tokens.length && args.length > 0 && simple_arg;
}

function classify_tokens(
	tokens: SqlToken[],
	depth = 0,
): Pick<QueryPlan, 'read_only' | 'can_paginate'> {
	if (depth > 100) invalid_sql('SQL nesting exceeds 100 levels.');
	const first = tokens[0];
	if (!first || first.kind !== 'word')
		invalid_sql('Expected a SQL statement keyword.');
	if (first.text === 'with') {
		let index = is_keyword(tokens[1], 'recursive') ? 2 : 1;
		while (index < tokens.length) {
			if (!tokens[index] || tokens[index].kind === 'symbol')
				invalid_sql('Expected a CTE name.');
			index++;
			if (tokens[index]?.text === '(')
				index = after_group(tokens, index);
			if (!is_keyword(tokens[index++], 'as'))
				invalid_sql('Expected AS in a CTE.');
			if (is_keyword(tokens[index], 'not')) {
				index++;
				if (!is_keyword(tokens[index], 'materialized'))
					invalid_sql('Expected MATERIALIZED after NOT.');
			}
			if (is_keyword(tokens[index], 'materialized')) index++;
			const end = after_group(tokens, index);
			const body = classify_tokens(
				tokens.slice(index + 1, end - 1),
				depth + 1,
			);
			if (!body.read_only || !body.can_paginate)
				invalid_sql('CTE bodies must be SELECT or VALUES queries.');
			index = end;
			if (tokens[index]?.text !== ',') break;
			index++;
		}
		return classify_tokens(tokens.slice(index), depth + 1);
	}
	if (first.text === 'explain') {
		let index = 1;
		if (
			is_keyword(tokens[index], 'query') &&
			is_keyword(tokens[index + 1], 'plan')
		)
			index += 2;
		const inner = classify_tokens(tokens.slice(index), depth + 1);
		if (!inner.read_only) {
			throw new ToolUsageError(
				'EXPLAIN of mutating SQL is not allowed on the read path.',
				[
					'Use EXPLAIN SELECT or EXPLAIN QUERY PLAN SELECT for read-only query analysis.',
				],
			);
		}
		return { read_only: true, can_paginate: false };
	}
	if (first.text === 'pragma')
		return {
			read_only: pragma_is_read_only(tokens),
			can_paginate: false,
		};
	return {
		read_only: first.text === 'select' || first.text === 'values',
		can_paginate: first.text === 'select' || first.text === 'values',
	};
}

export function analyze_query(query: string): QueryPlan {
	if (
		!query.trim() ||
		query.length > 10_000 ||
		query.includes('\0')
	) {
		invalid_sql(
			'SQL must contain 1–10000 characters and no null bytes.',
		);
	}
	const tokens = tokenize_sql(query);
	if (tokens.at(-1)?.text === ';') tokens.pop();
	if (!tokens.length) invalid_sql('SQL must contain a statement.');
	if (
		tokens.some(
			(token) => token.kind === 'symbol' && token.text === ';',
		)
	) {
		invalid_sql('Multiple SQL statements are not allowed.');
	}
	for (let index = 0; index < tokens.length; index++) {
		const function_name =
			tokens[index].kind === 'quoted'
				? tokens[index].text.slice(1, -1).toLowerCase()
				: tokens[index].text;
		if (
			['load_extension', 'writefile', 'readfile'].includes(
				function_name,
			) &&
			tokens[index + 1]?.text === '('
		) {
			invalid_sql('File and extension functions are not supported.');
		}
	}
	return {
		sql: query.slice(0, tokens.at(-1)!.end),
		...classify_tokens(tokens),
	};
}

export function require_read_query(query: string): QueryPlan {
	const plan = analyze_query(query);
	if (!plan.read_only) {
		throw new ToolUsageError(
			'This statement is not allowed on the read-only path.',
			[
				'Use execute_query for writes, schema changes, or mutating PRAGMAs.',
				'Use SELECT, read-only WITH queries, EXPLAIN of reads, or supported metadata PRAGMAs here.',
			],
		);
	}
	return plan;
}

export function quote_identifier(identifier: string): string {
	if (
		!identifier ||
		identifier.length > 64 ||
		identifier.includes('\0')
	) {
		throw new ToolUsageError(
			'Identifiers must contain 1–64 characters and no null bytes.',
		);
	}
	return `"${identifier.replace(/"/g, '""')}"`;
}
