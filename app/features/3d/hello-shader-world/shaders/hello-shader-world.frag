uniform vec3 uColorA;

void main() {
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  if (distanceToCenter > 0.5) {
    discard;
  }

  gl_FragColor = vec4(uColorA, 1.0);
}
