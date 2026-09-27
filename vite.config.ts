import { defineConfig as define_config } from 'vite-plus';

export default define_config({
	pack: {
		entry: ['src/index.ts'],
		format: ['esm'],
		platform: 'node',
		target: 'node24',
		sourcemap: true,
		dts: true,
		outExtensions: () => ({ js: '.js' }),
	},
	test: {
		include: ['tests/**/*.test.ts'],
	},
	fmt: {
		useTabs: true,
		singleQuote: true,
		printWidth: 70,
		trailingComma: 'all',
		proseWrap: 'always',
	},
	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
});
