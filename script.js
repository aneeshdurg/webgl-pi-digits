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

    const fileBody = await resp.body.getReader().read();
    const fileContents = String.fromCharCode.apply(null, fileBody.value)
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
    console.log("Drawing...");
    // draw the quad (2 triangles)
    const offset = 0;
    const numVertices = 6;
    gl.drawArrays(gl.TRIANGLES, offset, numVertices);
}

function setupProgram(gl, programInfo, bufferInfo) {
    console.log("Setting up program");
    gl.useProgram(programInfo.program);

    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

}

async function main() {
    console.log("Loading twgl");
    await loadTwgl();
    console.log("Loaded twgl");

    // TODO add a way to change n
    const n = 10000;
    const sqrt_n = Math.sqrt(n);
    const dimensions = [sqrt_n, sqrt_n];
    console.log("params", n, sqrt_n, dimensions);

    console.log("Initializing canvas");
    // const gl = document.createElement("canvas").getContext("webgl2");
    const canvas = document.getElementById("glcanvas");
    canvas.width = dimensions[0];
    canvas.height = dimensions[1];
    const gl = canvas.getContext("webgl2");


    gl.getExtension('OES_texture_float');        // just in case
    gl.getExtension('OES_texture_float_linear');
    ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
        alert("no ext color...");
        throw new Error("!");
    }

    console.log("Loading shaders");
    const vertShader = await getFile("./shader.vert.c");
    const fragShader = await getFile("./compute.frag.c");
    const vs = `
        #version 300 es
        in vec4 position;
        void main() {
          gl_Position = position;
        }`;
    console.log("Loaded shaders");
    console.log("Compiling shaders");
    const programInfo = twgl.createProgramInfo(gl, [vs, fragShader]);
    console.log(programInfo);

    console.log("Setting up textures/buffers");
    const computeDst = createTexture(gl, dimensions, null);

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
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
    });

    setupProgram(gl, programInfo, bufferInfo);

    twgl.setUniforms(programInfo, {
      u_src_width: canvas.width,
      u_n: n,
    });

    // render with computeDst
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, computeDst, 0 /* level */);
    render(gl);

    console.log("Reading results");
    // pull out the result
    let dstData = new Float32Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, dstData);
    console.log(dstData);

    // render to screen for debugging
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    render(gl);

    // let sleeper = new Promise((r) => setTimeout(r, 1000));
    // await sleeper;

    const sumShader = await getFile("./sum.frag.c");
    const sumProgramInfo = twgl.createProgramInfo(gl, [vs, sumShader]);
    setupProgram(gl, sumProgramInfo, bufferInfo);


    gl.activeTexture(gl.TEXTURE1);
    console.log("Creating sum texture");
    const sumDst = createTexture(gl, [canvas.width, canvas.height], null);
    const dstBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sumDst, 0 /* level */);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstBuffer);

    function decimate(srcData, scale) {
        twgl.setUniforms(sumProgramInfo, {
            u_src_width: canvas.width,
            u_x_scale: scale,
            u_y_scale: scale,
            u_src_data: srcData,
        });

        render(gl);

        console.log("Reading results");
        // pull out the result
        dstData = new Float32Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, dstData);
        console.log(dstData);

        return dstData;
    }

    const scale = dimensions[0];

    canvas.width /= scale;
    canvas.height /= scale;
    decimate(computeDst, scale);

    const r = dstData[0] * scale * scale;
    const g = dstData[1] * scale * scale;
    const b = dstData[2] * scale * scale;
    const a = dstData[3] * scale * scale;

    let s = 4 * r - 2 * g - b - a;
    console.log(s);
    s -= Math.floor(s);
    s *= 16;
    let nth = Math.floor(s);
    console.log(n, nth);

    document.getElementById("results").innerText = "The " + n + "th hex digit of pi is " + nth;
}

document.addEventListener('DOMContentLoaded', main);
