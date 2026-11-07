class_name AxisRoomView
extends Node2D
var game: Node2D
var time := 0.0
var font: FontVariation
func _ready() -> void:
	font=FontVariation.new()
	font.base_font=load("res://assets/fonts/NotoSansSC.ttf")
	font.variation_opentype={TextServerManager.get_primary_interface().name_to_tag("wght"):500.0}
func _process(dt: float) -> void:
	time+=dt
	queue_redraw()
func text(pos: Vector2,value: String,color: Color=Color("9aaebe"),size: int=15) -> void:
	draw_string(font,pos,value,HORIZONTAL_ALIGNMENT_LEFT,-1,size,color)
func _draw() -> void:
	if game==null or game.room.is_empty(): return
	if game.state=="menu":
		if game.art.backdrop:draw_texture_rect(game.art.backdrop,Rect2(0,0,1280,720),false,Color(0.65,0.7,0.8))
		return
	if game.art.backdrop:
		var background: Texture2D=game.art.backgrounds[mini(game.level_index/2,game.art.backgrounds.size()-1)]
		draw_texture_rect(background,Rect2(0,0,1280,720),false,Color(0.7,0.75,0.85))
	var tint: Color = [Color(0.25,0.45,0.6,0.06),Color(0.1,0.4,0.7,0.09),Color(0.6,0.4,0.2,0.07),Color(0.65,0.12,0.15,0.10)][game.level_index/2]
	draw_rect(Rect2(0,0,1280,720),tint)
	for zone in game.zones:
		draw_rect(zone.rect,Color(0.55,0.4,0.9,0.10))
		draw_rect(zone.rect,Color(0.65,0.55,0.95,0.25),false,1)
		if game.art.props.size()==9:
			var emitter: Vector2=zone.rect.position+Vector2(38,32)
			draw_texture_rect(game.art.props[5],Rect2(emitter-Vector2(30,20),Vector2(60,40)),false,Color(1,1,1,0.7))
		for x in range(int(zone.rect.position.x)+25,int(zone.rect.end.x)-10,45):
			for y in range(int(zone.rect.position.y)+25,int(zone.rect.end.y)-10,45):
				var p: Vector2 = Vector2(x,y)+zone.gravity*sin(time*2)*5
				var t := AxisRules.tangent(zone.gravity)
				draw_polyline(PackedVector2Array([p-zone.gravity*4-t*4,p+zone.gravity*3,p-zone.gravity*4+t*4]),Color(0.67,0.58,0.95,0.4),1.5,true)
	for surface in game.room.walls:
		var r: Rect2=surface.rect
		if game.art.props.size()==9:
			# Repeated industrial panels preserve detail; never stretch one tile across a room.
			for x in range(int(r.position.x),int(r.end.x),80):
				for y in range(int(r.position.y),int(r.end.y),80):
					var tile := Rect2(x,y,minf(80,r.end.x-x),minf(80,r.end.y-y))
					draw_texture_rect(game.art.props[2],tile,false,Color(0.48,0.6,0.7))
			if r.size.x>=r.size.y:
				for x in range(int(r.position.x),int(r.end.x),240):
					var width := minf(240,r.end.x-x)
					draw_texture_rect(game.art.props[0],Rect2(x,r.position.y,width,minf(r.size.y,42)),false,Color.WHITE if surface.portal else Color(0.46,0.57,0.65))
				if surface.portal:draw_line(r.position,r.position+Vector2(r.size.x,0),Color("d4ddd9"),2,true)
			else:
				for y in range(int(r.position.y),int(r.end.y),160):
					draw_texture_rect(game.art.props[1],Rect2(r.position.x,y,r.size.x,minf(160,r.end.y-y)),false,Color.WHITE if surface.portal else Color(0.46,0.57,0.65))
				if surface.portal:draw_rect(r,Color("a5b5bc"),false,1)
		else:
			draw_rect(r,Color("243646"))
	for hazard in game.room.hazards:
		if game.art.props.size()==9:
			draw_texture_rect(game.art.props[6],Rect2(hazard.position-Vector2(0,10),Vector2(hazard.size.x,30)),false)
		else:draw_rect(hazard,Color("ed5364"))
	for v in game.room.visits:
		var p: Vector2=v.rect.get_center()
		var color := Color("70f6b3") if v.done else Color("a298ed")
		if game.art.props.size()==9:
			draw_texture_rect(game.art.props[7],Rect2(p-Vector2(16,26),Vector2(32,52)),false,Color.WHITE if not v.done else Color(0.6,1,0.8))
		draw_arc(p,23,0,TAU,40,Color(color,0.3),1,true)
		draw_arc(p,29,time,time+PI,20,color*Color(1,1,1,0.4),2,true)
		text(p+Vector2(-35,45),v.label,color,14)
	for i in game.switches.size():
		var s: Dictionary=game.switches[i]
		var p: Vector2=s.position
		var t := AxisRules.tangent(s.normal)
		var color := Color("72edc7") if "momentum" in s.kind or s.kind=="timed" else Color("edc574")
		if s.active: color=Color("7fffaf")
		var target: Vector2=game.room.exit
		var cable := PackedVector2Array([p,p+s.normal*32,Vector2(target.x,p.y+s.normal.y*32),target])
		if s.active:draw_polyline(cable,Color(color,0.72),2,true)
		else:
			for segment in range(cable.size()-1):draw_dashed_line(cable[segment],cable[segment+1],Color(color,0.34),1.5,7,true)
		if game.art.props.size()==9:
			var momentum: bool="momentum" in s.kind or s.kind=="timed"
			draw_set_transform(p, s.normal.angle()+PI/2)
			var prop_size := Vector2(36,52) if momentum else Vector2(68,20)
			draw_texture_rect(game.art.props[4 if momentum else 3],Rect2(Vector2(-prop_size.x/2,-prop_size.y/2),prop_size),false,Color(0.7,1,0.8) if s.active else Color.WHITE)
			draw_set_transform(Vector2.ZERO)
		draw_line(p-t*29,p+t*29,Color("121f2b"),2,true)
		draw_line(p-t*26,p+t*26,Color(color,0.65),2,true)
		for n in 3:
			var mark: Vector2 = p+t*(n-1)*12+s.normal*11
			draw_line(mark,mark+s.normal*5,color,2,true)
		var label: String=s.label
		if s.kind=="timed" and s.active: label="%.1f s" % s.timer
		var anchor: Vector2=p+s.normal*40+Vector2(-45,-4)
		if p.x>1190:anchor=Vector2(p.x-215,p.y-18)
		elif s.normal==Vector2.DOWN:anchor=p+Vector2(65,42)
		text(anchor,label,color,15)
		if s.active:text(anchor+Vector2(0,21),"已导通",color,14)
	for i in 2:
		var portal: Dictionary=game.portals[i]
		if portal.is_empty(): continue
		portal_draw(portal,Color("5ddfff") if i==0 else Color("ffb562"))
	if not game.preview.is_empty() and game.room.portals:
		portal_draw(game.preview,Color(0.65,0.87,0.95,0.30))
	var exit: Vector2=game.room.exit
	if game.art.sprites.size()>7:
		draw_texture_rect(game.art.sprites[7],Rect2(exit-Vector2(38,58),Vector2(76,116)),false,Color.WHITE if game.exit_open else Color(0.5,0.55,0.6))
	text(exit+Vector2(-30,-64),"气闸开放" if game.exit_open else "回路锁定",Color("8de8ce") if game.exit_open else Color("a8b9c7"),14)
	if game.level_index==7:
		var p := Vector2(1010,260)
		if game.art.props.size()==9:draw_texture_rect(game.art.props[8],Rect2(p-Vector2(72,72),Vector2(144,144)),false)
		for ring in 3:
			var active: bool=game.switches[ring].active
			draw_arc(p,50+ring*15,time*(ring+1)*0.2,time*(ring+1)*0.2+TAU*0.86,60,Color("71edc4") if active else Color("e77d6f"),3,true)
		text(p+Vector2(-36,110),"零向中枢",Color("c8e5ed"),18)
		if game.exit_open:
			for j in 2:
				var q := Vector2(320+j*620,560)
				draw_arc(q,46,0,TAU,50,Color("74e5d7") if j==0 else Color("f3b177"),3,true)
				text(q+Vector2(-40,-60),"F · 重新校准" if j==0 else "F · 解除协议",Color.WHITE,20)
	for actor in game.actors:
		if not is_instance_valid(actor): continue
		if actor.velocity.length()>640 and game.save.data.settings.effects:
			for i in range(1,actor.trail.size()):
				draw_line(actor.trail[i-1],actor.trail[i],Color(0.4,0.9,1,0.3*(1.0-float(i)/8)),3,true)
	for p in game.particles:
		draw_circle(p.pos,p.life*3,p.color*Color(1,1,1,p.life))
func portal_draw(p: Dictionary,c: Color) -> void:
	var t := AxisRules.tangent(p.normal)
	var points := PackedVector2Array()
	for j in 49:
		var a := float(j)/48*TAU
		points.append(p.position+t*cos(a)*44+p.normal*sin(a)*7)
	draw_polyline(points,Color(c, c.a*0.15),12,true)
	draw_polyline(points,c,3,true)
