uniform sampler2D uState;

attribute vec2 aReference;

void main() {
  vec4 state = texture2D(uState, aReference);
  vec3 simulationPosition = vec3(state.xy * 4.0, 0.0);

  vec4 modelPosition = modelMatrix * vec4(simulationPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;

  gl_Position = projectedPosition;
  // Perspective scale: points get smaller as they move away from the camera,
  // and larger as they get closer (including camera zoom/orbit changes).
  gl_PointSize = 120.0 * (1.0 / -viewPosition.z);
}
