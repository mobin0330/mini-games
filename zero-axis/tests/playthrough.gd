extends SceneTree
var game
var failed := false
var messages: Array[String]=[]
func _initialize():call_deferred("run")
func ticks(n: int):
	for i in n:await physics_frame
func move(value: float):
	Input.action_release("left");Input.action_release("right")
	if value>0:Input.action_press("right",absf(value))
	elif value<0:Input.action_press("left",absf(value))
func pulse(action: String):
	Input.action_press(action)
	await ticks(2)
	Input.action_release(action)
func log_state(label: String):
	var message := "%s position=%s velocity=%s state=%s" %[label,game.player.position,game.player.velocity,game.state]
	messages.append(message);print(message)
func wait_for(predicate: Callable,limit: int,label: String) -> bool:
	for i in limit:
		if predicate.call():log_state("PASS "+label);return true
		await ticks(1)
	log_state("FAIL "+label);failed=true;return false
func gravity(g: Vector2):
	for i in 60:
		if game.player.change_gravity(g):return
		await ticks(1)
	failed=true;log_state("FAIL gravity change")
func x_to(target: float,limit: int=400):
	for i in limit:
		if game.state=="complete":return
		var p=game.player
		var error: float=target-p.position.x
		if absf(error)<4 and absf(p.velocity.x)<25:move(0);return
		var t:Vector2=AxisRules.tangent(p.gravity)
		if absf(t.x)>0.5:move(clampf(error*4/320,-1,1)/t.x)
		await ticks(1)
	failed=true;log_state("FAIL x_to "+str(target))
	move(0)
func y_to(target: float,limit: int=400):
	for i in limit:
		if game.state=="complete":return
		var p=game.player
		var error: float=target-p.position.y
		if absf(error)<5 and absf(p.velocity.y)<30:move(0);return
		var t:Vector2=AxisRules.tangent(p.gravity)
		if absf(t.y)>0.5:move(clampf(error*5/320,-1,1)/t.y)
		await ticks(1)
	failed=true;log_state("FAIL y_to "+str(target))
	move(0)
func run():
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);game.testing=true
	await ticks(2)
	if "--late" not in OS.get_cmdline_user_args() and "--final" not in OS.get_cmdline_user_args():
		game.start_level(0);await ticks(40)
		move(1)
		await wait_for(func():return game.player.position.x>245,100,"1 approach first platform")
		await pulse("jump")
		await wait_for(func():return game.player.position.x>475,130,"1 cross first platform")
		move(0);await ticks(50)
		move(1);await pulse("jump")
		await wait_for(func():return game.player.position.x>725,150,"1 cross second platform")
		await wait_for(func():return game.player.position.y<390,200,"1 walk up gravity wall")
		move(0)
		await wait_for(func():return game.state=="complete",260,"1 reach exit")
		game.start_level(1);await ticks(45)
		move(1);await wait_for(func():return game.player.position.x>220,100,"2 setup ceiling")
		move(0);await ticks(20);await gravity(Vector2.UP)
		await wait_for(func():return game.room.visits[0].done,200,"2 ceiling anchor")
		await wait_for(func():return game.player.is_on_floor(),100,"2 ceiling landed")
		move(-1);await wait_for(func():return game.player.position.x>490,160,"2 travel over wall")
		move(0);await ticks(20);await gravity(Vector2.DOWN)
		await wait_for(func():return game.room.visits[1].done,200,"2 side anchor")
		await wait_for(func():return game.player.is_on_floor(),100,"2 floor landed")
		move(1);await wait_for(func():return game.state=="complete",350,"2 exit")
		move(0)
		game.start_level(2);await ticks(30)
		move(1);await wait_for(func():return game.player.position.x>355,120,"3 enter deep well")
		move(-1);await wait_for(func():return game.player.velocity.x<8,80,"3 align descent with blue aperture")
		move(0)
		await wait_for(func():return game.teleports>0,180,"3 real falling teleport")
		await wait_for(func():return game.switches[0].active,250,"3 momentum receiver")
		await ticks(65)
		move(-1);await wait_for(func():return game.state=="complete",100,"3 exit")
		move(0)
		game.start_level(3);await ticks(45)
		await gravity(Vector2.UP)
		await wait_for(func():return game.player.is_on_floor() and game.player.position.y<140,240,"4 ceiling")
		await x_to(720)
		await gravity(Vector2.DOWN)
		await wait_for(func():return game.switches[0].active,220,"4 timed impact")
		await ticks(5);await gravity(Vector2.UP)
		move(-1)
		await wait_for(func():return game.player.position.x>1100,220,"4 race over barrier")
		move(0);await x_to(1170);await gravity(Vector2.DOWN)
		await wait_for(func():return game.state=="complete",230,"4 timed exit")
		move(0)
		game.start_level(4);await ticks(45)
		await x_to(208);game.toggle_carry()
		await x_to(360);game.toggle_carry();await ticks(35)
		await wait_for(func():return game.switches[0].active,60,"5 weight box latch")
		await x_to(608);game.toggle_carry()
		await x_to(790)
		move(1)
		await wait_for(func():return game.player.gravity==Vector2.RIGHT,80,"5 enter lateral field")
		await y_to(350)
		await wait_for(func():return game.player.is_on_floor(),180,"5 wall settled")
		game.toggle_carry();await ticks(50)
		await wait_for(func():return game.switches[1].active,80,"5 directional box pressure")
		await gravity(Vector2.UP)
		move(1)
		await wait_for(func():return game.player.position.y<230,150,"5 leave field upward")
		move(0)
		await wait_for(func():return game.player.position.y<190 or game.state=="complete",100,"5 reach upper airlock")
		await x_to(1180,100)
		await wait_for(func():return game.state=="complete",100,"5 exit")
		move(0)
	if "--final" not in OS.get_cmdline_user_args():
		game.start_level(5);await ticks(45)
		await x_to(198);game.toggle_carry()
		await x_to(390);game.toggle_carry();await ticks(35)
		await wait_for(func():return game.switches[0].active,60,"6 weight latch")
		await x_to(850)
		if not game.place_portal_at(1,Vector2(730,450)):failed=true;log_state("FAIL 6 orange placement")
		await x_to(390);game.toggle_carry()
		await x_to(600);await gravity(Vector2.UP)
		await wait_for(func():return game.player.is_on_floor() and game.player.position.y<140,240,"6 lift cargo to ceiling")
		await gravity(Vector2.DOWN);await ticks(2)
		if game.player.carrying:
			if not game.place_portal_at(0,Vector2(game.player.carrying.position.x,640)):failed=true;log_state("FAIL 6 blue placement")
			game.toggle_carry()
		else:failed=true;log_state("FAIL 6 cargo missing")
		await wait_for(func():return game.switches[2].active,300,"6 falling cargo through portal hits momentum latch")
		await wait_for(func():return game.player.is_on_floor(),180,"6 return floor")
		game.clear_portals()
		await x_to(530);game.toggle_carry()
		await x_to(850)
		await gravity(Vector2.UP)
		await wait_for(func():return game.player.is_on_floor() and game.player.position.y<140,240,"6 lift second cargo")
		await x_to(1100)
		await gravity(Vector2.DOWN)
		await wait_for(func():return game.player.gravity==Vector2.RIGHT,180,"6 enter direction zone")
		await y_to(330)
		await wait_for(func():return game.player.is_on_floor(),180,"6 wall contact")
		game.toggle_carry();await ticks(60)
		await wait_for(func():return game.switches[1].active,80,"6 direction latch")
		move(-1)
		await wait_for(func():return game.player.position.y>430,150,"6 leave direction zone")
		move(0);await x_to(1170)
		await wait_for(func():return game.state=="complete",180,"6 exit with AND circuit")
		move(0)
	game.start_level(6);await ticks(40)
	await x_to(258);game.toggle_carry()
	for round_index in 2:
		var enemy=game.actors.filter(func(a):return a.kind in ["patrol","shield"])[0]
		move(signf(enemy.position.x-game.player.position.x));await ticks(2)
		await wait_for(func():return game.actors.any(func(a):return a.kind in ["patrol","shield"] and a.position.distance_to(game.player.position)<165),320,"7 approach guard "+str(round_index))
		await pulse("dash");game.toggle_carry();move(0);log_state("7 released projectile")
		await wait_for(func():return game.actors.filter(func(a):return a.kind in ["patrol","shield"]).size()<2-round_index,220,"7 physical cargo kill "+str(round_index))
		if round_index==0:
			await ticks(45)
			var box=game.actors.filter(func(a):return a.kind=="box")[0]
			await x_to(box.position.x-38,160);game.toggle_carry()
	await x_to(1170)
	await wait_for(func():return game.state=="complete",120,"7 combat exit without melee")
	move(0)
	game.start_level(7);await ticks(45)
	await x_to(850)
	if not game.place_portal_at(1,Vector2(662,420)):failed=true;log_state("FAIL 8 orange placement")
	await x_to(170);game.toggle_carry();await x_to(450)
	await gravity(Vector2.UP)
	await wait_for(func():return game.player.is_on_floor() and game.player.position.y<140,240,"8 traversal anchor and cargo lift")
	await gravity(Vector2.DOWN);await ticks(2)
	if game.player.carrying:
		if not game.place_portal_at(0,Vector2(game.player.carrying.position.x,640)):failed=true;log_state("FAIL 8 blue placement")
		game.toggle_carry()
	else:failed=true;log_state("FAIL 8 missing first cargo")
	await wait_for(func():return game.switches[0].active,300,"8 first shield kinetic impact")
	game.clear_portals()
	await wait_for(func():return game.player.is_on_floor(),240,"8 regroup")
	# Return along the floor to the second cube; the upper field does not cover the floor.
	if game.player.gravity!=Vector2.DOWN:await gravity(Vector2.DOWN)
	await wait_for(func():return game.player.position.y>580,260,"8 return to workshop floor")
	await x_to(470);game.toggle_carry();log_state("8 picked second cargo "+str(game.player.carrying!=null));await x_to(800)
	await gravity(Vector2.UP)
	await wait_for(func():return game.player.position.y<380,150,"8 accelerate cargo upward")
	game.toggle_carry()
	await wait_for(func():return game.switches[1].active,180,"8 second shield reverse-gravity impact")
	await wait_for(func():return game.player.is_on_floor(),200,"8 upper dock")
	game.toggle_carry()
	await x_to(920)
	await gravity(Vector2.DOWN);await ticks(2);game.toggle_carry()
	await wait_for(func():return game.switches[2].active,220,"8 third shield downward impact")
	await wait_for(func():return game.exit_open or game.state=="ending",120,"8 all circuits and traversal completed")
	var terminal:=Vector2(320,560) if "--calibrate" in OS.get_cmdline_user_args() else Vector2(940,560)
	await wait_for(func():return game.player.is_on_floor(),120,"8 dock before final choice")
	await x_to(terminal.x);await pulse("jump")
	await wait_for(func():return game.player.position.distance_to(terminal)<55,100,"8 reach physical choice terminal")
	game.toggle_carry()
	await wait_for(func():return game.state=="ending",30,"8 physical terminal ending")
	move(0)
	print("PLAYTHROUGH ","FAIL" if failed else "PASS")
	var file=FileAccess.open("res://docs/playthrough.txt",FileAccess.WRITE);file.store_string("\n".join(messages));file.close()
	game.queue_free();await process_frame;await process_frame
	quit(1 if failed else 0)
