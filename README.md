# Bangumi 补标助手

按季度浏览动画，勾选你早就看过、却一直没标记的作品，批量补标为「看过」。

## 功能

- 按季度（春 / 夏 / 秋 / 冬）浏览热门动画，分页加载。
- 点击「关联作品」展开续集、前传、主线故事，一条线上一起补，避免漏掉第 2 季。
- 自动同步你在 Bangumi 的现有收藏，已标记的作品会置灰跳过。
- 批量提交：先设为私密再公开，避免收藏事件刷屏时间线。
- 选中项、季度缓存、关联缓存写入 localStorage，刷新后继续。

## 快速开始

需要 Node.js 22+ 与 pnpm。

```bash
pnpm install
pnpm dev      # 开发服务器 http://localhost:8080
pnpm build    # 产物输出到 dist/
pnpm typecheck
```

## 使用步骤

1. 登录 [Bangumi 主站](https://bgm.tv/login)。
2. 到 [next.bgm.tv/demo/access-token/create](https://next.bgm.tv/demo/access-token/create) 创建 Access Token，并勾选「收藏」相关的写入权限。
3. 把 Token 粘贴到页面首页，验证通过后进入主界面。
4. 选择季度、勾选看过的作品，点提交。

## 说明

- 纯前端应用，没有后端；所有请求由浏览器直连 `https://api.bgm.tv`。
- Access Token 保存在浏览器 localStorage，不会离开本机。公共电脑上使用后请及时登出，或清除站点数据。
- 提交分两阶段：先把选中项标记为私密，再取消私密。若第二阶段部分失败，条目会停留在私密状态，重新提交对应条目即可修复。

## 技术栈

TypeScript + [Rspack](https://rspack.dev/)（SWC loader、内置 CSS 支持），无框架，直接操作 DOM。
