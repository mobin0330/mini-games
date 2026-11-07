---
name: "重力风暴：零向协议"
description: "未来工业与高清像素美术，以可读的空间和机械反馈表达重力与动量。"
colors:
  world-bg: "#09131f"
  text: "#dce9ed"
  text-muted: "#9db5c5"
  subtitle: "#b7d0dc"
  button: "#132b3b"
  button-hover: "#244b5b"
  button-pressed: "#347183"
  border: "#3c5969"
  focus: "#70dbdb"
  portal-blue: "#5ddfff"
  portal-orange: "#ffb562"
  gravity-field: "rgba(140,102,230,0.10)"
  pressure: "#edc574"
  momentum: "#72edc7"
  activated: "#7fffaf"
  danger: "#ed5364"
  health: "#7ce8d5"
  health-empty: "#263e4c"
  compass: "#77ece4"
  compass-inactive: "#496371"
  slider-track: "#263d4b"
  slider-fill: "#60b9c3"
  shell-button: "#24667a"
  shell-button-hover: "#317d8f"
  shell-focus: "#f6b86c"
typography:
  display:
    fontFamily: "Noto Sans SC"
    fontSize: "42px"
    fontWeight: 500
  narrative:
    fontFamily: "Noto Sans SC"
    fontSize: "24px"
    fontWeight: 500
  menu-control:
    fontFamily: "Noto Sans SC"
    fontSize: "19px"
    fontWeight: 500
  body:
    fontFamily: "Noto Sans SC"
    fontSize: "18px"
    fontWeight: 500
  hud-secondary:
    fontFamily: "Noto Sans SC"
    fontSize: "17px"
    fontWeight: 500
  subtitle:
    fontFamily: "Noto Sans SC"
    fontSize: "16px"
    fontWeight: 500
  mechanism:
    fontFamily: "Noto Sans SC"
    fontSize: "15px"
    fontWeight: 500
rounded:
  menu-control: "0px"
  slider-grip: "3px"
  toggle-track: "9px"
spacing:
  menu-step: "58px"
  menu-inset: "82px"
  hud-inset: "34px"
  shell-inset: "24px"
components:
  menu-button:
    backgroundColor: "{colors.button}"
    textColor: "{colors.text}"
    typography: "{typography.menu-control}"
    rounded: "{rounded.menu-control}"
    width: "340px"
    height: "48px"
  menu-button-hover:
    backgroundColor: "{colors.button-hover}"
  menu-button-pressed:
    backgroundColor: "{colors.button-pressed}"
  web-start:
    backgroundColor: "{colors.shell-button}"
    textColor: "#f0fffc"
    padding: "15px 50px"
  web-start-hover:
    backgroundColor: "{colors.shell-button-hover}"
---

# Design System: 重力风暴：零向协议

## Overview

**Creative North Star: "地面不是一个位置，而是一个方向。"**

延续用户指定的未来工业与高清像素风格。暖白陶瓷装甲、深色机械关节和能量核心构成维护锚体的轮廓；海军蓝工业空间承载四章场景。角色、墙体、平台、货箱、机关和中枢使用实际生成的位图素材，几何绘制承担能量、方向、连接关系和状态反馈。

这里的视觉规范记录现有实现。桌面 Godot 游戏为主要表面；浏览器加载页是外围容器，不将其系统字体和响应式布局当作游戏 HUD 的规范。本文不证明首通时长、性能或全部玩法需求已完成。

**Key Characteristics:**
- 真实机械素材与克制的能量几何并存。
- 默认稳定的水平侧视镜头，HUD 保持屏幕正向。
- 功能颜色辅以箭头、图案、文字和虚实线路。
- 菜单使用独立背景，不透出正在游玩的机关与目标。

## Colors

深蓝中性色作为空间与界面底色，暖白角色和少量高亮功能色形成阅读顺序；所有精确值以上方 token 为准。

### Primary
- **青蓝能量：** 蓝门、焦点、重力罗盘的有效方向与界面交互反馈；同族但不同职责的颜色分别保留。
- **明橙出口：** 橙门专用，保持与蓝门的稳定配对。

### Secondary
- **淡紫引力：** 低透明度覆盖区域与连续方向箭头。区域内另有位图发生器，不能用覆盖色替代设备本体。
- **黄铜压力 / 青绿动量：** 压力与方向机关使用暖黄，动量与限时机关使用青绿。
- **绿色导通：** 机关完成状态；同时显示“已导通”和实线，不能仅变色。
- **红色危险：** 激光设备与危险反馈，避免扩展为常驻大面积背景光。

### Neutral
- **深蓝空间：** 场景基底、菜单遮罩及浏览器外壳。
- **雾白文字：** 操作与目标的主文字；次要说明和字幕分别使用已定义的低亮度蓝灰。

**The Functional Color Rule.** 保持门、引力、压力、动量、危险的语义映射；新增装饰不能复用这些颜色制造假的交互目标。

## Typography

**Display / Body Font:** 本地 `assets/fonts/NotoSansSC.ttf`，Godot 通过 OpenType `wght` 数字标签设置为 500。字重不能改回未经转换的字符串轴键。

菜单标题、结局正文、控件、HUD 和机关标注分别使用前述角色。机关状态与气闸说明为 14 px，机关名称为 15 px；HUD 主目标为 19 px，方向信息为 17 px，下沿信息为 16 px。文字缩放设置为 0.85–1.15，默认 1.0；现有实现会缩放标签与按钮字体，但没有按比例重排整个布局。

浏览器外壳正文使用系统中文无衬线栈，18 px / 1.8 行高；其标题使用系统字体的现状是外壳实现细节，不作为游戏品牌展示字规范。外壳说明为 13 px，导航为 14 px。

**The Readable Machinery Rule.** 标注位置应跟随机器的可读空间，不跟随机器中心；右侧接收器标注向左移，上方接收器标注向右下移，避免叠在气闸和字幕上。

## Layout

Godot 基准为 1280×720，使用 `canvas_items` 拉伸。默认是单屏稳定侧视场景。顶沿 HUD 背板高 70 px，下沿背板从 y=662 延伸 58 px；主目标位于左上，生命、有效重力与四向罗盘位于右上。字幕固定在底部信息带，与首次操作提示错时显示。

菜单标题从 x=80 开始，按钮从 x=82 开始；常规按钮宽 340 px、高 48 px。主菜单纵向步进 58 px；右侧展示完整维护锚体。设置分为左侧偏好和右侧按键，章节选择采用两列。

浏览器外壳有独立 44 px 导航，画布占据下方剩余视口；600 px 以下隐藏导航中间标题并缩减加载页文字。该断点仅属于加载外壳，并不代表游戏实现了触屏操作或独立移动端 HUD。

## Elevation & Depth

界面不依赖投影制造层级。深色遮罩、纹理材质、角色与背景的亮度差构成深度；菜单按钮以一像素边线和状态色表现交互。背景乘色降低亮度，机械前景保留材质细节。传送门的能量外沿和核心圆环属于游戏特效，不是通用 UI 阴影。

**The Artwork First Rule.** 真实场景物件使用位图；程序几何用于明确的能量或信息表达。不要用大色块重新替代已经接入的机械素材。

## Shapes

菜单控件使用直角矩形。开关轨道为圆角，滑块抓手是小型圆角机械片；这些是标准控件形状，不推广为面板或卡片语言。生命状态为三段独立绘制的条块，方向罗盘为四个三角箭头，不使用 Unicode 字形冒充图标。

墙体底板重复铺设，平台边沿与立柱分段绘制；保留材质密度，不将一张纹理拉满整间房。角色按贴图纵横比绘制，方块保持方形。位图应有真实透明背景，不保留白色或半透明底板。

## Components

### Menu buttons

直角、单边线、清楚的中文动作名称。普通、悬停/焦点与按下状态分别使用已定义的三种填色；悬停和键盘焦点共用高亮边线。禁用章节同时显示“未解锁”，不能只降低亮度。

### Settings

自绘 SVG 开关图标、青色滑轨和抓手与菜单同色系。按键重绑定显示等待状态、占用错误和取消行为。音量滑块范围为 0–1；文字大小只改变现有字体尺寸，不能据此宣称界面整体缩放已重新布局。

### Gravity HUD and wheel

右上四向罗盘高亮有效重力；旁边显示空中重写次数和场覆盖文字。按住 G 的选择盘以玩家为中心、半径 76 px；选中方向通过亮色箭头表示。显示盘时游戏行动冻结，由游戏逻辑负责。

### Machinery and connections

压力踏板、动量接收器、引力发生器、激光设备、锚点信标和反应堆来自环境图集。未导通线路使用短虚线和 0.34 alpha，导通线路为 0.72 alpha 实线；“已导通”文字作为第二通道。机关名称、气闸状态和字幕分别占有清晰位置。

### Actors and motion

基础图集提供玩家、敌人、货箱和气闸；动作图集提供挥刀、落地、冲刺、受伤和搬运。跑步为八帧循环，源码按 14 帧/秒推进。角色朝向平滑追随重力；传送后重置插值。高于 640 px/s 显示短拖尾，允许关闭特效。默认关闭镜头随重力旋转，默认开启震动、特效、操作提示与交互高亮。

### Browser loading shell

使用实际游戏截图作为低亮度背景，提供明确进入按钮、下载进度、失败说明、返回小游戏与全屏入口。状态与错误应为正常文本。加载页没有另建登录表单，认证继续由公共模块承担。

## Do's and Don'ts

### Do:
- **Do** 保持真实角色、场景和机械设备位图，并检查透明边缘与游戏尺寸下的清晰度。
- **Do** 使用颜色、形状、文字及线路状态共同表达机关语义。
- **Do** 将字幕留在下沿 HUD，把机关标注放在独立可读区域。
- **Do** 在主菜单使用独立背景，隐藏当前房间的角色和机关状态。
- **Do** 分别验证原生游戏 HUD 与浏览器加载外壳；两者共享氛围但不共享布局模型。

### Don't:
- **Don't** 用普通色块替代角色、平台、门或机械机关。
- **Don't** 将背景高亮做得强于玩家、危险物与交互目标。
- **Don't** 把传送门光效当作按钮、卡片或文字的通用发光装饰。
- **Don't** 从截图验收推导玩法、性能、浏览器兼容性或首通时长已经通过测试。

未固化为规范的现状：浏览器外壳仍使用系统展示字体；文字缩放未覆盖所有固定尺寸标注和设置控件。这些需要独立实现与验证，本文不将其写成推荐模式。
