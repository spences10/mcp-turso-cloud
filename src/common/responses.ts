import type { ResultSet } from '@libsql/client';
import {
	ToolUsageError,
	TursoApiError,
	get_error_message,
} from './errors.js';

const max_result_bytes = 512 * 1024;

export function serialize_json(value: unknown): string {
	return JSON.stringify(value, (_key, item) => {
		if (typeof item === 'bigint') return item.toString();
		if (item instanceof ArrayBuffer || ArrayBuffer.isView(item)) {
			const bytes =
				item instanceof ArrayBuffer
					? Buffer.from(item)
					: Buffer.from(
							item.buffer,
							item.byteOffset,
							item.byteLength,
						);
			return { type: 'blob', base64: bytes.toString('base64') };
		}
		return item;
	});
}

export function create_tool_response(data: unknown) {
	return {
		content: [{ type: 'text' as const, text: serialize_json(data) }],
	};
}

export function create_tool_error_response(error: unknown) {
	return {
		...create_tool_response({
			error:
				error instanceof ToolUsageError
					? 'tool_usage_error'
					: error instanceof TursoApiError
						? 'turso_api_error'
						: 'internal_error',
			message: get_error_message(error),
			...(error instanceof ToolUsageError
				? { suggestions: error.suggestions }
				: {}),
			...(error instanceof TursoApiError
				? { status_code: error.status_code }
				: {}),
		}),
		isError: true,
	};
}

export function format_query_result(result: ResultSet, limit = 1000) {
	const rows: ResultSet['rows'] = [];
	let used_bytes =
		Buffer.byteLength(serialize_json(result.columns)) + 2;
	for (const row of result.rows.slice(0, limit)) {
		const row_bytes =
			Buffer.byteLength(serialize_json(row)) + (rows.length ? 1 : 0);
		if (used_bytes + row_bytes > max_result_bytes) break;
		used_bytes += row_bytes;
		rows.push(row);
	}
	const truncated =
		rows.length < result.rows.length || used_bytes > max_result_bytes;
	return {
		rows,
		rowsAffected: result.rowsAffected,
		lastInsertRowid: result.lastInsertRowid,
		columns: used_bytes > max_result_bytes ? [] : result.columns,
		truncated,
		returned_count: rows.length,
		...(truncated
			? {
					truncation_reason:
						used_bytes > max_result_bytes ||
						rows.length < Math.min(limit, result.rows.length)
							? 'byte_limit'
							: 'row_limit',
					message:
						'Result truncated. Select fewer or smaller columns, or request the next read page. Do not repeat writes to retrieve omitted rows.',
				}
			: {}),
	};
}
