# sillyberg.github.com

一个纯静态的个人待办（Todo）Web 应用，无后端、无构建步骤、无第三方依赖。

## 功能

- 新增、编辑（双击或回车）、完成、删除任务
- 筛选：全部 / 未完成 / 已完成
- 剩余计数、清除已完成
- 数据保存在浏览器 `localStorage`，刷新或关闭页面都不丢
- 跟随系统的深色模式、移动端自适应、键盘可操作

## 本地预览

```sh
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

或直接用浏览器打开 `index.html`。

## 部署

站点按 GitHub Pages 的项目站点发布：

1. 仓库 Settings → Pages
2. Source 选 "Deploy from a branch"，分支 `master`，目录 `/ (root)`
3. 稍等一两分钟，访问 `https://sillyberg.github.io/sillyberg.github.com/`

`.nojekyll` 让 Pages 跳过 Jekyll 处理，静态文件原样发布。

## 目录结构

```
index.html          页面骨架
assets/style.css    样式（含深色模式与响应式）
assets/app.js       状态、渲染、localStorage 持久化
.nojekyll           关闭 GitHub Pages 的 Jekyll 处理
```

## 数据说明

任务只保存在**当前浏览器**的 `localStorage` 里（键名 `sillyberg.todo.v1`）。换设备、换浏览器或清除站点数据后不会同步，也不会自动恢复。需要多设备同步的话，得引入后端或第三方存储，那已经超出静态站的范围。

## 可访问性

- 表单有可见标签（视觉隐藏但仍被读屏读取）
- 筛选按钮维护 `aria-pressed`
- 所有操作可用键盘完成：Tab 聚焦、Enter 编辑、Esc 取消
- 焦点样式使用 `:focus-visible`
