// @requirement HSW-103 [598e09f4-18f1-4322-8356-9a25b6a3b754]
uniform float uFrame;
uniform float uSeed;
uniform float uAcceleration;
uniform float uDirectionJitter;
uniform float uMagnitudeJitter;
uniform float uDamping;
uniform float uMaxSpeed;

const float TAU = 6.28318530718;

// logic: deterministic noise for random walk variations
float hash12(vec2 value) {
  vec3 p3 = fract(vec3(value.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// logic: random walk direction and magnitude delta
vec2 calculateRandomWalkForce(vec2 velocity, float index, float seed, float frame) {
  float speed = length(velocity);
  vec2 heading;

  if (speed < 0.000001) {
    float startAngle = hash12(vec2(index + (seed * 73.0), 11.0)) * TAU;
    heading = vec2(cos(startAngle), sin(startAngle));
  } else {
    heading = velocity / speed;
  }

  // logic: apply direction jitter
  float directionNoise = hash12(vec2(index + (seed * 97.0), frame * 0.61803398875));
  float directionDelta = (directionNoise - 0.5) * 2.0 * uDirectionJitter;
  float cosDelta = cos(directionDelta);
  float sinDelta = sin(directionDelta);
  heading = vec2((heading.x * cosDelta) - (heading.y * sinDelta), (heading.x * sinDelta) + (heading.y * cosDelta));

  // logic: apply magnitude jitter
  float magnitudeNoise = hash12(vec2(index + 19.0 + (seed * 131.0), (frame + 31.0) * 1.41421356237));
  float accelerationScale = 1.0 + ((magnitudeNoise - 0.5) * 2.0 * uMagnitudeJitter);
  float stepAcceleration = max(0.0, uAcceleration * accelerationScale);

  return heading * stepAcceleration;
}

// logic: velocity-based state integration
vec2 integrateVelocity(vec2 velocity, vec2 force) {
  vec2 newVelocity = (velocity + force) * uDamping;
  float speed = length(newVelocity);
  if (speed > uMaxSpeed) {
    newVelocity = (newVelocity / speed) * uMaxSpeed;
  }
  return newVelocity;
}

void main() {
  vec2 texel = gl_FragCoord.xy;
  float index = (floor(texel.y) * resolution.x) + floor(texel.x);
  vec2 uv = texel / resolution.xy;
  
  // logic: fetch previous simulation state
  vec4 previousState = texture2D(textureState, uv);
  vec2 previousPosition = previousState.rg;
  vec2 previousVelocity = previousState.ba;

  // logic: handle frame initialization
  if (uFrame < 0.5) {
    gl_FragColor = vec4(previousPosition, vec2(0.0));
    return;
  }

  // logic: compute next state components
  vec2 force = calculateRandomWalkForce(previousVelocity, index, uSeed, uFrame);
  vec2 velocity = integrateVelocity(previousVelocity, force);
  vec2 position = previousPosition + velocity;

  // logic: commit updated state to the GPU texture
  gl_FragColor = vec4(position, velocity);
}
