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
  let foldedNodes = $state(new Set<string>());

  // ---- D3 Zoom ----
  let zoomTransform = $state(d3.zoomIdentity);
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
  const TRANSFORM_SAFE = $derived.by(() => {
    const t = zoomTransform;
    if (
      !t ||
      !Number.isFinite(t.x) ||
      !Number.isFinite(t.y) ||
      !Number.isFinite(t.k)
    ) {
      return "translate(0,0) scale(1)";
    }
    return `translate(${t.x},${t.y}) scale(${t.k})`;
  });

  const spacingX = 22;
  const spacingY = 15;
  const nodeWidth = 20;
  const nodeHeight = 13;

  const ANNOTATION_DEFINITIONS: Record<
    string,
    { symbol: string; color: string; icon: string }
  > = {
    "W+": { symbol: "White +", color: "var(--piece-red)", icon: "thumbs-up" },
    "B+": {
      symbol: "Black +",
      color: "var(--piece-black)",
      icon: "thumbs-down",
    },
    "=": { symbol: "Equal", color: "green", icon: "handshake" },
    "?": { symbol: "Key", color: "var(--text-warning)", icon: "bookmark" },
    "!": { symbol: "Brilliant", color: "var(--color-yellow)", icon: "star" },
    "1-0": { symbol: "1-0", color: "white", icon: "thumbs-up" },
    "0-1": { symbol: "0-1", color: "black", icon: "thumbs-up" },
    "1/2-1/2": { symbol: "Draw", color: "gray", icon: "handshake" },
  };

  const ALL_ANNOTATION_KEYS = Object.keys(ANNOTATION_DEFINITIONS);

  // Chess piece icon name lookup
  const PIECE_ICONS: Record<string, string> = {
    k: "chess-king",
    q: "chess-queen",
    r: "chess-rook",
    b: "chess-bishop",
    n: "chess-knight",
    p: "chess-pawn",
  };

  function getPieceIcon(node: ChessNode): string | null {
    if (!node.move) return null;
    if (node.move.isKingsideCastle() || node.move.isQueensideCastle())
      return "castle";
    if (node.move.promotion) return "chevrons-up";
    return PIECE_ICONS[node.move.piece] ?? null;
  }

  // ---- 工具函数 ----
  function getPrimaryAnnotation(node: ChessNode): string | undefined {
    if (!node.comments) return undefined;
    return node.comments.find((c) => ALL_ANNOTATION_KEYS.includes(c));
  }

  function getAllAnnotations(node: ChessNode): string[] {
    return node.comments?.filter((c) => ALL_ANNOTATION_KEYS.includes(c)) ?? [];
  }

  const SHAPES_RE = /^([a-h][1-8])([a-h][1-8])?:([gryb])$/;

  function getRegularComments(node: ChessNode): string[] {
    return (
      node.comments?.filter(
        (c) => !ALL_ANNOTATION_KEYS.includes(c) && !SHAPES_RE.test(c),
      ) ?? []
    );
  }

  function getAllShapes(node: ChessNode): string[] {
    return node.comments?.filter((c) => SHAPES_RE.test(c)) ?? [];
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
  let handleSliderMouseMove: ((evt: MouseEvent) => void) | null = null;
  let handleSliderMouseUp: (() => void) | null = null;

  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }
    if (layoutChangeHandler) {
      activeDocument.body.removeEventListener(
        "chess-layout-change",
        layoutChangeHandler,
      );
      layoutChangeHandler = null;
    }
    if (handleSliderMouseMove)
      activeDocument.removeEventListener("mousemove", handleSliderMouseMove);
    if (handleSliderMouseUp)
      activeDocument.removeEventListener("mouseup", handleSliderMouseUp);
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
    const regularComments = commentsText
      .split("\n")
      .filter((c) => c.trim() !== "");
    const existingAnnotations = getAllAnnotations(currentNode);
    const existingShapes = getAllShapes(currentNode);
    const newComments = [
      ...existingAnnotations,
      ...existingShapes,
      ...regularComments,
    ];
    const oldComments = currentNode.comments ?? [];
    const changed =
      newComments.length !== oldComments.length ||
      newComments.some((c, i) => c !== oldComments[i]);
    currentNode.comments = newComments;
    eventBus.emit("updateUI");
    if (changed) eventBus.emit("modified");
  }

  function adjustTextareaHeight() {
    if (!textareaEl) return;
    textareaEl.classList.add("auto-height");
    textareaEl.style.setProperty(
      "--textarea-height",
      `${textareaEl.scrollHeight}px`,
    );
    textareaEl.classList.remove("auto-height");
  }

  function updateTreeLayout() {
    renderedNodes = calculateTreeLayout(nodeMap, foldedNodes);
  }

  function toggleFold(node: ChessNode) {
    const cur = foldedNodes.has(node.id);
    if (cur) {
      foldedNodes.delete(node.id);
    } else {
      foldedNodes.add(node.id);
    }
    foldedNodes = new Set(foldedNodes);
    updateTreeLayout();
  }

  function resetView() {
    updateTreeLayout();
    if (!svgEl || !zoomBehavior) return;
    if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) return;
    const padding = 40;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of renderedNodes) {
      if (n.x === undefined || n.y === undefined) continue;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    )
      return;
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
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc))
      return;
    const { clientWidth, clientHeight } = svgEl;
    const padding = 50;
    let translateX = tx,
      translateY = ty,
      scale = sc;
    const nodeScreenX = node.x * spacingX * scale + translateX;
    const nodeScreenY = node.y * spacingY * scale + translateY;

    let dx = 0,
      dy = 0;
    if (nodeScreenX < padding) dx = padding - nodeScreenX;
    else if (nodeScreenX > clientWidth - padding)
      dx = clientWidth - padding - nodeScreenX;
    if (nodeScreenY < padding) dy = padding - nodeScreenY;
    else if (nodeScreenY > clientHeight - padding)
      dy = clientHeight - padding - nodeScreenY;

    if (dx || dy) {
      translateX += dx;
      translateY += dy;
    }
    const t = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    d3.select(svgEl).transition().duration(300).call(zoomBehavior.transform, t);
  }

  function zoomAtCenter(factor: number) {
    if (!svgEl) return;
    const { x: tx, y: ty, k: sc } = zoomTransform;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(sc))
      return;
    const w = svgEl.clientWidth,
      h = svgEl.clientHeight;
    const cx = w / 2,
      cy = h / 2;
    let translateX = tx,
      translateY = ty,
      scale = sc;
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

  let sliderMouseDown = $state(false);
  let sliderInnerEl: HTMLDivElement | undefined = $state();

  function handleSliderAreaMouseDown(evt: MouseEvent) {
    if (evt.button !== 0) return;
    sliderMouseDown = true;
    navigateFromSliderY(evt.clientY);
  }

  function navigateFromSliderY(clientY: number) {
    if (!sliderInnerEl || currentPath.length <= 1) return;
    const { top, height } = sliderInnerEl.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientY - top) / height));
    const idx = Math.round(percent * (currentPath.length - 1));
    const targetId = currentPath[idx];
    if (targetId && targetId !== currentNode?.id) {
      eventBus.emit("slider-navigate", targetId);
    }
  }

  let sliderPercent = $derived.by(() => {
    if (!currentNode || currentPath.length <= 1) return 0;
    const idx = currentPath.indexOf(currentNode.id);
    if (idx === -1) return 0;
    return (idx / (currentPath.length - 1)) * 100;
  });

  let sliderText = $derived.by(() => {
    if (!currentNode || currentPath.length <= 1) return "";
    const idx = currentPath.indexOf(currentNode.id);
    return idx !== -1 ? `${idx}/${currentPath.length - 1}` : "";
  });

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

  onMount(() => {
    if (!svgEl) return;
    updateTreeLayout();
    zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      const t = event.transform;
      if (
        t &&
        Number.isFinite(t.x) &&
        Number.isFinite(t.y) &&
        Number.isFinite(t.k)
      ) {
        zoomTransform = t;
      }
    });

    handleSliderMouseMove = (evt: MouseEvent) => {
      if (!sliderMouseDown) return;
      navigateFromSliderY(evt.clientY);
    };
    handleSliderMouseUp = () => {
      sliderMouseDown = false;
    };
    activeDocument.addEventListener("mousemove", handleSliderMouseMove);
    activeDocument.addEventListener("mouseup", handleSliderMouseUp);

    layoutChangeHandler = () => resetView();
    activeDocument.body.addEventListener(
      "chess-layout-change",
      layoutChangeHandler,
    );

    tick()
      .then(() => new Promise(requestAnimationFrame))
      .then(() => {
        if (!svgEl || svgEl.clientWidth === 0 || svgEl.clientHeight === 0)
          return;
        d3.select(svgEl).call(zoomBehavior);
        resetView();
        return undefined;
      });
  });

  $effect(() => {
    if (!currentNode) {
      commentsText = "";
      return;
    }
    const node = currentNode;
    commentsText = getRegularComments(node).join("\n");
    // oxlint-disable-next-line promise/always-return
    tick().then(() => {
      if (textareaEl) adjustTextareaHeight();
      panToNodeIfNeeded(node);
    });
  });

  $effect(() => {
    // oxlint-disable-next-line no-unused-expressions
    nodeMap.size;
    updateTreeLayout();
  });
</script>

<div class="tree-container">
  <div class="svg-wrapper">
    <svg bind:this={svgEl} width="100%" height="100%" class="tree-svg">
      <g transform={TRANSFORM_SAFE}>
        {#each renderedNodes as node}
          {#each node.children as child, idx}
            {#if !(foldedNodes.has(node.id) && idx > 0)}
              <path
                d={`
              M ${node.x! * spacingX} ${node.y! * spacingY}
              L ${(child.x! - 0.3 * Math.sign(child.x! - node.x!)) * spacingX} ${node.y! * spacingY}
              L ${child.x! * spacingX} ${child.y! * spacingY}
              `}
                stroke="var(--chess-board-line)"
                stroke-linejoin="round"
                stroke-width={currentPath.includes(node.id) &&
                currentPath.includes(child.id)
                  ? 1.5
                  : 1}
                opacity={currentPath.includes(node.id) &&
                currentPath.includes(child.id)
                  ? 1.5
                  : 0.7}
                filter={currentPath.includes(node.id) &&
                currentPath.includes(child.id)
                  ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                  : "grayscale(50%) brightness(0.75)"}
                fill="none"
              />
            {/if}
          {/each}
        {/each}

        {#each renderedNodes as node}
          {@const primaryAnnotation = getPrimaryAnnotation(node)}
          {@const hasComments = getRegularComments(node).length > 0}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group"
            transform="translate({node.x! * spacingX} {node.y! *
              spacingY}){node.id === currentNode?.id ? ' scale(1.15)' : ''}"
            opacity={currentPath.includes(node.id) ? 1 : 0.8}
            filter={!currentPath.includes(node.id)
              ? "grayscale(100%) brightness(0.75)"
              : node.id === currentNode?.id
                ? "drop-shadow(0 0 4px var(--interactive-accent))"
                : undefined}
            stroke-width={node.id === currentNode?.id ? 1 : 0.5}
            onclick={() => eventBus.emit("node-click", node.id)}
          >
            {#if primaryAnnotation}
              {@const def = ANNOTATION_DEFINITIONS[primaryAnnotation]}
              <rect
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                rx="2.5"
                ry="2.5"
                fill={node.side === "white"
                  ? "#fff"
                  : node.side === "black"
                    ? "#333"
                    : "green"}
                stroke="var(--chess-board-line)"
              />
              <g transform="translate(-6, -6)" color={node.side === "white" ? "#333" : "#fff"}>
                {@html iconSvg(def.icon, 12, 1.5)}
              </g>
            {:else}
              <rect
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                rx="2.5"
                ry="2.5"
                fill={node.side === "white"
                  ? "#fff"
                  : node.side === "black"
                    ? "#333"
                    : "green"}
                stroke="var(--chess-board-line)"
              />
              {#if nodeMode === 0 && !node.move}
                <g transform="translate(-6, -6)" color="#fff">
                  {@html iconSvg("house", 12, 1.5)}
                </g>
              {:else if nodeMode === 0 && getPieceIcon(node)}
                <g
                  transform="translate(-6, -6)"
                  color={node.side === "white" ? "#333" : "#fff"}
                >
                  {@html iconSvg(getPieceIcon(node)!, 12, 1.5)}
                </g>
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
              <g transform="translate(4.8, -8)">
                {@html iconSvg("message-square-text", 8, 1.5, "royalblue")}
              </g>
            {/if}

            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            {#if node.children.length > 1}
              {@const isLeft = (node.y ?? 0) % 2 === 0}
              <g
                transform="translate({isLeft
                  ? -nodeWidth / 2
                  : nodeWidth / 2}, 0)"
                style="cursor: pointer"
                onclick={(e) => {
                  e.stopPropagation();
                  toggleFold(node);
                }}
              >
                <polygon
                  points={foldedNodes.has(node.id)
                    ? isLeft
                      ? "0,-4 0,4 -3,3 -3,-3"
                      : "0,-4 0,4 3,3 3,-3"
                    : isLeft
                      ? "0,-4 0,4 -5,0"
                      : "0,-4 0,4 5,0"}
                  fill="var(--chess-board-line)"
                  stroke="var(--chess-board-line)"
                  stroke-width="1"
                  stroke-linejoin="round"
                  opacity={currentPath.includes(node.id) &&
                  node.children[0] &&
                  !currentPath.includes(node.children[0].id)
                    ? 1.5
                    : 0.7}
                  filter={currentPath.includes(node.id) &&
                  node.children[0] &&
                  !currentPath.includes(node.children[0].id)
                    ? "brightness(1.5) saturate(1.4) drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))"
                    : "grayscale(50%) brightness(0.75)"}
                />
              </g>
            {/if}
          </g>
        {/each}
      </g>
    </svg>

    <div class="toolbar">
      {#each zoomBTN as { title, icon, event }}
        <button
          class="toolbar-btn"
          {title}
          aria-label={title}
          use:useSetIcon={icon}
          onclick={event}
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

    <div class="slider" class:active={sliderMouseDown}>
      <button
        class="slider-btn slider-to-start"
        aria-label="To start"
        use:useSetIcon={"minus"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "toStart", payload: null })}
      ></button>
      <button
        class="slider-btn slider-prev"
        aria-label="Previous"
        use:useSetIcon={"arrow-up"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "back", payload: null })}
      ></button>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={sliderInnerEl}
        class="slider-inner"
        onmousedown={handleSliderAreaMouseDown}
      >
        <span class="slider-thumb" style="top: {sliderPercent}%"></span>
        {#if sliderText}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="slider-label"
            style="top: {sliderPercent}%"
            onmousedown={handleSliderAreaMouseDown}>{sliderText}</span
          >
        {/if}
      </div>
      <button
        class="slider-btn slider-next"
        aria-label="Next"
        use:useSetIcon={"arrow-down"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "next", payload: null })}
      ></button>
      <button
        class="slider-btn slider-to-end"
        aria-label="To end"
        use:useSetIcon={"minus"}
        onclick={() =>
          eventBus.emit("btn-click", { name: "toEnd", payload: null })}
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
    --chess-board-background: var(--background-primary-alt);
    --chess-board-line: var(--text-normal);
    --piece-red: var(--chess-piece-white, var(--color-red));
    --piece-black: var(--chess-piece-black, var(--color-blue));
    --text-color: var(--text-normal);
  }

  :global(.tree-codeblock .tree-view.right) .tree-container {
    height: calc(var(--chess-cell-size, 50px) * 8);
  }

  :global(.tree-codeblock .tree-view.bottom) .tree-container {
    height: calc(var(--chess-cell-size, 50px) * 5);
  }

  .svg-wrapper {
    flex: 1 1 auto;
    overflow: hidden;
    background-color: var(--chess-board-background);
    position: relative;
    width: 100%;
    height: 100%;
  }

  .toolbar {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
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

  .slider {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 6px;
    background: var(--background-modifier-border);
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 3px;
    margin: 6px;
  }

  .slider-btn {
    width: 16px;
    height: 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    color: var(--text-muted);
    font-size: 0.55em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    transition:
      color 0.2s,
      background 0.2s;
  }
  .slider-btn + .slider-btn {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    margin-top: -1px;
  }
  .slider-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
  .slider-btn:active {
    color: var(--text-on-accent);
    background: var(--interactive-accent);
  }

  .slider-inner {
    flex: 1 1 auto;
    width: 100%;
    position: relative;
    cursor: pointer;
  }

  .slider-thumb {
    position: absolute;
    left: -2px;
    right: -2px;
    height: 6px;
    margin-top: -3px;
    background: var(--interactive-accent);
    border-radius: 3px;
    transition: top 0.2s;
  }
  .slider.active .slider-thumb {
    transition: none;
  }

  .slider-label {
    position: absolute;
    right: calc(100% + 8px);
    height: 18px;
    margin-top: -9px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 0.6em;
    line-height: 18px;
    text-align: center;
    padding: 0 4px;
    border-radius: 3px;
    white-space: nowrap;
    cursor: pointer;
    transition: top 0.2s;
  }
  .slider.active .slider-label {
    transition: none;
  }
  .slider-label::after {
    content: "";
    position: absolute;
    top: 50%;
    right: -4px;
    transform: translateY(-50%);
    border: 4px solid transparent;
    border-left-color: var(--interactive-accent);
    border-right: none;
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
