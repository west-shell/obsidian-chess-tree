import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

import { MarkdownView, Plugin, TFile, addIcon } from "obsidian";
import type { ISettings } from "./types";
import { applyThemes } from "./themes";
import { ChessRenderChild } from "./renderChild/MoveListRenderChild";
import { GenFENRenderChild } from './renderChild/GenFENRenderChild';
import { PGNView } from './view/pgn';
import { ChessSettingTab, DEFAULT_SETTINGS } from "./settings";

export default class ChessPlugin extends Plugin {
	settings: ISettings = DEFAULT_SETTINGS;
	instances: Set<{ refresh(): void }> = new Set();
	async onload() {

		await this.loadSettings();

		this.addSettingTab(new ChessSettingTab(this.app, this));

		applyThemes(this.settings);
		addIcon("chess-icon", `
<svg viewBox="0 0 80 80">
  <circle cx="40" cy="40" r="38"
    fill="var(--background-primary-alt)"
    stroke="var(--text-normal)"
    stroke-width="4" />
  <text x="50%" y="58%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-size="60"
    fill="var(--text-normal)"
    font-weight="bold">&#9822;</text>
</svg>
`);
		this.registerMarkdownCodeBlockProcessor('chess', (source, el, ctx) => {
			const renderChild = new ChessRenderChild(el, ctx, source, this);
			ctx.addChild(renderChild);
		});

		this.registerMarkdownCodeBlockProcessor('chessboard', (source, el, ctx) => {
			const renderChild = new GenFENRenderChild(el, ctx, source, this);
			ctx.addChild(renderChild);
		});

		this.registerView(
			PGNView.VIEW_TYPE,
			(leaf) => new PGNView(leaf, this)
		);

		this.registerExtensions(["pgn"], PGNView.VIEW_TYPE);

		this.addRibbonIcon("chess-icon", "New PGN file", async () => {
			let baseFileName = "Untitled";
			let fileExtension = ".pgn";
			let fileName = baseFileName + fileExtension;
			let counter = 0;

			while (await this.app.vault.adapter.exists(fileName)) {
				counter++;
				fileName = `${baseFileName} ${counter}${fileExtension}`;
			}

			const fileContent = "";

			try {
				const newFile = await this.app.vault.create(fileName, fileContent);
				this.app.workspace.getLeaf(true).openFile(newFile);
			} catch (error) {
				console.error("Failed to create PGN file:", error);
			}
		});

		this.registerEvent(
			this.app.workspace.on("resize", () => {
				document.body.dispatchEvent(new CustomEvent("xq-layout-change"));
			}),
		);

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				applyThemes(this.settings)
			}),
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== "pgn") {
					return;
				}
				const currentView = this.app.workspace.getLeaf().view;
				if (!(currentView instanceof MarkdownView && currentView.file === file)) {
					menu.addItem((item) =>
						item
							.setTitle("Open in Markdown view")
							.setIcon("file-text")
							.onClick(() => this.changeView(file, 'markdown'))
					);
				} if (!(currentView instanceof PGNView && currentView.file === file)) {
					menu.addItem((item) =>
						item.setTitle("Open in PGN view")
							.setIcon("chess-icon")
							.onClick(() => this.changeView(file, PGNView.VIEW_TYPE)));
				}
			}),
		);
	}

	refresh() {
		this.instances.forEach((instance) => {
			instance.refresh();
		});
	}

	async changeView(file: TFile, targetViewType: string) {
		const leaf = this.app.workspace.getLeaf(false);
		if (!leaf) return;

		await leaf.setViewState({
			type: targetViewType,
			state: { file: file.path },
			active: true,
		});
	}


	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = {
			...DEFAULT_SETTINGS,
			...savedData,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
		applyThemes(this.settings);
	}

}
