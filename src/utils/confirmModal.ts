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
  private readonly fileRows: {
    name: string;
    url: string;
    status: HTMLSpanElement;
    nameSpan: HTMLSpanElement;
  }[] = [];
  private downloadBtn!: HTMLButtonElement;

  constructor(
    app: App,
    private readonly title: string,
    private readonly files: { name: string; url: string }[],
    private readonly confirmText: string,
    private readonly cancelText: string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("p", { text: this.title });

    for (const file of this.files) {
      const row = contentEl.createEl("p");

      const nameSpan = row.createSpan({ text: file.name });
      row.appendText("（");
      const link = row.createEl("a", {
        text: "GitHub",
        attr: { href: file.url, target: "_blank" },
      });
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(file.url, "_blank");
      });
      row.appendText("）");

      const status = contentEl.createSpan({ cls: "download-status", text: "" });

      this.fileRows.push({
        name: file.name,
        url: file.url,
        status,
        nameSpan,
      });
    }

    const btnContainer = contentEl.createDiv("modal-button-container");

    this.downloadBtn = btnContainer.createEl("button", {
      text: this.confirmText,
      cls: "mod-cta",
    });
    this.downloadBtn.addEventListener("click", () => {
      this.resolvePromise(true);
    });

    const cancelBtn = btnContainer.createEl("button", {
      text: this.cancelText,
    });
    cancelBtn.addEventListener("click", () => {
      this.resolvePromise(false);
      this.close();
    });
  }

  showProgress(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.status.textContent = "⏳";
    this.downloadBtn.disabled = true;
  }

  done(index: number) {
    const row = this.fileRows[index];
    if (!row) return;
    row.nameSpan.textContent = row.name + " ✓";
    row.status.textContent = "";
    const allDone = this.fileRows.every((r) =>
      r.nameSpan.textContent?.includes("✓"),
    );
    if (allDone) {
      window.setTimeout(() => this.close(), 500);
    }
  }

  error(index: number, msg: string) {
    const row = this.fileRows[index];
    if (!row) return;
    row.status.textContent = msg;
    this.downloadBtn.disabled = false;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
