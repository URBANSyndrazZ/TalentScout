// 一个极简静态服务器（零依赖）：npm run serve
// 然后浏览器打开 http://localhost:8080/frontend/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT ?? 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let filePath = path.join(root, urlPath);
    if (urlPath === "/" || urlPath.endsWith("/")) filePath = path.join(root, urlPath, "index.html");

    // 防目录穿越
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found: " + urlPath);
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream", "Cache-Control": "no-store, max-age=0" });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`🌐 静态服务器已启动: http://localhost:${PORT}/frontend/`);
    console.log("   按 Ctrl+C 停止");
  });
