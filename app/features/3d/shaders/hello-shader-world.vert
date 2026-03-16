// @requirement HSW-103 [598e09f4-18f1-4322-8356-9a25b6a3b754]
uniform sampler2D uState;

attribute vec2 aReference;
attribute float aActive;

// logic: coordinate transformation from simulation space to projected screen space
vec4 projectSimulationPosition(vec2 statePos) {
  vec3 simulationPosition = vec3(statePos * 4.0, 0.0);
  vec4 modelPosition = modelMatrix * vec4(simulationPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  return projectionMatrix * viewPosition;
}

// logic: perspective-aware point size calculation
float calculatePointSize(vec2 statePos) {
  // We need the viewPosition to calculate size based on distance from camera
  vec3 simulationPosition = vec3(statePos * 4.0, 0.0);
  vec4 modelPosition = modelMatrix * vec4(simulationPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  
  // Perspective scale: points get smaller as they move away from the camera
  return 120.0 * (1.0 / -viewPosition.z);
}

void main() {
  // logic: handle inactive particles by placing them outside clip space
  if (aActive < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  // logic: sample the current simulation state (calculated in fragment/compute)
  vec4 state = texture2D(uState, aReference);
  
  // logic: map state to projection
  gl_Position = projectSimulationPosition(state.xy);
  gl_PointSize = calculatePointSize(state.xy);
}
