import { type App, Modal, Setting } from "obsidian";

export type SaveConfirmResult = {
  action: "save" | "saveAll" | "cancel";
  includeEval: boolean;
};

export class SaveConfirmModal extends Modal {
  private resolvePromise: (value: SaveConfirmResult) => void;
  public promise: Promise<SaveConfirmResult>;
  private includeEval = true;

  constructor(
    app: App,
    private readonly hasBranches: boolean,
    private readonly hasEval: boolean,
    private readonly t: (key: string) => string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName(this.t("confirm.saveTitle")).setHeading();

    if (this.hasEval) {
      new Setting(contentEl)
        .setName(this.t("confirm.saveEval"))
        .addToggle((toggle) => {
          toggle.setValue(this.includeEval).onChange((val) => {
            this.includeEval = val;
          });
        });
    }

    if (this.hasBranches) {
      contentEl.createEl("p", { text: this.t("confirm.saveBranchesMsg") });

      const btnContainer = contentEl.createDiv("modal-button-container");

      const saveMainBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveMain"),
        cls: "mod-cta",
      });
      saveMainBtn.addEventListener("click", () => {
        this.resolvePromise({ action: "save", includeEval: this.includeEval });
        this.close();
      });

      const saveAllBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveAll"),
      });
      saveAllBtn.addEventListener("click", () => {
        this.resolvePromise({ action: "saveAll", includeEval: this.includeEval });
        this.close();
      });

      const cancelBtn = btnContainer.createEl("button", {
        text: this.t("confirm.cancel"),
      });
      cancelBtn.addEventListener("click", () => {
        this.resolvePromise({ action: "cancel", includeEval: this.includeEval });
        this.close();
      });
    } else {
      contentEl.createEl("p", { text: this.t("confirm.saveMsg") });

      const btnContainer = contentEl.createDiv("modal-button-container");

      const confirmBtn = btnContainer.createEl("button", {
        text: this.t("confirm.saveBtn"),
        cls: "mod-cta",
      });
      confirmBtn.addEventListener("click", () => {
        this.resolvePromise({ action: "save", includeEval: this.includeEval });
        this.close();
      });

      const cancelBtn = btnContainer.createEl("button", {
        text: this.t("confirm.cancel"),
      });
      cancelBtn.addEventListener("click", () => {
        this.resolvePromise({ action: "cancel", includeEval: this.includeEval });
        this.close();
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ConfirmModal extends Modal {
  private resolvePromise: (value: boolean) => void;
  public promise: Promise<boolean>;

  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly confirmText = "确认",
    private readonly cancelText = "取消",
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;

    // 标题
    new Setting(contentEl).setName(this.title).setHeading();

    // 消息内容
    contentEl.createEl("p", { text: this.message });

    // 按钮容器
    const buttonContainer = contentEl.createDiv("modal-button-container");

    // 确认按钮（使用 Obsidian 的主色调样式）
    const confirmBtn = buttonContainer.createEl("button", {
      text: this.confirmText,
      cls: "mod-cta", // Obsidian 的强调按钮样式
    });
    confirmBtn.addEventListener("click", () => {
      this.resolvePromise(true);
      this.close();
    });

    // 取消按钮
    const cancelBtn = buttonContainer.createEl("button", {
      text: this.cancelText,
    });
    cancelBtn.addEventListener("click", () => {
      this.resolvePromise(false);
      this.close();
    });

    // 回车键确认，ESC 键取消
    confirmBtn.focus();
    this.scope.register([], "Enter", () => {
      this.resolvePromise(true);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class DownloadModal extends Modal {
  private resolvePromise: (value: boolean) => void;
  public promise: Promise<boolean>;
  private progressBar!: HTMLProgressElement;
  private statusEl!: HTMLElement;
  private cancelBtnEl!: HTMLButtonElement;
  public abortController: AbortController = new AbortController();

  constructor(
    app: App,
    private readonly fileName: string,
    private readonly downloadUrl: string,
    private readonly confirmText: string,
    private readonly cancelText: string,
    private readonly manualText: string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("p", { text: this.fileName });

    this.progressBar = contentEl.createEl("progress", {
      cls: "download-progress",
    });
    this.progressBar.value = 0;
    this.progressBar.style.width = "100%";
    this.progressBar.style.display = "none";

    this.statusEl = contentEl.createEl("p", {
      cls: "download-status",
      text: "",
    });

    const btnContainer = contentEl.createDiv("modal-button-container");

    const downloadBtn = btnContainer.createEl("button", {
      text: this.confirmText,
      cls: "mod-cta",
    });
    downloadBtn.addEventListener("click", () => {
      this.resolvePromise(true);
    });

    this.cancelBtnEl = btnContainer.createEl("button", {
      text: this.cancelText,
    });
    this.cancelBtnEl.addEventListener("click", () => {
      this.abortController.abort();
      this.resolvePromise(false);
      this.close();
    });

    const manualLink = btnContainer.createEl("a", {
      text: this.manualText,
      cls: "download-manual-link",
      attr: { href: this.downloadUrl, target: "_blank" },
    });
    manualLink.style.marginLeft = "12px";
    manualLink.style.fontSize = "0.85em";
    manualLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(this.downloadUrl, "_blank");
    });
  }

  showProgress() {
    this.progressBar.style.display = "block";
    const downloadBtn = this.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
    if (downloadBtn) downloadBtn.disabled = true;
  }

  setProgress(loaded: number, total: number) {
    this.progressBar.value = loaded;
    this.progressBar.max = total;
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    this.statusEl.textContent = `${mb(loaded)} / ${mb(total)} MB`;
  }

  done() {
    this.statusEl.textContent = "✓";
    this.progressBar.value = this.progressBar.max;
    setTimeout(() => this.close(), 500);
  }

  error(msg: string) {
    this.statusEl.textContent = msg;
    const buttons = this.contentEl.querySelectorAll("button");
    buttons.forEach((b) => ((b as HTMLButtonElement).disabled = false));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
