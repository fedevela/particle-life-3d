// @requirement HSW-104 [a6f6e300-3058-466d-869f-390457639f99]
uniform vec3 uColorA;

void main() {
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  if (distanceToCenter > 0.5) {
    discard;
  }

  gl_FragColor = vec4(uColorA, 1.0);
}
