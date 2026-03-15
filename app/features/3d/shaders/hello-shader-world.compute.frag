// IMPL-003: Execute random walk position updates entirely within GPU shader logic.
uniform float uFrame;
uniform float uSeed;

const float MAX_DISTANCE_FROM_CENTER = 0.5;
const float MOVEMENT_SPEED = 0.001;
const float TAU = 6.28318530718;

float hash12(vec2 value) {
  vec3 p3 = fract(vec3(value.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 texel = gl_FragCoord.xy;
  vec2 uv = texel / resolution.xy;
  vec4 previousState = texture2D(textureState, uv);
  vec2 position = previousState.rg;

  // For frame 0, just use the initial position.
  if (uFrame < 0.5) {
    gl_FragColor = vec4(position, vec2(0.0));
    return;
  }

  // Generate a random angle for the random walk
  float randomAngle = hash12(vec2(position.x + uSeed, position.y * uFrame)) * TAU;
  vec2 randomDirection = vec2(cos(randomAngle), sin(randomAngle));

  // Update the position
  position += randomDirection * MOVEMENT_SPEED;

  // If the particle goes too far, reset it to the center.
  if (length(position) > MAX_DISTANCE_FROM_CENTER) {
    position = vec2(0.0);
  }

  // The last two components (velocity) are unused in this simple simulation.
  gl_FragColor = vec4(position, vec2(0.0));
}
