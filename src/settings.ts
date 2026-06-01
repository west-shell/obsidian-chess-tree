import ChessPlugin from "./main";
import type { ISettings } from "./types";
import { type App, PluginSettingTab, Setting } from "obsidian";
import { THEME_OPTIONS } from "./themes";

export const DEFAULT_SETTINGS: ISettings = {
	position: "right",
	theme: "wood",
	cellSize: 50,
	fontSize: 12,
	showCoordinateLabels: true,
	showLastMove: true,
	showNextMove: true,
	showTurnBorder: true,
	autoJump: "auto",
	enableSpeech: true,
	showMovelist: true,
	showMovelistText: true,
	boardMarginTop: 20,
	boardMarginBottom: 20,
	viewOnly: false,
	rotated: false,
};

function addSliderWithValue(
	containerEl: HTMLElement,
	name: string,
	desc: string,
	value: number,
	limits: { min: number; max: number; step: number },
	unit: string,
	onChange: (v: number) => void,
) {
	let currentValue = value;
	const setting = new Setting(containerEl).setName(name).setDesc(desc);

	const valueDisplay = createSpan({ cls: "xq-slider-value" });
	valueDisplay.setText(`${currentValue}${unit}`);
	setting.controlEl.prepend(valueDisplay);

	setting.addSlider((slider) => {
		slider.setLimits(limits.min, limits.max, limits.step).setValue(currentValue);
		slider.onChange((v) => {
			currentValue = v;
			valueDisplay.setText(`${v}${unit}`);
			onChange(v);
		});
		slider.sliderEl.addEventListener("input", () => {
			const v = slider.getValue();
			currentValue = v;
			valueDisplay.setText(`${v}${unit}`);
		});
	});

	return setting;
}

export class ChessSettingTab extends PluginSettingTab {
	plugin: ChessPlugin;

	constructor(app: App, plugin: ChessPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const settings = this.plugin.settings;
		const { containerEl } = this;
		containerEl.empty();

		// ==================== Board appearance ====================
		containerEl.createEl("h2", { text: "Board" });

		new Setting(containerEl)
			.setName("Theme")
			.setDesc("Board color and texture")
			.addDropdown((dropdown) => {
				dropdown.addOptions(THEME_OPTIONS);
				dropdown.setValue(settings.theme).onChange((theme) => {
					settings.theme = theme as ISettings["theme"];
					this.plugin.saveSettings();
					this.plugin.refresh();
				});
			});

		addSliderWithValue(
			containerEl,
			"Cell size",
			"Adjust board and piece display size",
			settings.cellSize,
			{ min: 15, max: 100, step: 1 },
			"px",
			(v) => {
				settings.cellSize = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		new Setting(containerEl)
			.setName("Layout")
			.setDesc("Toolbar position relative to board")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({ right: "Side", bottom: "Bottom" })
					.setValue(settings.position)
					.onChange((position) => {
						settings.position = position as "bottom" | "right";
						this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});

		new Setting(containerEl)
			.setName("Show coordinates")
			.setDesc("Show file letters and rank numbers on board edges")
			.addToggle((toggle) =>
				toggle.setValue(settings.showCoordinateLabels).onChange((value) => {
					settings.showCoordinateLabels = value;
					this.plugin.saveSettings();
				}),
			);

		// ==================== Game hints ====================
		containerEl.createEl("h2", { text: "Game Hints" });

		new Setting(containerEl)
			.setName("Show last move")
			.setDesc("Highlight the origin and destination of the previous move")
			.addToggle((toggle) =>
				toggle.setValue(settings.showLastMove).onChange((value) => {
					settings.showLastMove = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName("Show legal moves")
			.setDesc("Highlight legal destination squares for the selected piece")
			.addToggle((toggle) =>
				toggle.setValue(settings.showNextMove).onChange((value) => {
					settings.showNextMove = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName("Show turn border")
			.setDesc("Show a highlighted border indicating whose turn it is")
			.addToggle((toggle) =>
				toggle.setValue(settings.showTurnBorder).onChange((value) => {
					settings.showTurnBorder = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		if (window.speechSynthesis) {
			new Setting(containerEl)
				.setName("Speech")
				.setDesc("Read moves aloud (unavailable on mobile)")
				.addToggle((toggle) =>
					toggle.setValue(settings.enableSpeech).onChange((value) => {
						settings.enableSpeech = value;
						this.plugin.saveSettings();
					}),
				);
		}

		// ==================== Movelist ====================
		containerEl.createEl("h2", { text: "Move List" });

		new Setting(containerEl)
			.setName("Show move list")
			.setDesc("Display the full move record and variations beside the board")
			.addToggle((toggle) =>
				toggle.setValue(settings.showMovelist).onChange((value) => {
					settings.showMovelist = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
				}),
			);

		new Setting(containerEl)
			.setName("Show move text")
			.setDesc("Display SAN notation for each move alongside move numbers")
			.addToggle((toggle) =>
				toggle.setValue(settings.showMovelistText).onChange((value) => {
					settings.showMovelistText = value;
					this.plugin.saveSettings();
					this.plugin.refresh();
					this.display();
				}),
			);

		addSliderWithValue(
			containerEl,
			"Move text size",
			"Font size for the move list",
			settings.fontSize,
			{ min: 10, max: 25, step: 1 },
			"px",
			(v) => {
				settings.fontSize = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		new Setting(containerEl)
			.setName("Auto jump")
			.setDesc("Where to position the board when opening a game")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						never: "Never jump",
						always: "Always jump to end",
						auto: "Only for default position",
					})
					.setValue(settings.autoJump)
					.onChange(async (value) => {
						settings.autoJump = value as "never" | "always" | "auto";
						this.plugin.saveSettings();
					});
			});

		// ---- margins ----
		containerEl.createEl("h3", { text: "Board Margins" });

		addSliderWithValue(
			containerEl,
			"Top margin",
			"Space above the board",
			settings.boardMarginTop,
			{ min: 0, max: 100, step: 1 },
			"px",
			(v) => {
				settings.boardMarginTop = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		addSliderWithValue(
			containerEl,
			"Bottom margin",
			"Space below the board",
			settings.boardMarginBottom,
			{ min: 0, max: 100, step: 1 },
			"px",
			(v) => {
				settings.boardMarginBottom = v;
				this.plugin.saveSettings();
				this.plugin.refresh();
			},
		);

		const style = containerEl.createEl("style");
		style.textContent = `
			.xq-slider-value {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 42px;
				height: 24px;
				margin-right: 8px;
				font-size: 13px;
				font-weight: 600;
				color: var(--text-accent);
				background: var(--background-modifier-border);
				border-radius: 4px;
				padding: 0 6px;
			}
			.chess-setting-tab .setting-item {
				border-top: none;
			}
		`;
		containerEl.parentElement?.classList.add("chess-setting-tab");
	}

	async hide() {
		this.plugin.refresh();
	}
}
