class_name AxisArt
extends RefCounted
var sprites: Array[Texture2D]=[]
var animations: Array[Texture2D]=[]
var running: Array[Texture2D]=[]
var props: Array[Texture2D]=[]
var backgrounds: Array[Texture2D]=[]
var backdrop: Texture2D
func _init() -> void:
	sprites=atlas("res://assets/atlas-clean.png",4,2)
	animations=atlas("res://assets/animations.png",4,2)
	running=atlas("res://assets/run-cycle.png",4,2)
	props=atlas("res://assets/environment.png",3,3)
	for path in ["backdrop","shaft","workshop","core"]:
		if ResourceLoader.exists("res://assets/"+path+".png"):
			backgrounds.append(load("res://assets/"+path+".png"))
	if not backgrounds.is_empty():backdrop=backgrounds[0]
func atlas(path: String,columns: int,rows: int) -> Array[Texture2D]:
	var result: Array[Texture2D]=[]
	if not ResourceLoader.exists(path):return result
	var texture: Texture2D=load(path)
	var baked: Dictionary=preload("res://scripts/atlas_regions.gd").REGIONS
	if baked.has(path.get_file()):
		for bounds in baked[path.get_file()]:
			var a:=AtlasTexture.new();a.atlas=texture;a.region=Rect2(bounds[0],bounds[1],bounds[2],bounds[3]);result.append(a)
		return result
	var im := texture.get_image()
	if im.is_compressed():im.decompress()
	var cell := Vector2i(im.get_width()/columns,im.get_height()/rows)
	for i in columns*rows:
		var origin := Vector2i(i%columns,i/columns)*cell
		var low := cell
		var high := Vector2i.ZERO
		# Ignore low-alpha glow when finding silhouette bounds; pixels are never edited.
		for y in range(0,cell.y,2):
			for x in range(0,cell.x,2):
				if im.get_pixelv(origin+Vector2i(x,y)).a>0.65:
					low=low.min(Vector2i(x,y));high=high.max(Vector2i(x,y))
		var a := AtlasTexture.new()
		a.atlas=texture
		low=(low-Vector2i(3,3)).max(Vector2i.ZERO)
		high=(high+Vector2i(4,4)).min(cell)
		a.region=Rect2(Vector2(origin+low),Vector2(high-low))
		result.append(a)
	return result
