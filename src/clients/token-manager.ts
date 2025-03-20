/**
 * Token management for the Turso MCP server
 */
import { getConfig } from '../config.js';
import { CachedToken, TokenCache } from '../common/types.js';
import { TursoApiError } from '../common/errors.js';

// In-memory token cache
const tokenCache: TokenCache = {};

/**
 * Parse a JWT token to extract its expiration date
 */
function getTokenExpiration(jwt: string): Date {
  try {
    // JWT tokens consist of three parts separated by dots
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // The second part contains the payload, which is base64 encoded
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8')
    );
    
    // The exp claim contains the expiration timestamp in seconds
    if (typeof payload.exp !== 'number') {
      throw new Error('JWT missing expiration');
    }
    
    // Convert to milliseconds and create a Date object
    return new Date(payload.exp * 1000);
  } catch (error) {
    // If parsing fails, set a default expiration of 1 hour from now
    console.error('Error parsing JWT expiration:', error);
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 1);
    return expiration;
  }
}

/**
 * Generate a new token for a database using the organization token
 */
export async function generateDatabaseToken(
  databaseName: string,
  permission: 'full-access' | 'read-only' = 'full-access'
): Promise<string> {
  const config = getConfig();
  const url = `https://api.turso.tech/v1/organizations/${config.TURSO_ORGANIZATION}/databases/${databaseName}/auth/tokens`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.TURSO_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expiration: config.TOKEN_EXPIRATION,
        permission,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || response.statusText;
      throw new TursoApiError(
        `Failed to generate token for database ${databaseName}: ${errorMessage}`,
        response.status
      );
    }
    
    const data = await response.json();
    return data.jwt;
  } catch (error) {
    if (error instanceof TursoApiError) {
      throw error;
    }
    throw new TursoApiError(
      `Failed to generate token for database ${databaseName}: ${(error as Error).message}`,
      500
    );
  }
}

/**
 * Get a token for a database, generating a new one if necessary
 */
export async function getDatabaseToken(
  databaseName: string,
  permission: 'full-access' | 'read-only' = 'full-access'
): Promise<string> {
  // Check if we have a valid token in the cache
  const cachedToken = tokenCache[databaseName];
  if (cachedToken && cachedToken.permission === permission) {
    // Check if the token is still valid (not expired)
    if (cachedToken.expiresAt > new Date()) {
      return cachedToken.jwt;
    }
  }
  
  // Generate a new token
  const jwt = await generateDatabaseToken(databaseName, permission);
  
  // Cache the token
  tokenCache[databaseName] = {
    jwt,
    expiresAt: getTokenExpiration(jwt),
    permission,
  };
  
  return jwt;
}

/**
 * Remove expired tokens from the cache
 */
export function cleanupExpiredTokens(): void {
  const now = new Date();
  for (const [databaseName, token] of Object.entries(tokenCache)) {
    if (token.expiresAt <= now) {
      delete tokenCache[databaseName];
    }
  }
}

// Set up a periodic cleanup of expired tokens (every hour)
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
