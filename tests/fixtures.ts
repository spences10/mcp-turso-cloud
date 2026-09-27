import type { ResultSet } from '@libsql/client';

export function result_set(
	rows: Record<string, unknown>[] = [],
): ResultSet {
	return {
		columns: rows.length ? Object.keys(rows[0]) : [],
		columnTypes: [],
		rows: rows as ResultSet['rows'],
		rowsAffected: 0,
		lastInsertRowid: undefined,
		toJSON: () => ({}),
	};
}
