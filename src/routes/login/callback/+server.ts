import { checkRateLimit } from '$lib/server/rate-limit';
import { guestRequestAllowed } from '$lib/server/guest-session';
import type { RequestHandler } from './$types';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
import { verifyGoogleToken } from '$lib/server/google-verify';



function html(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store, no-cache, must-revalidate',
			'Referrer-Policy': 'no-referrer'
		}
	});
}


// Escape characters that break out of a <script> context. JSON.stringify leaves
// <, >, &, and the line/paragraph separators (U+2028/U+2029) unescaped; any of
// them can terminate the script block or throw a JS parse error. The credential
// is Google-signed and verified before reaching here, but this makes the sink
// unreachable by construction (defense-in-depth, not the primary control).
function safeJsonForScript(value: string): string {
	const LS = String.fromCharCode(0x2028);
	const PS = String.fromCharCode(0x2029);
	return JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(new RegExp(LS, 'g'), '\\u2028')
		.replace(new RegExp(PS, 'g'), '\\u2029');
}

function successPage(credential: string): Response {
	const tokenJson = safeJsonForScript(credential);
	return html(`<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>กำลังเข้าสู่ระบบ…</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;
    font-family:'Kanit',system-ui,sans-serif;background:#ffffff;color:#525252}
  .s{width:28px;height:28px;border:3px solid #dbeafe;border-top-color:#2563eb;
    border-radius:50%;animation:r .7s linear infinite;margin-right:12px}
  @keyframes r{to{transform:rotate(360deg)}}
  .b{display:flex;align-items:center}
</style></head>
<body>
  <div class="b"><div class="s"></div><span>กำลังเข้าสู่ระบบ…</span></div>
  <script>
    try {
      sessionStorage.setItem('er-diagram:id-token', ${tokenJson});
    } catch (e) {}
    location.replace('/?signedin=1');
  </script>
</body></html>`);
}

function errorPage(): Response {
	return html(`<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>เข้าสู่ระบบไม่สำเร็จ</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:16px;font-family:'Kanit',system-ui,sans-serif;background:#ffffff;color:#525252;padding:24px;text-align:center}
  a{display:inline-block;padding:10px 20px;border-radius:9999px;background:#2563eb;
    color:#fff;text-decoration:none;font-weight:600}
</style></head>
<body>
  <p>เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
  <a href="/">กลับหน้าเข้าสู่ระบบ</a>
</body></html>`, 401);
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	if (!guestRequestAllowed(`login:${ip}`) || !(await checkRateLimit(`login:${ip}`, 10)).allowed) return html('กรุณารอ 1 นาทีแล้วลองใหม่', 429);
	if (!PUBLIC_GOOGLE_CLIENT_ID) return errorPage();

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return errorPage();
	}

	const credential = form.get('credential');
	if (typeof credential !== 'string' || !credential) return errorPage();

	const csrfBody = form.get('g_csrf_token');
	const csrfCookie = cookies.get('g_csrf_token');
	if (!csrfCookie || typeof csrfBody !== 'string' || csrfCookie !== csrfBody) {
		return errorPage();
	}

	try {
		await verifyGoogleToken(credential, PUBLIC_GOOGLE_CLIENT_ID);
	} catch {
		return errorPage();
	}

	return successPage(credential);
};


export const GET: RequestHandler = () => {
	return new Response(null, { status: 303, headers: { Location: '/' } });
};
