// Minimal static file server for local preview of the Thermal Dawn site.
// Serves the repo root (this file's parent directory) so root-relative
// paths like /assets/css/style.css resolve the same way they do on Netlify.
//
//   node .claude/serve.js [port]
//
// No dependencies — Node's standard library only.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

function send(res, code, body, type) {
  res.writeHead(code, {
    "content-type": type || "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

http
  .createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return send(res, 400, "Bad request");
    }

    let file = path.join(ROOT, rel);
    // keep requests inside the web root
    if (!file.startsWith(ROOT)) return send(res, 403, "Forbidden");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }

    if (!fs.existsSync(file)) {
      const notFound = path.join(ROOT, "404.html");
      if (fs.existsSync(notFound)) {
        return send(res, 404, fs.readFileSync(notFound), TYPES[".html"]);
      }
      return send(res, 404, "Not found");
    }

    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    send(res, 200, fs.readFileSync(file), type);
  })
  .listen(PORT, () => {
    console.log("serving " + ROOT + " on http://localhost:" + PORT);
  });
