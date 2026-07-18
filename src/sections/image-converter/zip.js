// Generador de ZIP con método "store" (sin compresión), sin dependencias.

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function buildZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v) =>
    new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const push = (arr) => {
    chunks.push(arr);
    offset += arr.length;
  };

  for (const { name, blob } of entries) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const localOffset = offset;

    // Local file header
    push(u32(0x04034b50));
    push(u16(20));
    push(u16(0));
    push(u16(0)); // version, flags, method (store)
    push(u16(0));
    push(u16(0)); // mod time, date
    push(u32(crc));
    push(u32(data.length));
    push(u32(data.length));
    push(u16(nameBytes.length));
    push(u16(0));
    push(nameBytes);
    push(data);

    // Central directory record (guardado para el final)
    const c = [];
    c.push(u32(0x02014b50));
    c.push(u16(20));
    c.push(u16(20));
    c.push(u16(0));
    c.push(u16(0));
    c.push(u16(0));
    c.push(u16(0));
    c.push(u32(crc));
    c.push(u32(data.length));
    c.push(u32(data.length));
    c.push(u16(nameBytes.length));
    c.push(u16(0));
    c.push(u16(0));
    c.push(u16(0));
    c.push(u16(0));
    c.push(u32(0));
    c.push(u32(localOffset));
    c.push(nameBytes);
    central.push({ bytes: c });
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const rec of central)
    for (const part of rec.bytes) {
      push(part);
      centralSize += part.length;
    }

  // End of central directory
  push(u32(0x06054b50));
  push(u16(0));
  push(u16(0));
  push(u16(entries.length));
  push(u16(entries.length));
  push(u32(centralSize));
  push(u32(centralStart));
  push(u16(0));

  return new Blob(chunks, { type: 'application/zip' });
}

/**
 * Dada una lista de { name, blob }, evita nombres duplicados
 * agregando un sufijo -1, -2, … antes de la extensión.
 */
export function dedupeNames(entries) {
  const used = {};
  return entries.map(({ name, blob }) => {
    let finalName = name;
    if (used[name]) {
      const dot = name.lastIndexOf('.');
      const base = dot === -1 ? name : name.slice(0, dot);
      const ext = dot === -1 ? '' : name.slice(dot);
      finalName = `${base}-${used[name]}${ext}`;
    }
    used[name] = (used[name] || 0) + 1;
    return { name: finalName, blob };
  });
}
