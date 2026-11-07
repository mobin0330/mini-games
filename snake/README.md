# 经典贪吃蛇

一个无需安装、无需联网即可游玩的经典单人贪吃蛇页面。棋盘为 20 × 20，初始蛇长 3 格，吃到食物得 10 分，碰到墙壁或自身结束。

## 操作

- 方向键或 WASD：转向
- 空格：暂停 / 继续
- 开始、暂停、重新开始按钮：控制游戏状态
- 手机：使用棋盘下方的四方向按钮，或在棋盘上滑动
- 切换到其他标签页时游戏会自动暂停，回到页面后不会自行继续

## 本地功能

- 当前分与本机最高分显示在计分区
- 最高分保存在 `localStorage`；存储不可用时会自动退化为仅当前会话有效，不影响游玩
- 棋盘使用 canvas 并按设备像素比绘制，状态文字通过 `aria-live` 播报

## 文件

- `index.html`：页面结构与固定 DOM 节点
- `styles.css`：暖纸背景与响应式布局
- `engine.js`：确定性游戏引擎（题目提供，未修改）
- `app.js`：界面、计时器、键盘、触控与存储逻辑
- `tests/ui.test.cjs`：界面逻辑与静态结构测试

## 测试

在项目根目录运行：

```sh
/opt/homebrew/bin/node --test acceptance/engine.contract.cjs acceptance/ui.contract.cjs tests/engine.test.cjs tests/ui.test.cjs
```
