#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision mediump float;
precision mediump int;
#endif

uniform int u_src_width;
uniform int u_n;

out vec4 color_out;

// pi = Sum(k = 0, inf, (1/16^k) * (4/(8k+1) - 2/(8k+4) - 1/(8k+5) - 1/(8k+6)))
// To find the nth digit of pi, we need to calculate:
//      Sum(k = 0, inf, 16^(n-k) * (4/(8k+1) - 2/(8k+4) - 1/(8k+5) - 1/(8k+6)))
// this program takes in k as the coordinates and computes the absolute values
// of the four terms in the sum as the outputs to the four RGBA channels.

// computes (a^b mod m)
// a must be in [0, m)
float modularExponent(float a, int b, float m) {
    float res = 1.0;
    for (int i = 0; i < b; i++)
        res = mod(a * res, m);
    return res;
}

void main() {
    int k = int(gl_FragCoord.y) * u_src_width + int(gl_FragCoord.x);
    int n = u_n;
    // Optimization when n > k, can compute in modulo arithmetic since we only
    // want decimal values.
    float r_const =  8.0 * float(k) + 1.0;
    float g_const =  8.0 * float(k) + 4.0;
    float b_const =  8.0 * float(k) + 5.0;
    float a_const =  8.0 * float(k) + 6.0;

    if (n > k) {
        // r === 4 * 16^(n-k) mod (8k + 1)/(8k + 1)
        // g === 2 * 16^(n-k) mod (8k + 4)/(8k + 4)
        // b === 16^(n-k) mod (8k + 5)/(8k + 5)
        // a === 16^(n-k) mod (8k + 6)/(8k + 6)
        // color_out = vec4(
        //     modularExponent(16.0, n - k, r_const) / r_const,
        //     modularExponent(16.0, n - k, b_const) / b_const,
        //     modularExponent(16.0, n - k, g_const) / g_const,
        //     modularExponent(16.0, n - k, a_const) / a_const);
        // float place_shift = pow(16.0, float(n - k));
        color_out = vec4(
            modularExponent(16.0, n - k, r_const) / r_const,
            modularExponent(16.0, n - k, g_const) / g_const,
            modularExponent(16.0, n - k, b_const) / b_const,
            modularExponent(16.0, n - k, a_const) / a_const);

    } else {
        // We have no choice but to compute the power here:
        float place_shift = pow(16.0, float(n - k));

        // r === 1/(16^(k-n) * (8k + 1))
        // g === 1/(16^(k-n) * (8k + 4))
        // b === 1/(16^(k-n) * (8k + 5))
        // a === 1/(16^(k-n) * (8k + 6))
        color_out = place_shift * vec4(
            1.0 / r_const, 1.0 / b_const, 1.0 / g_const, 1.0 / a_const);
    }

    // color_out = vec4(1.0, 0.5, 1.0, 1.0);
    // gl_FragColor = color_out;
}
