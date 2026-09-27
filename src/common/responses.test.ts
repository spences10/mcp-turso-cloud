import { expect, test } from 'vite-plus/test';
import { ToolUsageError, TursoApiError } from './errors.js';
import {
	create_tool_error_response,
	create_tool_response,
	format_query_result,
} from './responses.js';
import { result_set } from '../../tests/fixtures.js';

test('serializes bigint cells, row IDs, and blobs', () => {
	const result = result_set([
		{
			value: 9007199254740993n,
			blob: new Uint8Array([0, 255]).buffer,
		},
	]);
	result.lastInsertRowid = 9007199254740993n;
	const response = create_tool_response({
		result: format_query_result(result),
	});
	expect(JSON.parse(response.content[0].text)).toMatchObject({
		result: {
			rows: [
				{
					value: '9007199254740993',
					blob: { type: 'blob', base64: 'AP8=' },
				},
			],
			lastInsertRowid: '9007199254740993',
		},
	});
});

test('bounds rows and signals truncation without losing write metadata', () => {
	const result = result_set(
		Array.from({ length: 1001 }, (_value, index) => ({
			value: index,
		})),
	);
	result.rowsAffected = 1001;
	const formatted = format_query_result(result);
	expect(formatted.rows).toHaveLength(1000);
	expect(formatted).toMatchObject({
		rowsAffected: 1001,
		truncated: true,
		truncation_reason: 'row_limit',
	});
});

test('bounds oversized cells and explains how to recover', () => {
	const formatted = format_query_result(
		result_set([{ small: 'ok' }, { large: 'x'.repeat(600000) }]),
	);
	expect(formatted.rows).toEqual([{ small: 'ok' }]);
	expect(formatted).toMatchObject({
		truncated: true,
		truncation_reason: 'byte_limit',
	});
	expect(formatted.message).toContain('Do not repeat writes');
	expect(
		create_tool_response(formatted).content[0].text.length,
	).toBeLessThan(1024);
});

test('bounds oversized column metadata even when there are no rows', () => {
	const result = result_set();
	result.columns = ['x'.repeat(600000)];
	const formatted = format_query_result(result);
	expect(formatted).toMatchObject({
		columns: [],
		rows: [],
		truncated: true,
		truncation_reason: 'byte_limit',
	});
});

test('retains actionable usage and API error details', () => {
	const usage = create_tool_error_response(
		new ToolUsageError('Wrong tool', ['Use execute_query']),
	);
	expect(usage.isError).toBe(true);
	expect(JSON.parse(usage.content[0].text)).toMatchObject({
		error: 'tool_usage_error',
		suggestions: ['Use execute_query'],
	});
	const api = create_tool_error_response(
		new TursoApiError('Access denied', 403),
	);
	expect(JSON.parse(api.content[0].text)).toMatchObject({
		error: 'turso_api_error',
		status_code: 403,
	});
});
