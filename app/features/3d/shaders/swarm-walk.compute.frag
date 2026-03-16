uniform float uFrame;
uniform float uSeed;
uniform float uDeltaTime;
uniform float uAttraction;
uniform float uJitter;
uniform float uDamping;
uniform float uMaxSpeed;
uniform float uBounds;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

vec3 random3(vec3 p) {
    return vec3(
        hash(dot(p, vec3(127.1, 311.7, 74.7)) + uFrame * 0.01),
        hash(dot(p, vec3(269.5, 183.3, 246.1)) + uFrame * 0.02),
        hash(dot(p, vec3(113.5, 271.9, 124.6)) + uFrame * 0.03)
    ) * 2.0 - 1.0;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    // Position texture stores: x, y, z, frame
    // Velocity texture stores: vx, vy, vz, 0
    vec4 posData = texture2D(texturePosition, uv);
    vec4 velData = texture2D(textureVelocity, uv);
    
    vec3 pos = posData.xyz;
    vec3 vel = velData.xyz;
    
    // 1. Random walk jitter
    vec3 jitterForce = random3(pos + uSeed) * uJitter;
    vel += jitterForce;
    
    // 2. Attraction to center (0,0,0)
    vec3 attractionForce = -pos * uAttraction;
    vel += attractionForce;
    
    // 3. Speed limit and Damping
    vel *= uDamping;
    float speed = length(vel);
    if (speed > uMaxSpeed) {
        vel = (vel / speed) * uMaxSpeed;
    }
    
    // 4. Update position
    pos += vel * uDeltaTime * 60.0;
    
    // 5. Hard bounds check
    float dist = length(pos);
    if (dist > uBounds) {
        pos = (pos / dist) * uBounds;
        vel *= -0.5; // Bounce back softly
    }
    
    // Store back
    // We alternate which variable we write to based on a common convention or 
    // we use separate compute shaders if using GPUComputationRenderer for multiple variables.
    // However, GPUComputationRenderer expects one shader per variable.
    
    // This shader is for POSITION
    #ifdef PASS_POSITION
    gl_FragColor = vec4(pos, uFrame);
    #endif
    
    // This shader is for VELOCITY
    #ifdef PASS_VELOCITY
    gl_FragColor = vec4(vel, 0.0);
    #endif
}
