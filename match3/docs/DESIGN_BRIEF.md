# 甜品消消乐 · 设计与验收要点

Operate / existing Game visual system. 中文 UI，甜品柜台视觉：暖奶油纸底、草莓红主操作、焦糖金描边、圆角卡片。六种甜品使用自制 SVG 素材并保留各自轮廓与颜色，方便色觉差异用户区分。移动端 360 / 390px 棋盘优先。返回链接 `/` 与 `https://home.ericmo.top`。不展示执行 ID。

外部资源仅限本局内置的 `assets/*.svg` 与 `audio/*.mp3`，由 `game/app.py` 显式白名单提供；不使用 CDN、远程字体、内联脚本或内联样式。图片生成不可用时所使用的素材均为项目内 SVG；甜品 SVG 的 `viewBox` 已裁切到内容边界，让核心图案在格子中占比约 90% 以上。音效来自 Kenney CC0 音频包，背景音乐为 OpenGameArt 的 CC0 曲目 `Happy Adventure (Loop)`，来源见 `audio/CREDITS.md`。

## 手感与节奏

- 交换动画约 100ms；点击第二块后约 110ms 内开始消除，避免等待感。
- 同一次消除按阅读顺序逐格错开约 8ms 破碎，最多错开 72ms；碎片、冲击环、玻璃破碎音与短闪同时出现。
- 下落按列错开约 5ms，并按实际掉落行数设置位移距离；最后一段下落后约 36ms 解锁，基础消除整体约 0.5 秒。
- 连锁之间保留约 64ms 呼吸拍，让玩家看清第二次消除；Combo 徽章、音高与震动逐层增强。
- 选中方块持续呼吸，按下时立即缩放；页面背景有缓慢漂浮的光斑/糖粒，棋盘有扫光，BGM 在首次手势后循环播放。所有持续动画在 `prefers-reduced-motion` 下停止。

## 玩法与固定引擎 API

不限时、不限步数，记录得分、步数、最高分；最高分存 `localStorage.match3.best`，异常时降级。8 × 8 棋盘，六种基础甜品。点击或指针滑动交换相邻甜品；键盘方向键移动焦点，Enter / 空格选择，Esc 取消。提示高亮一组可行交换，不消耗步数；重开安全取消旧动画定时器。没有可行交换时自动重排并保留分数与步数。界面提供实时文字反馈、focus-visible、减少动态效果支持，结算期间锁定输入。

特殊甜品（强化玩法）：

- 四连生成横 / 竖火箭糖，清除整行 / 整列；方向与连成方向一致。
- T / L 型消除生成巧克力炸弹，清除 3 × 3。
- 五连生成彩虹棒棒糖，与任意甜品交换时清除全场同色甜品。
- 特殊甜品被卷入消除时按链式顺序触发，每次只激活一次。
- 连锁 Combo 逐层提升倍率、音高、震动与屏幕反馈。

`engine.js` 同时导出 CommonJS 与 `window.Match3Engine`，纯同步、无 DOM / storage / timer 依赖。导出：`createGame`, `findMatches`, `findGroups`, `findMove`, `swap`, `reshuffle`, `tileType`, `specialKind`, `isRainbow`, `makeSpecial`, `SPECIAL`。

棋盘值编码：`0..5` 为普通甜品；`type + 6 * kind` 为保留颜色的特殊甜品；`kind` 为 1 横火箭、2 竖火箭、3 炸弹、4 彩虹。彩虹不参与普通同色匹配。

`createGame({random=Math.random}={})` 返回 `{board:Array(64),score:0,moves:0,random}`，初始棋盘稳定且有合法交换；生成有界，常量随机也能终止。`findMatches(board)` 返回排序去重的横 / 竖三连及以上索引，不跨行 / 列回绕。`findGroups` 返回带方向、长度、类型的连续组。`findMove(board)` 返回 `[a,b]` 或 `null`，不修改棋盘；彩虹相邻即视为合法。

`swap(game,a,b)` 返回 `{valid,cascades,reshuffled}`。非法索引、非相邻、交换后无匹配时返回 `valid:false` 且不修改棋盘 / 分数 / 步数；彩虹交换总是合法。合法交换只增加一次步数，随后消除、下落、连锁至稳定。每个 cascade 条目包含 `{indices, board, after, depth, groups, spawns, activated, gained}`：`board` 为消除前快照，`after` 为补位并生成特殊糖后的快照，`activated` 为本轮触发的特殊糖索引。计分：`round((消除格数 × 20 + 超出三连的额外格数 × 15 + 触发特殊糖数 × 30) × 连锁倍率)`，倍率依次为 1 / 1.5 / 2 / 3 / 4（后续保持 4）。分数增量必须等于各 cascade `gained` 之和。连锁与生成均有有限保护；无可走步时自动重排。

`reshuffle(game)` 生成稳定可玩棋盘并保留分数与步数。

## UI 契约

`index.html` 按顺序外链 `engine.js`、`sfx.js`、`app.js`（defer）与 `styles.css`。必备 ID：`board`, `score`, `best`, `moves`, `status`, `hint`, `restart`, `sound`, `haptics`, `combo`, `record`, `fx`, `flash`, `score-fx`, `stage`。棋盘含 64 个 button tile，具备 grid/gridcell 语义与 roving tabindex；棋盘内另有一个 `aria-hidden` 的扫光装饰层，不参与 grid 语义。规则、键盘说明、声音 / 震动开关可见且可持久化。`app.js` 只通过 `Match3Engine` 与 `Match3SFX` 工作。

测试必须执行真实 `app.js` 绑定（DOM harness 或浏览器），覆盖选择、无效 / 有效交换、连锁 Combo 徽章、特殊糖出现时机、音效与震动开关、提示、重开、键盘、存储失败与动画锁定。不得只断言源码字符串。
