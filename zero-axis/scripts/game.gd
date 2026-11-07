extends Node2D
var art := AxisArt.new()
var save := AxisSave.new()
var sound := AxisAudio.new()
var room: Dictionary={}
var level_index := 0
var actors: Array[AxisActor]=[]
var player: AxisActor
var solids: Array[StaticBody2D]=[]
var zones: Array=[]
var switches: Array=[]
var portals: Array[Dictionary]=[{},{}]
var preview: Dictionary={}
var particles: Array=[]
var exit_open := false
var state := "menu"
var elapsed := 0.0
var deaths := 0
var teleports := 0
var notice := ""
var notice_time := 0.0
var wheel := false
var wheel_direction := Vector2.DOWN
var hitstop := 0.0
var shake_time := 0.0
var ui: AxisUI
var view: AxisRoomView
var camera: Camera2D
var testing := false
var reset_pending := false
var default_keys := {"left":KEY_A,"right":KEY_D,"jump":KEY_SPACE,"dash":KEY_SHIFT,"wheel":KEY_G,"blue":KEY_Q,"orange":KEY_E,"carry":KEY_F,"attack":KEY_J,"retry":KEY_R,"clear_portals":KEY_X,"pause":KEY_ESCAPE,"up":KEY_UP,"down":KEY_DOWN,"gravity_left":KEY_LEFT,"gravity_right":KEY_RIGHT}
func _ready() -> void:
	save.load_data()
	setup_inputs()
	sound.settings=save.data.settings
	add_child(sound)
	view=AxisRoomView.new(); view.game=self; add_child(view)
	camera=Camera2D.new(); camera.position=Vector2(640,360);camera.ignore_rotation=false;add_child(camera)
	ui=AxisUI.new(); ui.game=self; add_child(ui)
	load_level(0,false)
	state="menu"
	ui.main_menu()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--level="): start_level(int(arg.trim_prefix("--level=")))
		if arg=="--test": testing=true
func setup_inputs() -> void:
	for action in default_keys:
		if not InputMap.has_action(action): InputMap.add_action(action)
		InputMap.action_erase_events(action)
		var event := InputEventKey.new()
		event.physical_keycode=int(save.data.keys.get(action,default_keys[action]))
		InputMap.action_add_event(action,event)
func spawn_actor(p: Vector2,kind: String) -> AxisActor:
	var actor := AxisActor.new()
	actor.position=p;actor.kind=kind;actor.world=self
	if kind=="box": actor.radius=18
	add_child(actor);actors.append(actor)
	return actor
func load_level(index: int,reset_stats: bool=true) -> void:
	for actor in actors: actor.free()
	actors.clear()
	for solid in solids: solid.free()
	solids.clear()
	level_index=clampi(index,0,7)
	room=AxisLevels.get_level(level_index)
	zones=room.zones; switches=room.switches
	portals=[{},{}]; preview={}; particles=[]; exit_open=false; wheel=false; reset_pending=false
	if reset_stats: elapsed=0;deaths=0
	for wall in room.walls:
		var body := StaticBody2D.new()
		body.position=wall.rect.get_center()
		var shape := CollisionShape2D.new()
		var rect := RectangleShape2D.new()
		rect.size=wall.rect.size;shape.shape=rect
		body.add_child(shape);add_child(body);solids.append(body)
	player=spawn_actor(room.spawn,"player")
	for p in room.boxes: spawn_actor(p,"box")
	for enemy in room.enemies: spawn_actor(enemy.position,enemy.kind)
	teleports=0
	if level_index==2:
		portals[0]={"position":Vector2(400,640),"normal":Vector2.UP}
		portals[1]={"position":Vector2(536,200),"normal":Vector2.RIGHT}
	notice=room.log;notice_time=8*float(save.data.settings.text_speed)
func start_level(index: int) -> void:
	load_level(index)
	state="playing"
	ui.clear_menu()
	if not testing:
		save.data.last=index
		save.save()
func _unhandled_input(event: InputEvent) -> void:
	if ui.rebinding!="": return
	if event.is_action_pressed("pause"):
		if state=="playing": state="paused";wheel=false;ui.pause_menu()
		elif state=="paused": state="playing";ui.clear_menu()
		return
	if state!="playing": return
	if event.is_action_pressed("retry"):
		load_level(level_index,false);return
	if event.is_action_pressed("wheel") and room.gravity:
		wheel=true;wheel_direction=player.base_gravity
	if event.is_action_released("wheel") and wheel:
		wheel=false
		if not player.change_gravity(wheel_direction): message("重力重写未就绪：着地恢复，或离开锁定场")
	if wheel: return
	if room.gravity:
		for pair in [["up",Vector2.UP],["down",Vector2.DOWN],["gravity_left",Vector2.LEFT],["gravity_right",Vector2.RIGHT]]:
			if event.is_action_pressed(pair[0]) and not player.change_gravity(pair[1]): message("重力重写未就绪：着地恢复，或离开锁定场")
	if event.is_action_pressed("blue"): place_portal(0)
	if event.is_action_pressed("orange"): place_portal(1)
	if event.is_action_pressed("carry"): toggle_carry()
	if event.is_action_pressed("attack"): player.attack()
	if event.is_action_pressed("clear_portals"):clear_portals()
func _physics_process(dt: float) -> void:
	if state!="playing": return
	if wheel:
		var d := get_global_mouse_position()-player.position
		wheel_direction=Vector2(signf(d.x),0) if absf(d.x)>absf(d.y) else Vector2(0,signf(d.y))
		return
	shake_time=maxf(0,shake_time-dt)
	camera.offset=Vector2(randf_range(-2,2),randf_range(-2,2))*shake_time*8 if save.data.settings.shake else Vector2.ZERO
	if hitstop>0: hitstop-=dt;return
	elapsed+=dt
	notice_time=maxf(0,notice_time-dt)
	preview=portal_candidate(get_global_mouse_position()) if room.portals else {}
	for s in switches:
		if not s.latch:
			s.timer=maxf(0,s.timer-dt)
			s.active=s.timer>0
	var controls := {"move":Input.get_axis("left","right"),"jump":Input.is_action_just_pressed("jump"),"dash":Input.is_action_just_pressed("dash")}
	for actor in actors.duplicate():
		if is_instance_valid(actor) and not actor.is_queued_for_deletion(): actor.step(dt,controls if actor==player else {})
	for visit in room.visits:
		if not visit.done and visit.rect.has_point(player.position):
			visit.done=true;sound.play("switch");burst(player.position,Color("a594ff"),18)
	var conditions: Array=[]
	for s in switches: conditions.append(s.active)
	for visit in room.visits: conditions.append(visit.done)
	if level_index==6: conditions.append(actors.all(func(a): return a.kind in ["player","box"]))
	if level_index==2: conditions.append(teleports>0)
	exit_open=AxisRules.logic(conditions,room.gate)
	if exit_open:
		if level_index<7 and player.position.distance_to(room.exit)<42: complete_level()

	for p in particles:
		p.life-=dt*1.7;p.pos+=p.velocity*dt;p.velocity*=0.96
	particles=particles.filter(func(p): return p.life>0)
	var target_angle := -player.visual_angle if save.data.settings.rotate else 0.0
	camera.rotation=lerp_angle(camera.rotation,target_angle,dt*3)
	camera.zoom=Vector2.ONE*(0.72 if save.data.settings.rotate else 1.0)
func is_gravity_locked(p: Vector2) -> bool:
	for zone in zones:
		if zone.locked and zone.rect.has_point(p): return true
	return false
func free_at(p: Vector2,radius: float,ignore: AxisActor=null) -> bool:
	for wall in room.walls:
		var rect: Rect2=wall.rect
		var nearest := p.clamp(rect.position,rect.end)
		if p.distance_to(nearest)<radius-0.2: return false
	for actor in actors:
		if actor!=ignore and not actor.carried and actor.position.distance_to(p)<radius+actor.radius-2: return false
	return true
func portal_candidate(aim: Vector2) -> Dictionary:
	var ray := PhysicsRayQueryParameters2D.create(player.position,player.position+(aim-player.position).normalized()*1800,1)
	var hit := get_world_2d().direct_space_state.intersect_ray(ray)
	if hit.is_empty(): return {}
	var p: Vector2=hit.position
	var n: Vector2=hit.normal
	for wall in room.walls:
		var r: Rect2=wall.rect
		if not wall.portal or not r.grow(1).has_point(p): continue
		var lo: float=r.position.x+49 if absf(n.y)>0.5 else r.position.y+49
		var hi: float=r.end.x-49 if absf(n.y)>0.5 else r.end.y-49
		if hi<lo: return {}
		if absf(n.y)>0.5: p.x=clampf(p.x,lo,hi)
		else: p.y=clampf(p.y,lo,hi)
		return {"position":p,"normal":n}
	return {}
func place_portal(index: int) -> bool:
	return place_portal_at(index,get_global_mouse_position())
func place_portal_at(index: int, aim: Vector2) -> bool:
	if not room.portals: message("双传送门将在第二章解锁"); return false
	var candidate := portal_candidate(aim)
	if candidate.is_empty(): message("此处无法放门：瞄准无遮挡的浅色长表面");sound.play("deny");return false
	var other: Dictionary=portals[1-index]
	if not other.is_empty() and candidate.position.distance_to(other.position)<100:
		message("两扇门过近，请选择另一个表面");return false
	portals[index]=candidate;sound.play("portal");burst(candidate.position,Color("73deff") if index==0 else Color("ffb968"),15)
	return true
func try_portal(actor: AxisActor,start: Vector2,finish: Vector2) -> bool:
	if actor.portal_cooldown>0 or portals[0].is_empty() or portals[1].is_empty(): return false
	for i in 2:
		var entry: Dictionary=portals[i]
		var out: Dictionary=portals[1-i]
		if not AxisRules.crossing(start,finish,entry.position,entry.normal,actor.radius): continue
		var offset := clampf((start-entry.position).dot(AxisRules.tangent(entry.normal)),-25,25)
		var destination: Vector2=out.position-AxisRules.tangent(out.normal)*offset+out.normal*(actor.radius+3)
		if not free_at(destination,actor.radius,actor):
			if actor==player: message("出口被阻挡：移走货箱或重新放门")
			return false
		var carried_target: Vector2=destination+out.normal*43
		if actor.carrying and not free_at(carried_target,actor.carrying.radius,actor):
			if actor==player: message("携带货箱无法安全通过这个出口")
			return false
		actor.position=destination
		actor.velocity=AxisRules.portal_vector(actor.velocity,entry.normal,out.normal)
		actor.dash_direction=AxisRules.portal_vector(actor.dash_direction,entry.normal,out.normal)
		actor.portal_cooldown=0.18
		actor.trail.clear()
		actor.reset_physics_interpolation()
		if actor.carrying:
			actor.carrying.position=carried_target;actor.carrying.reset_physics_interpolation()
		if actor==player: teleports+=1
		sound.play("portal");burst(destination,Color("67dfff"),18)
		return true
	return false
func resolve_actor(actor: AxisActor,_dt: float) -> void:
	for s in switches:
		var distance: Vector2=actor.position-s.position
		if absf(distance.dot(AxisRules.tangent(s.normal)))>32+actor.radius: continue
		var depth := distance.dot(s.normal)
		if depth < -3 or depth>actor.radius+12: continue
		var valid := false
		if s.kind=="weight": valid=actor.gravity.dot(-s.normal)>0.9 and actor.velocity.length()<100
		elif s.kind=="direction": valid=actor.kind=="box" and actor.gravity.dot(-s.normal)>0.9 and actor.velocity.length()<100
		else:
			valid=AxisRules.impact(actor.prior_velocity,s.normal,s.threshold)
			if s.kind=="momentum_box": valid=valid and actor.kind=="box"
			if level_index==7:
				var idx := switches.find(s)
				for earlier in range(idx): valid=valid and switches[earlier].active
		if valid and not s.active:
			s.active=true;s.timer=8.0
			sound.play("switch");burst(s.position,Color("7affc2"),20)
			if level_index==7: core_phase_changed()
	for hazard in room.hazards:
		if hazard.grow(actor.radius*0.7).has_point(actor.position):
			if actor.kind=="box": recall(actor)
			else: actor.hurt(3,actor.position-actor.gravity*20,true)
	if actor.position.x< -100 or actor.position.x>1380 or actor.position.y< -100 or actor.position.y>850:
		if actor.kind=="player": die.call_deferred()
		elif actor.kind=="box": recall(actor)
		else: actors.erase(actor);actor.queue_free()
	if actor.kind in ["patrol","shield"] and actor.position.distance_to(player.position)<35:
		player.hurt(1,actor.position)
	if actor.kind=="box" and not actor.carried:
		for enemy in actors.duplicate():
			if enemy.kind not in ["patrol","shield"]: continue
			var relative: Vector2=actor.prior_velocity-enemy.velocity
			if actor.position.distance_to(enemy.position)<42 and relative.dot((enemy.position-actor.position).normalized())>450:
				enemy.hurt(3,actor.position,true);actor.velocity*=-0.25;hitstop=0.045
func core_phase_changed() -> void:
	var count := switches.filter(func(s):return s.active).size()
	if count==1:
		zones.append(AxisLevels.zone(700,94,400,450,Vector2.UP,3))
		message("第一层防护解除 · 上方引力场已反转")
	elif count==2:
		zones.clear()
		message("第二层防护解除 · 向下投送，击穿最后锁定")
	else: message("协议已失去防护。左侧重新校准；右侧解除协议。")
func toggle_carry() -> void:
	if level_index==7 and exit_open and interact_terminal():return
	if player.carrying:
		var box := player.carrying
		if not free_at(box.position,box.radius,player): message("放置空间不足");return
		box.carried=false;box.velocity=player.velocity;box.base_gravity=player.gravity
		box.portal_cooldown=0.15;player.carrying=null;sound.play("pickup")
		return
	var closest: AxisActor=null
	var distance := 82.0
	for actor in actors:
		if actor.kind=="box" and actor.position.distance_to(player.position)<distance:
			var ray:=PhysicsRayQueryParameters2D.create(player.position,actor.position,1)
			if not get_world_2d().direct_space_state.intersect_ray(ray).is_empty():continue
			distance=actor.position.distance_to(player.position);closest=actor
	if closest:
		player.carrying=closest;closest.carried=true;closest.velocity=Vector2.ZERO;sound.play("pickup")
	else: message("靠近货箱后按 F 搬运")
func recall(box: AxisActor) -> void:
	box.position=box.spawn_position;box.velocity=Vector2.ZERO;box.base_gravity=Vector2.DOWN
	box.carried=false;box.reset_physics_interpolation()
	if player.carrying==box:player.carrying=null
	message("货箱已返回初始停泊位")
func melee(actor: AxisActor) -> void:
	var direction := AxisRules.tangent(actor.gravity)*actor.facing
	for enemy in actors.duplicate():
		if enemy.kind not in ["patrol","shield"] or enemy in actor.attack_targets: continue
		var d: Vector2 = enemy.position-actor.position
		if d.length()<76 and d.dot(direction)>0:
			enemy.hurt(1,actor.position);actor.attack_targets.append(enemy);hitstop=0.035
func message(value: String) -> void:
	notice=value;notice_time=4
func burst(p: Vector2,color: Color,count: int) -> void:
	if count>=18:shake_time=0.12
	if not save.data.settings.effects: return
	for i in count:
		particles.append({"pos":p,"velocity":Vector2.from_angle(randf()*TAU)*randf_range(30,170),"life":1.0,"color":color})
func die() -> void:
	if reset_pending or state!="playing": return
	reset_pending=true
	deaths+=1;sound.play("death")
	load_level(level_index,false)
	message("锚体已重启 · 当前房间复原")
func complete_level() -> void:
	state="complete";sound.play("finish")
	if not testing: save.completed(level_index,elapsed,deaths)
	ui.complete_menu()
func ending(which: String) -> void:
	state="ending";sound.play("finish")
	if not testing:
		save.completed(7,elapsed,deaths)
		if which not in save.data.endings:save.data.endings.append(which)
		save.save()
	ui.ending_menu(which)

func _exit_tree() -> void:
	for actor in actors:
		if is_instance_valid(actor): actor.world=null;actor.carrying=null
	actors.clear()
	if is_instance_valid(view):view.game=null
	if is_instance_valid(ui):ui.game=null

func clear_portals() -> void:
	portals[0]={};portals[1]={}
	message("传送门已收回")

func interact_terminal() -> bool:
	for choice in [[Vector2(320,560),"calibrate"],[Vector2(940,560),"release"]]:
		if player.position.distance_to(choice[0])<55:
			ending(choice[1]);return true
	return false
