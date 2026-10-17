import QRCode from "qrcode";
const [url, out] = process.argv.slice(2);
await QRCode.toFile(out, url, { width: 720, margin: 2, color: { dark: "#1a1440", light: "#ffffff" } });
console.log("✅ " + out + "  ←  " + url);