import { describe, expect, it } from "vitest";
import { buildAvcC, isAnnexB, naluType, splitNalus, toLengthPrefixed } from "./avc";

const sps = new Uint8Array([0x67, 0x42, 0xc0, 0x1f, 0xda, 0x01, 0x40]);
const pps = new Uint8Array([0x68, 0xce, 0x3c, 0x80]);
const idr = new Uint8Array([0x65, 0x88, 0x84, 0x00, 0x33]);

describe("H.264 helpers", () => {
  it("splits Annex B with 3- and 4-byte start codes and converts to length-prefixed", () => {
    const annexb = new Uint8Array([0, 0, 0, 1, ...sps, 0, 0, 1, ...pps, 0, 0, 0, 1, ...idr]);
    expect(isAnnexB(annexb)).toBe(true);
    const { format, nalus } = splitNalus(annexb);
    expect(format).toBe("annexb");
    expect(nalus.map(naluType)).toEqual([7, 8, 5]);
    expect([...nalus[2]]).toEqual([...idr]);

    const avcc = toLengthPrefixed(nalus);
    expect(isAnnexB(avcc)).toBe(false);
    const again = splitNalus(avcc);
    expect(again.format).toBe("avcc");
    expect(again.nalus.map((n) => [...n])).toEqual([[...sps], [...pps], [...idr]]);
  });

  it("keeps zero bytes that end a NAL unit's data when it's the last one", () => {
    const tail = new Uint8Array([0x65, 0x10, 0x00]);
    const { nalus } = splitNalus(new Uint8Array([0, 0, 0, 1, ...tail]));
    expect([...nalus[0]]).toEqual([...tail]);
  });

  it("builds an avcC record from SPS and PPS", () => {
    const rec = buildAvcC(sps, [pps]);
    expect([...rec.slice(0, 6)]).toEqual([1, 0x42, 0xc0, 0x1f, 0xff, 0xe1]);
    expect((rec[6] << 8) | rec[7]).toBe(sps.length);
    expect(rec[8 + sps.length]).toBe(1);
    expect(rec.length).toBe(6 + 2 + sps.length + 1 + 2 + pps.length);
    const high = buildAvcC(new Uint8Array([0x67, 100, 0, 0x28]), [pps]);
    expect(high.length).toBe(6 + 2 + 4 + 1 + 2 + pps.length + 4);
  });
});
