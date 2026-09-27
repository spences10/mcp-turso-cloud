/**
 * Token management for the Turso MCP server
 */
import { TursoApiError } from '../common/errors.js';
import { CachedToken, TokenCache } from '../common/types.js';
import { get_config } from '../config.js';

// In-memory token cache
const token_cache: TokenCache = {};

/**
 * Parse a JWT token to extract its expiration date
 */
function get_token_expiration(jwt: string): Date {
	try {
		// JWT tokens consist of three parts separated by dots
		const parts = jwt.split('.');
		if (parts.length !== 3) {
			throw new Error('Invalid JWT format');
		}

		// The second part contains the payload, which is base64 encoded
		const payload = JSON.parse(
			Buffer.from(parts[1], 'base64').toString('utf8'),
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
export async function generate_database_token(
	database_name: string,
	permission: 'full-access' | 'read-only' = 'full-access',
): Promise<string> {
	const config = get_config();
	const url = new URL(
		`https://api.turso.tech/v1/organizations/${encodeURIComponent(config.TURSO_ORGANIZATION)}/databases/${encodeURIComponent(database_name)}/auth/tokens`,
	);
	// Turso expects authorization and expiration in the query, not the body.
	url.searchParams.set('authorization', permission);
	url.searchParams.set('expiration', config.TOKEN_EXPIRATION);

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.TURSO_API_TOKEN}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error || response.statusText;
			throw new TursoApiError(
				`Failed to generate token for database ${database_name}: ${errorMessage}`,
				response.status,
			);
		}

		const data = await response.json();
		if (typeof data?.jwt !== 'string' || !data.jwt) {
			throw new TursoApiError(
				'Token endpoint did not return a database token.',
				502,
			);
		}
		return data.jwt;
	} catch (error) {
		if (error instanceof TursoApiError) {
			throw error;
		}
		throw new TursoApiError(
			`Failed to generate token for database ${database_name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}

/**
 * Get a token for a database, generating a new one if necessary
 */
export async function get_database_token(
	database_name: string,
	permission: 'full-access' | 'read-only' = 'full-access',
): Promise<string> {
	// Check if we have a valid token in the cache
	const cache_key = `${database_name}:${permission}`;
	const cached_token = token_cache[cache_key];
	if (cached_token && cached_token.permission === permission) {
		// Check if the token is still valid (not expired)
		if (cached_token.expiresAt > new Date()) {
			return cached_token.jwt;
		}
	}

	// Generate a new token
	const jwt = await generate_database_token(
		database_name,
		permission,
	);

	// Cache the token
	token_cache[cache_key] = {
		jwt,
		expiresAt: get_token_expiration(jwt),
		permission,
	};

	return jwt;
}

/**
 * Remove expired tokens from the cache
 */
export function cleanup_expired_tokens(): void {
	const now = new Date();
	for (const [database_name, token] of Object.entries(token_cache)) {
		if ((token as CachedToken).expiresAt <= now) {
			delete token_cache[database_name];
		}
	}
}

// Set up a periodic cleanup of expired tokens (every hour)
setInterval(cleanup_expired_tokens, 60 * 60 * 1000).unref();
