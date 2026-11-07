extends SceneTree
var checks := 0
var failures: Array[String]=[]
var game
func check(value: bool,label: String):
	checks+=1
	if not value:failures.append(label);print("FAIL ",label)
	else: print("PASS ",label)
func ticks(n: int):
	for i in n:await physics_frame
func _initialize():call_deferred("run")
func run():
	var directions := [Vector2.UP,Vector2.DOWN,Vector2.LEFT,Vector2.RIGHT]
	for a in directions:
		for b in directions:
			var v := Vector2(371,921)
			var out := AxisRules.portal_vector(v,a,b)
			check(absf(v.length()-out.length())<0.001,"portal speed %s -> %s" %[a,b])
			check(AxisRules.portal_vector(out,b,a).is_equal_approx(v),"portal inverse %s -> %s" %[a,b])
	check(AxisRules.portal_vector(Vector2(0,900),Vector2.UP,Vector2.RIGHT).is_equal_approx(Vector2(900,0)),"floor-to-wall launches right")
	check(AxisRules.crossing(Vector2(0,-100),Vector2(0,120),Vector2.ZERO,Vector2.UP,17),"swept crossing at high speed")
	check(not AxisRules.crossing(Vector2(60,-100),Vector2(60,120),Vector2.ZERO,Vector2.UP,17),"aperture rejects edge")
	check(not AxisRules.crossing(Vector2(0,100),Vector2(0,-100),Vector2.ZERO,Vector2.UP,17),"backside rejected")
	var zones := [AxisLevels.zone(0,0,100,100,Vector2.LEFT,1),AxisLevels.zone(0,0,100,100,Vector2.UP,4)]
	check(AxisRules.effective_gravity(Vector2(50,50),Vector2.DOWN,zones)==Vector2.UP,"priority override")
	zones.reverse()
	check(AxisRules.effective_gravity(Vector2(50,50),Vector2.DOWN,zones)==Vector2.UP,"priority independent of order")
	check(AxisRules.effective_gravity(Vector2(110,50),Vector2.DOWN,zones)==Vector2.DOWN,"outside restores base")
	check(AxisRules.logic([true,true],"AND") and not AxisRules.logic([true,false],"AND"),"AND logic")
	check(AxisRules.logic([false,true],"OR") and not AxisRules.logic([false,false],"OR"),"OR logic")
	check(not AxisRules.impact(Vector2(900,0),Vector2.UP,650),"momentum direction matters")
	check(not AxisRules.impact(Vector2(0,600),Vector2.UP,650),"momentum threshold rejects slow")
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);game.testing=true
	await ticks(2)
	for i in 8:
		game.start_level(i);await ticks(3)
		check(game.player!=null and game.room.title!="","level %d loads and advances physics" %(i+1))
		check(not game.exit_open if i in [0,1,2,3,4,5,6,7] else true,"level %d objective gated" %(i+1))
	game.start_level(1);await ticks(50)
	var p=game.player
	for g in directions:
		p.position=Vector2(200,300);p.base_gravity=g;p.velocity=Vector2.ZERO;p.reset_physics_interpolation()
		await ticks(150)
		check(p.is_on_floor(),"ground detection "+str(g))
		var before:Vector2=p.position
		p.step(1.0/120,{"jump":true})
		check(p.velocity.dot(-g)>480,"jump opposite gravity "+str(g))
		p.position=before;p.velocity=Vector2.ZERO
	p.position=Vector2(600,300);p.velocity=Vector2(100,400);p.grounded=true;p.gravity_cooldown=0
	var before:Vector2=p.velocity
	check(p.change_gravity(Vector2.LEFT),"ground gravity change permitted")
	check(p.velocity==before,"gravity change preserves world velocity")
	p.grounded=false;p.gravity_cooldown=0;p.airborne_changes=1
	check(p.change_gravity(Vector2.UP),"one airborne change")
	p.gravity_cooldown=0
	check(not p.change_gravity(Vector2.RIGHT),"second airborne change denied")
	game.start_level(2);await ticks(2);p=game.player
	game.portals.assign([{"position":Vector2(400,640),"normal":Vector2.UP},{"position":Vector2(536,200),"normal":Vector2.RIGHT}])
	p.position=Vector2(400,620);p.velocity=Vector2(0,900);p.dash_direction=Vector2.DOWN;p.portal_cooldown=0
	check(game.try_portal(p,p.position,p.position+Vector2(0,15)),"real floor-to-wall teleport")
	check(p.velocity.is_equal_approx(Vector2(900,0)),"real teleport conserves directional speed")
	check(p.dash_direction==Vector2.RIGHT,"dash direction transformed")
	check(not game.try_portal(p,p.position,p.position+Vector2(20,0)),"portal cooldown prevents looping")
	p.portal_cooldown=0;p.position=Vector2(400,620);p.velocity=Vector2(0,900)
	var blocker=game.spawn_actor(Vector2(556,200),"box")
	check(not game.try_portal(p,p.position,p.position+Vector2(0,15)),"occupied exit refuses teleport")
	check(p.position==Vector2(400,620),"blocked exit leaves traveller outside wall")
	game.start_level(4);await ticks(5);p=game.player
	var box=game.actors[1]
	p.position=Vector2(250,580);box.position=Vector2(290,580)
	game.toggle_carry();check(p.carrying==box and box.carried,"pickup within range")
	p.velocity=Vector2(230,-100);p.gravity=Vector2.LEFT
	game.toggle_carry();check(not box.carried and box.velocity==Vector2(230,-100) and box.base_gravity==Vector2.LEFT,"release inherits velocity and gravity")
	box.position=Vector2(400,622);box.base_gravity=Vector2.DOWN;box.velocity=Vector2.ZERO
	await ticks(12);check(game.switches[0].active,"weight switch physical contact")
	box.position=Vector2(1205,350);box.base_gravity=Vector2.RIGHT;box.velocity=Vector2.ZERO
	await ticks(15);check(game.switches[1].active,"direction switch physical contact")
	game.load_level(4,false);await ticks(2)
	check(not game.switches[0].active and not game.switches[1].active,"room reset clears latches")
	game.start_level(6);await ticks(2)
	var shield=game.actors[-1]
	shield.facing=-1;shield.gravity=Vector2.DOWN;shield.invulnerable=0
	shield.hurt(1,shield.position+Vector2(-50,0));check(shield.health==3,"front shield blocks melee")
	shield.hurt(1,shield.position+Vector2(50,0));check(shield.health==2,"back attack damages shield enemy")
	var health:int=shield.health;shield.hurt(1,shield.position+Vector2(50,0));check(shield.health==health,"damage invulnerability")
	shield.invulnerable=0;shield.hurt(3,shield.position+Vector2(-50,0),true)
	check(shield.is_queued_for_deletion(),"physical impact breaks shield")
	await ticks(2)
	game.start_level(0);await ticks(2)
	game.player.hurt(3,Vector2.ZERO,true);await ticks(3)
	check(game.player.health==3 and game.deaths==1,"death reconstructs room and health")
	game.start_level(7);await ticks(2)
	game.ending("calibrate");check(game.state=="ending","calibration ending renders")
	game.start_level(7);game.ending("release");check(game.state=="ending","release ending renders")
	var test_save := AxisSave.new("user://zero-axis-test-save.json")
	test_save.data.last=1;test_save.data.unlocked=2;test_save.data.settings.music=0.15;test_save.save()
	var restored := AxisSave.new("user://zero-axis-test-save.json");restored.load_data()
	check(restored.data.last==1 and restored.data.unlocked==2 and is_equal_approx(restored.data.settings.music,0.15),"save round trip progress and settings")
	DirAccess.remove_absolute("user://zero-axis-test-save.json")
	game.start_level(1);await ticks(2);p=game.player
	p.position=Vector2(600,300);p.base_gravity=Vector2.DOWN;p.coyote=0.08;p.velocity=Vector2.ZERO
	p.step(1.0/120,{"jump":true})
	check(p.velocity.y< -490,"coyote jump after leaving ledge")
	p.position=Vector2(600,605);p.coyote=0;p.velocity=Vector2(0,200);p.jump_buffer=0
	p.step(1.0/120,{"jump":true})
	await ticks(10)
	check(p.velocity.y< -400,"buffered jump fires on landing")
	game.start_level(4);await ticks(3);p=game.player
	var carried_box=game.actors[1]
	p.position=Vector2(600,111);p.base_gravity=Vector2.DOWN;p.velocity=Vector2.ZERO
	p.carrying=carried_box;carried_box.carried=true
	await ticks(1)
	check(game.free_at(carried_box.position,carried_box.radius,p),"ceiling carrying selects collision-free alternate mount")
	print("RESULT: ",checks-failures.size(),"/",checks," checks passed")
	var report=FileAccess.open("res://docs/test-results.txt",FileAccess.WRITE)
	report.store_string("Godot 4.5.2 / headless integration\n%d/%d passed\n" %[checks-failures.size(),checks]+"\n".join(failures));report.close()
	game.queue_free();await process_frame;await process_frame
	quit(0 if failures.is_empty() else 1)
