# 2048 数字合成小游戏

一个零依赖、适配电脑和手机的 2048 网页小游戏。直接用浏览器打开即可游玩，也可以部署到 GitHub Pages 免费托管。

## 玩法

- 电脑：使用方向键或 `WASD`
- 手机：在棋盘上向任意方向滑动
- 两个相同数字相撞会合并，目标是合成 `2048`
- 支持撤销一步、最高分记录和自动保存当前进度

## 本地运行

直接打开 `index.html`，或启动任意静态文件服务器：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库。
2. 打开仓库的 `Settings`。
3. 进入 `Pages`。
4. 在 `Build and deployment` 中选择 `Deploy from a branch`。
5. 选择 `main` 分支和 `/ (root)` 目录。
6. 保存后等待 GitHub 生成访问地址。

部署完成后，朋友就可以通过 GitHub Pages 地址在线游玩。
