# Simple Mind

一个面向 Obsidian 的 Markdown 大纲思维导图插件。

> 状态：早期开发中。导图视图、编辑交互、主题和设置正在按 `doc/design-simple-mind.md` 实现。

## 它做什么

Simple Mind 把思维导图保存为可读的 `.mindmap` 文件：

```markdown
---
mindmap:
  version: 1
  theme: obsidian
  layout: mindmap
  spacingX: 64
  spacingY: 18
  maxWidth: 280
---
# 产品计划
- 调研
  - 用户访谈
  - 竞品扫描
- 交付
  - 核心编辑器
  - 主题系统
```

文件默认以导图打开；点击 Source 会在同一标签页切换到 Obsidian 原生 Markdown 编辑器。

## 目标功能

- 四种布局：思维导图、向右树图、向左树图、组织架构图。
- 直接编辑：新增、修改、删除、折叠、拖拽、复制粘贴、撤销和重做。
- 8 套内置主题，跟随 Obsidian 明暗切换，并支持自定义主题编辑器。
- “样式 / 文本”面板作用于选中节点；连线形状按导图设置，连线的颜色和粗细在设置页配置。
- 悬停控件：连线配色的圆润收展符号、隐藏节点数量圆钮，以及按布局方向浮动的添加按钮。
- 英文和中文界面。
- 桌面端单图 1,000 节点的性能目标。

## 开发安装

1. 安装依赖：

   ```bash
   npm install
   ```

2. 构建一次，或启动监听：

   ```bash
   npm run build
   npm run dev
   ```

3. 把 `test-vault` 作为 Obsidian 库打开。构建会把插件写入
   `test-vault/.obsidian/plugins/simple-mind`。

4. 重新构建后在 Obsidian 中重载插件。Obsidian 默认不会热重载社区插件。

## 源码规则

- 有且只有一个 H1 根节点。
- 根节点下是一棵嵌套无序列表。
- 节点文字是单行基础行内 Markdown。
- 单节点样式保存在该行末尾的 `<!-- sm:{...} -->` 注释中。
- 源码不合法时显示带行号的错误，并锁定地图编辑，避免覆盖内容。
- 地图写回文件时会规范化空行和列表符号。

## 开发命令

```bash
npm run dev        # 监听 TypeScript 与 CSS，并同步测试库
npm run build      # 生产构建
npm run typecheck  # TypeScript 检查
npm run lint       # Biome 检查
npm run test       # 单元测试
```

## 架构

- `src/pages`：Obsidian 视图生命周期。
- `src/components`：导图画布、设置、源码切换和导图引擎。
- `src/types`：共享 TypeScript 类型。
- `src/styles`：CSS 源码，打包为 `styles.css`。
- `src/api`：Obsidian 适配层。
- `src/config`：常量、默认值、i18n 和主题预设。

导图使用 HTML 节点和 SVG 连线；布局、渲染和编辑均为本地实现，不依赖思维导图运行时库。

## 文档

- `doc/prd.md`
- `doc/design-simple-mind.md`
- `doc/plan-simple-mind.md`

## 许可证

MIT。Copyright (c) 2026 fickit.
