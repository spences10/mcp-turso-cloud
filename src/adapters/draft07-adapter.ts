/**
 * Custom JSON Schema adapter that generates Draft-07 compatible schemas
 * for GitHub Copilot compatibility while maintaining Zod validation
 */
import { JsonSchemaAdapter } from 'tmcp/adapter';
import * as z from 'zod';
import { ZodSchema } from 'zod';

/**
 * Recursively converts JSON Schema Draft 2020-12 to Draft-07
 * by removing incompatible features like $dynamicRef, $dynamicAnchor, etc.
 */
function convertToDraft07(schema: any): any {
	if (typeof schema !== 'object' || schema === null) {
		return schema;
	}

	// Create a copy to avoid mutating the original
	const result: any = Array.isArray(schema) ? [] : {};

	for (const [key, value] of Object.entries(schema)) {
		// Skip Draft 2020-12 specific features
		if (key === '$dynamicRef' || key === '$dynamicAnchor') {
			continue;
		}

		// Change $schema to Draft-07
		if (key === '$schema') {
			result[key] = 'http://json-schema.org/draft-07/schema#';
			continue;
		}

		// Recursively convert nested objects and arrays
		if (typeof value === 'object' && value !== null) {
			result[key] = convertToDraft07(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Draft-07 compatible adapter for GitHub Copilot
 * Extends the base JsonSchemaAdapter to convert Zod schemas to Draft-07
 */
export class Draft07JsonSchemaAdapter extends JsonSchemaAdapter<ZodSchema> {
	/**
	 * Converts a Zod schema to JSON Schema Draft-07 format
	 * @param schema - The Zod schema to convert
	 * @returns The JSON Schema Draft-07 representation
	 */
	async toJsonSchema(schema: ZodSchema): Promise<any> {
		let jsonSchema2020: any;
		try {
			jsonSchema2020 = z.toJSONSchema(schema);
		} catch (err) {
			throw new Error(`Failed to convert Zod schema to JSON Schema: ${err instanceof Error ? err.message : String(err)}`);
		}

		if (typeof jsonSchema2020 !== 'object' || jsonSchema2020 === null) {
			throw new Error('z.toJSONSchema did not return a valid object');
		}
		
		// Convert to Draft-07
		const jsonSchema07 = convertToDraft07(jsonSchema2020);
		
		return jsonSchema07;
	}
}
