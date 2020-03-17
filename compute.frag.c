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
float modularExponent16(int b, float m) {
    float res = 1.0;
    int i = 0;

    // float m4 = mod(65536.0, m);
    // for (; b >= 4; b -= 4)
    //      res = mod(m4 * res, m);

    // float m2 = mod(256.0, m);
    // for (; b >= 2; b -= 2)
    //      res = mod(m2 * res, m);

    for (; b > 0; b -= 1)
         res = mod(16.0 * res, m);

    // int i = 0;
    // while (i < b) {
    //     int j = (b - 1) - i;
    //     // if (j > 4) {
    //     //     res = mod(pow(16.0, 4.0) * res, m);
    //     //     i += 4;
    //     // } else if (j > 2) {
    //     // if (j > 2) {
    //     //     res = mod(mod(256.0, m) * res, m);
    //     //     i += 2;
    //     // } else {
    //         res = mod(16.0 * res, m);
    //         i += 1;
    //     //}
    // }
    return res;
}

float isGEq(int a, int b) {
    return sign(sign(float(a) - float(b)) + 1.0);
}

float isGEq(float a, float b) {
    return sign(sign(a - b) + 1.0);
}

void main() {
    int k = int(gl_FragCoord.y) * u_src_width + int(gl_FragCoord.x);
    int n = u_n;
    // Optimization when n > k, can compute in modulo arithmetic since we only
    // want decimal values.
    float eightk = 8.0 * float(k);
    float r_const =  eightk + 1.0;
    float g_const =  eightk + 4.0;
    float b_const =  eightk + 5.0;
    float a_const =  eightk + 6.0;

    // if (n > k) {
    //     // r === 4 * 16^(n-k) mod (8k + 1)/(8k + 1)
    //     // g === 2 * 16^(n-k) mod (8k + 4)/(8k + 4)
    //     // b === 16^(n-k) mod (8k + 5)/(8k + 5)
    //     // a === 16^(n-k) mod (8k + 6)/(8k + 6)
    //     // color_out = vec4(
    //     //     modularExponent(16.0, n - k, r_const) / r_const,
    //     //     modularExponent(16.0, n - k, b_const) / b_const,
    //     //     modularExponent(16.0, n - k, g_const) / g_const,
    //     //     modularExponent(16.0, n - k, a_const) / a_const);
    //     // float place_shift = pow(16.0, float(n - k));
    //     color_out = vec4(
    //         modularExponent(16.0, n - k, r_const) / r_const,
    //         modularExponent(16.0, n - k, g_const) / g_const,
    //         modularExponent(16.0, n - k, b_const) / b_const,
    //         modularExponent(16.0, n - k, a_const) / a_const);

    // } else {
    //     // We have no choice but to compute the power here:
    //     float place_shift = pow(16.0, float(n - k));

    //     // r === 1/(16^(k-n) * (8k + 1))
    //     // g === 1/(16^(k-n) * (8k + 4))
    //     // b === 1/(16^(k-n) * (8k + 5))
    //     // a === 1/(16^(k-n) * (8k + 6))
    //     color_out = place_shift * vec4(
    //         1.0 / r_const, 1.0 / b_const, 1.0 / g_const, 1.0 / a_const);
    // }

    // color_out = vec4(1.0, 0.5, 1.0, 1.0);
    // gl_FragColor = color_out;
    //
    float place_shift = pow(16.0, float(n - k));
    color_out =
        isGEq(n, k) * vec4(
             modularExponent16(n - k, r_const) / r_const,
             modularExponent16(n - k, g_const) / g_const,
             modularExponent16(n - k, b_const) / b_const,
             modularExponent16(n - k, a_const) / a_const) +
        (1.0 - isGEq(n, k)) * place_shift * vec4(
            1.0 / r_const, 1.0 / b_const, 1.0 / g_const, 1.0 / a_const);

}
