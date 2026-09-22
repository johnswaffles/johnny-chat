shader_type canvas_item;
uniform float ocean_time = 0.0;
uniform float motion_amount = 1.0;
uniform vec4 event_tint : source_color = vec4(0.5, 0.8, 1.0, 1.0);
uniform float event_strength = 0.0;
uniform float climate_warmth = 0.0;
void fragment() {
	vec2 uv = UV;
	float t = ocean_time * motion_amount;
	vec2 flow = uv * vec2(23.0, 18.0);
	flow += vec2(sin(uv.y * 12.0 + t * 0.22), cos(uv.x * 9.0 - t * 0.18)) * 0.6;
	float a = sin(flow.x + sin(flow.y + t * 0.16));
	float b = sin(flow.y - sin(flow.x - t * 0.13));
	float caustic = pow(max(0.0, 1.0 - abs(a + b) * 0.7), 9.0);
	float light = smoothstep(1.1, 0.0, distance(uv, vec2(0.28, 0.18)));
	float shaft = pow(max(0.0, sin(uv.x * 16.0 + uv.y * 3.0 + t * 0.06)), 14.0) * (1.0 - uv.y);
	// Soft edge wash signals an intervention without obscuring life or flashing.
	float edge = smoothstep(0.25, 0.75, distance(uv, vec2(0.5)));
	float wash = event_strength * (0.025 + edge * 0.16);
	vec3 water_light = mix(vec3(0.48, 0.93, 0.83), vec3(0.94, 0.68, 0.40), climate_warmth * 0.3);
	float base_alpha = caustic * 0.045 + light * 0.022 + shaft * 0.035;
	COLOR = vec4(mix(water_light, event_tint.rgb, wash / max(0.001, base_alpha + wash)), base_alpha + wash);
}
