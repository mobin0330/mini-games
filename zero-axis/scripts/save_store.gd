class_name AxisSave
extends RefCounted
const PATH := "user://progress.json"
var save_path: String
func _init(path: String=PATH) -> void:
	save_path=path
var data := {"unlocked":0,"last":0,"best":{},"endings":[],"settings":{"sfx":0.65,"music":0.35,"shake":true,"effects":true,"rotate":false,"hints":true,"highlight":true,"ui_scale":1.0,"text_speed":1.0},"keys":{}}
func load_data() -> void:
	if not FileAccess.file_exists(save_path): return
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(save_path))
	if parsed is Dictionary:
		for key in data:
			if parsed.has(key):
				if data[key] is Dictionary: data[key].merge(parsed[key],true)
				else: data[key] = parsed[key]
	data.unlocked=clampi(int(data.unlocked),0,7)
	data.last=clampi(int(data.last),0,int(data.unlocked))
func save() -> void:
	var file := FileAccess.open(save_path+".tmp",FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()
		DirAccess.rename_absolute(save_path+".tmp",save_path)
func completed(level: int, seconds: float, deaths: int) -> void:
	data.unlocked = maxi(int(data.unlocked), mini(level+1,7))
	var key := str(level)
	if not data.best.has(key) or seconds < data.best[key].time:
		data.best[key] = {"time":seconds,"deaths":deaths}
	save()
