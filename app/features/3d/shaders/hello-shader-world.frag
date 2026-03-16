// @requirement HSW-104 [a6f6e300-3058-466d-869f-390457639f99]
uniform vec3 uColorA;

void main() {
  // logic: calculate distance from the center of the point coordinate (0.0 to 1.0)
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  
  // logic: discard fragments outside the 0.5 radius to render a circular point
  if (distanceToCenter > 0.5) {
    discard;
  }

  // logic: apply a small smoothstep at the edge to reduce aliasing
  float alpha = smoothstep(0.5, 0.48, distanceToCenter);

  // logic: set the final fragment color using the particle color uniform
  gl_FragColor = vec4(uColorA, alpha);
}
