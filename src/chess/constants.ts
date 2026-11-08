// ========== Constants ==========
export const DEFAULT_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const EMPTY_FEN = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

// ---- DOM class names (BEM) ----
// Class-name prefix (chess: "ct", xiangqi: "xq"). Every plugin class is
// `${CLS_PREFIX}-...` at the usage site; the matching scss prefix lives in
// style/layout/_variant.scss ($cls-prefix).
export const CLS_PREFIX = "ct";
// chessground's own class names — never rename, styled in style/layout/_board.scss
export const WRAP_CLASS = "cg-wrap";
export const BOARD_ELEMENT = "cg-board";

export const BOARD_ASPECT_RATIO = 1;
export const LAYOUT_CHANGE_EVENT = "chess-layout-change";
export const ZOOM_CHANGE_EVENT = "chess-zoom-changed";
export const RESIZE_EVENT = "chessground.resize";
export const DEFAULT_TREE_BLOCK_NAMES = ["chess", "tree"];
export const DEFAULT_FEN_BLOCK_NAMES = ["fen"];
export const RIBBON_ICON = "chess-knight";
export const DEFAULT_FILENAME = "Untitled";
export const PGN_PLACEHOLDER = "1. e4 e5 2. Nf3 Nc6 ...";
export const GRID_SVG: string | null = null;
export const NODE_CHAR_DY = 3.5;
export const DEFAULT_LANG = "en";

// ========== Flags ==========
export const HAS_PROMOTION = true;
export const PRIMARY_PLAYER_KEY = "White";
/** Piece-color key of the first player, for player-bar side marks. */
export const FIRST_PLAYER_COLOR = "white";
/** Piece-color key of the second player, for player-bar side marks. */
export const SECOND_PLAYER_COLOR = "black";
/** i18n key of the first player's side name (chess: White, xiangqi: Red). */
export const FIRST_SIDE_KEY = "side.white";
/** i18n key of the second player's side name (Black in both variants). */
export const SECOND_SIDE_KEY = "side.black";
