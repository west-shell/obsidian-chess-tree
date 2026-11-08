// ========== Tag Canonicalization ==========
// PGN tag keys/values are stored raw (round-trip safe). These adapters map
// localized tag spellings onto the canonical keys the UI reads (White,
// Black, Event, Result, ...). Standard chess PGN uses those keys directly,
// so both helpers are the identity here; the xiangqi adapter maps Chinese
// tag names (红方 -> Red etc.) and result values (红胜 -> 1-0).

/** Map a raw PGN tag key onto its canonical key (identity for chess). */
export function canonicalTagKey(key: string): string {
  return key;
}

/** Map a raw PGN tag value onto its canonical value (identity for chess). */
export function canonicalTagValue(key: string, value: string): string {
  void key;
  return value;
}
