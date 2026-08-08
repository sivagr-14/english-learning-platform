const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "../..");
const fixtureRoot = path.join(root, "test/fixtures/gold-corpus");
const output = path.join(fixtureRoot, "generated");
fs.mkdirSync(output, { recursive: true });
const text = fs.readFileSync(path.join(fixtureRoot, "source.txt"), "utf8");
fs.copyFileSync(path.join(fixtureRoot, "source.txt"), path.join(output, "gold.txt"));
fs.copyFileSync(path.join(fixtureRoot, "subtitles.srt"), path.join(output, "gold.srt"));

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of entries) {
    const n = Buffer.from(name), raw = Buffer.from(value), data = zlib.deflateRawSync(raw), crc = crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20,4); h.writeUInt16LE(8,8); h.writeUInt32LE(crc,14); h.writeUInt32LE(data.length,18); h.writeUInt32LE(raw.length,22); h.writeUInt16LE(n.length,26);
    local.push(h,n,data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(8,10); c.writeUInt32LE(crc,16); c.writeUInt32LE(data.length,20); c.writeUInt32LE(raw.length,24); c.writeUInt16LE(n.length,28); c.writeUInt32LE(offset,42);
    central.push(c,n); offset += h.length+n.length+data.length;
  }
  const body=Buffer.concat(local), directory=Buffer.concat(central), end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(body.length,16);
  return Buffer.concat([body,directory,end]);
}
function xml(value) { return value.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function pdf(value) {
  const safe=value.replace(/[\\()]/g,"\\$&").replace(/\n/g,") Tj 0 -16 Td (");
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",`<< /Length ${safe.length+35} >>\nstream\nBT /F1 10 Tf 50 740 Td (${safe}) Tj ET\nendstream`];
  let out="%PDF-1.4\n", offsets=[0]; objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}); const x=Buffer.byteLength(out); out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(v=>String(v).padStart(10,"0")+" 00000 n \n").join("")+`trailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`; return Buffer.from(out);
}
fs.writeFileSync(path.join(output,"gold.pdf"),pdf(text));
fs.writeFileSync(path.join(output,"gold.docx"),zip([["[Content_Types].xml",`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`],["_rels/.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],["word/document.xml",`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${xml(text)}</w:t></w:r></w:p></w:body></w:document>`]]));
fs.writeFileSync(path.join(output,"gold.epub"),zip([["mimetype","application/epub+zip"],["META-INF/container.xml",`<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],["OEBPS/content.opf",`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>BASE-01 Gold</dc:title><dc:identifier id="id">base-01</dc:identifier></metadata><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>`],["OEBPS/chapter.xhtml",`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>${xml(text)}</p></body></html>`]]));
console.log(`Built five privacy-safe fixtures in ${path.relative(root,output)}`);

