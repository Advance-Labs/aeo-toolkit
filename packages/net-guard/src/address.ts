/**
 * IP address classification for the SSRF guard.
 *
 * `isBlockedAddress` returns true for any address an attacker could use to reach internal
 * infrastructure — loopback, RFC-1918 private, link-local (incl. the cloud-metadata IP), CGNAT,
 * IPv6 ULA/link-local, IPv4-mapped IPv6, multicast/reserved — and **fails closed** on anything it
 * cannot parse. Public, routable addresses return false.
 */
import net from 'node:net';

/** True if `ip` must NOT be fetched (private/internal/unparseable). Fail-closed on malformed input. */
export function isBlockedAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedV4(ip);
  if (kind === 6) return isBlockedV6(ip);
  return true; // unparseable → blocked
}

function isBlockedV4(ip: string): boolean {
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = o as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + broadcast
  return false;
}

function isBlockedV6(ip: string): boolean {
  const groups = toGroups((ip.split('%')[0] ?? '').toLowerCase());
  if (!groups) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  // IPv4-mapped (::ffff:a.b.c.d) — classify the embedded v4
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    const v4 = `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`;
    return isBlockedV4(v4);
  }

  const allZeroButLast = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0;
  if (allZeroButLast && g7 === 0) return true; // :: unspecified
  if (allZeroButLast && g7 === 1) return true; // ::1 loopback
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** Expand a (net.isIP-validated) IPv6 string to its 8 hextets, handling `::` and embedded IPv4. */
function toGroups(addr: string): [number, number, number, number, number, number, number, number] | null {
  let s = addr;
  const tail: number[] = [];
  if (s.includes('.')) {
    const colon = s.lastIndexOf(':');
    const oct = s.slice(colon + 1).split('.').map(Number);
    if (oct.length !== 4) return null;
    const [o0, o1, o2, o3] = oct as [number, number, number, number];
    if ([o0, o1, o2, o3].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    tail.push((o0 << 8) | o1, (o2 << 8) | o3);
    s = s.slice(0, colon + 1); // keep the trailing ':' so the split below behaves
  }

  const parts = s.split('::');
  if (parts.length > 2) return null;
  const toNums = (seg: string | undefined) =>
    seg ? seg.split(':').filter((x) => x !== '').map((h) => parseInt(h, 16)) : [];
  const left = toNums(parts[0]);

  let groups: number[];
  if (parts.length === 2) {
    const right = [...toNums(parts[1]), ...tail];
    const fill = 8 - left.length - right.length;
    if (fill < 0) return null;
    groups = [...left, ...new Array<number>(fill).fill(0), ...right];
  } else {
    groups = [...left, ...tail];
  }
  return groups.length === 8
    ? (groups as [number, number, number, number, number, number, number, number])
    : null;
}
