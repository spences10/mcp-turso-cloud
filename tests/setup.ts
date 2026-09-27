import {
	afterEach as after_each,
	beforeEach as before_each,
	vi,
} from 'vite-plus/test';

before_each(() => {
	vi.stubGlobal('fetch', () => {
		throw new Error(
			'Network access is disabled in tests. Mock the request explicitly.',
		);
	});
});

after_each(() => vi.unstubAllGlobals());
