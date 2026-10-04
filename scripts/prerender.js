const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const BUILD_DIR = path.join(__dirname, '../build');
const PORT = 5411;
const ROUTES = ['/', '/about'];

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(dir, port) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(dir, urlPath);

    if (!filePath.startsWith(dir)) {
      res.writeHead(403);
      res.end();
      return;
    }

    if (urlPath.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA fallback: let the client-side router handle unknown paths.
      filePath = path.join(dir, 'index.html');
    }

    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => resolve(server));
  });
}

async function prerenderRoute(browser, baseUrl, route) {
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
    // EventList shows a CircularProgress (role="progressbar") while the CSV fetch
    // is in flight; wait for it to clear so we snapshot real content, not the spinner.
    try {
      await page.waitForSelector('[role="progressbar"]', { hidden: true, timeout: 15000 });
    } catch (waitError) {
      console.warn(`  Warning: loading indicator never cleared for ${route}, snapshotting current DOM anyway`);
    }
    return await page.content();
  } finally {
    await page.close();
  }
}

async function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error('build/ directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  console.log('Prerendering static content for crawlers...');
  const server = await serveStatic(BUILD_DIR, PORT);
  const baseUrl = `http://localhost:${PORT}`;
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
  });

  try {
    for (const route of ROUTES) {
      console.log(`  ${route}`);
      const html = await prerenderRoute(browser, baseUrl, route);
      const outDir = route === '/' ? BUILD_DIR : path.join(BUILD_DIR, route);
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'index.html');
      fs.writeFileSync(outFile, html);
      console.log(`    wrote ${path.relative(BUILD_DIR, outFile)} (${html.length} bytes)`);
    }
    console.log('Prerendering complete.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error('Prerendering failed:', err);
  process.exit(1);
});
