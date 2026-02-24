uniform sampler2D uState;

attribute vec2 aReference;

varying float vSpeed;

void main() {
  vec4 state = texture2D(uState, aReference);
  vec3 simulationPosition = vec3(state.xy * 4.0, 0.0);

  vec4 modelPosition = modelMatrix * vec4(simulationPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;

  gl_Position = projectedPosition;
  gl_PointSize = 5.0;

  vSpeed = length(state.zw);
}
