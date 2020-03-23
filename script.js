async function loadTwgl() {
    const p = new Promise((resolve) => {
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = "https://twgljs.org/dist/4.x/twgl-full.min.js";
        script.onreadystatechange = resolve;
        script.onload = resolve;
        document.head.appendChild(script);
    });
    return p;
}

_fileCache = {}
async function getFile(url) {
    if (url in _fileCache)
        return _fileCache[url];

    const resp = await fetch(url);
    if (resp.status !== 200)
        throw("Could not find shader " + url);

    let fileContents = "";
    const reader = resp.body.getReader();
    done = false;
    while (!done) {
        let fileBody = await reader.read();
        if (!fileBody.value) {
            done = true;
        } else {
            fileContents += String.fromCharCode.apply(null, fileBody.value);
        }
    }
    _fileCache[url] = fileContents;
    return fileContents;
}

/**
 * @param gl webgl2 instance
 * @param dimensions [width, height] tuple for texture dimensions
 * @param data - can be null, if not will be used as the source for the texture
 */
function createTexture(gl, dimensions, data) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0, // level
        gl.RGBA32F, // internal format
        dimensions[0], // width
        dimensions[1], // height
        0, // border
        gl.RGBA, // format
        gl.FLOAT, // type
        data, /* source */);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    return tex;
}

function render(gl) {
    // draw the quad (2 triangles)
    const offset = 0;
    const numVertices = 6;
    gl.drawArrays(gl.TRIANGLES, offset, numVertices);
}

function setupProgram(gl, programInfo, bufferInfo) {
    gl.useProgram(programInfo.program);

    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

}

function enableGlExts(gl) {
    gl.getExtension('OES_texture_float');        // just in case
    gl.getExtension('OES_texture_float_linear');
    ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
        alert("no ext color...");
        throw new Error("!");
    }
}

const vs = `
    #version 300 es
    in vec4 position;
    void main() {
      gl_Position = position;
    }`;

const bufferArrays = {
    position: {
        data: [
          -1, -1,
           1, -1,
          -1,  1,
          -1,  1,
           1, -1,
           1,  1,
        ],
        numComponents: 2,
    },
};

var gl = null;
async function main(canvas, n, root) {
    console.time("main");
    console.time("Initial setup");
    await loadTwgl();

    const sqrt_n = Math.max(Math.ceil(Math.sqrt(n)), 1);
    const dimensions = [sqrt_n + 1, sqrt_n + 1];

    canvas.width = dimensions[0];
    canvas.height = dimensions[1];
    gl = canvas.getContext("webgl2", {premultipliedAlpha: false});
    if (!gl)
        throw new Error("Could not initialize webgl2 context! Does your browser support webgl2?");
    enableGlExts(gl);

    const fragShader = await getFile(root + "/compute.frag.c");
    const programInfo = twgl.createProgramInfo(gl, [vs, fragShader]);

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, bufferArrays);
    setupProgram(gl, programInfo, bufferInfo);

    const computeDst = createTexture(gl, dimensions, null);

    twgl.setUniforms(programInfo, {
        u_src_width: canvas.width,
        u_n: n,
        u_texture: 1,
        u_use_texture: 0,
    });

    // render with computeDst
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, computeDst, 0 /* level */);
    gl.finish();
    console.timeEnd("Initial setup");

    console.time("Compute");
    render(gl);
    gl.finish();
    console.timeEnd("Compute");

    // render to screen because it looks cool
    console.time("Render");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    twgl.setUniforms(programInfo, {
        u_texture: computeDst,
        u_use_texture: 1,
    });
    render(gl);
    gl.finish()
    console.timeEnd("Render");

    // Sum the results on the GPU
    console.group("Sum time stats");
    console.time("Sum pixels");
    console.time("Setup GPU Sum pixels");
    let scale = window.piCalcScale || 16;
    const width = Math.ceil(canvas.width / scale);
    const height = Math.ceil(canvas.height / scale);
    gl.viewport(0, 0, width, height);

    const sumShader = await getFile(root + "/sum.frag.c");
    const sumProgramInfo = twgl.createProgramInfo(gl, [vs, sumShader]);
    setupProgram(gl, sumProgramInfo, bufferInfo);

    gl.activeTexture(gl.TEXTURE1);
    const sumDst = createTexture(gl, [width, height], null);
    const dstBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sumDst, 0 /* level */);

    twgl.setUniforms(sumProgramInfo, {
        u_src_width: canvas.width,
        u_src_height: canvas.height,
        u_x_scale: scale,
        u_y_scale: scale,
        u_src_data: computeDst,
    });
    console.timeEnd("Setup GPU Sum pixels");

    console.time("Sum GPU");
    render(gl);
    gl.finish();
    console.timeEnd("Sum GPU");

    console.time("Read GPU result");
    let sumData = new Float32Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, sumData);
    console.timeEnd("Read GPU result");

    console.time("Sum CPU");
    let sum = 0.0;
    for (let i = 0; i < (sumData.length /  4); i++) {
        const r = sumData[i * 4 + 0]  * scale * scale;
        const g = sumData[i * 4 + 1]  * scale * scale;
        const b = sumData[i * 4 + 2]  * scale * scale;
        const a = sumData[i * 4 + 3]  * scale * scale;
        sum += 4 * r - 2 * g - b - a;
    }
    console.timeEnd("Sum CPU");
    console.timeEnd("Sum pixels");

    sum -= Math.floor(sum);
    sum *= 16;
    let nth = Math.floor(sum);
    if (nth >= 10)
        nth = String.fromCharCode(65 + nth - 10);
    else
        nth = String(nth);
    console.groupEnd("Sum time stats");

    console.info("Final results:", n, nth);
    console.timeEnd("main");
    return nth;
}
