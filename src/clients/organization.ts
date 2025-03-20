/**
 * Turso Platform API client for organization-level operations
 */
import { getConfig } from '../config.js';
import { Database } from '../common/types.js';
import { TursoApiError } from '../common/errors.js';

/**
 * Base URL for the Turso Platform API
 */
const API_BASE_URL = 'https://api.turso.tech/v1';

/**
 * Get the organization ID from the configuration
 */
function getOrganizationId(): string {
  return getConfig().TURSO_ORGANIZATION;
}

/**
 * Get the authorization header for API requests
 */
function getAuthHeader(): { Authorization: string } {
  return { Authorization: `Bearer ${getConfig().TURSO_API_TOKEN}` };
}

/**
 * List all databases in the organization
 */
export async function listDatabases(): Promise<Database[]> {
  const organizationId = getOrganizationId();
  const url = `${API_BASE_URL}/organizations/${organizationId}/databases`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || response.statusText;
      throw new TursoApiError(
        `Failed to list databases: ${errorMessage}`,
        response.status
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
      500
    );
  }
}

/**
 * Create a new database in the organization
 */
export async function createDatabase(
  name: string,
  options: {
    group?: string;
    regions?: string[];
  } = {}
): Promise<Database> {
  const organizationId = getOrganizationId();
  const url = `${API_BASE_URL}/organizations/${organizationId}/databases`;
  
  // Default to "default" group if not specified
  const group = options.group || "default";
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
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
        response.status
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TursoApiError) {
      throw error;
    }
    throw new TursoApiError(
      `Failed to create database ${name}: ${(error as Error).message}`,
      500
    );
  }
}

/**
 * Delete a database from the organization
 */
export async function deleteDatabase(name: string): Promise<void> {
  const organizationId = getOrganizationId();
  const url = `${API_BASE_URL}/organizations/${organizationId}/databases/${name}`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || response.statusText;
      throw new TursoApiError(
        `Failed to delete database ${name}: ${errorMessage}`,
        response.status
      );
    }
  } catch (error) {
    if (error instanceof TursoApiError) {
      throw error;
    }
    throw new TursoApiError(
      `Failed to delete database ${name}: ${(error as Error).message}`,
      500
    );
  }
}

/**
 * Get details for a specific database
 */
export async function getDatabaseDetails(name: string): Promise<Database> {
  const organizationId = getOrganizationId();
  const url = `${API_BASE_URL}/organizations/${organizationId}/databases/${name}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || response.statusText;
      throw new TursoApiError(
        `Failed to get database details for ${name}: ${errorMessage}`,
        response.status
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TursoApiError) {
      throw error;
    }
    throw new TursoApiError(
      `Failed to get database details for ${name}: ${(error as Error).message}`,
      500
    );
  }
}

/**
 * Generate a new token for a database
 * This is a wrapper around the token-manager's generateDatabaseToken function
 * to make it available through the organization client
 */
export async function generateDatabaseToken(
  databaseName: string,
  permission: 'full-access' | 'read-only' = 'full-access'
): Promise<string> {
  // Import here to avoid circular dependencies
  const { generateDatabaseToken: generateToken } = await import('./token-manager.js');
  return generateToken(databaseName, permission);
}
