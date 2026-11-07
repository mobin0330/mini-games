class_name AxisLevels
extends RefCounted
static func wall(x: float,y: float,w: float,h: float,portal: bool=false) -> Dictionary:
	return {"rect":Rect2(x,y,w,h),"portal":portal}
static func zone(x: float,y: float,w: float,h: float,g: Vector2,priority: int=1,locked: bool=false) -> Dictionary:
	return {"rect":Rect2(x,y,w,h),"gravity":g,"priority":priority,"locked":locked}
static func mechanism(p: Vector2,normal: Vector2,kind: String,label: String,threshold: float=650,latch: bool=true) -> Dictionary:
	return {"position":p,"normal":normal,"kind":kind,"label":label,"threshold":threshold,"latch":latch,"active":false,"timer":0.0,"progress":0.0}
static func get_level(index: int) -> Dictionary:
	var d := {"title":"","chapter":"","goal":"","hint":"","log":"","spawn":Vector2(110,580),"exit":Vector2(1170,590),"walls":[wall(0,640,1280,80,true),wall(0,70,1280,24,true),wall(0,70,40,570,true),wall(1240,70,40,570,true)],"zones":[],"switches":[],"boxes":[],"enemies":[],"hazards":[],"visits":[],"gate":"AND","gravity":index>=1,"portals":index>=2,"checkpoint":Vector2(110,580)}
	match index:
		0:
			d.title="第一块地面"; d.chapter="第一章 · 方向不可靠"
			d.goal="越过维修台，进入侧向引力舱"
			d.hint="A / D 移动   SPACE 跳跃   SHIFT 冲刺"
			d.log="轴：欢迎醒来，维护锚体。地面，只是你暂时接受的方向。"
			d.walls.append_array([wall(310,575,110,65),wall(550,535,120,105),wall(940,420,40,220)])
			d.zones=[zone(790,340,450,300,Vector2.RIGHT)]
			d.visits=[{"rect":Rect2(960,360,240,210),"label":"侧向引力","done":false}]
			d.exit=Vector2(1195,390)
		1:
			d.title="墙也是地面"; d.chapter="第一章 · 方向不可靠"
			d.goal="校准三个方向锚点，再抵达气闸"
			d.hint="方向键 重写自身重力 · 按住 G 打开选择盘 · 空中仅一次"
			d.log="ST-3：他们说墙壁不能走。我想，他们只是没有试过。"
			d.walls.append_array([wall(400,370,40,270),wall(780,94,40,275)])
			d.visits=[{"rect":Rect2(160,95,170,90),"label":"天顶锚点","done":false},{"rect":Rect2(445,385,90,150),"label":"侧壁锚点","done":false},{"rect":Rect2(1050,480,150,150),"label":"出口锚点","done":false}]
		2:
			d.title="深井飞行"; d.chapter="第二章 · 速度是钥匙"
			d.goal="从深井坠入蓝门，用墙面橙门击中动量接收器"
			d.hint="鼠标瞄准浅色表面 · Q 蓝门 / E 橙门 · 坠落保留速度"
			d.log="轴：坠落并非故障。每一米落差，都是尚未使用的能量。"
			d.spawn=Vector2(210,220);d.checkpoint=d.spawn
			d.walls.append_array([wall(80,260,240,24),wall(500,94,36,390,true),wall(900,560,250,24)])
			d.switches=[mechanism(Vector2(1223,530),Vector2.LEFT,"momentum","速度 ≥ 650",650)]
			d.zones=[zone(40,94,1200,546,Vector2.DOWN,1,true)]
			d.exit=Vector2(1150,590)
		3:
			d.title="水平不代表停止";d.chapter="第二章 · 速度是钥匙"
			d.goal="冲击接收器，穿过限时气闸"
			d.hint="青绿接收器需要速度 · 亮起后有 8 秒到达出口"
			d.log="ST-3：这里测量的不是维修效率，而是我们有多少种服从的方式。"
			d.switches=[mechanism(Vector2(720,622),Vector2.UP,"timed","限时 8 秒",650,false)]
			d.walls.append_array([wall(400,440,180,24,true),wall(960,500,32,140,true)])
			d.zones=[zone(620,94,220,430,Vector2.DOWN)]
		4:
			d.title="重量与方向"; d.chapter="第三章 · 物体不属于地面"
			d.goal="用货箱导通重量触点与右壁方向触点"
			d.hint="F 搬运 / 释放 · 释放继承你的速度与有效重力"
			d.log="轴：所有物体遵守相同规则。维护锚体也不例外。"
			d.boxes=[Vector2(250,590),Vector2(650,580)]
			d.switches=[mechanism(Vector2(400,622),Vector2.UP,"weight","重量锁存"),mechanism(Vector2(1223,350),Vector2.LEFT,"direction","向右受压")]
			d.zones=[zone(840,250,400,390,Vector2.RIGHT)]
			d.exit=Vector2(1180,180)
		5:
			d.title="三重协奏";d.chapter="第三章 · 物体不属于地面"
			d.goal="依次锁存三个回路：重量 / 方向 / 动量"
			d.hint="三个回路永久锁存 · 允许搬运同一货箱重复利用 · R 重试"
			d.log="ST-3：我们不是第七代。我们是同一个问题的第七次答案。"
			d.boxes=[Vector2(240,590),Vector2(570,590),Vector2(200,230)]
			d.walls.append_array([wall(80,270,260,24,true),wall(700,94,30,426,true)])
			d.switches=[mechanism(Vector2(430,622),Vector2.UP,"weight","A / 重量"),mechanism(Vector2(1223,330),Vector2.LEFT,"direction","B / 方向"),mechanism(Vector2(1223,570),Vector2.LEFT,"momentum_box","C / 动量",650)]
			d.zones=[zone(930,220,310,200,Vector2.RIGHT)]
		6:
			d.title="另一种士兵";d.chapter="第四章 · 物理就是武器"
			d.goal="解除两名守卫，抵达中枢入口"
			d.hint="J 能量刀 · 盾卫正面免疫近战 · 高速货箱可击穿护盾"
			d.log="轴：请回到回收舱。更正，请继续维护任务。"
			d.boxes=[Vector2(300,590),Vector2(300,250)]
			d.enemies=[{"position":Vector2(770,590),"kind":"patrol"},{"position":Vector2(1090,590),"kind":"shield"}]
			d.walls.append_array([wall(120,290,260,24,true),wall(660,390,190,24,true)])
			d.hazards=[Rect2(950,94,100,18)]
			d.zones=[zone(930,100,300,240,Vector2.UP)]
		7:
			d.title="零向中枢";d.chapter="第四章 · 物理就是武器"
			d.goal="跨越锚点，投送货箱解除三层防护"
			d.hint="三次不同方向冲击 · 完成后亲自走入左 / 右中枢，决定协议命运"
			d.log="ST-3：不必成为更好的答案。你可以，让这个问题结束。"
			d.boxes=[Vector2(210,590),Vector2(510,590),Vector2(210,240)]
			d.walls.append_array([wall(80,280,250,24,true),wall(630,94,32,426,true)])
			d.switches=[mechanism(Vector2(1223,550),Vector2.LEFT,"momentum_box","防护 I",650),mechanism(Vector2(800,112),Vector2.DOWN,"momentum_box","防护 II",650),mechanism(Vector2(920,622),Vector2.UP,"momentum_box","防护 III",650)]
			d.visits=[{"rect":Rect2(400,100,180,100),"label":"中枢锚点","done":false}]
	return d
