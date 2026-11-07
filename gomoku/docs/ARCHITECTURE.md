# 五子棋架构与验收合同（Codex）
范围：本地浏览器双人五子棋，15×15，黑先、交替落子，任意方向连续 >=5 胜，无禁手。支持悔棋、重新开始、胜负/和棋提示、最后一手标记，适配手机和键盘操作。无联网、AI、账号、依赖包、构建流程。

## 模块
- engine.js：浏览器全局 Gomoku，同时 CommonJS 导出（可直接 file:// 打开）。纯规则，无 DOM。
- index.html + styles.css + app.js：中文 UI，用按钮网格或 canvas+可访问交互。木色棋盘、清楚黑白子、状态区域、操作按钮。UI 调用引擎；非法操作无状态变更。
- tests/engine.test.cjs、tests/ui.test.cjs：Node 内置 node:test；不得依赖 npm install、CDN 或网络。

## 固定引擎 API
createGame() => {board: 15x15 数字数组(0空/1黑/2白), currentPlayer:1, winner:0, draw:false, history:[], winningLine:[]}
play(game,row,col) => boolean。成功更新原对象、history push {row,col,player}；失败返回 false，不抛出且不改变任何状态。拒绝非整数/越界/占用/终局。胜利时 winner 为玩家，winningLine 为获胜方向连续棋坐标数组 {row,col}，currentPlayer 保持赢家；正常落子切换玩家。满盘无胜 draw=true。
undo(game) => boolean。撤销最后一步（含终局），currentPlayer 恢复被撤销方，清空 winner/draw/winningLine；无历史 false。
reset(game) => 原对象，完全回到初始状态。
导出 {createGame,play,undo,reset}。

## Task engine
只写 engine.js 和 tests/engine.test.cjs。测试覆盖四个方向、边界与超过五连、非法输入不变、交替、终局禁止落子、悔棋/终局悔棋、重开、满盘和棋（合法无五连棋型）。验收 node --test tests/engine.test.cjs。

## Task ui
继承 engine，仅写 index.html/styles.css/app.js/tests/ui.test.cjs/README.md。实现完整可玩 UI 和简短启动说明（双击 index.html 或 python3 -m http.server）。提供基于 Node VM/最小 DOM 假对象的实际 UI 行为测试：初始225格、落子与轮转、占用不重复、悔棋、重开、终局反馈；不要仅检查源码字符串。键盘至少支持 Tab/Enter 落子；状态 aria-live。胜利棋高亮，终局禁用后续落子。不得修改引擎或其测试。验收 node --test tests/engine.test.cjs tests/ui.test.cjs。

实现/测试全部由 OpenCode 编写。不要写任何执行配置、提交/推送/部署；AgentFlow 负责保存候选提交。
