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
      throw new TursoApiError(
        `Failed to list databases: ${response.statusText}`,
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
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        group: options.group,
        regions: options.regions,
      }),
    });
    
    if (!response.ok) {
      throw new TursoApiError(
        `Failed to create database ${name}: ${response.statusText}`,
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
      throw new TursoApiError(
        `Failed to delete database ${name}: ${response.statusText}`,
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
      throw new TursoApiError(
        `Failed to get database details for ${name}: ${response.statusText}`,
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
