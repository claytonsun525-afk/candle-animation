# 灵动蜡烛（网页）

这是一个纯前端静态页面（`Canvas + JavaScript`），打开即可看到灵动蜡烛动画。

## 本地打开（最快）

- 直接双击 `index.html`（浏览器打开）

如果你的浏览器对本地文件有资源限制，也可以用一个本地静态服务器：

- Python 方式（任选其一）：
  - `py -m http.server 8000`
  - `python -m http.server 8000`
- 然后打开：`http://localhost:8000`

## 发布成“任何人都能访问”的网页（最快路线：GitHub Pages）

1. 新建一个 GitHub 仓库（例如 `candle`）
2. 把本目录文件上传到仓库根目录（至少包含 `index.html`、`style.css`、`main.js`）
3. GitHub 仓库 `Settings -> Pages`
4. `Build and deployment` 选择：
   - Source: `Deploy from a branch`
   - Branch: `main` / `root`
5. 保存后等待 1-2 分钟，Pages 会给你一个公开链接

## 操作

- 点击/拖动：制造微风
- `Space`：暂停/继续
- `R`：重置

