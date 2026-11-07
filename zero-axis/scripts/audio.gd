class_name AxisAudio
extends Node
var settings: Dictionary
var voices: Array[AudioStreamPlayer] = []
var music: AudioStreamPlayer
func _ready() -> void:
	for i in 8:
		var voice := AudioStreamPlayer.new()
		add_child(voice)
		voices.append(voice)
	music = AudioStreamPlayer.new()
	add_child(music)
	var stream := AudioStreamWAV.new()
	stream.mix_rate=22050
	stream.format=AudioStreamWAV.FORMAT_16_BITS
	var bytes := PackedByteArray()
	bytes.resize(22050*8*2)
	for i in 22050*8:
		var t := float(i)/22050.0
		var value := sin(TAU*55*t)*0.08 + sin(TAU*82.5*t)*0.045 + sin(TAU*110*t)*0.025*(0.5+0.5*sin(TAU*t/8))
		bytes.encode_s16(i*2,int(value*32767))
	stream.data=bytes
	stream.loop_mode=AudioStreamWAV.LOOP_FORWARD
	stream.loop_end=22050*8
	music.stream=stream
	music.play()
func _process(_dt: float) -> void:
	music.volume_db=linear_to_db(maxf(0.0001,float(settings.get("music",0.35))))
func play(kind: String) -> void:
	var frequencies := {"jump":440.0,"dash":180.0,"gravity":660.0,"portal":880.0,"pickup":550.0,"hit":90.0,"switch":1100.0,"death":65.0,"finish":1320.0,"deny":130.0}
	var hz: float=frequencies.get(kind,330.0)
	var stream := AudioStreamWAV.new()
	stream.mix_rate=22050
	stream.format=AudioStreamWAV.FORMAT_16_BITS
	var bytes := PackedByteArray()
	var count := 6000
	bytes.resize(count*2)
	for i in count:
		var t := float(i)/22050.0
		var envelope := pow(1.0-float(i)/count,2.0)
		var value := (sin(TAU*hz*t*(1.0-t))+sin(TAU*hz*1.5*t)*0.25)*envelope*0.23
		bytes.encode_s16(i*2,int(value*32767))
	stream.data=bytes
	for voice in voices:
		if not voice.playing:
			voice.stream=stream
			voice.volume_db=linear_to_db(maxf(0.0001,float(settings.get("sfx",0.65))))
			voice.play()
			break

func _exit_tree() -> void:
	if is_instance_valid(music):music.stop();music.stream=null
	for voice in voices:
		voice.stop();voice.stream=null
