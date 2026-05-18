extends RefCounted

static func texture(width: int, height: int, base: Color, rects: Array) -> ImageTexture:
	var image := Image.create(width, height, false, Image.FORMAT_RGBA8)
	image.fill(base)
	for rect in rects:
		_draw_rect(image, int(rect.x), int(rect.y), int(rect.w), int(rect.h), rect.color)
	return ImageTexture.create_from_image(image)

static func sprite(texture: Texture2D, scale_value: float = 4.0, centered := true) -> Sprite2D:
	var node := Sprite2D.new()
	node.texture = texture
	node.centered = centered
	node.scale = Vector2(scale_value, scale_value)
	node.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return node

static func solid_sprite(width: int, height: int, color: Color, scale_value: float = 4.0) -> Sprite2D:
	return sprite(texture(width, height, Color.TRANSPARENT, [{"x": 0, "y": 0, "w": width, "h": height, "color": color}]), scale_value)

static func _draw_rect(image: Image, x: int, y: int, width: int, height: int, color: Color) -> void:
	for yy in range(max(0, y), min(image.get_height(), y + height)):
		for xx in range(max(0, x), min(image.get_width(), x + width)):
			image.set_pixel(xx, yy, color)
