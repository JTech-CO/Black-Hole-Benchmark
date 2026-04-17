#version 300 es
precision highp float;

// screen.vert — Fullscreen quad vertex shader
// Maps NDC coordinates to UV for fragment shader raymarching
// Fullscreen triangle (3 vertices cover the entire screen)
// No vertex buffer needed — uses gl_VertexID
void main() {
    // Generate fullscreen triangle from vertex ID
    // Vertex 0: (-1, -1), Vertex 1: (3, -1), Vertex 2: (-1, 3)
    float x = -1.0 + float((gl_VertexID & 1) << 2);
    float y = -1.0 + float((gl_VertexID >> 1 & 1) << 2);
    gl_Position = vec4(x, y, 0.0, 1.0);
}
