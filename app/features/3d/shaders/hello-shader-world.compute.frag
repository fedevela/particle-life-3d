uniform float uFrame;
uniform float uSeed;

float hash12(vec2 value) {
  vec3 p3 = fract(vec3(value.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 texel = gl_FragCoord.xy;
  float index = (floor(texel.y) * resolution.x) + floor(texel.x);
  vec2 uv = texel / resolution.xy;
  vec2 previousPosition = texture2D(textureState, uv).rg;

  float randomAngle = hash12(vec2(index + (uSeed * 97.0), uFrame * 0.61803398875)) * 6.28318530718;
  float randomSpeed = 0.006 + (hash12(vec2(index + 19.0 + (uSeed * 131.0), (uFrame + 31.0) * 1.41421356237)) * 0.008);
  vec2 step = vec2(cos(randomAngle), sin(randomAngle)) * randomSpeed;
  vec2 position = (uFrame < 0.5) ? step : (previousPosition + step);

  gl_FragColor = vec4(position, step);
}
