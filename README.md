# WebGame 小游戏合集

一个零依赖、适合 GitHub Pages 免费托管的网页小游戏合集。当前包含 2048 和霓虹方块，后续可以继续添加更多小游戏。

在线访问：

```text
https://jayhou2.github.io/webgame/
```

## 当前游戏

- 霓虹方块：`games/tetris/`
- 2048：`games/2048/`

## 项目结构

```text
.
├── index.html              # 小游戏合集首页
├── styles/
│   └── site.css            # 合集首页样式
├── games/
│   ├── tetris/
│   │   ├── index.html      # 霓虹方块游戏页
│   │   ├── style.css       # 霓虹方块样式
│   │   └── game.js         # 霓虹方块逻辑
│   └── 2048/
│       ├── index.html      # 2048 游戏页
│       ├── style.css       # 2048 游戏样式
│       └── game.js         # 2048 游戏逻辑
└── README.md
```

## 霓虹方块说明

`games/tetris/game.js` 使用 `requestAnimationFrame` 驱动渲染，并把渲染目标上限设为 `TARGET_FPS = 90`。实际帧数仍取决于玩家设备、浏览器和屏幕刷新率；如果设备只能稳定 60 FPS，浏览器会自动按实际能力运行。

已包含功能：

- 发光方块和深色霓虹视觉
- 幽灵落点
- 保留方块
- 下一个方块队列
- 软降、硬降、暂停
- 清行动效和粒子
- 电脑键盘与手机按钮操作

## 后续添加新游戏

1. 在 `games/` 下新建一个目录，例如 `games/memory/`。
2. 在新目录里放入该游戏自己的 `index.html`、样式和脚本。
3. 回到根目录的 `index.html`，在游戏列表里新增一张游戏卡片。
4. 如需共享样式，优先放在 `styles/` 目录。

## 广告位

当前预留了这些广告占位：

- 首页顶部 Hero 广告位
- 首页游戏列表下方横幅广告位
- 2048 游戏页顶部/底部广告位
- 霓虹方块游戏页顶部/底部广告位

后续接入广告平台时，可以把 `.ad-slot` 内部的占位文案替换成广告脚本或广告容器。

## 本地运行

建议启动静态文件服务器：

```powershell
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

## 部署

当前 GitHub Pages 使用 `gh-pages` 分支的根目录发布。更新流程：

```powershell
git add .
git commit -m "Update game collection"
git push origin main
git push origin main:gh-pages
```

推送后等待 GitHub Pages 自动刷新即可。
