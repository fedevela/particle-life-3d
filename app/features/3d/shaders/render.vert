uniform sampler2D uPositions;
attribute vec2 reference;

void main() {
  vec3 simulatedPosition = texture2D(uPositions, reference).xyz;
  vec4 modelPosition = modelMatrix * vec4(simulatedPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;

  gl_Position = projectedPosition;
  gl_PointSize = 36.0 / max(0.0001, -viewPosition.z);
}
