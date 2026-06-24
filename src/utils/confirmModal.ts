import { type App, Modal, Setting } from 'obsidian';

export class SaveConfirmModal extends Modal {
  private resolvePromise: (value: 'save' | 'saveAll' | 'cancel') => void;
  public promise: Promise<'save' | 'saveAll' | 'cancel'>;

  constructor(
    app: App,
    private hasBranches: boolean,
    private t: (key: string) => string,
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName(this.t('confirm.saveTitle')).setHeading();

    if (this.hasBranches) {
      contentEl.createEl('p', { text: this.t('confirm.saveBranchesMsg') });

      const btnContainer = contentEl.createDiv('modal-button-container');

      const saveMainBtn = btnContainer.createEl('button', {
        text: this.t('confirm.saveMain'),
        cls: 'mod-cta',
      });
      saveMainBtn.addEventListener('click', () => {
        this.resolvePromise('save');
        this.close();
      });

      const saveAllBtn = btnContainer.createEl('button', {
        text: this.t('confirm.saveAll'),
      });
      saveAllBtn.addEventListener('click', () => {
        this.resolvePromise('saveAll');
        this.close();
      });

      const cancelBtn = btnContainer.createEl('button', {
        text: this.t('confirm.cancel'),
      });
      cancelBtn.addEventListener('click', () => {
        this.resolvePromise('cancel');
        this.close();
      });
    } else {
      contentEl.createEl('p', { text: this.t('confirm.saveMsg') });

      const btnContainer = contentEl.createDiv('modal-button-container');

      const confirmBtn = btnContainer.createEl('button', {
        text: this.t('confirm.saveBtn'),
        cls: 'mod-cta',
      });
      confirmBtn.addEventListener('click', () => {
        this.resolvePromise('save');
        this.close();
      });

      const cancelBtn = btnContainer.createEl('button', {
        text: this.t('confirm.cancel'),
      });
      cancelBtn.addEventListener('click', () => {
        this.resolvePromise('cancel');
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
    private title: string,
    private message: string,
    private confirmText = '确认',
    private cancelText = '取消',
  ) {
    super(app);
    this.resolvePromise = () => {};
    this.promise = new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;

    // 标题
    new Setting(contentEl).setName(this.title).setHeading();

    // 消息内容
    contentEl.createEl('p', { text: this.message });

    // 按钮容器
    const buttonContainer = contentEl.createDiv('modal-button-container');

    // 确认按钮（使用 Obsidian 的主色调样式）
    const confirmBtn = buttonContainer.createEl('button', {
      text: this.confirmText,
      cls: 'mod-cta', // Obsidian 的强调按钮样式
    });
    confirmBtn.addEventListener('click', () => {
      this.resolvePromise(true);
      this.close();
    });

    // 取消按钮
    const cancelBtn = buttonContainer.createEl('button', {
      text: this.cancelText,
    });
    cancelBtn.addEventListener('click', () => {
      this.resolvePromise(false);
      this.close();
    });

    // 回车键确认，ESC 键取消
    confirmBtn.focus();
    this.scope.register([], 'Enter', () => {
      this.resolvePromise(true);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
