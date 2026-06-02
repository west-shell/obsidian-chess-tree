# Obsidian Chess Plugin

![Version](https://img.shields.io/github/v/release/west-shell/obsidian-chess-tree)
[![License](https://img.shields.io/github/license/west-shell/obsidian-chess-tree)](./LICENSE)

[中文](./README.md) | [English](./README.en.md)

If you like this project, feel free to check out my page on  
[![Bilibili](https://img.shields.io/badge/Bilibili-Bilibili-ff69b4?logo=bilibili&logoColor=white)](https://space.bilibili.com/156446344)  
Likes, coins, and feedback are greatly appreciated.

## Overview

**Obsidian Chess Plugin** is a chess rendering engine built for Obsidian. It displays chess positions and games in FEN and PGN formats, supports move exploration and variation management. Full rules engine powered by [chess.js](https://github.com/jhlywa/chess.js).

## PGN File Support

Open `.pgn` files directly in Obsidian — the plugin registers a dedicated `.pgn` file view with an interactive board interface.

- **Real-time I/O**: Any changes (moves, variations, comments, annotations) are saved back to the file automatically
- **Variation Tree**: Interactive tree graph showing all branches — click nodes to navigate
- **Comments & Annotations**: Supports `!` `?` `W+` `B+` `=` and other standard annotations
- **View Toggle**: Switch between text view and PGN view via the file menu
- **Quick Create**: New PGN files from the ribbon button

![PGN File](./IMAGE/PGN文件.png)

## Code Blocks

Two code block types:

---

`chess`: Display and explore chess games in Markdown

````markdown
```chess
1. e4 e5
2. Nf3 Nc6
3. Bb5 a6
```
````

![Move List](./IMAGE/MoveList.png)

---

`fen`: Visual board editor — generates a `chess` block with FEN

````markdown
```fen

```
````

![FEN Editor](./IMAGE/GenFEN.png)

---

## Features

- **Complete Rules Engine**: Castling, en passant, promotion, check/checkmate detection, threefold repetition, 50-move rule — all via chess.js
- **Board Rendering**: High-quality chessboard via chessground with drag-and-drop moves
- **Move List**: Full move record with click-to-navigate
- **Variation Tree**: Tree graph with icon/SAN display modes for node labels
- **Visual FEN Editor**: Drag/click to place pieces, clear/fill board, toggle side to move
- **PGN Saving**: Button colors — **gray** (empty), **green** (saved), **orange** (modified)
- **Customizable Settings**:
  - Board themes: Wood, Green, Blue, Grey, Dark, Light
  - Toolbar position: right / bottom
  - Adjustable board size and move text size
  - Move list display options
  - Auto-jump to end
  - Optional move narration (desktop only)
- **Board Markers**: Draw arrows and highlights on the board
- **Mobile Friendly**: Adjust board size for small screens

## Usage

### `fen` Code Block

1. Add a `fen` code block to start the editor
2. Drag pieces or click piece buttons to set up the position
3. Use clear/fill/turn buttons as needed
4. Click Save to generate a `chess` code block with the FEN

### `chess` Code Block

1. Write your game inside a `chess` code block (optionally with FEN and SAN moves)
2. FEN is optional — defaults to the standard starting position
3. Controls:
   - When no manual moves are made, the move list shows the original PGN
   - After making moves, the list shows your modified sequence
   - Click **Reset** to revert to before manual edits
4. Click **Save** to overwrite the original PGN

### Optional Parameters

| Name             | Value       | Description                                       |
| ---------------- | ----------- | ------------------------------------------------- |
| `protected` / `p` | true / false | When true, Save button is disabled; default false |
| `rotated` / `r`   | true / false | When true, board is flipped (Black on bottom)     |

#### Example

````markdown
```chess
r:true
[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]
1... e5 2. Nf3 Nc6
```
````

- Colons can be Chinese or English; `r` and `p` are case-insensitive
- FEN value works with or without quotes

## Installation

> ~~This plugin is available on the Obsidian Community Plugin marketplace. Search for "Chess" to install.~~ (Not yet published)

1. Open Obsidian
2. Go to **Settings**
3. Click **Community plugins**
4. Ensure **Restricted mode** is off
5. Click **Browse**
6. Search for "Chess"
7. Find this plugin and click **Install**
8. Click **Enable**

## Build

```bash
git clone https://github.com/west-shell/obsidian-chess-tree.git
cd obsidian-chess-tree
npm install
npm run build        # Dev build (unminified, with sourcemaps)
npm run build:min    # Minified build (for release)
```

## Donation

If you like this plugin, feel free to support me!
![Donation](./IMAGE/打赏.png)
