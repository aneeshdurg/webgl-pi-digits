#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision mediump float;
precision mediump int;
#endif

uniform float u_src_width;
uniform sampler2D u_src_data;

uniform int u_x_scale;
uniform int u_y_scale;

out vec4 color_out;

// given
// [[a_0, b_0, c_0, d_0], ..., [a_n, b_n, c_n, d_n]]
//
// Want to compute
// [Sum(k = 0, n, a_k), (k = 0, n, b_k), Sum(k = 0, n, c_k), Sum(k = 0, n, d_k)]
//
// this program takes in k as the coordinates and a factor `scale` that implies
// that 1 px in the output sums `scale`^2 pixels in the src
//
// TODO make sure that values above 1.0 are correctly handled

void main() {
    float k = gl_FragCoord.y * u_src_width + gl_FragCoord.x;
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

    ivec2 src_coord = ivec2(
        u_x_scale * int(gl_FragCoord.x), u_y_scale * int(gl_FragCoord.y));

    for (int x_i = 0; x_i < u_x_scale; x_i++) {
        for (int y_i = 0; y_i < u_y_scale; y_i++) {
            vec4 texel = texelFetch(
                u_src_data, ivec2(src_coord.x + x_i, src_coord.y + y_i), 0);
            color += texel / (float(u_x_scale) * float(u_y_scale));
        }
    }

    color_out = color;
}
