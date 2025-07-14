/**
 * Configuration management for the Turso MCP server
 */
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define configuration schema as specified in the plan
export const ConfigSchema = z.object({
	// Organization-level authentication
	TURSO_API_TOKEN: z.string().min(1),
	TURSO_ORGANIZATION: z.string().min(1),

	// Optional default database
	TURSO_DEFAULT_DATABASE: z.string().optional(),

	// Token management settings
	TOKEN_EXPIRATION: z.string().default('7d'),
	TOKEN_PERMISSION: z
		.enum(['full-access', 'read-only'])
		.default('full-access'),
});

// Configuration type derived from schema
export type Config = z.infer<typeof ConfigSchema>;

// Parse environment variables using the schema
export function load_config(): Config {
	try {
		return ConfigSchema.parse({
			TURSO_API_TOKEN: process.env.TURSO_API_TOKEN,
			TURSO_ORGANIZATION: process.env.TURSO_ORGANIZATION,
			TURSO_DEFAULT_DATABASE: process.env.TURSO_DEFAULT_DATABASE,
			TOKEN_EXPIRATION: process.env.TOKEN_EXPIRATION || '7d',
			TOKEN_PERMISSION: process.env.TOKEN_PERMISSION || 'full-access',
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			const missing_fields = error.issues
				.filter(
					(err: any) =>
						err.code === 'invalid_type' &&
						err.received === 'undefined',
				)
				.map((err: any) => err.path.join('.'));

			throw new Error(
				`Missing required configuration: ${missing_fields.join(
					', ',
				)}\n` +
					'Please set these environment variables or add them to your .env file.',
			);
		}
		throw error;
	}
}

// Singleton instance of the configuration
let config: Config | null = null;

// Get the configuration, loading it if necessary
export function get_config(): Config {
	if (!config) {
		config = load_config();
	}
	return config;
}
