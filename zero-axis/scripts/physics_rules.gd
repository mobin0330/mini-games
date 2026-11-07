class_name AxisRules
extends RefCounted
const GRAVITY := 980.0
const SPEED := 320.0
const RADIUS := 17.0
static func tangent(g: Vector2) -> Vector2:
	return Vector2(g.y, -g.x)
static func portal_vector(v: Vector2, incoming: Vector2, outgoing: Vector2) -> Vector2:
	return -v.dot(tangent(incoming)) * tangent(outgoing) - v.dot(incoming) * outgoing
static func effective_gravity(pos: Vector2, base: Vector2, zones: Array) -> Vector2:
	var result := base
	var priority := -99999
	for zone in zones:
		if zone.rect.has_point(pos) and zone.priority > priority:
			priority = zone.priority
			result = zone.gravity
	return result
static func crossing(a: Vector2, b: Vector2, center: Vector2, normal: Vector2, radius: float) -> bool:
	var da := (a-center).dot(normal) - radius
	var db := (b-center).dot(normal) - radius
	if da < -1.5 or db > 0.0 or da <= db:
		return false
	var point := a.lerp(b, clampf(da / (da-db), 0.0, 1.0))
	return absf((point-center).dot(tangent(normal))) < 45.0-radius
static func impact(speed: Vector2, normal: Vector2, threshold: float) -> bool:
	return -speed.dot(normal) >= threshold
static func logic(values: Array, mode: String) -> bool:
	if values.is_empty(): return true
	return values.all(func(v): return v) if mode == "AND" else values.any(func(v): return v)
