const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
void main() {
    float x = -1.0 + float((gl_VertexID & 1) << 2);
    float y = -1.0 + float((gl_VertexID >> 1 & 1) << 2);
    gl_Position = vec4(x, y, 0.0, 1.0);
}`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_mass;
uniform float u_spin;
uniform int u_steps;
uniform bool u_enableDisk;
uniform bool u_isIdle;
uniform vec3 u_cameraPos;
uniform mat3 u_cameraRot;

uniform sampler2D u_bgTex;

#define PI  3.14159265359

// ========================= HASHING =========================
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xxy) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
    float f = 0.0; float w = 0.5;
    for(int i = 0; i < 4; i++) {
        f += w * noise(p); p *= 2.0; w *= 0.5;
    }
    return f;
}

// ========================= ACCRETION DISK =========================
// Evaluate density and color at a 3D intersection point
vec4 evaluateDiskPoint(vec3 p, float rs) {
    float r = length(p.xz) / (rs * 2.0); // Normalize radius
    float rIn = 1.3;
    float rOut = 4.0;
    
    if (r < rIn || r > rOut) return vec4(0.0);
    
    float t = (r - rIn) / (rOut - rIn);
    float temp = pow(1.0 - t, 0.7);

    vec3 cool = vec3(0.8, 0.15, 0.03);
    vec3 warm = vec3(1.0, 0.5, 0.1);
    vec3 hot  = vec3(1.0, 0.9, 0.7);
    
    vec3 c = mix(cool, warm, smoothstep(0.0, 0.5, temp));
    c = mix(c, hot, smoothstep(0.6, 1.0, temp));

    float angle = atan(p.z, p.x);
    // Doppler beaming - simplified for relative camera velocity
    float doppler = 1.0 + 0.5 * sin(angle - 0.2); 
    
    vec2 turbCoords = vec2(cos(angle), sin(angle)) * 8.0;
    float turb = fbm(vec2(turbCoords.x - u_time * 0.5, turbCoords.y + r * 15.0));
    turb = pow(turb, 1.5) * 1.5;
    
    float fade = smoothstep(rOut, rOut - 0.5, r) * smoothstep(rIn, rIn + 0.2, r);

    // Vertical falloff (disk is thin)
    float vertDensity = exp(-abs(p.y) * 10.0 / pow(r, 0.5));

    vec3 col = c * temp * doppler * doppler * turb * fade * 1.5;
    return vec4(col, vertDensity * fade * 0.3); // alpha is density
}

// ========================= X-RAY JETS =========================
vec4 evaluateJets(vec3 p, float rs) {
    // Jets emit from the poles (y-axis)
    float cylDist = length(p.xz);
    float height = abs(p.y);
    
    // Confined to a narrow beam
    float width = 1.5 + height * 0.2; 
    if (cylDist > width || height < rs) return vec4(0.0);

    float density = exp(-pow(cylDist / width * 3.0, 2.0));
    
    // Add turbulence flowing outward
    float turb = fbm(vec2(cylDist * 5.0, height * 2.0 - u_time * 8.0));
    
    vec3 col = vec3(0.2, 0.6, 1.0) * density * (0.5 + turb) * exp(-height * 0.05);
    return vec4(col * 0.8, density * 0.05);
}

// ========================= 3D GEODESIC RAYMARCH =========================
// Integrates RK4 geodesics. Also accumulates volumetric emission for visuals.
// Returns vec4(rgb_color, stress_accumulator)
vec4 traceGeodesic(vec2 uv, float rs) {
    vec3 pos = u_cameraPos;
    vec3 vel = normalize(u_cameraRot * vec3(uv, -1.0)); // Adjusted FoV multiplier
    
    float accumulator = 0.0;
    vec3 color = vec3(0.0);
    float transmittance = 1.0;
    bool hitHorizon = false;

    // Use larger steps if idle to save power, otherwise use benchmark steps
    int maxSteps = u_isIdle ? 80 : u_steps;

    for (int i = 0; i < 500; i++) {
        if (i >= maxSteps) break;
        
        float r = length(pos);
        
        // Event Horizon
        if (r < rs * 1.01) { hitHorizon = true; break; }
        // Out of bounds
        if (r > 60.0) break;

        float r2 = r * r; float r5 = max(r2 * r2 * r, 0.001);

        // Geodesic acceleration: a = -1.5 * rs * |L|^2 / r^5 * pos
        vec3 h = cross(pos, vel);
        vec3 accel = -1.5 * rs * dot(h, h) / r5 * pos;

        // Dynamic step size (smaller near BH, larger far away)
        float dt = 0.05 + 0.3 * smoothstep(rs * 1.5, rs * 6.0, r);

        // RK4 Integration
        vec3 k1v = accel * dt;  vec3 k1x = vel * dt;
        vec3 p2 = pos + k1x * 0.5;  vec3 v2 = vel + k1v * 0.5;
        vec3 a2 = -1.5 * rs * dot(cross(p2, v2), cross(p2, v2)) / max(pow(length(p2), 5.0), 0.001) * p2;
        vec3 k2v = a2 * dt; vec3 k2x = v2 * dt;
        
        vec3 p3 = pos + k2x * 0.5;  vec3 v3 = vel + k2v * 0.5;
        vec3 a3 = -1.5 * rs * dot(cross(p3, v3), cross(p3, v3)) / max(pow(length(p3), 5.0), 0.001) * p3;
        vec3 k3v = a3 * dt; vec3 k3x = v3 * dt;

        vec3 p4 = pos + k3x;    vec3 v4 = vel + k3v;
        vec3 a4 = -1.5 * rs * dot(cross(p4, v4), cross(p4, v4)) / max(pow(length(p4), 5.0), 0.001) * p4;
        vec3 k4v = a4 * dt; vec3 k4x = v4 * dt;

        vec3 nextPos = pos + (k1x + 2.0 * k2x + 2.0 * k3x + k4x) / 6.0;
        vel += (k1v + 2.0 * k2v + 2.0 * k3v + k4v) / 6.0;

        // Visual Accumulation between pos and nextPos
        if (!u_isIdle && u_enableDisk) {
            // Accretion disk (near y=0)
            if (abs(pos.y) < rs * 3.0) {
                vec4 disk = evaluateDiskPoint(pos, rs);
                color += disk.rgb * disk.a * transmittance;
                transmittance *= (1.0 - disk.a);
            }
            
            // Jets (near xz=0)
            if (length(pos.xz) < rs * 4.0 && abs(pos.y) > rs) {
                vec4 jets = evaluateJets(pos, rs);
                color += jets.rgb * jets.a * transmittance;
                transmittance *= (1.0 - jets.a);
            }
            
            // Break early for opacity
            if (transmittance < 0.01) transmittance = 0.0;
        }

        pos = nextPos;
        accumulator += length(pos) * 0.001; // Stress load tracker
    }
    
    // Background lookup if ray escapes
    if (!hitHorizon) {
        // Map remaining velocity to equirectangular UV for the background texture
        vec3 dir = normalize(vel);
        vec2 bgUV = vec2(atan(dir.z, dir.x) / (2.0 * PI) + 0.5, asin(dir.y) / PI + 0.5);
        vec3 bgColor = texture(u_bgTex, bgUV).rgb * 0.25; // Darken space
        color += bgColor * transmittance;
    }

    return vec4(color, fract(accumulator) * 0.02);
}

// ========================= MAIN =========================
void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    
    if (u_isIdle) {
        // Flat background for absolute zero stress IDLE
        vec2 bgUV = gl_FragCoord.xy / u_resolution.xy;
        fragColor = vec4(texture(u_bgTex, bgUV).rgb * 0.3, 1.0);
        return;
    }

    float rs = 2.0 * u_mass;
    
    // Full 3D Raymarching for visuals and stress
    vec4 result = traceGeodesic(p, rs);
    vec3 color = result.rgb;
    float stressNoise = result.a;

    // Optional: Add a faint photon sphere bloom directly in screen space based on ray impact parameter
    // Because volumetric RK4 is noisy, this guarantees a sleek ring.
    vec3 rayDir0 = normalize(u_cameraRot * vec3(p, -1.0));
    vec3 h0 = cross(u_cameraPos, rayDir0);
    float b = length(h0); // Impact parameter
    float b_photon = rs * 2.6; // Critical impact parameter
    
    // Only draw the bright ring if we are actually looking TOWARDS the black hole,
    // not away from it (dot product < 0 means looking towards origin).
    if (dot(rayDir0, u_cameraPos) < 0.0 && abs(b - b_photon) < 0.2) {
         color += vec3(0.6, 0.8, 1.0) * exp(-pow((b - b_photon)/0.1, 2.0));
    }

    // Add GPU stress noise to ensure benchmark load isn't optimized out
    color += stressNoise;

    // Tonemapping ACES-like
    color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
    color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}`;

export class WebGLContext {
  constructor(canvas, onContextLost, onContextRestored) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.uniforms = {};
    this.texture = null;
    this.textureLoaded = false;
    this.isContextLost = false;
    this.onContextLost = onContextLost;
    this.onContextRestored = onContextRestored;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  init() {
    const canvas = this.canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    if (!this.gl) { console.error('[BHB] WebGL 2.0 not supported'); return false; }
    
    const gl = this.gl;
    gl.getExtension('EXT_color_buffer_float');
    
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); this.isContextLost = true;
      if (this.onContextLost) this.onContextLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.isContextLost = false; this._setupProgram();
      if (this.onContextRestored) this.onContextRestored();
    });
    
    this._loadTexture('/src/assets/images/nasa_bg.png');
    return this._setupProgram();
  }

  _loadTexture(url) {
    const gl = this.gl;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    const image = new Image();
    image.src = url;
    image.onload = () => {
      if (this.isContextLost) return;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.textureLoaded = true;
    };
  }

  _setupProgram() {
    const gl = this.gl;
    const vs = this._compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[BHB] Link error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog); return false;
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    this.program = prog; gl.useProgram(prog);
    this.uniforms = {
      u_resolution: gl.getUniformLocation(prog, 'u_resolution'),
      u_time: gl.getUniformLocation(prog, 'u_time'),
      u_mass: gl.getUniformLocation(prog, 'u_mass'),
      u_spin: gl.getUniformLocation(prog, 'u_spin'),
      u_steps: gl.getUniformLocation(prog, 'u_steps'),
      u_enableDisk: gl.getUniformLocation(prog, 'u_enableDisk'),
      u_isIdle: gl.getUniformLocation(prog, 'u_isIdle'),
      u_cameraPos: gl.getUniformLocation(prog, 'u_cameraPos'),
      u_cameraRot: gl.getUniformLocation(prog, 'u_cameraRot'),
      u_bgTex: gl.getUniformLocation(prog, 'u_bgTex'),
    };
    gl.uniform1i(this.uniforms.u_bgTex, 0);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    return true;
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source.trimStart());
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[BHB] Shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader); return null;
    }
    return shader;
  }

  resize() {
    const c = this.canvas, gl = this.gl;
    const w = Math.floor(c.clientWidth * this.dpr);
    const h = Math.floor(c.clientHeight * this.dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
    return { width: c.width, height: c.height };
  }

  setParams(p) {
    const gl = this.gl; if (!gl || this.isContextLost) return;
    gl.uniform2f(this.uniforms.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.u_time, p.time);
    gl.uniform1f(this.uniforms.u_mass, p.mass);
    gl.uniform1f(this.uniforms.u_spin, p.spin);
    gl.uniform1i(this.uniforms.u_steps, p.steps);
    gl.uniform1i(this.uniforms.u_enableDisk, p.enableDisk ? 1 : 0);
    gl.uniform1i(this.uniforms.u_isIdle, p.isIdle ? 1 : 0);
    gl.uniform3fv(this.uniforms.u_cameraPos, p.cameraPos);
    gl.uniformMatrix3fv(this.uniforms.u_cameraRot, false, p.cameraRot);
  }

  render() {
    const gl = this.gl; if (!gl || this.isContextLost) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    const gl = this.gl; if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.texture) gl.deleteTexture(this.texture);
    this.gl = null; this.program = null;
  }

  getRendererInfo() {
    const gl = this.gl;
    if (!gl) return { vendor: 'Unknown', renderer: 'Unknown' };
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    if (d) return { vendor: gl.getParameter(d.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(d.UNMASKED_RENDERER_WEBGL) };
    return { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER) };
  }
}
