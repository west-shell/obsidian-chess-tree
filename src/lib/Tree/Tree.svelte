<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { EventBus } from "../../core/event-bus";
  import { type ChessNode, type NodeMap } from "../../types";
  import { onLangChange, t } from "../../i18n";
  import { calculateTreeLayout } from "./layout";
  import { iconSvg } from "../../utils/icon";
  import { setIcon } from "obsidian";
  import * as d3 from "d3";

  interface Props {
    nodeMap: NodeMap;
    eventBus: EventBus;
    currentNode: ChessNode | null;
    currentPath: string[];
  }

  let {
    nodeMap,
    eventBus,
    currentNode = $bindable(),
    currentPath,
  }: Props = $props();

  let commentsText = $state("");
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  let renderedNodes: ChessNode[] = $state([]);

  // ---- D3 Zoom ----
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  const TRANSFORM_SAFE = $derived.by(() => {
    const t = zoomTransform;
    if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.k)) {
      return "translate(0,0) scale(1)";
    }
    return `translate(${t.x},${t.y}) scale(${t.k})`;
  });

  const spacingX = 22;
  const spacingY = 15;
  const nodeWidth = 20;
  const nodeHeight = 13;

  const ANNOTATION_DEFINITIONS: Record<string, { symbol: string; color: string; icon: string }> = {
    "W+": { symbol: "White +", color: "var(--piece-red)", icon: "thumbs-up" },
    "B+": { symbol: "Black +", color: "var(--piece-black)", icon: "thumbs-down" },
    "=": { symbol: "Equal", color: "green", icon: "handshake" },
    "?": { symbol: "Key", color: "var(--text-warning)", icon: "bookmark" },
    "!": { symbol: "Brilliant", color: "var(--color-yellow)", icon: "star" },
    "1-0": { symbol: "1-0", color: "white", icon: "thumbs-up" },
    "0-1": { symbol: "0-1", color: "black", icon: "thumbs-up" },
    "1/2-1/2": { symbol: "Draw", color: "gray", icon: "handshake" },
  };
  const ALL_ANNOTATION_KEYS = Object.keys(ANNOTATION_DEFINITIONS);

  const PIECE_ICONS: Record<string, string> = {
    k: "chess-king", q: "chess-queen", r: "chess-rook",
    b: "chess-bishop", n: "chess-knight", p: "chess-pawn",
  };

  function getPieceIcon(node: ChessNode): string | null {
    if (!node.move) return null;
    if (node.move.isKingsideCastle() || node.move.isQueensideCastle()) return "castle";
    if (node.move.promotion) return "chevrons-up";
    return PIECE_ICONS[node.move.piece] ?? null;
  }

  function getPrimaryAnnotation(node: ChessNode): string | undefined {
    return node.comments?.find((c) => ALL_ANNOTATION_KEYS.includes(c));
  }

  function getAllAnnotations(node: ChessNode): string[] {
    return node.comments?.filter((c) => ALL_ANNOTATION_KEYS.includes(c)) ?? [];
  }

  const SHAPES_RE = /^([a-h][1-8])([a-h][1-8])?:([gryb])$/;

  function getRegularComments(node: ChessNode): string[] {
    return node.comments?.filter((c) => !ALL_ANNOTATION_KEYS.includes(c) && !SHAPES_RE.test(c)) ?? [];
  }

  // ---- 自动保存 ----
  let saveTimeout: number | undefined;
  function handleCommentsInput() {
    adjustTextareaHeight();
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => { saveComments(); saveTimeout = undefined; }, 700);
  }

  let layoutChangeHandler: (() => void) | null = null;

  onDestroy(() => {
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = undefined; }
    if (layoutChangeHandler) { document.body.removeEventListener("layout-change", layoutChangeHandler); layoutChangeHandler = null; }
  });

  function handleCommentsBlur() {
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = undefined; }
    saveComments();
  }

  function saveComments() {
    if (!currentNode) return;
    const regularComments = commentsText.split("\n").filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    const existingShapes = getAllShapes(currentNode);
    currentNode.comments = [...existingAnnotations, ...existingShapes, ...regularComments];
    eventBus.emit("updateUI");
    eventBus.emit("modified");
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

  // ---- 重置视角 ----
  function resetView() {
    updateTreeLayout();
    if (!svgEl || !zoomBehavior) return;
    if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
    const padding = 40;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of renderedNodes) {
      if (n.x === undefined || n.y === undefined) continue;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;
    const treeWidth = (maxX - minX) * spacingX;
    const treeHeight = (maxY - minY) * spacingY;
    const { clientWidth, clientHeight } = svgEl;
    const scaleX = (clientWidth - padding * 2) / treeWidth;
    const scaleY = (clientHeight - padding * 2) / treeHeight;
    const k = Math.max(0.75, Math.min(scaleX, scaleY, 2));
    const tx = clientWidth / 2 - (minX * spacingX + treeWidth / 2) * k;
    const ty = clientHeight / 2 - (minY * spacingY + treeHeight / 2) * k;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function panToNodeIfNeeded(node: ChessNode) {
    if (!node || !svgEl || node.x === undefined || node.y === undefined) return;
    const { x: tx, y: ty, k: sc } = zoomTransform;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc)) return;
    const { clientWidth, clientHeight } = svgEl;
    const padding = 50;
    let translateX = tx, translateY = ty, scale = sc;
    const nodeScreenX = node.x * spacingX * scale + translateX;
    const nodeScreenY = node.y * spacingY * scale + translateY;
    let dx = 0, dy = 0;
    if (nodeScreenX < padding) dx = padding - nodeScreenX;
    else if (nodeScreenX > clientWidth - padding) dx = clientWidth - padding - nodeScreenX;
    if (nodeScreenY < padding) dy = padding - nodeScreenY;
    else if (nodeScreenY > clientHeight - padding) dy = clientHeight - padding - nodeScreenY;
    if (dx || dy) { translateX += dx; translateY += dy; }
    const t = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function zoomAtCenter(factor: number) {
    if (!svgEl) return;
    const { x: tx, y: ty, k: sc } = zoomTransform;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc)) return;
    const w = svgEl.clientWidth, h = svgEl.clientHeight;
    const cx = w / 2, cy = h / 2;
    let translateX = tx, translateY = ty, scale = sc;
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
  function zoomIn() { zoomAtCenter(ZOOM_STEP); }
  function zoomOut() { zoomAtCenter(1 / ZOOM_STEP); }

  let nodeMode = $state(0);
  const MODE_ICONS = ["club", "align-justify"];
  function cycleNodeMode() { nodeMode = (nodeMode + 1) % 2; }

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
    return "";
  }
  function nodeFontSize(): string {
    if (nodeMode === 1) return "7px";
    return "12px";
  }
  let modeIcon = $derived(MODE_ICONS[nodeMode]);
  function useSetIcon(el: HTMLElement, icon: string) { setIcon(el, icon); }

  // ─── D3 渲染 ─────────────────────────────────────

  function nodeFillColor(node: ChessNode): string {
    if (node.side === "white") return "#fff";
    if (node.side === "black") return "#333";
    return "green";
  }

  function renderTree(svg: SVGSVGElement, nodes: ChessNode[]) {
    if (!nodes.length) return;
    const g = d3.select(svg).select("g.tree-root");
    if (g.empty()) return;

    const linkData = nodes.flatMap((node) =>
      node.children.map((child) => ({ source: node, target: child }))
    );

    const animationDuration = 200;

    // ── 连线 ──
    const paths = g.selectAll<SVGPathElement, { source: ChessNode; target: ChessNode }>("path.link")
      .data(linkData, (d) => d.target.id);

    const pathsEnter = paths.enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "var(--board-line)")
      .attr("stroke-linejoin", "round")
      .attr("opacity", 0);

    paths.exit()
      .transition().duration(animationDuration)
      .attr("opacity", 0)
      .remove();

    const pathsMerge = pathsEnter.merge(paths);

    // ── 节点组 ──
    const nodeGroups = g.selectAll<SVGGElement, ChessNode>("g.node")
      .data(nodes, (d) => d.id);

    const nodeGroupsEnter = nodeGroups.enter()
      .append("g")
      .attr("class", "node")
      .attr("cursor", "pointer")
      .on("click", (_, d) => eventBus.emit("node-click", d.id));

    nodeGroups.exit()
      .transition().duration(animationDuration)
      .attr("opacity", 0)
      .remove();

    const nodeGroupsMerge = nodeGroupsEnter.merge(nodeGroups);

    // ── 节点内元素（只在新节点建一次） ──
    nodeGroupsEnter.each(function (d) {
      const g = d3.select(this);

      // 矩形背景
      g.append("rect")
        .attr("class", "node-bg")
        .attr("x", -nodeWidth / 2)
        .attr("y", -nodeHeight / 2)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("rx", 2.5)
        .attr("ry", 2.5);

      // 注释图标容器
      g.append("g")
        .attr("class", "annotation-icon")
        .attr("transform", "translate(-6, -6)");

      // 棋子图标容器
      g.append("g")
        .attr("class", "piece-icon")
        .attr("transform", "translate(-6, -6)");

      // 文字
      g.append("text")
        .attr("class", "node-text")
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central");

      // 评论标记容器
      g.append("g")
        .attr("class", "comment-icon")
        .attr("transform", "translate(4.8, -8)");
    });

    // ── 更新节点变换与样式 ──
    nodeGroupsMerge
      .transition().duration(animationDuration)
      .attr("transform", (d) => `translate(${d.x! * spacingX} ${d.y! * spacingY})`);

    // ── 连线更新 ──
    const linkTransition = d3.transition().duration(animationDuration);
    pathsMerge
      .transition(linkTransition)
      .attr("d", (d) => {
        const sx = d.source.x! * spacingX;
        const sy = d.source.y! * spacingY;
        const tx = d.target.x! * spacingX;
        const ty = d.target.y! * spacingY;
        const offX = 0.3 * Math.sign(tx - sx) * spacingX;
        return `M ${sx} ${sy}
                L ${tx - offX} ${sy}
                L ${tx} ${ty}`;
      })
      .attr("opacity", (d) =>
        currentPath.includes(d.source.id) && currentPath.includes(d.target.id) ? 1 : 0.7)
      .attr("stroke-width", (d) =>
        currentPath.includes(d.source.id) && currentPath.includes(d.target.id) ? 1.5 : 1);

    // ── 节点样式更新 ──
    nodeGroupsMerge.each(function (d) {
      const g = d3.select(this);
      const isOnPath = currentPath.includes(d.id);
      const isActive = d.id === currentNode?.id;

      // 背景色
      g.select("rect.node-bg")
        .attr("fill", nodeFillColor(d))
        .attr("stroke", "var(--board-line)")
        .attr("stroke-width", isActive ? 1 : 0.5);

      // 滤镜/透明度
      g.attr("opacity", isOnPath ? 1 : 0.8);
      g.style("filter", isActive
        ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255,255,255,0.6))"
        : isOnPath
          ? undefined
          : "grayscale(100%) brightness(0.75)");

      // 注释
      const primaryAnnotation = getPrimaryAnnotation(d);
      const annotationDef = primaryAnnotation ? ANNOTATION_DEFINITIONS[primaryAnnotation] : null;
      g.select("g.annotation-icon")
        .style("display", annotationDef ? null : "none")
        .style("color", annotationDef?.color ?? null)
        .html(annotationDef ? iconSvg(annotationDef.icon, 12, 1.5) : "");

      // 内容：棋子图标 或 文字
      const pieceIcon = getPieceIcon(d);
      const hasAnnotation = !!annotationDef;
      const showPiece = !hasAnnotation && nodeMode === 0 && !d.move;
      const showIcon = !hasAnnotation && nodeMode === 0 && pieceIcon;
      const showText = !hasAnnotation && (nodeMode === 1 || !pieceIcon);

      g.select("g.piece-icon")
        .style("display", showIcon ? null : "none")
        .style("color", d.side === "white" ? "#333" : "#fff")
        .html(showPiece ? iconSvg("house", 12, 1.5) : (showIcon ? iconSvg(pieceIcon!, 12, 1.5) : ""));

      g.select("text.node-text")
        .style("display", showText ? null : "none")
        .attr("fill", d.side === "white" ? "#333" : "#fff")
        .attr("font-size", nodeFontSize())
        .text(showText ? nodeLabel(d) : "");

      // 评论标记
      const hasComments = getRegularComments(d).length > 0;
      g.select("g.comment-icon")
        .style("display", hasComments ? null : "none")
        .html(hasComments ? iconSvg("message-square-text", 8, 1.5, "royalblue") : "");
    });
  }

  // ── 响应式渲染 ──
  let renderTimeout: number | undefined;

  function scheduleRender() {
    if (renderTimeout) cancelAnimationFrame(renderTimeout);
    renderTimeout = requestAnimationFrame(() => {
      if (svgEl) renderTree(svgEl, renderedNodes);
    });
  }

  // ── 初始化 ──
  onMount(async () => {
    if (!svgEl) return;
    updateTreeLayout();
    zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      const t = event.transform;
      if (t && Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.k)) {
        zoomTransform = t;
      }
    });
    d3.select(svgEl).call(zoomBehavior);
    await tick();
    await new Promise(requestAnimationFrame);
    resetView();

    layoutChangeHandler = () => resetView();
    document.body.addEventListener("layout-change", layoutChangeHandler);
  });

  // ── 响应数据变化 ──
  $effect(() => {
    nodeMap.size;
    updateTreeLayout();
    scheduleRender();
  });

  $effect(() => {
    // 当 renderedNodes / currentPath / currentNode / nodeMode 变化时重渲染
    renderedNodes;
    currentPath;
    currentNode;
    nodeMode;
    scheduleRender();
  });

  // 当前节点变化时平移到它
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
</script>

<div class="tree-container">
  <div class="svg-wrapper">
    <svg bind:this={svgEl} width="100%" height="100%" class="tree-svg">
      <g transform={TRANSFORM_SAFE}>
        <g class="tree-root"></g>
      </g>
    </svg>

    <div class="toolbar">
      {#each zoomBTN as { title, icon, event }}
        <button class="toolbar-btn" {title} aria-label={title} use:useSetIcon={icon} onclick={event}></button>
      {/each}
      <button class="toolbar-btn" title={nodeModeTitle} aria-label={nodeModeTitle} use:useSetIcon={modeIcon} onclick={cycleNodeMode}></button>
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
  textarea.auto-height { height: auto; }
  textarea:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 5px var(--interactive-accent);
  }
</style>
