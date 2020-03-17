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

async function getFile(url) {
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
    console.time("Initial setup");
    await loadTwgl();

    const sqrt_n = Math.max(Math.ceil(Math.sqrt(n)), 1);
    const dimensions = [sqrt_n, sqrt_n];
    console.log("params", n, sqrt_n, dimensions);

    canvas.width = dimensions[0];
    canvas.height = dimensions[1];
    gl = canvas.getContext("webgl2");
    console.log(gl);
    enableGlExts(gl);

    const fragShader = await getFile(root + "/compute.frag.c");

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
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, computeDst, 0 /* level */);
    gl.finish();
    console.timeEnd("Initial setup");

    console.time("Compute");

    render(gl);
    gl.finish();

    console.timeEnd("Compute");

    console.time("Extract");
    let dstData = new Float32Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, dstData);
    console.log(dstData);
    console.timeEnd("Extract");

    console.time("Render");
    // render to screen because it looks cool
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    render(gl);
    console.timeEnd("Render");

    //const sumShader = await getFile("./sum.frag.c");
    //const sumProgramInfo = twgl.createProgramInfo(gl, [vs, sumShader]);
    //setupProgram(gl, sumProgramInfo, bufferInfo);


    //gl.activeTexture(gl.TEXTURE1);
    //const sumDst = createTexture(gl, [canvas.width, canvas.height], null);
    //const dstBuffer = gl.createFramebuffer();
    //gl.bindFramebuffer(gl.FRAMEBUFFER, dstBuffer);
    //gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sumDst, 0 /* level */);
    //gl.bindFramebuffer(gl.FRAMEBUFFER, dstBuffer);

    let scale = 1;
    //console.log(canvas.width);
    //canvas.width /= scale;
    //canvas.height /= scale;
    //console.log("Iterating", canvas.width);

    //twgl.setUniforms(sumProgramInfo, {
    //    u_src_width: canvas.width,
    //    u_x_scale: scale,
    //    u_y_scale: scale,
    //    u_src_data: computeDst,
    //});

    //console.time("Sum pixels GPU");
    //render(gl);
    //gl.finish();
    //console.timeEnd("Sum pixels GPU");

    //console.log("Reading results");
    //// pull out the result
    //let dstData = new Float32Array(canvas.width * canvas.height * 4);
    //gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, dstData);
    //console.log(dstData);

    console.time("Sum pixels CPU");
    let sum = 0.0;

    for (let i = 0; i < (canvas.width * canvas.height); i++) {
        const r = dstData[i * 4 + 0] * scale * scale;
        const g = dstData[i * 4 + 1] * scale * scale;
        const b = dstData[i * 4 + 2] * scale * scale;
        const a = dstData[i * 4 + 3] * scale * scale;
        sum += 4 * r - 2 * g - b - a;
    }

    console.log(sum);
    console.timeEnd("Sum pixels CPU");
    sum -= Math.floor(sum);
    sum *= 16;
    let nth = Math.floor(sum);
    if (nth >= 10)
        nth = String.fromCharCode(65 + nth - 10);
    else
        nth = String(nth);
    console.log(n, nth);

    canvas.width = dimensions[0];
    canvas.height = dimensions[1];
    return nth;
}
