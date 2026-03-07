uniform float uFrame;
uniform float uSeed;
uniform float uAcceleration;
uniform float uDirectionJitter;
uniform float uMagnitudeJitter;
uniform float uDamping;
uniform float uMaxSpeed;

const float TAU = 6.28318530718;

float hash12(vec2 value) {
  vec3 p3 = fract(vec3(value.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 texel = gl_FragCoord.xy;
  float index = (floor(texel.y) * resolution.x) + floor(texel.x);
  vec2 uv = texel / resolution.xy;
  vec4 previousState = texture2D(textureState, uv);
  vec2 previousPosition = previousState.rg;
  vec2 previousVelocity = previousState.ba;

  if (uFrame < 0.5) {
    gl_FragColor = vec4(previousPosition, vec2(0.0));
    return;
  }

  vec2 velocity = previousVelocity;
  float speed = length(velocity);

  if (speed < 0.000001) {
    // Initialize with random direction when stationary
    float startAngle = hash12(vec2(index + (uSeed * 73.0), 11.0)) * TAU;
    velocity = vec2(cos(startAngle), sin(startAngle)) * 0.001;
  }

  // Generate random force direction and magnitude for "gust of wind" behavior
  float randomAngle = hash12(vec2(index + (uSeed * 97.0), uFrame * 0.61803398875)) * TAU;
  vec2 randomDirection = vec2(cos(randomAngle), sin(randomAngle));
  
  float magnitudeNoise = hash12(vec2(index + 19.0 + (uSeed * 131.0), (uFrame + 31.0) * 1.41421356237));
  float accelerationScale = 1.0 + ((magnitudeNoise - 0.5) * 2.0 * uMagnitudeJitter);
  float stepAcceleration = max(0.0, uAcceleration * accelerationScale);

  // Apply random force directly to velocity (like a gust hitting a bee)
  velocity = velocity + (randomDirection * stepAcceleration);
  velocity = velocity * uDamping;

  speed = length(velocity);
  if (speed > uMaxSpeed) {
    velocity = velocity / speed * uMaxSpeed;
  }

  vec2 position = previousPosition + velocity;

  gl_FragColor = vec4(position, velocity);
}
