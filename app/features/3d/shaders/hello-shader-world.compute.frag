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
  vec2 heading;

  if (speed < 0.000001) {
    float startAngle = hash12(vec2(index + (uSeed * 73.0), 11.0)) * TAU;
    heading = vec2(cos(startAngle), sin(startAngle));
  } else {
    heading = velocity / speed;
  }

  float directionNoise = hash12(vec2(index + (uSeed * 97.0), uFrame * 0.61803398875));
  float directionDelta = (directionNoise - 0.5) * 2.0 * uDirectionJitter;
  float cosDelta = cos(directionDelta);
  float sinDelta = sin(directionDelta);
  heading = vec2((heading.x * cosDelta) - (heading.y * sinDelta), (heading.x * sinDelta) + (heading.y * cosDelta));

  float magnitudeNoise = hash12(vec2(index + 19.0 + (uSeed * 131.0), (uFrame + 31.0) * 1.41421356237));
  float accelerationScale = 1.0 + ((magnitudeNoise - 0.5) * 2.0 * uMagnitudeJitter);
  float stepAcceleration = max(0.0, uAcceleration * accelerationScale);

  velocity = velocity + (heading * stepAcceleration);
  velocity = velocity * uDamping;

  speed = length(velocity);
  if (speed > uMaxSpeed) {
    velocity = velocity / speed * uMaxSpeed;
  }

  vec2 position = previousPosition + velocity;

  gl_FragColor = vec4(position, velocity);
}
