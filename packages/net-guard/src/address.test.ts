import { describe, it, expect } from 'vitest';
import { isBlockedAddress } from './address.js';

describe('isBlockedAddress — IPv4', () => {
  it('blocks loopback 127.0.0.0/8', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('127.255.255.254')).toBe(true);
  });

  it('blocks the unspecified address 0.0.0.0', () => {
    expect(isBlockedAddress('0.0.0.0')).toBe(true);
  });

  it('blocks RFC-1918 private ranges', () => {
    expect(isBlockedAddress('10.0.0.5')).toBe(true);
    expect(isBlockedAddress('172.16.4.4')).toBe(true);
    expect(isBlockedAddress('172.31.255.255')).toBe(true);
    expect(isBlockedAddress('192.168.1.1')).toBe(true);
  });

  it('does NOT block the public-looking 172.32.x (just outside 172.16/12)', () => {
    expect(isBlockedAddress('172.32.0.1')).toBe(false);
  });

  it('blocks link-local 169.254.0.0/16 including the cloud-metadata IP', () => {
    expect(isBlockedAddress('169.254.0.1')).toBe(true);
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
  });

  it('blocks CGNAT 100.64.0.0/10', () => {
    expect(isBlockedAddress('100.64.0.1')).toBe(true);
    expect(isBlockedAddress('100.127.255.255')).toBe(true);
  });

  it('does NOT block CGNAT-adjacent public 100.63.x / 100.128.x', () => {
    expect(isBlockedAddress('100.63.255.255')).toBe(false);
    expect(isBlockedAddress('100.128.0.0')).toBe(false);
  });

  it('allows public IPv4', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
  });
});

describe('isBlockedAddress — IPv6', () => {
  it('blocks loopback ::1', () => {
    expect(isBlockedAddress('::1')).toBe(true);
  });

  it('blocks unique-local fc00::/7 (fc.. and fd..)', () => {
    expect(isBlockedAddress('fc00::1')).toBe(true);
    expect(isBlockedAddress('fd12:3456::1')).toBe(true);
  });

  it('blocks link-local fe80::/10', () => {
    expect(isBlockedAddress('fe80::1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 that maps to a private/metadata address', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true);
  });

  it('allows public IPv6', () => {
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false);
  });
});

describe('isBlockedAddress — malformed input is blocked (fail closed)', () => {
  it('blocks unparseable strings', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
    expect(isBlockedAddress('999.999.999.999')).toBe(true);
  });
});
