uniform float uSeed;
uniform float uStep;

float quantize(float value) {
  return floor(value * 1000000.0 + 0.5) / 1000000.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 current = texture2D(texturePosition, uv);
  float frame = current.w + 1.0;
  float phase = frame * uStep + uSeed * 6.28318530718;
  vec3 delta = vec3(
    sin(phase * 0.71 + uSeed),
    cos(phase * 0.53 + uSeed * 0.5),
    sin(phase * 0.37 + uSeed * 0.25)
  ) * 0.01;
  vec3 nextPosition = clamp(current.xyz + delta, vec3(-2.0), vec3(2.0));

  gl_FragColor = vec4(
    quantize(nextPosition.x),
    quantize(nextPosition.y),
    quantize(nextPosition.z),
    frame
  );
}
