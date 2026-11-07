# 经典贪吃蛇：设计纲领与固定接口

## 产品目标
在小游戏站点 /snake/ 提供可立即开始的经典单人贪吃蛇。桌面与手机均可玩；从 Home → 游戏主页 → 贪吃蛇进入，随时返回。无需安装、联网对战、云端排行榜或额外账号。认证和发布由现有游戏服务承担，工作者只做游戏源码。

## 玩法与边界
20×20 格子，初始蛇长 3、水平向右、每次吃食物得 10 分；食物绝不生成在蛇身。碰墙或碰自身结束，不穿墙。允许进入本 tick 会移走的尾格（非进食时）；填满棋盘显示胜利。每 tick 最多接受一次转向，禁止立即反向，也不能通过两次快速按键绕过。移动和碰撞为纯确定性引擎，独立于 DOM/定时器。提供开始、暂停/继续、重新开始；开始前不移动。切后台自动暂停，恢复页面不擅自继续。支持方向键、WASD、空格暂停，以及屏幕四方向按钮和滑动。

## 固定引擎 API（不可变）
engine.js 同时导出 CommonJS module.exports 与浏览器 globalThis.SnakeEngine。
导出 SIZE=20、createGame(options={})、startGame(game)、setDirection(game,direction)、tick(game)、togglePause(game)。
方向只接受 'up','down','left','right'。
createGame({size=20,random=Math.random}) 返回可变对象：
- size：棋盘边长，最小 4；snake：头在首位的 {x,y} 数组；
- 初始蛇头为 floor(size/2), floor(size/2)，其后两格依次向左；
- direction='right'，pendingDirection=null，score=0，status='ready'；
- food 为一个空格坐标；持有供后续生成食物使用的 random 函数。
startGame 仅 ready→running，返回布尔。
setDirection 仅 running 且本 tick 无排队方向时接受有效非反向方向，设 pendingDirection，返回布尔；拒绝不改变状态。接受同向请求也占一个 tick 的输入槽。
tick 仅 running 时移动，返回是否执行该 tick；非 running 返回 false 且不改变状态。先消费 pendingDirection，再判碰撞。碰撞置 status='gameover'，蛇不移动。吃到食物蛇增长、score+=10、重新从剩余空格中选 food；无空格 status='won', food=null。
togglePause 仅 running↔paused 返回 true，其他状态返回 false。
UI 必须调用上述接口，不复制移动/碰撞规则。

## 视觉与交互
延续游戏主页暖纸背景 #f6f4ed、深墨 #24382e、绿 #24583e，棋盘浅绿、蛇深绿、食物暖橙红。以棋盘为核心，不做卡片套卡片、外部字体、图片或 CDN。中文简短文案，状态明确“准备开始 / 进行中 / 已暂停 / 游戏结束 / 你赢了”。手机 360px 无横向溢出；按钮触控区域至少 44px；可见键盘焦点。棋盘支持高 DPI 缩放，计分区有当前分与本机最高分；localStorage 不可用时仍可玩。空格/方向键只在游戏控制上下文拦截，不吞按钮的 Enter/Space。游戏区可用 canvas，必须有可读状态替代。
固定 DOM：#board 是 canvas，#score/#best/#status 为文字节点，#start/#pause/#restart 为按钮；四个方向按钮带 data-direction。状态 aria-live，页面有 href="/" 的游戏主页链接和 https://home.ericmo.top 链接。
保留开始按钮在运行/暂停时禁用；暂停按钮仅 running/paused 可用；重开销毁旧计时器，回到 ready 并允许开始。任意时刻最多一个游戏计时器。

## 文件与安全约束
只生成 engine.js、index.html、styles.css、app.js、指定 tests 文件。外部验收 acceptance/ 不得修改。禁止写认证代码、Cookie、fetch 登录、服务端、部署脚本。CSS/JS 全部外置，符合 CSP script-src/style-src self。不得读取其他项目、API Key、全局配置；不得改 git 配置、运行 git commit/push。只按需读此任务文件和本子项目代码，不读取完整 PRD 或旧日志。

## 验收
固定引擎合同测试由 Codex 编写；OpenCode 另写自身单测，须覆盖状态切换、增长、碰撞和快速输入。UI 验收验证必要 DOM、外部资源路径、全局接口、无网络依赖。Codex 完成真实浏览器的开始、转向、暂停、重开与手机布局检查。
