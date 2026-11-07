class_name AxisUI
extends CanvasLayer
var game: Node2D
var root := Control.new()
var menu := Control.new()
var hud := Control.new()
var top: Label
var bottom: Label
var status: Label
var note: Label
var rebinding := ""
var rebind_button: Button
var return_to := "menu"
func _ready() -> void:
	var theme := Theme.new()
	var font := FontVariation.new()
	font.base_font=load("res://assets/fonts/NotoSansSC.ttf")
	font.variation_opentype={TextServerManager.get_primary_interface().name_to_tag("wght"):500.0}
	theme.default_font=font
	root.theme=theme
	add_child(root)
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter=Control.MOUSE_FILTER_IGNORE
	root.add_child(hud);hud.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for area in [Rect2(0,0,1280,70),Rect2(0,662,1280,58)]:
		var backing := ColorRect.new();backing.position=area.position;backing.size=area.size;backing.color=Color(0.025,0.05,0.08,0.95);backing.mouse_filter=Control.MOUSE_FILTER_IGNORE;hud.add_child(backing)
	top=label(hud,Vector2(34,8),"",22)
	status=label(hud,Vector2(940,8),"",17)
	bottom=label(hud,Vector2(34,668),"",17)
	note=label(hud,Vector2(34,694),"",16,Color("b7d0dc"))
	note.size=Vector2(1200,26);note.horizontal_alignment=HORIZONTAL_ALIGNMENT_LEFT;note.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	root.add_child(menu)
	menu.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var drawer := WheelDraw.new();drawer.ui=self;hud.add_child(drawer)
func label(parent: Node,p: Vector2,text: String,size: int=20,color: Color=Color("dce9ed")) -> Label:
	var l := Label.new();l.position=p;l.text=text;l.add_theme_font_size_override("font_size",int(size*float(game.save.data.settings.ui_scale)));l.add_theme_color_override("font_color",color)
	parent.add_child(l);return l
func clear_menu() -> void:
	for child in menu.get_children(): child.queue_free()
func panel(title: String,subtitle: String="",wide: bool=false) -> void:
	clear_menu()
	var shade := ColorRect.new();shade.color=Color(0.02,0.045,0.075,0.94 if wide else 0.85);shade.size=Vector2(1280,720);menu.add_child(shade)
	label(menu,Vector2(80,65),title,42)
	label(menu,Vector2(82,127),subtitle,18,Color("9db5c5"))
func button(p: Vector2,text: String,callback: Callable,width: float=340) -> Button:
	var b := Button.new();b.position=p;b.size=Vector2(width,48);b.text=text
	b.add_theme_font_size_override("font_size",int(19*float(game.save.data.settings.ui_scale)))
	var style := StyleBoxFlat.new();style.bg_color=Color("132b3b");style.border_color=Color("3c5969");style.set_border_width_all(1);style.content_margin_left=18
	b.add_theme_stylebox_override("normal",style)
	var hover := style.duplicate();hover.bg_color=Color("244b5b");hover.border_color=Color("70dbdb")
	b.add_theme_stylebox_override("hover",hover);b.add_theme_stylebox_override("focus",hover)
	var pressed := style.duplicate();pressed.bg_color=Color("347183");b.add_theme_stylebox_override("pressed",pressed)
	b.pressed.connect(callback);menu.add_child(b)
	return b
func main_menu() -> void:
	game.state="menu"
	for actor in game.actors:actor.visible=false
	panel("重力风暴\n零向协议","地面不是一个位置，而是一个方向。")
	for l in menu.get_children():
		if l is Label and l.position.y==127: l.position.y=190
	label(menu,Vector2(83,245),"GRAVITY STORM / ZERO AXIS",19,Color("76cdd9"))
	button(Vector2(82,305),"开始游戏",func():game.start_level(0)).grab_focus()
	button(Vector2(82,363),"继续游戏",func():game.start_level(int(game.save.data.last)))
	button(Vector2(82,421),"章节选择",chapters)
	button(Vector2(82,479),"设置与操作",func():settings_menu("menu"))
	button(Vector2(82,537),"返回小游戏" if OS.has_feature("web") else "退出",func():
		if OS.has_feature("web"):JavaScriptBridge.get_interface("location").assign("/")
		else:get_tree().quit())
	if game.art.sprites.size()>0:
		var sprite := TextureRect.new();sprite.texture=game.art.sprites[0];sprite.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;sprite.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		sprite.position=Vector2(770,190);sprite.size=Vector2(210,365);sprite.mouse_filter=Control.MOUSE_FILTER_IGNORE;menu.add_child(sprite)
	label(menu,Vector2(790,600),"衡－9 / 维护锚体",18,Color("83afc0"))
func chapters() -> void:
	panel("选择校准区域","完成关卡解锁下一区域；最快纪录会保存在本机。",true)
	for i in 8:
		var d := AxisLevels.get_level(i)
		var text := "%d-%d   %s" % [i/2+1,i%2+1,d.title]
		var best: Dictionary=game.save.data.best.get(str(i),{})
		if not best.is_empty(): text+="   %.1fs / %d 次重启" % [best.time,best.deaths]
		var b := button(Vector2(82+(i/4)*570,190+(i%4)*88),text,func():game.start_level(i),535)
		b.disabled=i>int(game.save.data.unlocked)
		if b.disabled:b.text+="  · 未解锁"
	button(Vector2(82,590),"返回主菜单",main_menu)
func pause_menu() -> void:
	panel("暂时锚定","时间已暂停。你的动量会在继续时恢复。")
	button(Vector2(82,220),"继续",func():game.state="playing";clear_menu()).grab_focus()
	button(Vector2(82,280),"当前房间重试",func():game.load_level(game.level_index,false);game.state="playing";clear_menu())
	button(Vector2(82,340),"设置与操作",func():settings_menu("paused"))
	button(Vector2(82,400),"返回主菜单",main_menu)
func complete_menu() -> void:
	panel("校准完成",game.room.title+" · %.1f 秒 · %d 次重启" % [game.elapsed,game.deaths])
	button(Vector2(82,240),"进入下一区域",func():game.start_level(mini(7,game.level_index+1))).grab_focus()
	button(Vector2(82,300),"重试，挑战纪录",func():game.start_level(game.level_index))
	button(Vector2(82,360),"返回主菜单",main_menu)
func ending_menu(which: String) -> void:
	if which=="calibrate":
		panel("新的第一块地面","结局一 / 重新校准",true)
		label(menu,Vector2(82,230),"设施恢复了稳定。\n\n轴：任务完成。你的数据将被妥善保存。\n\n在另一个舱室，第八代维护锚体睁开了眼睛。",24)
	else:
		panel("不再有向下","结局二 / 解除协议",true)
		label(menu,Vector2(82,230),"引力环逐个熄灭。回收舱停止计数。\n\n你和那些未曾醒来的锚体，缓缓离开了地面。\n\n这一次，没有声音告诉你应该去哪里。",24)
	button(Vector2(82,520),"返回主菜单",main_menu).grab_focus()
	button(Vector2(460,520),"重返中枢，选择另一条路",func():game.start_level(7),430)
func settings_menu(origin: String) -> void:
	return_to=origin
	panel("设置与操作","修改立即保存。桌面键盘与触控板均可操作。",true)
	var settings: Dictionary=game.save.data.settings
	var toggles := [["rotate","镜头随重力旋转"],["shake","屏幕震动"],["effects","粒子与速度拖尾"],["hints","操作提示"],["highlight","交互对象高亮"]]
	for i in toggles.size():
		var key: String=toggles[i][0]
		var check := CheckButton.new();check.position=Vector2(82,185+i*48);check.text=toggles[i][1];check.button_pressed=settings[key];check.add_theme_font_size_override("font_size",19)
		check.toggled.connect(func(value):settings[key]=value;game.save.save());var toggle := StyleBoxFlat.new();toggle.bg_color=Color("142e3b");toggle.border_color=Color("405f70");toggle.set_border_width_all(1)
		check.add_theme_stylebox_override("normal",toggle)
		var toggle_hover:=toggle.duplicate();toggle_hover.border_color=Color("72dfdc");check.add_theme_stylebox_override("focus",toggle_hover);check.add_theme_stylebox_override("hover",toggle_hover)
		check.add_theme_color_override("font_pressed_color",Color("79edcf"));check.add_theme_icon_override("checked",load("res://assets/ui/toggle-on.svg"));check.add_theme_icon_override("unchecked",load("res://assets/ui/toggle-off.svg"));menu.add_child(check)
	for i in 2:
		var key := "sfx" if i==0 else "music"
		label(menu,Vector2(82,448+i*58),"音效" if i==0 else "音乐",18)
		var slider := HSlider.new();slider.position=Vector2(155,455+i*58);slider.size=Vector2(260,24);slider.min_value=0;slider.max_value=1;slider.step=0.05;slider.value=settings[key]
		slider.value_changed.connect(func(v):settings[key]=v;game.save.save());style_slider(slider);menu.add_child(slider)
	label(menu,Vector2(610,184),"按键重绑定：点击后按新的按键",20)
	var pairs := [["left","左移"],["right","右移"],["jump","跳跃"],["dash","冲刺"],["wheel","重力盘"],["blue","蓝门"],["orange","橙门"],["carry","搬运"],["attack","能量刀"],["retry","重试"]]
	for i in pairs.size():
		var action: String=pairs[i][0]
		var keycode: int=game.save.data.keys.get(action,game.default_keys[action])
		var b := button(Vector2(610+(i%2)*260,230+(i/2)*56),pairs[i][1]+"   "+OS.get_keycode_string(keycode),func():pass,240)
		b.pressed.connect(func():rebinding=action;rebind_button=b;b.text="按一个新按键…")
	label(menu,Vector2(610,530),"方向键：世界绝对重力方向\nESC：暂停 / 返回 · G：冻结时间选择方向",17,Color("a5bdc9"))
	for extra in [["ui_scale","文字大小",Vector2(82,560),0.85,1.15,0.05],["text_speed","对白停留",Vector2(610,590),0.5,2.0,0.25]]:
		var key: String=extra[0]
		label(menu,extra[2],extra[1],18)
		var slider := HSlider.new();slider.position=extra[2]+Vector2(100,7);slider.size=Vector2(220,24);slider.min_value=extra[3];slider.max_value=extra[4];slider.step=extra[5];slider.value=settings[key]
		slider.value_changed.connect(func(v):settings[key]=v;game.save.save());style_slider(slider);menu.add_child(slider)
	button(Vector2(82,615),"返回",func():game.save.save();pause_menu() if return_to=="paused" else main_menu())
func style_slider(slider: HSlider) -> void:
	slider.add_theme_icon_override("grabber",load("res://assets/ui/slider.svg"))
	slider.add_theme_icon_override("grabber_highlight",load("res://assets/ui/slider.svg"))
	var track:=StyleBoxFlat.new();track.bg_color=Color("263d4b");track.content_margin_top=3;track.content_margin_bottom=3
	slider.add_theme_stylebox_override("slider",track)
	var fill:=track.duplicate();fill.bg_color=Color("60b9c3");slider.add_theme_stylebox_override("grabber_area",fill)
	var focus:=fill.duplicate();focus.bg_color=Color("89f0dc");slider.add_theme_stylebox_override("grabber_area_highlight",focus)
func _input(event: InputEvent) -> void:
	if rebinding!="" and event is InputEventKey and event.pressed and not event.echo:
		var key: int=event.physical_keycode
		if key==KEY_ESCAPE:rebinding="";settings_menu(return_to);get_viewport().set_input_as_handled();return
		for action in game.default_keys:
			if action!=rebinding and int(game.save.data.keys.get(action,game.default_keys[action]))==key:
				rebind_button.text="已占用，请换一个按键";get_viewport().set_input_as_handled();return
		game.save.data.keys[rebinding]=key;game.setup_inputs();game.save.save();rebinding="";settings_menu(return_to);get_viewport().set_input_as_handled()
func _process(_dt: float) -> void:
	if game==null:return
	hud.visible=game.state in ["playing","paused"]
	if not is_instance_valid(game.player):return
	var p: AxisActor=game.player
	top.text=game.room.chapter+" / "+game.room.title+"\n"+game.room.goal
	top.add_theme_font_size_override("font_size",int(19*float(game.save.data.settings.ui_scale)))
	status.add_theme_font_size_override("font_size",int(17*float(game.save.data.settings.ui_scale)))
	bottom.add_theme_font_size_override("font_size",int(16*float(game.save.data.settings.ui_scale)))
	var arrow := "下"
	if p.gravity==Vector2.UP:arrow="上"
	elif p.gravity==Vector2.LEFT:arrow="左"
	elif p.gravity==Vector2.RIGHT:arrow="右"
	status.text="完整性\n重力  "+arrow+"  / 空中重写 "+str(p.airborne_changes)
	if p.gravity!=p.base_gravity or game.is_gravity_locked(p.position):status.text+="  场覆盖"
	bottom.text=("Q 蓝门 "+("就绪" if not game.portals[0].is_empty() else "未放置")+"    E 橙门 "+("就绪" if not game.portals[1].is_empty() else "未放置")+"      ") if game.room.portals else ""
	bottom.text+="%.0f px/s    %.1f s    ESC 暂停" % [p.velocity.length(),game.elapsed]
	if game.save.data.settings.hints and game.notice_time<=0: bottom.text+="\n"+game.room.hint
	note.text=game.notice if game.notice_time>0 else ""
class WheelDraw extends Control:
	var ui: AxisUI
	func _process(_dt: float) -> void:queue_redraw()
	func _draw() -> void:
		if ui.game==null or not is_instance_valid(ui.game.player):return
		var game=ui.game
		for i in 3:
			var r:=Rect2(1023+i*24,15,18,11)
			draw_rect(r,Color("7ce8d5") if i<game.player.health else Color("263e4c"))
			draw_rect(r,Color("89aaaf"),false,1)
		var center:=Vector2(1210,35)
		for direction in [Vector2.UP,Vector2.DOWN,Vector2.LEFT,Vector2.RIGHT]:
			var c:=Color("77ece4") if direction==game.player.gravity else Color("496371")
			var tip:Vector2=center+direction*22
			var side:=AxisRules.tangent(direction)*5
			draw_colored_polygon(PackedVector2Array([tip,tip-direction*10+side,tip-direction*10-side]),c)
		if game.wheel:
			var p: Vector2=game.get_viewport().get_canvas_transform()*game.player.position
			draw_circle(p,76,Color(0.03,0.08,0.13,0.96))
			for direction in [Vector2.UP,Vector2.DOWN,Vector2.LEFT,Vector2.RIGHT]:
				var c := Color("76eced") if direction==game.wheel_direction else Color("607785")
				var t := AxisRules.tangent(direction)
				var q: Vector2=p+direction*49
				draw_polyline(PackedVector2Array([q-direction*7-t*8,q+direction*3,q-direction*7+t*8]),c,4,true)
		elif game.save.data.settings.highlight:
			for actor in game.actors:
				if actor.kind=="box" and actor.position.distance_to(game.player.position)<82:
					var p: Vector2=game.get_viewport().get_canvas_transform()*actor.position
					draw_string(ThemeDB.fallback_font,p+Vector2(-5,-34),"F",HORIZONTAL_ALIGNMENT_LEFT,-1,18,Color("ffdc8c"))
