/**
 * Turso Platform API client for organization-level operations
 */
import { TursoApiError } from '../common/errors.js';
import { Database } from '../common/types.js';
import { get_config } from '../config.js';

/**
 * Base URL for the Turso Platform API
 */
const API_BASE_URL = 'https://api.turso.tech/v1';

/**
 * Get the organization ID from the configuration
 */
function get_organization_id(): string {
	return get_config().TURSO_ORGANIZATION;
}

/**
 * Get the authorization header for API requests
 */
function get_auth_header(): { Authorization: string } {
	return { Authorization: `Bearer ${get_config().TURSO_API_TOKEN}` };
}

/**
 * List all databases in the organization
 */
export async function list_databases(): Promise<Database[]> {
	const organization_id = get_organization_id();
	const url = `${API_BASE_URL}/organizations/${organization_id}/databases`;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				...get_auth_header(),
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error || response.statusText;
			throw new TursoApiError(
				`Failed to list databases: ${errorMessage}`,
				response.status,
			);
		}

		const data = await response.json();
		return data.databases || [];
	} catch (error) {
		if (error instanceof TursoApiError) {
			throw error;
		}
		throw new TursoApiError(
			`Failed to list databases: ${(error as Error).message}`,
			500,
		);
	}
}

/**
 * Create a new database in the organization
 */
export async function create_database(
	name: string,
	options: {
		group?: string;
		regions?: string[];
	} = {},
): Promise<Database> {
	const organization_id = get_organization_id();
	const url = `${API_BASE_URL}/organizations/${organization_id}/databases`;

	// Default to "default" group if not specified
	const group = options.group || 'default';

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				...get_auth_header(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name,
				group,
				regions: options.regions,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error || response.statusText;
			throw new TursoApiError(
				`Failed to create database ${name}: ${errorMessage}`,
				response.status,
			);
		}

		return await response.json();
	} catch (error) {
		if (error instanceof TursoApiError) {
			throw error;
		}
		throw new TursoApiError(
			`Failed to create database ${name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}

/**
 * Delete a database from the organization
 */
export async function delete_database(name: string): Promise<void> {
	const organization_id = get_organization_id();
	const url = `${API_BASE_URL}/organizations/${organization_id}/databases/${name}`;

	try {
		const response = await fetch(url, {
			method: 'DELETE',
			headers: get_auth_header(),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error || response.statusText;
			throw new TursoApiError(
				`Failed to delete database ${name}: ${errorMessage}`,
				response.status,
			);
		}
	} catch (error) {
		if (error instanceof TursoApiError) {
			throw error;
		}
		throw new TursoApiError(
			`Failed to delete database ${name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}

/**
 * Get details for a specific database
 */
export async function get_database_details(
	name: string,
): Promise<Database> {
	const organization_id = get_organization_id();
	const url = `${API_BASE_URL}/organizations/${organization_id}/databases/${name}`;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				...get_auth_header(),
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error || response.statusText;
			throw new TursoApiError(
				`Failed to get database details for ${name}: ${errorMessage}`,
				response.status,
			);
		}

		return await response.json();
	} catch (error) {
		if (error instanceof TursoApiError) {
			throw error;
		}
		throw new TursoApiError(
			`Failed to get database details for ${name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}

/**
 * Generate a new token for a database
 * This is a wrapper around the token-manager's generate_database_token function
 * to make it available through the organization client
 */
export async function generate_database_token(
	database_name: string,
	permission: 'full-access' | 'read-only' = 'full-access',
): Promise<string> {
	// Import here to avoid circular dependencies
	const { generate_database_token: generate_token } = await import(
		'./token-manager.js'
	);
	return generate_token(database_name, permission);
}
