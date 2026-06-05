# Pre-release Workflow with Artifact Attestation

## 目标

为 Obsidian-chess-tree 添加 GitHub Actions 工作流，使其在推送版本 tag 时自动构建并发布预发布（pre-release），同时为构建产物添加 GitHub Artifact Attestations（构建来源证明）。

## 背景

参考项目 [obsidian-xiangqi](https://github.com/west-shell/obsidian-xiangqi) 已有成熟的预发布工作流。Obsidian-chess-tree 作为同类型的 Obsidian 插件，采用相同模式。

## 触发条件

- `push` 事件，匹配 tag 模式：`[0-9]+\.[0-9]+\.[0-9]+`（正式版）和 `[0-9]+\.[0-9]+\.[0-9]+-*`（预发布版）

## 所需权限

```yaml
permissions:
  contents: write      # 创建 release
  id-token: write      # OIDC token（attestation 需要）
  attestations: write  # 创建构建来源证明
```

## 工作流步骤

| 步骤 | Action | 说明 |
|------|--------|------|
| 1. Checkout | `actions/checkout@v4` | 拉取代码 |
| 2. Setup Node.js | `actions/setup-node@v4` | Node 20 |
| 3. Install dependencies | `npm ci` | 安装依赖（chess.js, chessground 为 npm 包，无需额外 checkout） |
| 4. Build | `npm run build` | 生产构建，输出到 `build/` 目录 |
| 5. Attest | `actions/attest-build-provenance@v2` | 为 `build/main.js`, `build/manifest.json`, `build/styles.css` 生成构建来源证明 |
| 6. Release | `softprops/action-gh-release@v2` | 创建预发布，附带构建产物和自动生成的 release notes |

## 发布产物

- `build/main.js` — 插件主代码
- `build/manifest.json` — 插件元数据
- `build/styles.css` — 插件样式

## 与 obsidian-xiangqi 的区别

| 项目 | 子仓库依赖 | npm 外部依赖 |
|------|-----------|-------------|
| obsidian-xiangqi | xiangqi.js, xiangqiground（需 git checkout） | 无 |
| obsidian-chess-tree | 无 | chess.js, chessground（npm install） |

## 安全性

- 使用 `actions/attest-build-provenance@v2` 生成 Sigstore 构建来源证明，确保发布产物的可验证性
- 产物可通过 `gh attestation verify` 命令验证
- 使用 `npm ci` 而非 `npm install`，确保依赖锁定的确定性
