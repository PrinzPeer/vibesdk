// import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { execSync } from 'child_process';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

// Auto-detect Docker so dev startup works on machines without it.
// The Cloudflare Vite plugin calls verifyDockerInstalled() when wrangler.jsonc
// declares a `containers` block; without Docker that aborts the dev server.
// Setting dev.enable_containers=false skips the check (Live Preview disabled).
// We probe via the same binary the plugin will use (WRANGLER_DOCKER_BIN, e.g.
// the docker-host-network.sh wrapper) so a broken wrapper also falls back.
const containersForciblyDisabled = process.env.VIBESDK_DISABLE_CONTAINERS === 'true';
const dockerBin = process.env.WRANGLER_DOCKER_BIN || 'docker';
let dockerAvailable = false;
let dockerProbeError: string | undefined;
if (!containersForciblyDisabled) {
	try {
		execSync(`${dockerBin} info`, { stdio: 'pipe', timeout: 5000 });
		dockerAvailable = true;
	} catch (err) {
		dockerProbeError = err instanceof Error ? err.message : String(err);
	}
}
const enableContainers = dockerAvailable && !containersForciblyDisabled;
if (!enableContainers) {
	const reason = containersForciblyDisabled
		? 'VIBESDK_DISABLE_CONTAINERS=true'
		: `Docker not reachable via "${dockerBin}"`;
	console.warn(
		`[vibesdk] ${reason} — starting dev without sandbox containers. Live Preview will be disabled. Install/start Docker (or fix WRANGLER_DOCKER_BIN) to enable it.`,
	);
	if (dockerProbeError) {
		console.warn(`[vibesdk] docker probe error: ${dockerProbeError.split('\n')[0]}`);
	}
}

// https://vite.dev/config/
export default defineConfig({
	optimizeDeps: {
		exclude: ['format', 'editor.all'],
		include: ['monaco-editor/esm/vs/editor/editor.api'],
		force: true,
	},

	// build: {
	//     rollupOptions: {
	//       output: {
	//             advancedChunks: {
	//                 groups: [{name: 'vendor', test: /node_modules/}]
	//             }
	//         }
	//     }
	// },
	plugins: [
		react(),
		svgr(),
		cloudflare({
			configPath: 'wrangler.jsonc',
			config: (config) => {
				if (!enableContainers) {
					config.dev = { ...config.dev, enable_containers: false };
				}
			},
		}),
		tailwindcss(),
		// sentryVitePlugin({
		// 	org: 'cloudflare-0u',
		// 	project: 'javascript-react',
		// }),
	],

	resolve: {
		alias: {
			debug: 'debug/src/browser',
			'@': path.resolve(__dirname, './src'),
			'shared': path.resolve(__dirname, './shared'),
			'worker': path.resolve(__dirname, './worker'),
		},
	},

	// Configure for Prisma + Cloudflare Workers compatibility
	define: {
		// Ensure proper module definitions for Cloudflare Workers context
		'process.env.NODE_ENV': JSON.stringify(
			process.env.NODE_ENV || 'development',
		),
		global: 'globalThis',
		// '__filename': '""',
		// '__dirname': '""',
	},

	worker: {
		// Handle Prisma in worker context for development
		format: 'es',
	},

	server: {
		host: true,
		allowedHosts: true,
	},

	// Clear cache more aggressively
	cacheDir: 'node_modules/.vite',
});
