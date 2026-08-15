// Private-preview gate: the whole site requires a password until the client approves launch.
// Password lives in the PREVIEW_PASS env var on Vercel (repo is public — never hardcode it here).
// Remove this file to relaunch the site publicly.
const USER = 'majd';

export default function middleware(request) {
  const path = new URL(request.url).pathname;

  // Tell crawlers the whole site is off-limits while the gate is up.
  if (path === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  // Search Console ownership file must stay reachable, or Google revokes the
  // verified property and cancels the site-removal request.
  if (path === '/google3654382e4b01e65d.html') return;

  const pass = process.env.PREVIEW_PASS;
  const auth = request.headers.get('authorization') || '';
  if (pass && auth.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = atob(auth.slice(6)); } catch (e) {}
    if (decoded === USER + ':' + pass) return;
  }

  return new Response('Private preview — authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Private preview"',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}
