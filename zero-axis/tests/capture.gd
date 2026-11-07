extends SceneTree
func _initialize():call_deferred("run")
func capture(path: String):
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(path)
func run():
	var game=load("res://scenes/main.tscn").instantiate()
	root.add_child(game);game.testing=true
	await process_frame
	for i in 5:await process_frame
	await capture("res://docs/menu.png")
	for level in [0,2,5,7]:
		game.start_level(level)
		for i in 35:await physics_frame
		await capture("res://docs/level-%02d.png" %(level+1))
	game.state="paused";game.ui.settings_menu("paused")
	for i in 3:await process_frame
	await capture("res://docs/settings.png")
	root.size=Vector2i(960,540)
	game.ui.main_menu()
	for i in 10:await process_frame
	await capture("res://docs/menu-960.png")
	game.start_level(5)
	for i in 20:await physics_frame
	await capture("res://docs/level-960.png")
	game.queue_free();await process_frame
	quit()
