uniform vec3 uColor;

void main() {
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  if (distanceToCenter > 0.5) {
    discard;
  }

  float alpha = smoothstep(0.5, 0.0, distanceToCenter);
  gl_FragColor = vec4(uColor, alpha);
}
