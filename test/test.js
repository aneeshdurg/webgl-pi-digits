function assert(cond, msg) {
    if (!cond) {
        console.trace();
        console.assert(cond, msg);
        throw new Error("assertion failed");
    }
}

async function runTest(f) {
    console.time("Test execution");
    await f();
    console.timeEnd("Test execution");
}

async function tester() {
    await runTest(test_compute);
    // await runTest(test_sum_scale_1);
    // await test_sum_scale_2();
    // await test_sum_scale_10();
}

const n = 1600;
const dimensions = [40, 40]; // compute the first 100 terms of the sequence

// Returns max delta
function assert_arrays_equal(a, b, threshold) {
    assert(a.length == b.length, "Array length mismatch!");

    const deltas = []
    for (let i = 0; i < a.length; i++) {
        const aVal = a[i];
        const bVal = b[i];
        const delta = Math.abs(aVal - bVal);
        assert(delta < threshold, "At idx " + i + " " + aVal + " != " + bVal);
        deltas.push(delta)
    }
    return Math.max(...deltas);
}

async function test_compute() {
    await loadTwgl();

    const canvas = document.getElementById("glcanvas");
    canvas.width = dimensions[0];
    canvas.height = dimensions[1];
    const gl = canvas.getContext("webgl2");
    enableGlExts(gl);

    const fragShader = await getFile("../compute.frag.c");

    const programInfo = twgl.createProgramInfo(gl, [vs, fragShader]);

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, bufferArrays);
    setupProgram(gl, programInfo, bufferInfo);
    const computeDst = createTexture(gl, dimensions, null);

    twgl.setUniforms(programInfo, {
      u_src_width: canvas.width,
      u_n: n,
    });

    // render with computeDst
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, computeDst, 0);
    render(gl);

    let dstData = new Float32Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, dstData);
    assert(dstData.length == 6400, "actual length was " + dstData.length);

    const expected = JSON.parse(await getFile("./output.json"));
    assert(expected.length == 6400);

    const threshold = 0.001;
    const max_delta = assert_arrays_equal(dstData, expected, threshold);
    console.log("Passed! Max delta was", max_delta);
}

async function _test_sum_scaled(scale) {
    await loadTwgl();

    // const gl = document.createElement("canvas").getContext("webgl2");
    const canvas = document.getElementById("glcanvas");
    canvas.width = dimensions[0];
    canvas.height = dimensions[1];
    const gl = canvas.getContext("webgl2");
    enableGlExts(gl);

    const expected = JSON.parse(await getFile("./compute.json"));
    assert(expected.length == 400);
    assert(Math.max(...expected) < 1, "idk");
    const computeDst = createTexture(gl, dimensions, new Float32Array(expected));

    const sumShader = await getFile("../sum.frag.c");
    const sumProgramInfo = twgl.createProgramInfo(gl, [vs, sumShader]);
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, bufferArrays);
    setupProgram(gl, sumProgramInfo, bufferInfo);


    gl.activeTexture(gl.TEXTURE1);
    const sumDst = createTexture(gl, [canvas.width, canvas.height], null);
    const dstBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sumDst, 0 /* level */);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstBuffer);

    canvas.width /= scale;
    canvas.height /= scale;

    twgl.setUniforms(sumProgramInfo, {
        u_src_width: canvas.width,
        u_x_scale: scale,
        u_y_scale: scale,
        u_src_data: computeDst,
    });

    render(gl);

    // pull out the result
    let dstData = new Float32Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, dstData);

    return [expected, dstData];
}

async function test_sum_scale_1() {
    let res = await _test_sum_scaled(1);
    const expected = res[0];
    const dstData = res[1];

    assert(dstData.length == 400);

    const threshold = 0.001;
    const max_delta = assert_arrays_equal(dstData, expected, threshold);
    console.log("Passed! Max delta was", max_delta);
}

async function test_sum_scale_2() {
    let res = await _test_sum_scaled(2);
    const expected = res[0];
    const dstData = res[1];

    assert(dstData.length == 100);

    const sums = new Float32Array(100);

    for (let x = 0; x < 5; x ++) {
        for (let y = 0; y < 5; y ++) {
            // index into sums
            let si = (y * 5 + x) * 4;

            let xi = x * 2;
            let yi = y * 2;
            for (let xj = 0; xj < 2; xj++) {
                for (let yj = 0; yj < 2; yj++) {
                    let x_coord = xi + xj;
                    let y_coord = yi + yj;
                    // convert 2d coord to 1d and adjust for width of pixel
                    let i = (y_coord * 10 + x_coord) * 4;

                    sums[si + 0] += expected[i + 0] / 4;
                    sums[si + 1] += expected[i + 1] / 4;
                    sums[si + 2] += expected[i + 2] / 4;
                    sums[si + 3] += expected[i + 3] / 4;
                }
            }
        }
    }

    const threshold = 0.001;
    const max_delta = assert_arrays_equal(dstData, sums, threshold);
    console.log("Passed! Max delta was", max_delta);

    const total_sums = [0.0, 0.0, 0.0, 0.0];
    for (let i = 0; i < 400; i += 4) {
        total_sums[0] += expected[i + 0];
        total_sums[1] += expected[i + 1];
        total_sums[2] += expected[i + 2];
        total_sums[3] += expected[i + 3];
    }

    const derived_sums = [0.0, 0.0, 0.0, 0.0];
    for (let i = 0; i < 100; i += 4) {
        derived_sums[0] += sums[i + 0] * 4;
        derived_sums[1] += sums[i + 1] * 4;
        derived_sums[2] += sums[i + 2] * 4;
        derived_sums[3] += sums[i + 3] * 4;
    }

    console.log(total_sums, derived_sums);
    const smax_delta = assert_arrays_equal(derived_sums, total_sums, threshold);
    console.log("Passed! Max delta was", smax_delta);
}

async function test_sum_scale_10() {
    let res = await _test_sum_scaled(10);
    const expected = res[0];
    const dstData = res[1];

    assert(dstData.length == 4);

    const sums = [0.0, 0.0, 0.0, 0.0]
    for (let i = 0; i < 400; i += 4) {
        sums[0] += expected[i + 0] / 100;
        sums[1] += expected[i + 1] / 100;
        sums[2] += expected[i + 2] / 100;
        sums[3] += expected[i + 3] / 100;
    }

    const threshold = 0.001;
    const max_delta = assert_arrays_equal(dstData, sums, threshold);
    console.log("Passed! Max delta was", max_delta);

    console.log(dstData);
}
