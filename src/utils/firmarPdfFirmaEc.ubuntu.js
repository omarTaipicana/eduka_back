// utils/firmarPdfFirmaEc.ubuntu.js
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PYTHON_BIN = "/var/www/eduka_back/.venv/bin/python3";
const SCRIPT = "/var/www/eduka_back/scripts/firmar_pdf.py";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).toString()));
      resolve({ stdout, stderr });
    });
  });
}

module.exports = async function firmarPdfFirmaEcUbuntu(pdfPath, opts = {}) {
  if (!fs.existsSync(pdfPath)) throw new Error("PDF no existe");

  const p12Path = process.env.FIRMA_P12_PATH;
  const p12Pass = process.env.FIRMA_P12_PASSWORD;

  if (!p12Path || !fs.existsSync(p12Path)) throw new Error("Certificado no existe");
  if (!p12Pass) throw new Error("FIRMA_P12_PASSWORD falta en .env");

  const ext = path.extname(pdfPath);
  const signedPath = pdfPath.replace(ext, `_firmado${ext}`);

  const page = opts.page ?? 1;

  // ✅ SIN BORDE (campo casi invisible) + ✅ MÁS ARRIBA
  // Sube/baja cambiando Y1/Y2 (ej: 200->260 más arriba)
  const rect = opts.rect ?? [10, 240, 12, 242];
  const rectStr = rect.join(",");

  await run(PYTHON_BIN, [
    SCRIPT,
    pdfPath,
    signedPath,
    p12Path,
    p12Pass,
    String(page),
    rectStr,
  ]);

  if (!fs.existsSync(signedPath)) {
    throw new Error("No se generó el PDF firmado");
  }

  return signedPath;
};
