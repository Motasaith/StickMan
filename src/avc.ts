// H.264 bitstream helpers for encoders that don't hand over a decoder config.
// Some browsers (e.g. Firefox with a hardware encoder) emit chunks without
// `decoderConfig.description`, or emit Annex B with start codes. An MP4 needs
// length-prefixed NAL units plus an avcC box built from the SPS and PPS.

export type NaluFormat = "annexb" | "avcc";

export function isAnnexB(d: Uint8Array): boolean {
  return d.length > 4 && d[0] === 0 && d[1] === 0 && (d[2] === 1 || (d[2] === 0 && d[3] === 1));
}

/** Split a chunk into NAL units (without start codes or length prefixes). */
export function splitNalus(d: Uint8Array): { format: NaluFormat; nalus: Uint8Array[] } {
  if (isAnnexB(d)) {
    const starts: { at: number; len: number }[] = [];
    for (let i = 0; i + 2 < d.length; i++) {
      if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 1) {
        const four = i > 0 && d[i - 1] === 0;
        starts.push({ at: four ? i - 1 : i, len: four ? 4 : 3 });
        i += 2;
      }
    }
    const nalus = starts.map((s, k) => {
      const begin = s.at + s.len;
      let end = k + 1 < starts.length ? starts[k + 1].at : d.length;
      // Trailing zero bytes before the next start code belong to no NAL unit.
      while (end > begin && d[end - 1] === 0 && k + 1 < starts.length) end--;
      return d.subarray(begin, end);
    });
    return { format: "annexb", nalus: nalus.filter((n) => n.length) };
  }
  const nalus: Uint8Array[] = [];
  let i = 0;
  while (i + 4 <= d.length) {
    const len = ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0;
    i += 4;
    if (len === 0 || i + len > d.length) break;
    nalus.push(d.subarray(i, i + len));
    i += len;
  }
  return { format: "avcc", nalus };
}

export const naluType = (n: Uint8Array) => n[0] & 0x1f;

export function toLengthPrefixed(nalus: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(nalus.reduce((s, n) => s + 4 + n.length, 0));
  let o = 0;
  for (const n of nalus) {
    out[o] = (n.length >>> 24) & 255;
    out[o + 1] = (n.length >>> 16) & 255;
    out[o + 2] = (n.length >>> 8) & 255;
    out[o + 3] = n.length & 255;
    out.set(n, o + 4);
    o += 4 + n.length;
  }
  return out;
}

/** AVCDecoderConfigurationRecord (the avcC box payload) for 8-bit 4:2:0 video. */
export function buildAvcC(sps: Uint8Array, ppsList: Uint8Array[]): Uint8Array {
  const bytes: number[] = [1, sps[1], sps[2], sps[3], 0xfc | 3, 0xe0 | 1, sps.length >> 8, sps.length & 255, ...sps, ppsList.length];
  for (const pps of ppsList) bytes.push(pps.length >> 8, pps.length & 255, ...pps);
  // High profiles carry chroma format and bit depth: 4:2:0, 8-bit, no SPS extensions.
  if ([100, 110, 122, 144].includes(sps[1])) bytes.push(0xfc | 1, 0xf8, 0xf8, 0);
  return new Uint8Array(bytes);
}
