import {
	afterEach as after_each,
	beforeEach as before_each,
	expect,
	test,
	vi,
} from 'vite-plus/test';
import {
	generate_database_token,
	get_database_token,
} from './token-manager.js';

vi.mock('../config.js', () => ({
	get_config: () => ({
		TURSO_API_TOKEN: 'fake-platform-token',
		TURSO_ORGANIZATION: 'test-org',
		TOKEN_EXPIRATION: '7d',
	}),
}));

const fetch_mock = vi.fn();
function fake_jwt(permission: string, expires: number): string {
	return `fake.${Buffer.from(JSON.stringify({ permission, exp: expires })).toString('base64url')}.signature`;
}

before_each(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
	fetch_mock.mockReset();
	fetch_mock.mockImplementation((input: URL) =>
		Promise.resolve({
			ok: true,
			json: () =>
				Promise.resolve({
					jwt: fake_jwt(
						input.searchParams.get('authorization')!,
						Math.floor(Date.now() / 1000) + 60,
					),
				}),
		}),
	);
	vi.stubGlobal('fetch', fetch_mock);
});
after_each(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test.each(['read-only', 'full-access'] as const)(
	'uses the documented query parameters for %s tokens',
	async (permission) => {
		await generate_database_token('test-db', permission);
		const [url, options] = fetch_mock.mock.calls[0];
		expect(url.pathname).toBe(
			'/v1/organizations/test-org/databases/test-db/auth/tokens',
		);
		expect(url.searchParams.get('authorization')).toBe(permission);
		expect(url.searchParams.get('expiration')).toBe('7d');
		expect(options.method).toBe('POST');
		expect(options.body).toBeUndefined();
	},
);

test('keeps full-access and read-only cache entries separate and renews expired tokens', async () => {
	const full_token = await get_database_token(
		'cache-test',
		'full-access',
	);
	const read_token = await get_database_token(
		'cache-test',
		'read-only',
	);
	expect(full_token).not.toBe(read_token);
	expect(await get_database_token('cache-test', 'full-access')).toBe(
		full_token,
	);
	expect(await get_database_token('cache-test', 'read-only')).toBe(
		read_token,
	);
	expect(fetch_mock).toHaveBeenCalledTimes(2);
	vi.advanceTimersByTime(61000);
	expect(
		await get_database_token('cache-test', 'read-only'),
	).not.toBe(read_token);
	expect(fetch_mock).toHaveBeenCalledTimes(3);
	expect(
		fetch_mock.mock.calls[2][0].searchParams.get('authorization'),
	).toBe('read-only');
});

test('does not retry a rejected read-only token request as full-access', async () => {
	fetch_mock.mockResolvedValue({
		ok: false,
		status: 403,
		statusText: 'Forbidden',
		json: () => Promise.resolve({}),
	});
	await expect(
		get_database_token('denied-test', 'read-only'),
	).rejects.toThrow('Forbidden');
	expect(fetch_mock).toHaveBeenCalledTimes(1);
	expect(
		fetch_mock.mock.calls[0][0].searchParams.get('authorization'),
	).toBe('read-only');
});

test('rejects malformed token responses', async () => {
	fetch_mock.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({}),
	});
	await expect(
		get_database_token('malformed-test', 'read-only'),
	).rejects.toThrow('did not return a database token');
});
