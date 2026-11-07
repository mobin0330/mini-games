extends SceneTree
func _initialize():
	var im=Image.load_from_file("res://assets/atlas-clean.png")
	print("ALPHA: ",im.get_pixel(0,0)," / ",im.get_pixel(380,500)," USED ",im.get_used_rect())
	quit()
