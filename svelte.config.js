import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Listing every static file overflows the 100-rule _routes.json cap,
			// so dictionary shards would run the Pages Function
			routes: {
				include: ['/*'],
				exclude: [
					'<build>',
					'<prerendered>',
					'<redirects>',
					'/dict/*',
					'/icons/*',
					'/robots.txt',
					'/sw.js',
					'/workbox-*.js',
					'/registerSW.js',
					'/manifest.webmanifest'
				]
			}
		})
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
