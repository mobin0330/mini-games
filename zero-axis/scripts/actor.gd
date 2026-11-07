class_name AxisActor
extends CharacterBody2D
var world: Node2D
var kind := "player"
var base_gravity := Vector2.DOWN
var gravity := Vector2.DOWN
var radius := 17.0
var facing := 1.0
var health := 3
var airborne_changes := 1
var gravity_cooldown := 0.0
var portal_cooldown := 0.0
var dash_cooldown := 0.0
var dash_time := 0.0
var dash_direction := Vector2.RIGHT
var coyote := 0.0
var jump_buffer := 0.0
var invulnerable := 0.0
var attack_time := 0.0
var attack_targets: Array = []
var carried := false
var carrying: AxisActor
var spawn_position := Vector2.ZERO
var prior_velocity := Vector2.ZERO
var visual_angle := 0.0
var age := 0.0
var land_time := 0.0
var was_grounded := false
var grounded := false
var trail: Array[Vector2] = []
func _ready() -> void:
	collision_layer=2 if kind=="player" else 4
	collision_mask=1
	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius=radius
	shape.shape=circle
	add_child(shape)
	floor_stop_on_slope=false
	floor_constant_speed=false
	floor_snap_length=3
	spawn_position=position
	if kind=="shield": health=3
func change_gravity(direction: Vector2) -> bool:
	if gravity_cooldown>0 or (not grounded and airborne_changes<=0): return false
	if world.is_gravity_locked(position): return false
	base_gravity=direction
	if not grounded: airborne_changes-=1
	gravity_cooldown=0.25
	world.sound.play("gravity")
	return true
func step(dt: float, control: Dictionary={}) -> void:
	age+=dt
	gravity_cooldown=maxf(0,gravity_cooldown-dt)
	portal_cooldown=maxf(0,portal_cooldown-dt)
	dash_cooldown=maxf(0,dash_cooldown-dt)
	invulnerable=maxf(0,invulnerable-dt)
	if carried:
		queue_redraw()
		return
	gravity=AxisRules.effective_gravity(position,base_gravity,world.zones)
	up_direction=-gravity
	var tangent := AxisRules.tangent(gravity)
	grounded=is_on_floor()
	if grounded and not was_grounded:land_time=0.12
	land_time=maxf(0,land_time-dt)
	was_grounded=grounded
	if grounded:
		coyote=0.10
		airborne_changes=1
	else: coyote=maxf(0,coyote-dt)
	var move := float(control.get("move",0.0))
	if kind=="patrol" or kind=="shield":
		var offset: Vector2=world.player.position-position
		move=facing*0.38
		if offset.length()<320: move=signf(offset.dot(tangent))*0.48
		if is_on_wall(): facing=-facing; move=facing*0.45
	if absf(move)>0.01: facing=signf(move)
	if kind!="box":
		var along := velocity.dot(tangent)
		if move != 0:
			# No-input air motion and excess tangential momentum remain intact.
			if absf(along)<AxisRules.SPEED or signf(move)!=signf(along):
				velocity+=tangent*(move_toward(along,move*AxisRules.SPEED,(2400 if grounded else 1500)*dt)-along)
		elif grounded: velocity-=tangent*clampf(along,-2800*dt,2800*dt)
	elif grounded:
		velocity-=tangent*clampf(velocity.dot(tangent),-1000*dt,1000*dt)
	if control.get("jump",false): jump_buffer=0.12
	else: jump_buffer=maxf(0,jump_buffer-dt)
	if jump_buffer>0 and coyote>0:
		velocity-=gravity*(velocity.dot(gravity)+520)
		jump_buffer=0
		coyote=0
		grounded=false
		world.sound.play("jump")
	if control.get("dash",false) and dash_cooldown<=0:
		dash_direction=tangent*facing
		velocity=dash_direction*900
		dash_time=0.15
		dash_cooldown=0.5
		invulnerable=maxf(invulnerable,0.16)
		world.sound.play("dash")
	if dash_time>0: dash_time-=dt
	else: velocity+=gravity*AxisRules.GRAVITY*dt
	velocity=velocity.limit_length(1800)
	prior_velocity=velocity
	world.try_portal(self,position,position+velocity*dt)
	move_and_slide()
	world.resolve_actor(self,dt)
	if carrying and is_instance_valid(carrying):
		var offsets := [tangent*facing*40, -gravity*40, -tangent*facing*40, gravity*40]
		for offset in offsets:
			var target: Vector2=position+offset
			if world.free_at(target,carrying.radius,self):
				carrying.position=target
				break
		carrying.gravity=gravity
		carrying.visual_angle=visual_angle
	if attack_time>0:
		attack_time-=dt
		if attack_time<0.23 and attack_time>0.10: world.melee(self)
	visual_angle=lerp_angle(visual_angle,gravity.angle()-PI/2,clampf(dt*16,0,1))
	trail.push_front(position)
	if trail.size()>8: trail.pop_back()
	queue_redraw()
func attack() -> void:
	if attack_time<=0:
		attack_time=0.34
		attack_targets.clear()
func hurt(amount: int, source: Vector2, physical: bool=false) -> void:
	if invulnerable>0 or carried: return
	if kind=="shield" and not physical and (source-position).dot(AxisRules.tangent(gravity)*facing)>0:
		world.burst(position,Color("ffb85e"),12)
		world.sound.play("deny")
		return
	health-=amount
	invulnerable=0.9
	velocity+=(position-source).normalized()*180
	world.sound.play("hit")
	world.burst(position,Color("ff8b68"),16)
	if health<=0:
		if kind=="player": world.die.call_deferred()
		else:
			world.actors.erase(self)
			queue_free()
func _draw() -> void:
	if carried and not visible: return
	if invulnerable>0 and fmod(age,0.12)>0.07: return
	draw_set_transform(Vector2.ZERO,visual_angle,Vector2(facing if kind!="box" else 1,1))
	var index := 0
	var size := Vector2(42,51)
	if kind=="player":
		if not grounded: index=3
		elif absf(velocity.dot(AxisRules.tangent(gravity)))>30: index=1+int(age*12)%2
	elif kind=="patrol": index=4
	elif kind=="shield": index=5; size=Vector2(45,59)
	else: index=6; size=Vector2(38,38)
	if world.art.sprites.size()>index:
		var texture: Texture2D=world.art.sprites[index]
		if kind=="player" and index in [1,2] and world.art.running.size()==8:texture=world.art.running[int(age*14)%8]
		if kind=="player" and world.art.animations.size()==8:
			if attack_time>0: texture=world.art.animations[clampi(int((0.34-attack_time)/0.085),0,3)]
			elif dash_time>0: texture=world.art.animations[5]
			elif invulnerable>0.65: texture=world.art.animations[6]
			elif carrying: texture=world.art.animations[7]
			elif land_time>0: texture=world.art.animations[4]
		size.x=size.y*texture.get_width()/texture.get_height()
		if kind=="box":size=Vector2(38,38)
		draw_texture_rect(texture,Rect2(-size/2+Vector2(0,-7 if kind!="box" else 0),size),false)
	if attack_time>0.10 and attack_time<0.23:
		draw_arc(Vector2.ZERO,49,-1.2,1.2,18,Color("c5ffff"),5,true)
	draw_set_transform(Vector2.ZERO)
	if kind=="shield":
		var t := AxisRules.tangent(gravity)*facing
		draw_line(t*25-gravity*28,t*25+gravity*28,Color(1,0.65,0.28,0.8),4,true)
