uniform float uFrame;
uniform float uSeed;

float hashScalar(vec3 value) {
  return fract(sin(dot(value, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
  vec2 texel = gl_FragCoord.xy;
  float index = (floor(texel.y) * resolution.x) + floor(texel.x);
  vec2 uv = texel / resolution.xy;
  vec2 previousPosition = texture2D(textureState, uv).rg;

  float randomAngle = hashScalar(vec3(index, uFrame, uSeed)) * 6.28318530718;
  float randomSpeed = 0.006 + (hashScalar(vec3(index + 19.0, uFrame + 31.0, uSeed + 43.0)) * 0.008);
  vec2 step = vec2(cos(randomAngle), sin(randomAngle)) * randomSpeed;
  vec2 position = (uFrame < 0.5) ? step : (previousPosition + step);

  gl_FragColor = vec4(position, step);
}
