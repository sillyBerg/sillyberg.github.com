# 我的任务清单

一个纯静态的个人任务清单 Web 应用：无后端、无构建步骤、无第三方依赖，用浏览器打开就能用。

## 功能

- 新增任务，可设置截止日期与优先级（重要 / 普通 / 低）
- 完成、取消完成、编辑（双击标题、按回车或点铅笔按钮）、删除（6 秒内可撤销）
- 筛选：全部 / 未完成 / 今天（今天到期或已逾期）/ 已完成
- 按标题搜索，统计未完成、已完成与逾期数量
- 截止日期提示：今天到期、明天到期、逾期天数
- 浅色 / 深色主题，默认跟随系统，也可手动切换
- 移动端自适应，键盘可操作，`prefers-reduced-motion` 下关闭动效
- 数据保存在浏览器 `localStorage`，刷新或关闭页面都不丢

## 本地预览

```sh
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

也可以直接用浏览器打开 `index.html`。

## 部署

站点按 GitHub Pages 的项目站点发布：

1. 仓库 Settings → Pages
2. Source 选 "Deploy from a branch"，分支 `master`，目录 `/ (root)`
3. 稍等一两分钟，访问 `https://sillyberg.github.io/sillyberg.github.com/`

`.nojekyll` 让 Pages 跳过 Jekyll 处理，静态文件原样发布。

## 目录结构

```
index.html          页面骨架
assets/style.css    样式（浅色/深色主题、响应式）
assets/app.js       状态、渲染、筛选、localStorage 持久化
.nojekyll           关闭 GitHub Pages 的 Jekyll 处理
```

## 键盘与可访问性

- 在输入框按回车即可添加任务
- 聚焦任务标题后按回车或空格进入编辑；`Esc` 取消编辑
- 所有筛选按钮维护 `aria-pressed`，操作均有可读的 `aria-label`
- 焦点样式使用 `:focus-visible`，主题与对比度均按可访问性要求设计

## 数据说明

任务只保存在**当前浏览器**的 `localStorage` 里：

- 任务键名：`sillyberg.tasklist.v1`
- 主题键名：`sillyberg.tasklist.theme`

换设备、换浏览器或清除站点数据后不会同步，也不会自动恢复。需要多设备同步就得引入后端或第三方存储，那超出静态站的范围。
