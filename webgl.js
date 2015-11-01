'use strict';

var _gl;
var _ext0;
var _uNow;
var _uScale;
var _scale = 1.0;
var _uOffset;
var _timeOffset = Date.now(); // TODO: Update this every time we transition from no-animations-->one-or-more-animations to avoid floating point precision issues
var _aFromToPos;
var _aAnim;
var _aVertexPos;
var _aUV;
var _worker;
var _itemCount;
var _initPos = [];
var _animations;

function compile(shader) {
    _gl.compileShader(shader);
    if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
        console.error(_gl.getShaderInfoLog(shader));
    }
}

function Attribute(props) {
    this.props = props;
    this.buffer = _gl.createBuffer();
    var location = _gl.getAttribLocation(props.program, props.name);
    _gl.enableVertexAttribArray(location);
    _gl.bindBuffer(_gl.ARRAY_BUFFER, this.buffer);
    _gl.vertexAttribPointer(location, props.size, _gl.FLOAT, false, 0, 0);
    if (typeof props.instanceDivisor !== 'undefined') {
        _ext0.vertexAttribDivisorANGLE(location, props.instanceDivisor);
    }
}
Attribute.prototype = {
    constructor: Attribute,
    setData: function(data) {
        this.data = data;
        _gl.bindBuffer(_gl.ARRAY_BUFFER, this.buffer);
        _gl.bufferData(_gl.ARRAY_BUFFER, data, this.props.usage);
        
    },
};

function getTime() {
    return Date.now() - _timeOffset;
}

function initWebGL(canvas) {

    // Get GL context
    _gl = canvas.getContext('webgl', {
        antialias: true,
    });
    _gl = WebGLDebugUtils.makeDebugContext(_gl); // Note: For debugging purposes
    _ext0 = _gl.getExtension("ANGLE_instanced_arrays");
    
    // Compile vertex shader
    var shaderVert = _gl.createShader(_gl.VERTEX_SHADER);
    _gl.shaderSource(shaderVert, document.getElementById('vertexShader').textContent);
    compile(shaderVert);
 
    // Compile fragment shader
    var shaderFrag = _gl.createShader(_gl.FRAGMENT_SHADER);
    _gl.shaderSource(shaderFrag, document.getElementById('fragmentShader').textContent);
    compile(shaderFrag);
    
    // Create program
    var program = _gl.createProgram();
    _gl.attachShader(program, shaderVert);
    _gl.attachShader(program, shaderFrag);
    _gl.linkProgram(program);
    if (!_gl.getProgramParameter(program, _gl.LINK_STATUS)) {
        console.error(_gl.getProgramInfoLog(program));
    }

    // Enable program
    _gl.useProgram(program);
    
    // Get uniform handles
    _uScale = _gl.getUniformLocation(program, "uScale");
    _uOffset = _gl.getUniformLocation(program, "uOffset");
    _uNow = _gl.getUniformLocation(program, "uNow");
    
    // Assign uniforms
    _gl.uniform1f(_uScale, _scale);
    _gl.uniform2f(_uOffset, 0.0, 0.0);
    
    // Create data
    var dim =  1 / 300;
    var dataVertexPos = [
       -dim,  dim, 0, 0, // 0-2
       -dim, -dim, 0, 1, // |/
        dim,  dim, 1, 0, // 1
       
       -dim, -dim, 0, 1, //   2
        dim, -dim, 1, 1, //  /|
        dim,  dim, 1, 0, // 0-1
    ]
    var dataFromToPos = [];
    var dataUVScaleOffsets = [];
    var dataAnim = [];
    var startTime = getTime();
    for (var y = 0; y <= 1 - dim; y += dim) {
        for (var x = 0; x <= 1 - dim; x += dim) {
            
            Array.prototype.push.apply(dataUVScaleOffsets, [dim, dim, x, y]);
                        
            var initX = 2 * ((x) - 0.5);
            var initY = 2 * ((1 - y) - 0.5);
            _initPos.push(initX, initY);
            Array.prototype.push.apply(dataFromToPos, [0, 0, initX, initY]);
            
            Array.prototype.push.apply(dataAnim, [startTime, 4000, 0, 0]);
        }
    }
    
    _itemCount = dataUVScaleOffsets.length / 4;
    console.log('Quads: ' + _itemCount);
    
    // Assign from-to positions
    _aFromToPos = new Attribute({
        program: program,
        name: "aFromToPos",
        size: 4,
        usage: _gl.DYNAMIC_DRAW,
        instanceDivisor: 1,
    });
    _aFromToPos.setData(new Float32Array(dataFromToPos));
    
    // Assign animation stuff
    _aAnim = new Attribute({
        program: program,
        name: "aAnim",
        size: 4,
        usage: _gl.DYNAMIC_DRAW,
        instanceDivisor: 1,
    });
    _aAnim.setData(new Float32Array(dataAnim));
    
    // Assign vertex data
    _aVertexPos = new Attribute({
        program: program,
        name: "aVertexPos",
        size: 4,
        usage: _gl.STATIC_DRAW
    });
    _aVertexPos.setData(new Float32Array(dataVertexPos));
    
    // Assign UV scale/offsets
    _aUV = new Attribute({
        program: program,
        name: "aUVScaleOffset",
        size: 4,
        usage: _gl.STATIC_DRAW,
        instanceDivisor: 1,
    });
    _aUV.setData(new Float32Array(dataUVScaleOffsets));
    
    // Create texture
    var onTexLoaded = function(im, tex) {
        _gl.bindTexture(_gl.TEXTURE_2D, tex);
        _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, im);
        _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.NEAREST);
        _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR_MIPMAP_LINEAR);
        _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.REPEAT);
        _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.REPEAT);
        _gl.generateMipmap(_gl.TEXTURE_2D);
        _gl.bindTexture(_gl.TEXTURE_2D, null);
        
        _gl.activeTexture(_gl.TEXTURE0);
        _gl.bindTexture(_gl.TEXTURE_2D, tex);
        _gl.uniform1i(_gl.getUniformLocation(program, "uSampler"), 0);
    }
    var tex0 = _gl.createTexture();
    var im = new Image();
    im.onload = function() { onTexLoaded(im, tex0); }
    im.src = 'tex0.png';
    
    // Prepare for render
    _gl.viewport(0, 0, _gl.drawingBufferWidth, _gl.drawingBufferHeight);
    _gl.scissor(0, 0, _gl.drawingBufferWidth, _gl.drawingBufferHeight);
    _gl.enable(_gl.DEPTH_TEST);
    _gl.depthFunc(_gl.LESS);
    _gl.enable(_gl.CULL_FACE);
    _gl.cullFace(_gl.BACK);
    _gl.disable( _gl.BLEND );
    //_gl.clearColor(0.1, 0.1, 0.1, 1);
    
    // Begin rendering
    requestAnimationFrame(render);
    
    if (window.Worker) {
        _worker = new Worker('worker.js');
        _worker.onmessage = function(e) {
            setResult(e.data);
        }
    }
    
    // Listen for key/mouse events
    _animations = new Animations();
    window.addEventListener('keydown', keydown);
    window.addEventListener('mousewheel', mousewheel);
}

function render() {
    requestAnimationFrame(render);
    evaluateFPS();
    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
    _gl.uniform1f(_uNow,  getTime());
    _animations.apply();
    _ext0.drawArraysInstancedANGLE(_gl.TRIANGLES, 0, 6, _itemCount);
}

function createTransferList(obj) {
    var result = [];
    for (var i in obj) {
        if (obj[i].buffer && obj[i].buffer instanceof ArrayBuffer) {
            result.push(obj[i].buffer);
        }
    }
}

function workerFunc(e) {

    var anim = e.data.anim;
    var fromToPos = e.data.fromToPos;
    var itemCount = e.data.itemCount;
    var initPos = e.data.initPos;
    
    var dataAnim = [];
    var dataFromToPos = [];
    
    var now = Date.now() - e.data.timeOffset;
    
    for (var j = 0; j < itemCount; j++) {

        var j4 = 4 * j;
        var j2 = 2 * j;

        var dt = now - anim[j4 + 0];
        var t = dt / anim[j4 + 1];
        t = Math.max(0, t);
        t = Math.min(1, t);
        
        t -= 1.0;
        t = t * t * t * t * t + 1.0;
    
        var fx = fromToPos[j4 + 0];
        var fy = fromToPos[j4 + 1];
        var tx = fromToPos[j4 + 2];
        var ty = fromToPos[j4 + 3];
        
        var cx = fx + (tx - fx) * t;
        var cy = fy + (ty - fy) * t;
        
        
        dataFromToPos.push(cx, cy);
        
        if (initPos) {
            dataFromToPos.push(initPos[j2 + 0], initPos[j2 + 1]);
        } else {
            var move = 0.2;
            var randX = Math.random() - 0.5;
            var randY = Math.random() - 0.5;
            dataFromToPos.push(cx + randX * move, cy + randY * move);
        }
        
    }
    
    var duration = (initPos) ? 800 : 3000;
    var now = Date.now() - e.data.timeOffset;
    for (var j = 0; j < itemCount; j++) {
        var j4 = 4 * j;
        dataAnim.push(now, duration, 0, 0);
    }
    
    return {
        anim: new Float32Array(dataAnim), 
        fromToPos: new Float32Array(dataFromToPos),
        startTime: e.data.startTime
    }
}

function setResult(result) {
    console.log('Worker: ' + (Date.now() - result.startTime) + ' ms');
    _aAnim.setData(result.anim);
    _aFromToPos.setData(result.fromToPos);
}

function keydown(e) {
    
    var reset = (e.keyCode == 82);
    
    if (e.keyCode == 32 || reset) {
        
        var message = {
            anim: _aAnim.data, 
            fromToPos: _aFromToPos.data, 
            timeOffset: _timeOffset,
            itemCount: _itemCount, 
            startTime: Date.now()};
        
        if (reset) {
            message.initPos = new Float32Array(_initPos);
        }
        
        if (_worker) {
            _worker.postMessage(message, createTransferList(message));
        } else {
            setResult(workerFunc({data: message}));
        }
    }
    
}

function mousewheel(e) {
    var sign = (e.wheelDeltaY < 0) ? -1 : 1;
    var zoomFactor = 1.6;
    var to = ((sign < 0) ? 1 / zoomFactor : zoomFactor) * _scale;
    
    _animations.animate({
        object: this,
        property: '_scale',
        to: to,
        duration: 800,
        easing: _animations.EASE_QUINT_OUT,
        onupdate: function(val) {
            _gl.uniform1f(_uScale, val);
        }
    });   
}

var _lastRender;
var _sum = 0;
var _count = 0;
var _fpsDiv;
function evaluateFPS() {
    var now = Date.now();
    if (_lastRender) {
        _sum += (now - _lastRender);
        _count++;
        if (_count == 12) {
            if (!_fpsDiv) {
                _fpsDiv = document.getElementById('fps');
            }
            _fpsDiv.innerHTML = (1000.0 / (_sum / _count)).toFixed(1) + ' FPS';
            _sum = 0;
            _count = 0;
        }
    } 
    _lastRender = now;
}