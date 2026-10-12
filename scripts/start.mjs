import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Load local configuration before the production server starts.
// Environment variables supplied by the service take precedence.
for (const name of ['.env.production.local', '.env.local', '.env.production', '.env']) {
	try {
		loadEnvFile(fileURLToPath(new URL(`../${name}`, import.meta.url)));
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
}

// Bank slips can be up to 4 MiB; the upload endpoint also enforces its own cap.
process.env.BODY_SIZE_LIMIT ??= '4300000';

await import('../build/index.js');
