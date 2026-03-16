// DETERMINISTIC PHYSICS COMPUTE SHADER
// Traceability: SWARM-002, SWARM-003, SWARM-006, SWARM-007

uniform float uFrame;
uniform float uSeed;
uniform float uDeltaTime;
uniform float uFriction; // SWARM-003
uniform vec3 uBoundsMin; // SWARM-006
uniform vec3 uBoundsMax; // SWARM-006
uniform int uBoundaryType; // 0 = Bounce, 1 = Wrap

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    // 1. Read current state
    vec4 posData = texture2D(texturePosition, uv);
    vec4 velData = texture2D(textureVelocity, uv);
    
    vec3 pos = posData.xyz;
    vec3 vel = velData.xyz;
    
    // 2. [SWARM-003] Apply friction/velocity decay
    // vel = vel * exp(-uFriction * uDeltaTime)
    vel *= exp(-uFriction * uDeltaTime);
    
    // 3. [SWARM-002] Update position (Stationary if velocity is zero)
    pos += vel * uDeltaTime;
    
    // 4. [SWARM-006] Constrain within 3D volume
    if (uBoundaryType == 1) {
        // Wrap (Toroidal)
        vec3 size = uBoundsMax - uBoundsMin;
        if (pos.x < uBoundsMin.x) pos.x += size.x;
        if (pos.x > uBoundsMax.x) pos.x -= size.x;
        if (pos.y < uBoundsMin.y) pos.y += size.y;
        if (pos.y > uBoundsMax.y) pos.y -= size.y;
        if (pos.z < uBoundsMin.z) pos.z += size.z;
        if (pos.z > uBoundsMax.z) pos.z -= size.z;
    } else {
        // Bounce (Reflection)
        if (pos.x < uBoundsMin.x) { pos.x = uBoundsMin.x; vel.x *= -1.0; }
        if (pos.x > uBoundsMax.x) { pos.x = uBoundsMax.x; vel.x *= -1.0; }
        if (pos.y < uBoundsMin.y) { pos.y = uBoundsMin.y; vel.y *= -1.0; }
        if (pos.y > uBoundsMax.y) { pos.y = uBoundsMax.y; vel.y *= -1.0; }
        if (pos.z < uBoundsMin.z) { pos.z = uBoundsMin.z; vel.z *= -1.0; }
        if (pos.z > uBoundsMax.z) { pos.z = uBoundsMax.z; vel.z *= -1.0; }
    }
    
    // 5. Output based on pass
    #ifdef PASS_POSITION
    gl_FragColor = vec4(pos, 1.0);
    #endif
    
    #ifdef PASS_VELOCITY
    gl_FragColor = vec4(vel, 1.0);
    #endif
}
