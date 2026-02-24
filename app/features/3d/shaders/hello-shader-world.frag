uniform vec3 uColor;

void main() {
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  if (distanceToCenter > 0.5) {
    discard;
  }

  gl_FragColor = vec4(uColor, 1.0);
}
