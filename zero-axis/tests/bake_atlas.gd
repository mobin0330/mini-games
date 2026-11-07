extends SceneTree
func _initialize():
	var art=AxisArt.new()
	var result:Dictionary={}
	for pair in [["atlas-clean.png",art.sprites],["animations.png",art.animations],["run-cycle.png",art.running],["environment.png",art.props]]:
		var regions:Array=[]
		for texture in pair[1]:
			regions.append([texture.region.position.x,texture.region.position.y,texture.region.size.x,texture.region.size.y])
		result[pair[0]]=regions
	var out=FileAccess.open("res://scripts/atlas_regions.gd",FileAccess.WRITE)
	out.store_string("# Baked from generated sprite alpha bounds; no runtime pixel scan.\nextends RefCounted\nconst REGIONS = "+JSON.stringify(result)+"\n")
	quit()
