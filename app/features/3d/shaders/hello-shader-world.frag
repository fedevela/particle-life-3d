uniform vec3 uColorA;
uniform vec3 uColorB;

varying float vSpeed;

void main() {
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  if (distanceToCenter > 0.5) {
    discard;
  }

  float speedMix = clamp(vSpeed * 12.0, 0.0, 1.0);
  vec3 color = mix(uColorA, uColorB, speedMix);

  gl_FragColor = vec4(color, 1.0);
}
