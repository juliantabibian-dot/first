// Builds the demo version of Lookout as ONE self-contained HTML file, so it can
// be opened from a single link on a phone (it is published as a private
// claude.ai page). Everything is inlined: the JavaScript, the icon font and the
// few images. Supabase keys are blanked, so the page always runs as the demo.
//
//   node scripts/build-demo-page.mjs [output.html]

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'dist/lookout-demo.html');
const build = mkdtempSync(join(tmpdir(), 'lookout-web-'));

try {
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', build], {
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: '' },
  });

  const index = readFileSync(join(build, 'index.html'), 'utf8');
  const sources = [...index.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  if (!sources.length) throw new Error('No scripts found in the web build');

  const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf' };
  let inlined = 0;
  const js = sources
    .map((src) => readFileSync(join(build, src), 'utf8'))
    .join('\n')
    // Assets are referenced by absolute paths like "/assets/node_modules/...".
    // Those don't exist where the page is hosted, so each becomes a data: URL.
    .replace(/(["'])(\/assets\/[^"']+\.(?:png|jpg|ttf|otf))\1/g, (_, quote, path) => {
      const type = types[extname(path)];
      inlined += 1;
      return quote + `data:${type};base64,` + readFileSync(join(build, path)).toString('base64') + quote;
    })
    .replace(/<\/script/gi, '<\\/script');

  const page = `<title>Lookout</title>
<style>
/* One full-screen app. Colors match the app's own light and dark backgrounds. */
:root { --bg: #f5f5f7; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0e0e12; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #0e0e12; color-scheme: dark; }
html { height: 100%; box-sizing: border-box; }
body { height: 100%; overflow: hidden; background: var(--bg); }
#root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>
// The app's screens are addressed by path ("/", "/watchers", ...). If the page
// is served from some other path, start at the home screen.
try {
  if (!/^\\/(sign-in|welcome|account|add-photos|photo\\/[^/]+|watchers|texts)?\\/?$/.test(location.pathname)) {
    history.replaceState(null, '', '/');
  }
} catch (e) {}
</script>
<script>
${js}
</script>
`;

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page);
  console.log(`Wrote ${out} (${(page.length / 1024 / 1024).toFixed(1)} MB, ${sources.length} scripts, ${inlined} assets inlined)`);
} finally {
  rmSync(build, { recursive: true, force: true });
}
