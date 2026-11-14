// PDF open/export error handling shared by the app and tools/test-pdfs.mjs. No DOM.

// Turn whatever pdf.js / pdf-lib threw into a short plain-language sentence.
// `stage` is 'open' or 'export'.
export function friendlyPdfError(err, stage = 'open') {
  const name = err?.name || '', msg = String(err?.message || err || '');
  if (name === 'PasswordException') return err.code === 2 ? 'That password is not right.' : 'This PDF is password protected.';
  if (err?.code === 'ENCRYPTED' || name === 'EncryptedPDFError' || /encrypt/i.test(msg)) {
    return 'This PDF is encrypted, so critters cannot be written into it. You can still place them and look at the result, but to export, remove the protection first (for example with qpdf --decrypt in.pdf out.pdf) and open the unprotected copy.';
  }
  if (name === 'InvalidPDFException' || /invalid pdf|failed to parse|no pdf header|not a pdf|xref|trailer|unexpected/i.test(msg)) {
    return stage === 'open'
      ? 'That file does not look like a readable PDF. It may be damaged, cut short, or not a PDF at all.'
      : 'The PDF could not be rewritten because its structure is damaged. Opening it and repairing it with another tool (for example qpdf in.pdf repaired.pdf) may help.';
  }
  if (name === 'MissingPDFException') return 'That PDF could not be found.';
  if (err instanceof RangeError || /out of memory|allocation|array buffer/i.test(msg)) return 'This PDF is too large for the browser to handle in one go. Try exporting only the current page, or split the PDF into smaller parts.';
  return (stage === 'open' ? 'Could not open that PDF' : 'Export failed') + (msg ? ': ' + msg : '.');
}

// Cheap sniff before handing bytes to the heavy libraries: is there a %PDF header near the start?
export function looksLikePdf(bytes) {
  const n = Math.min(bytes.length, 1024);
  for (let i = 0; i + 4 <= n; i++) if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) return true;
  return false;
}
