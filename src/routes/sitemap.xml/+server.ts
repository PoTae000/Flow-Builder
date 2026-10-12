import type { RequestHandler } from './$types';



const SITE = 'https://suepskun.online';

export const GET: RequestHandler = () => {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url><loc>${SITE}/flowchart-online</loc></url>
  <url><loc>${SITE}/dfd-online</loc></url>
  <url><loc>${SITE}/er-diagram-online</loc></url>
</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
