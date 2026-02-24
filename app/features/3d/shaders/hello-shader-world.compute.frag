uniform float uFrame;

void main() {
  vec2 texel = gl_FragCoord.xy;
  float index = (floor(texel.y) * resolution.x) + floor(texel.x);

  float phase = (uFrame * 0.035) + (index * 0.017);
  float radialOffset = sin((index * 0.013) + (uFrame * 0.010));
  float radius = 0.35 + (0.25 * radialOffset);

  float x = radius * cos(phase);
  float y = radius * sin(phase * 1.21);
  float vx = -radius * 0.035 * sin(phase);
  float vy = radius * 0.04235 * cos(phase * 1.21);

  gl_FragColor = vec4(x, y, vx, vy);
}
