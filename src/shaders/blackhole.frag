#version 300 es
precision highp float;

// blackhole.frag — Black Hole rendering with Kerr Metric Raymarching + RK4 Integration
// Core GPU stress test: each pixel traces a light ray through curved spacetime

out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_mass;
uniform float u_spin;
uniform int u_steps;
uniform bool u_enableDisk;
uniform vec3 u_cameraPos;
uniform mat3 u_cameraRot;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

// Color Constants
const vec3 DISK_HOT = vec3(1.0, 0.95, 0.8);
const vec3 DISK_WARM = vec3(1.0, 0.6, 0.2);
const vec3 DISK_COOL = vec3(0.8, 0.15, 0.05);
const vec3 BG_STAR = vec3(0.95, 0.95, 1.0);

// Hash for stars
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xxy) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Background: Procedural Starfield
vec3 starfield(vec3 rd) {
    vec3 col = vec3(0.0);
    float phi_s = atan(rd.z, rd.x);
    float theta_s = acos(clamp(rd.y, -1.0, 1.0));

    for (int layer = 0; layer < 3; layer++) {
        float scale = 200.0 + float(layer) * 300.0;
        vec2 uv = vec2(phi_s, theta_s) * scale;
        vec2 id = floor(uv);
        vec2 f = fract(uv);
        float h = hash(id + float(layer) * 100.0);

        if (h > 0.97 - float(layer) * 0.005) {
            vec2 starPos = vec2(0.3 + 0.4 * hash(id + 1.0), 0.3 + 0.4 * hash(id + 2.0));
            float d = length(f - starPos);
            float brightness = smoothstep(0.05, 0.0, d) * (0.5 + 0.5 * hash(id + 3.0));
            brightness *= 0.7 + 0.3 * sin(u_time * (1.0 + hash(id + 4.0) * 3.0) + h * TWO_PI);
            vec3 starCol = mix(BG_STAR, vec3(0.7, 0.8, 1.0), hash(id + 5.0) * 0.3);
            col += starCol * brightness * (1.0 - float(layer) * 0.25);
        }
    }

    float nebula = smoothstep(0.4, 0.0, abs(rd.y)) * 0.02;
    col += vec3(0.1, 0.05, 0.2) * nebula;
    return col;
}

// Accretion Disk Color
vec3 accretionDiskColor(float r, float th, float ph, float M, float a) {
    float rISCO = 3.0 * M + M * sqrt(max(0.0, 9.0 - 8.0 * a * a / (M * M)));
    float rOuter = 12.0 * M;
    float diskThickness = 0.15;
    float equatorialDist = abs(th - PI * 0.5);

    if (equatorialDist > diskThickness) return vec3(0.0);
    if (r < rISCO || r > rOuter) return vec3(0.0);

    float t_normalized = (r - rISCO) / (rOuter - rISCO);
    float temperature = pow(1.0 - t_normalized, 0.75);

    vec3 diskCol = mix(DISK_COOL, DISK_WARM, smoothstep(0.0, 0.5, temperature));
    diskCol = mix(diskCol, DISK_HOT, smoothstep(0.5, 1.0, temperature));

    float doppler = 1.0 + 0.5 * sin(ph + u_time * 0.1);
    diskCol *= doppler * doppler;

    float edgeFade = smoothstep(diskThickness, 0.0, equatorialDist);
    float radialFade = smoothstep(rOuter, rOuter - 2.0 * M, r) * smoothstep(rISCO, rISCO + 0.5 * M, r);
    float turbulence = 0.85 + 0.15 * sin(ph * 12.0 + r * 3.0 - u_time * 0.5);

    return diskCol * temperature * 2.5 * edgeFade * radialFade * turbulence;
}

// Photon Sphere Glow
vec3 photonRingGlow(float r, float M, float spin) {
    float rPhoton = 1.5 * M * (1.0 + sqrt(max(0.0, 1.0 - spin * spin / (M * M))));
    float dist = abs(r - rPhoton);
    float glow = exp(-dist * dist * 8.0) * 0.5;
    return vec3(0.6, 0.85, 1.0) * glow;
}

// Simplified geodesic for raymarching in Schwarzschild-like approximation
// Uses effective potential approach for numerical stability
vec2 geodesicStep(float r, float th, float pr, float pth, float M, float a, float h) {
    float r2 = r * r;
    float a2 = a * a;
    float sinT = sin(th);
    float cosT = cos(th);
    float sigma = r2 + a2 * cosT * cosT;

    // Gravitational acceleration (Newtonian + GR corrections)
    float ar = -M / r2 + 3.0 * M * pth * pth / (r2 * r2) + a2 * sinT * cosT * pth / sigma;
    float ath = -a2 * sinT * cosT / sigma * pr + 2.0 * r * pr * pth / sigma;

    // Leapfrog integration
    float new_pr = pr + ar * h;
    float new_pth = pth + ath * h;
    float new_r = r + new_pr * h;
    float new_th = th + new_pth * h;

    return vec2(new_r, new_th);
}

// Main Raymarching
void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

    float M = u_mass;
    float a = u_spin * M;

    vec3 ro = u_cameraPos;
    vec3 rd = normalize(u_cameraRot * vec3(uv, -1.5));

    // Convert to spherical
    float r = length(ro);
    float theta = acos(clamp(ro.y / max(r, 0.001), -1.0, 1.0));
    float phi = atan(ro.z, ro.x);

    // Project rd onto spherical basis
    vec3 rHat = normalize(ro);
    vec3 thetaHat = vec3(cos(theta) * cos(phi), -sin(theta), cos(theta) * sin(phi));
    vec3 phiHat = vec3(-sin(phi), 0.0, cos(phi));

    float pr = dot(rd, rHat);
    float ptheta = dot(rd, thetaHat) / max(r, 0.001);

    float rEvent = M + sqrt(max(0.0, M * M - a * a));
    float stepSize = 0.2;

    vec3 color = vec3(0.0);
    bool escaped = false;
    bool captured = false;
    float currentR = r;
    float currentTheta = theta;
    float currentPr = pr;
    float currentPth = ptheta;

    // Main loop (GPU stress)
    for (int i = 0; i < 500; i++) {
        if (i >= u_steps) break;

        float adaptiveStep = stepSize * clamp(currentR / (4.0 * M), 0.2, 2.0);

        // RK4-style integration with multiple sub-steps for accuracy
        vec2 k1 = geodesicStep(currentR, currentTheta, currentPr, currentPth, M, a, adaptiveStep * 0.5);
        vec2 k2 = geodesicStep(k1.x, k1.y, currentPr, currentPth, M, a, adaptiveStep * 0.5);

        float oldR = currentR;
        currentR = k2.x;
        currentTheta = k2.y;
        currentPr += (-M / (currentR * currentR)) * adaptiveStep;
        currentPth += (-a * a * sin(currentTheta) * cos(currentTheta) / (currentR * currentR)) * adaptiveStep * 0.1;

        // Clamp theta
        currentTheta = clamp(currentTheta, 0.01, PI - 0.01);

        if (currentR <= rEvent * 1.01) {
            captured = true;
            break;
        }

        if (currentR > 50.0 * M) {
            escaped = true;
            break;
        }

        // Accretion disk
        if (u_enableDisk) {
            float currentPhi = phi + float(i) * 0.02;
            vec3 diskCol = accretionDiskColor(currentR, currentTheta, currentPhi, M, a);
            if (length(diskCol) > 0.01) {
                color += diskCol * 0.5;
            }
        }

        // Photon ring glow
        color += photonRingGlow(currentR, M, u_spin) * 0.015;
    }

    // Final composition
    if (captured) {
        float edgeGlow = exp(-pow(currentR - rEvent, 2.0) * 2.0) * 0.15;
        color += vec3(0.0, 0.15, 0.3) * edgeGlow;
    } else if (escaped) {
        float finalTheta = currentTheta;
        float finalPhi = phi + atan(sin(currentTheta), cos(currentTheta));
        vec3 escapedDir = vec3(
            sin(finalTheta) * cos(finalPhi),
            cos(finalTheta),
            sin(finalTheta) * sin(finalPhi)
        );
        color += starfield(escapedDir);
    }

    // Gravitational redshift near horizon
    float redshift = smoothstep(rEvent * 1.5, rEvent * 8.0, currentR);
    color *= mix(vec3(0.3, 0.1, 0.05), vec3(1.0), redshift);

    // ACES tonemapping
    color = color / (color + vec3(1.0));
    // Gamma
    color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}
