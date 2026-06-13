<script lang="ts">
  // oxlint-disable promise/always-return no-unused-expressions
  import { onDestroy, onMount, tick } from "svelte";
  import type { EventBus } from "../../core/event-bus";
  import { type ChessNode, type NodeMap } from "../../types";
  import { onLangChange, t } from "../../i18n";
  import { calculateTreeLayout } from "./layout";
  import { setIcon } from "obsidian";
  import * as d3 from "d3";

  // Lucide chess piece components
  import ChessKing from "@lucide/svelte/icons/chess-king";
  import ChessQueen from "@lucide/svelte/icons/chess-queen";
  import ChessRook from "@lucide/svelte/icons/chess-rook";
  import ChessBishop from "@lucide/svelte/icons/chess-bishop";
  import ChessKnight from "@lucide/svelte/icons/chess-knight";
  import ChessPawn from "@lucide/svelte/icons/chess-pawn";
  import Castle from "@lucide/svelte/icons/castle";
  import ChevronsUp from "@lucide/svelte/icons/chevrons-up";
  import House from "@lucide/svelte/icons/house";

  // Lucide annotation components
  import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
  import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
  import Handshake from "@lucide/svelte/icons/handshake";
  import Bookmark from "@lucide/svelte/icons/bookmark";
  import Star from "@lucide/svelte/icons/star";
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
  }

  let { nodeMap, eventBus, currentNode = $bindable(), currentPath }: Props = $props();

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  let renderedNodes: ChessNode[] = $state([]);

  // ---- D3 Zoom ----
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;

  const spacingX = 22;
  const spacingY = 15;
  const nodeWidth = 20;
  const nodeHeight = 13;

  const ANNOTATION_DEFINITIONS: Record<string, { symbol: string; color: string; component: any }> =
    {
      "W+": { symbol: "White +", color: "var(--piece-red)", component: ThumbsUp },
      "B+": { symbol: "Black +", color: "var(--piece-black)", component: ThumbsDown },
      "=": { symbol: "Equal", color: "green", component: Handshake },
      "?": { symbol: "Key", color: "var(--text-warning)", component: Bookmark },
      "!": { symbol: "Brilliant", color: "var(--color-yellow)", component: Star },
      "1-0": { symbol: "1-0", color: "white", component: ThumbsUp },
      "0-1": { symbol: "0-1", color: "black", component: ThumbsUp },
      "1/2-1/2": { symbol: "Draw", color: "gray", component: Handshake },
    };

  const ALL_ANNOTATION_KEYS = Object.keys(ANNOTATION_DEFINITIONS);

  // Chess piece component lookup
  const PIECE_COMPONENTS: Record<string, any> = {
    k: ChessKing,
    q: ChessQueen,
    r: ChessRook,
    b: ChessBishop,
    n: ChessKnight,
    p: ChessPawn,
  };

  function getPieceComponent(node: ChessNode) {
    if (!node.move) return null;
    if (node.move.isKingsideCastle() || node.move.isQueensideCastle()) return Castle;
    if (node.move.promotion) return ChevronsUp;
    return PIECE_COMPONENTS[node.move.piece] ?? null;
  }

  // ---- 工具函数 ----
  function getPrimaryAnnotation(node: ChessNode): string | undefined {
    if (!node.comments) return undefined;
    return node.comments.find((c) => ALL_ANNOTATION_KEYS.includes(c));
  }

  function getAllAnnotations(node: ChessNode): string[] {
    return node.comments?.filter((c) => ALL_ANNOTATION_KEYS.includes(c)) ?? [];
  }

  const SHAPES_PREFIX = "__SHAPES__";

  function getRegularComments(node: ChessNode): string[] {
    return (
      node.comments?.filter(
        (c) => !ALL_ANNOTATION_KEYS.includes(c) && !c.startsWith(SHAPES_PREFIX),
      ) ?? []
    );
  }

  // ---- 自动保存逻辑 ----
  let saveTimeout: number | undefined;

  function handleCommentsInput() {
    adjustTextareaHeight();

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      saveComments();
      saveTimeout = undefined;
    }, 700);
  }

  let layoutChangeHandler: (() => void) | null = null;

  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    if (layoutChangeHandler) {
      document.body.removeEventListener('layout-change', layoutChangeHandler);
      layoutChangeHandler = null;
    }
  });

  function handleCommentsBlur() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    saveComments();
  }

  function saveComments() {
    if (!currentNode) return;
    const regularComments = commentsText.split("\n").filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    const shapesComment = currentNode.comments?.find((c) => c.startsWith(SHAPES_PREFIX));
    currentNode.comments = [...existingAnnotations, ...regularComments];
    if (shapesComment) currentNode.comments.push(shapesComment);
    eventBus.emit("updateUI", null);
    eventBus.emit("updatePGN", null);
  }

  function adjustTextareaHeight() {
    if (!textareaEl) return;
    textareaEl.classList.add("auto-height");
    textareaEl.style.setProperty("--textarea-height", `${textareaEl.scrollHeight}px`);
    textareaEl.classList.remove("auto-height");
  }

  function updateTreeLayout() {
    renderedNodes = calculateTreeLayout(nodeMap);
  }

  function resetView() {
    updateTreeLayout();
    if (!svgEl || !zoomBehavior) return;
    const padding = 40;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of renderedNodes) {
      minX = Math.min(minX, n.x!);
      maxX = Math.max(maxX, n.x!);
      minY = Math.min(minY, n.y!);
      maxY = Math.max(maxY, n.y!);
    }
    const treeWidth = (maxX - minX) * spacingX;
    const treeHeight = (maxY - minY) * spacingY;
    const { clientWidth, clientHeight } = svgEl;
    const scaleX = (clientWidth - padding * 2) / treeWidth;
    const scaleY = (clientHeight - padding * 2) / treeHeight;
    const k = Math.max(0.75, Math.min(scaleX, scaleY, 2));
    const tx = clientWidth / 2 - (minX * spacingX + treeWidth / 2) * k;
    const ty = padding - minY * spacingY * k;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function panToNodeIfNeeded(node: ChessNode) {
    if (!node || !svgEl || node.x === undefined || node.y === undefined) return;
    const { clientWidth, clientHeight } = svgEl;
    const padding = 50;
    let { x: translateX, y: translateY, k: scale } = zoomTransform;
    const nodeScreenX = node.x * spacingX * scale + translateX;
    const nodeScreenY = node.y * spacingY * scale + translateY;

    let dx = 0,
      dy = 0;
    if (nodeScreenX < padding) dx = padding - nodeScreenX;
    else if (nodeScreenX > clientWidth - padding) dx = clientWidth - padding - nodeScreenX;
    if (nodeScreenY < padding) dy = padding - nodeScreenY;
    else if (nodeScreenY > clientHeight - padding) dy = clientHeight - padding - nodeScreenY;

    if (dx || dy) {
      translateX += dx;
      translateY += dy;
    }
    const t = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function zoomAtCenter(factor: number) {
    if (!svgEl) return;
    const w = svgEl.clientWidth,
      h = svgEl.clientHeight;
    const cx = w / 2,
      cy = h / 2;
    let { x: translateX, y: translateY, k: scale } = zoomTransform;
    const prev = scale;
    const next = prev * factor;
    const worldX = (cx - translateX) / prev;
    const worldY = (cy - translateY) / prev;
    scale = next;
    translateX = cx - worldX * scale;
    translateY = cy - worldY * scale;
    const t = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    d3.select(svgEl).transition().duration(200).call(zoomBehavior.transform, t);
  }

  const ZOOM_STEP = 1.15;
  function zoomIn() {
    zoomAtCenter(ZOOM_STEP);
  }
  function zoomOut() {
    zoomAtCenter(1 / ZOOM_STEP);
  }

  let nodeMode = $state(0);
  const MODE_ICONS = ["club", "align-justify"];
  function cycleNodeMode() {
    nodeMode = (nodeMode + 1) % 2;
  }

  let _lv = $state(0);
  onLangChange(() => _lv++);

  let zoomBTN = $derived([
    { title: t("tree.zoomIn", _lv), icon: "plus", event: zoomIn },
    { title: t("tree.zoomOut", _lv), icon: "minus", event: zoomOut },
    { title: t("tree.resetView", _lv), icon: "rotate-ccw", event: resetView },
  ]);
  let nodeModeTitle = $derived(t("tree.nodeMode", _lv));

  function nodeLabel(node: ChessNode): string {
    if (nodeMode === 1) return node.move?.san ?? "start";
    return ""; // icon mode handled in template
  }
  function nodeFontSize(): string {
    if (nodeMode === 1) return "7px";
    return "12px";
  }
  let modeIcon = $derived(MODE_ICONS[nodeMode]);
  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }

  onMount(async () => {
    if (!svgEl) return;
    updateTreeLayout();
    zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      zoomTransform = event.transform;
    });
    d3.select(svgEl).call(zoomBehavior);
    await tick();
    await new Promise(requestAnimationFrame);
    resetView();

    layoutChangeHandler = () => resetView();
    document.body.addEventListener('layout-change', layoutChangeHandler);
  });

  $effect(() => {
    if (!currentNode) {
      commentsText = "";
      return;
    }
    const node = currentNode;
    commentsText = getRegularComments(node).join("\n");
    tick().then(() => {
      if (textareaEl) adjustTextareaHeight();
      panToNodeIfNeeded(node);
    });
  });

  $effect(() => {
    nodeMap.size;
    updateTreeLayout();
  });
</script>

<div class="tree-container">
  <div class="svg-wrapper">
    <svg bind:this={svgEl} width="100%" height="100%" class="tree-svg">
      <g transform={zoomTransform.toString()}>
        {#each renderedNodes as node}
          {#each node.children as child}
            <path
              d={`
              M ${node.x! * spacingX} ${node.y! * spacingY}
              L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
              L ${child.x! * spacingX} ${child.y! * spacingY}
              `}
              stroke="var(--board-line)"
              stroke-linejoin="round"
              stroke-width={currentPath.includes(node.id) && currentPath.includes(child.id)
                ? 1.5
                : 1}
              opacity={currentPath.includes(node.id) && currentPath.includes(child.id) ? 1.5 : 0.7}
              filter={currentPath.includes(node.id) && currentPath.includes(child.id)
                ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                : "grayscale(50%) brightness(0.75)"}
              fill="none"
            />
          {/each}
        {/each}

        {#each renderedNodes as node (node.id)}
          {@const primaryAnnotation = getPrimaryAnnotation(node)}
          {@const hasComments = getRegularComments(node).length > 0}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group"
            transform="translate({node.x! * spacingX} {node.y! * spacingY})"
            opacity={currentPath.includes(node.id) ? 1 : 0.8}
            filter={!currentPath.includes(node.id)
              ? "grayscale(100%) brightness(0.75)"
              : node.id === currentNode?.id
                ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                : undefined}
            stroke-width={node.id === currentNode?.id ? 1 : 0.5}
            onclick={() => eventBus.emit("node-click", node.id)}
          >
            {#if primaryAnnotation}
              {@const def = ANNOTATION_DEFINITIONS[primaryAnnotation]}
              {@const AnnotationIcon = def.component}
              <rect
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                rx="2.5"
                ry="2.5"
                fill={node.side === "white" ? "#fff" : node.side === "black" ? "#333" : "green"}
                stroke="var(--board-line)"
              />
              <foreignObject x={-8} y={-6.5} width={16} height={13}>
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
                  color:{def.color};pointer-events:none;"
                >
                  <AnnotationIcon size={12} strokeWidth={1.5} />
                </div>
              </foreignObject>
            {:else}
              <rect
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                rx="2.5"
                ry="2.5"
                fill={node.side === "white" ? "#fff" : node.side === "black" ? "#333" : "green"}
                stroke="var(--board-line)"
              />
              {#if nodeMode === 0 && !node.move}
                <foreignObject x={-8} y={-6.5} width={16} height={13}>
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
                    color:#fff;pointer-events:none;"
                  >
                    <House size={12} strokeWidth={1.5} />
                  </div>
                </foreignObject>
              {:else if nodeMode === 0 && getPieceComponent(node)}
                {@const PieceIcon = getPieceComponent(node)!}
                <foreignObject x={-8} y={-6.5} width={16} height={13}>
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
                    color:{node.side === 'white' ? '#333' : '#fff'};pointer-events:none;"
                  >
                    <PieceIcon size={12} strokeWidth={1.5} />
                  </div>
                </foreignObject>
              {:else}
                <text
                  x="0"
                  dominant-baseline="central"
                  text-anchor="middle"
                  fill={node.side === "white" ? "#333" : "#fff"}
                  font-size={nodeFontSize()}>{nodeLabel(node)}</text
                >
              {/if}
            {/if}

            {#if hasComments}
              <foreignObject x={0.35 * nodeWidth} y={-0.7 * nodeHeight - 8} width={10} height={10}>
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
                  color:royalblue;pointer-events:none;"
                >
                  <MessageSquareText size={8} strokeWidth={1.5} fill="royalblue" />
                </div>
              </foreignObject>
            {/if}
          </g>
        {/each}
      </g>
    </svg>

    <div class="toolbar">
      {#each zoomBTN as { title, icon, event }}
        <button class="toolbar-btn" {title} aria-label={title} use:useSetIcon={icon} onclick={event}
        ></button>
      {/each}
      <button
        class="toolbar-btn"
        title={nodeModeTitle}
        aria-label={nodeModeTitle}
        use:useSetIcon={modeIcon}
        onclick={cycleNodeMode}
      ></button>
    </div>
  </div>

  <textarea
    bind:value={commentsText}
    class="auto-height"
    placeholder={t("tree.placeholder")}
    bind:this={textareaEl}
    oninput={handleCommentsInput}
    onblur={handleCommentsBlur}
    rows="1"
  ></textarea>
</div>

<style>
  .tree-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    --board-background: var(--background-primary-alt);
    --board-line: var(--text-normal);
    --piece-red: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
    --text-color: var(--text-normal);
  }

  .svg-wrapper {
    flex: 1 1 auto;
    overflow: hidden;
    background-color: var(--board-background);
    position: relative;
    width: 100%;
    height: 100%;
  }

  .toolbar {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    gap: 0;
    margin: 0;
    padding: 0px;
  }

  .toolbar .toolbar-btn {
    width: 30px;
    height: 30px;
    padding: 0;
    margin: 0;
  }

  .tree-svg {
    user-select: none;
    touch-action: none;
    display: block;
  }

  .node-group {
    cursor: pointer;
  }

  textarea {
    width: 100%;
    height: var(--textarea-height, 20px);
    max-height: 80px;
    resize: none;
    font-family: var(--font-family);
    font-size: var(--font-size-normal);
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    padding: 0;
    outline: none;
    overflow-y: auto;
  }
  textarea.auto-height {
    height: auto;
  }
  textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 5px var(--interactive-accent);
  }
</style>
