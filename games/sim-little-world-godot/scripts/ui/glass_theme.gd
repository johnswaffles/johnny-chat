extends RefCounted


func style_panel(panel: Panel, color: Color = Color(0.025, 0.045, 0.065, 0.78), border: Color = Color(0.45, 0.9, 1.0, 0.14)) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.corner_radius_top_left = 20
	style.corner_radius_top_right = 20
	style.corner_radius_bottom_left = 20
	style.corner_radius_bottom_right = 20
	style.shadow_color = Color(0, 0, 0, 0.35)
	style.shadow_size = 18
	style.shadow_offset = Vector2(0, 8)
	panel.add_theme_stylebox_override("panel", style)


func style_button(button: Button, accent: Color = Color(0.16, 0.45, 0.58, 0.55)) -> void:
	button.add_theme_font_size_override("font_size", 15)
	button.add_theme_color_override("font_color", Color(0.9, 1.0, 0.96, 0.96))
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.add_theme_color_override("font_pressed_color", Color("#8fffea"))
	button.add_theme_stylebox_override("normal", _button_box(Color(0.04, 0.07, 0.09, 0.82), Color(0.42, 0.8, 0.95, 0.12)))
	button.add_theme_stylebox_override("hover", _button_box(accent, Color(0.56, 0.96, 1.0, 0.42)))
	button.add_theme_stylebox_override("pressed", _button_box(Color(0.05, 0.32, 0.34, 0.92), Color(0.42, 1.0, 0.82, 0.75)))
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())


func _button_box(bg: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(1)
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	style.content_margin_left = 10
	style.content_margin_right = 10
	return style
