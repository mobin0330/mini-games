# 音效来源

本目录的音效均来自 Kenney 的免费音频包，许可证为 **CC0 1.0（公共领域）**，可免费用于商业项目。

- 来源站点：https://kenney.nl/assets/category:Audio
- 许可证：https://creativecommons.org/publicdomain/zero/1.0/

具体文件对应关系：

| 游戏文件 | Kenney 音频包 | 原始文件 |
| --- | --- | --- |
| `select.mp3` | Interface Sounds | `select_001.ogg` |
| `click.mp3` | Interface Sounds | `click_001.ogg` |
| `invalid.mp3` | Interface Sounds | `error_004.ogg` |
| `match.mp3` | Interface Sounds | `glass_002.ogg` |
| `special.mp3` | Interface Sounds | `confirmation_001.ogg` |
| `rainbow.mp3` | Interface Sounds | `confirmation_002.ogg` |
| `swap.mp3` | Casino Audio | `card-slide-2.ogg` |
| `drop.mp3` | Casino Audio | `card-place-3.ogg` |
| `combo.mp3` | Casino Audio | `chips-stack-3.ogg` |
| `bomb.mp3` | Impact Sounds | `impactGeneric_light_003.ogg` |
| `break.mp3` | Impact Sounds | `impactGlass_heavy_000.ogg` |
| `newbest.mp3` | Music Jingles | `Pizzicato jingles/jingles_PIZZI07.ogg` |
| `bgm.mp3` | 背景音乐，非 Kenney | `Happy Adventure (Loop)`，见下 |

已统一转码为单声道 44.1kHz MP3，并做了必要的裁剪和淡出处理，以减小体积和延迟。

## 背景音乐

- 曲目：**Happy Adventure (Loop)**（源文件元数据标题为 *The Fish is Blue*）
- 作者：Rick Hoppmann
- 来源：https://opengameart.org/content/happy-adventure-loop
- 许可证：**CC0 1.0（公共领域）**，https://creativecommons.org/publicdomain/zero/1.0/
- 处理：使用 ffmpeg 统一响度（loudnorm -19 LUFS）后转码为 112 kbps 立体声 MP3，作为循环背景音乐播放。
