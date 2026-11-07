# 重力风暴：零向协议

Godot 4.5.2 / GDScript，单人 2D 重力、传送门与物理解谜游戏。首个可玩版本 0.1：四章八个独立谜题房、两类守卫、三阶段中枢回路与双结局。角色、跑步/攻击等动作、四章背景及机械机关使用专门生成的 PNG 美术；没有以色块代替角色或场景的正式渲染。

## 开始游玩

- 网页：[小游戏首页](https://game.ericmo.top/) → **重力风暴：零向协议**，或 [直接进入](https://game.ericmo.top/zero-axis/)。沿用小游戏统一邮件门禁。首次下载约 61 MB；电脑键盘和鼠标/触控板优先。
- 本机源码：将 `project.godot` 导入 Godot 4.5.2 并按 F5 运行。桌面和 Web 导出步骤见下。

## 操作

| 操作 | 默认键位 |
|---|---|
| 沿当前地面移动 | A / D |
| 跳跃 / 冲刺 | Space / Shift |
| 世界坐标重力方向 | 方向键 |
| 暂停选择重力方向 | 按住 G，移动鼠标，松开确认 |
| 蓝门 / 橙门 | 鼠标瞄准浅色表面，Q / E |
| 收回两扇传送门 | X |
| 搬运、释放货箱 / 操作结局终端 | F |
| 能量刀 | J |
| 当前谜题房重试 / 暂停 | R / Esc |

移动、跳跃、冲刺、重力盘、双门、搬运、攻击和重试可在设置重新绑定；重绑定拒绝占用键。改变重力不会清除现有速度。空中只允许一次主动重写，着地恢复。重力场覆盖角色自己的重力；离场恢复。出口空间不足时不会传送。

## 存档与设置

自动保存解锁关卡、最近关卡、最快用时/死亡数、结局及设置到 Godot `user://progress.json`。macOS 通常在 `~/Library/Application Support/Godot/app_userdata/重力风暴：零向协议/`。浏览器版使用站点本地存储，清理站点数据会移除存档；它不与桌面存档同步。

设置包含稳定/旋转镜头、震动、粒子拖尾、提示、交互高亮、音效、音乐、文字大小和对白停留时间。对白不阻断行动，暂停与重力盘才冻结模拟。

## 开发、测试与导出

```sh
GODOT_BIN="$(command -v godot)" ./tests/run.sh
# 图形环境截图矩阵：
godot --path . --script tests/capture.gd
# 第二结局真实输入路线：
godot --headless --path . --script tests/playthrough.gd -- --final --calibrate
# 导出（需要官方 4.5.2 模板）：
mkdir -p build/windows build/web
godot --headless --path . --export-release macOS
godot --headless --path . --export-release Windows
godot --headless --path . --export-release Web
python3 tools/prepare_web.py
```

Web 导出后必须运行 `prepare_web.py`，使用外部 JS/CSS 启动壳，满足公共 SDK 的 CSP；不得放宽为 `unsafe-inline` 或 JavaScript `unsafe-eval`。网页文件仅由 `game/app.py` 明确清单提供，源码、测试和凭据不对外开放。

[关卡解法](docs/LEVELS.md) · [架构](docs/ARCHITECTURE.md) · [验收与限制](docs/QA.md) · [美术来源](docs/ASSETS.md)
