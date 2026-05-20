shader_type canvas_item;

uniform vec4 haze_color : source_color = vec4(0.18, 0.72, 0.88, 1.0);
uniform float haze_strength = 0.12;
uniform float drift_speed = 0.045;

void fragment() {
	vec2 uv = UV;
	float tide = sin((uv.x * 9.0 + uv.y * 4.0) + TIME * drift_speed * 18.0) * 0.5 + 0.5;
	float bloom = smoothstep(0.12, 1.0, 1.0 - distance(uv, vec2(0.52, 0.48)));
	float mist = (tide * 0.28 + bloom * 0.72) * haze_strength;
	COLOR = vec4(haze_color.rgb, mist);
}
