'use strict';

var _gl;
var _ext0;
var _uNow;
var _uScale;
var _scale = 1.0;
var _uOffset;
var _offset = {x: 0, y: 0};
var _timeOffset = Date.now();
var _aFromToPos;
var _aAnim;
var _aVertexPos;
var _aUV;
var _worker;
var _itemCount;
var _initPos = [];
var _animations;
var _canvas;

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

function initWebGL(canvas) {

    // Get GL context
    _canvas = canvas;
    _gl = _canvas.getContext('webgl', {
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
    
    // Initialize uniforms
    _gl.uniform1f(_uScale, _scale);
    _gl.uniform2f(_uOffset, _offset.x, _offset.y);
    
    // Create data
    var dim =  1 / 317;
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
    var startTime = Date.now() - _timeOffset;
    for (var y = 0; y <= 1 - dim; y += dim) {
        for (var x = 0; x <= 1 - dim; x += dim) {
            
            Array.prototype.push.apply(dataUVScaleOffsets, [dim, dim, x, y]);
                        
            var initX = 2 * ((x) - 0.5);
            var initY = 2 * ((1 - y) - 0.5);
            _initPos.push(initX, initY);
            Array.prototype.push.apply(dataFromToPos, [initX, initY, initX, initY]);
            
            Array.prototype.push.apply(dataAnim, [startTime, 0, 0, 0]);
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
        _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
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
    _animations = new ANIM.Animations();
    window.addEventListener('keydown', keydown);
    _canvas.addEventListener('wheel', wheel);
    _canvas.addEventListener('mousedown', mousedown);
    window.addEventListener('mouseup', mouseup);
    window.addEventListener('mousemove', mousemove);
}

function render() {
    requestAnimationFrame(render);
    evaluateFPS();
    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
    _gl.uniform1f(_uNow,  Date.now() - _timeOffset);
    _animations.tick();
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
    var targetPos;
    var duration; 
    var durationRandomness = 1500;
    var theta;
    var initPos = e.data.initPos;
    
    var explode = (e.data.keyCode == 32);
    var reset = (e.data.keyCode == 82);
    var swap = (e.data.keyCode == 83);
    var piles = (e.data.keyCode >= 49 && e.data.keyCode <= 57);
        
    if (explode || reset || swap || piles) {
        
        if (reset) {
            targetPos = initPos;
            duration = 800;
            durationRandomness = 600;
            theta = 0;
        }
        
        if (swap) {
            var pos = initPos;
            shufflePairs(pos);
            targetPos = new Float32Array(pos);
            duration = 800;
            theta = 0;
        }
        
        if (piles) {
            var pileCount = e.data.keyCode - 48;
            var pos = [];
            var createPilePos = function(x, y) {
                var r = Math.random() * 0.2 + Math.random() * Math.random() * 0.04;
                var t = Math.random() * 2 * Math.PI;
                return {
                    x: x + r * Math.cos(t),
                    y: y + r * Math.sin(t)
                };
            }
            var dist = (pileCount == 1) ? 0.0 : 0.7;
            var itemsPerPile = Math.round(itemCount / pileCount);
            var tDelta = (2 * Math.PI) / pileCount;
            var idx = 0;
            var t = 0;
            for (var i = 0; i < pileCount; i++) {
                var pileX = dist * Math.cos(t);
                var pileY = dist * Math.sin(t);
                t += tDelta;
                var lastPile = (i == pileCount - 1);
                var first = idx;
                var last = lastPile ? itemCount : idx + itemsPerPile;
                for (var j = first; j < last; j++) {
                    var pt = createPilePos(pileX, pileY);
                    pos.push(pt.x, pt.y);
                }
                idx += itemsPerPile;
            }
            targetPos = new Float32Array(pos);
            shufflePairs(targetPos);
            duration = 800;
            durationRandomness = 3000;
        }
    } else {
        return;
    }
        
    var dataAnim = [];
    var dataFromToPos = [];   
    var nowOld = Date.now() - e.data.oldTimeOffset;

    for (var j = 0; j < itemCount; j++) {

        var j4 = 4 * j;
        var j2 = 2 * j;

        var dt = nowOld - anim[j4 + 0];
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
        
        if (targetPos) {
            dataFromToPos.push(targetPos[j2 + 0], targetPos[j2 + 1]);
        } else {
            var move = 1.2;
            var randX = Math.random() - 0.5;
            var randY = Math.random() - 0.5;
            dataFromToPos.push(cx + randX * move, cy + randY * move);
        }
        
        var theta0 = anim[j4 + 2] + (anim[j4 + 3] - anim[j4 + 2]) * t;
        theta0 %=  (2 * Math.PI);
        var theta1 = theta;
        if (typeof theta1 === 'undefined') {
            theta1 = theta0 + 2 * Math.PI + Math.random() * 4 * Math.PI;
        }
        var actualDuration = duration || 2500;
        var actualDurationRandomness = durationRandomness || 0;
        var computedDuration = actualDuration + Math.random() * actualDurationRandomness;
        
        dataAnim.push(0, computedDuration, theta0, theta1);
    }
    
    return {
        anim: new Float32Array(dataAnim), 
        fromToPos: new Float32Array(dataFromToPos),
        workerFuncStartTime: e.data.workerFuncStartTime,
        newTimeOffset: Date.now()
    }
}

function setResult(result) {
    if (typeof result === 'undefined') {
        return;
    }
    console.log('Worker: ' + (Date.now() - result.workerFuncStartTime) + ' ms');
    _timeOffset = result.newTimeOffset;
    _aAnim.setData(result.anim);
    _aFromToPos.setData(result.fromToPos);
}

function shufflePairs(array) {
    var currentIndex = array.length / 2, randomIndex ;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        var temporaryValue0 = array[currentIndex * 2 + 0];
        var temporaryValue1 = array[currentIndex * 2 + 1];
        
        array[currentIndex * 2 + 0] = array[randomIndex * 2 + 0];
        array[currentIndex * 2 + 1] = array[randomIndex * 2 + 1];
        
        array[randomIndex * 2 + 0] = temporaryValue0;
        array[randomIndex * 2 + 1] = temporaryValue1;
    }
    return array;
}

function keydown(e) {
    
    var message = {
        anim: _aAnim.data, 
        fromToPos: _aFromToPos.data, 
        oldTimeOffset: _timeOffset,
        itemCount: _itemCount,
        initPos: new Float32Array(_initPos),
        keyCode: e.keyCode,
        workerFuncStartTime: Date.now()};
        
    if (_worker) {
        _worker.postMessage(message, createTransferList(message));
    } else {
        setResult(workerFunc({data: message}));
    }
}

var _dragging = false;
var _dragStart;
var _tmpOffset;
var _animIdX;
var _animIdY;
var _lastDelta;
var _lastPoint;

function screenToClipSpace(pt) {
    var rect = _canvas.getBoundingClientRect();
    var x = pt.x - rect.left;
    var y = pt.y - rect.top;
    var rw = rect.right - rect.left;
    var rh = rect.bottom - rect.top;
    return {
        x: ((x / rw) - 0.5) * 2,
        y: -((y / rh) - 0.5) * 2
    }
}

function mousedown(e) {
    _dragging = true;
    _dragStart = _lastPoint = screenToClipSpace({x: e.clientX, y: e.clientY});
    _animations.cancel(_animIdX);
    _animations.cancel(_animIdY);
}

function mouseup(e) {
    if (_dragging) {
        _dragging = false;
        _offset = _tmpOffset;
        
        if (_lastDelta) {
            
            var dt = (Date.now() - _lastDelta.timeStamp) + 5;
            var scale = (1 / dt) * (1 / _scale) * 120 ;
            
           _animIdX = _animations.animate({
                object: _offset,
                property: 'x',
                to: _offset.x + _lastDelta.dx * scale,
                duration: 1200,
                easing: ANIM.EASE_QUINT_OUT,
                onupdate: function(val) {
                    _offset.x = val;
                    _gl.uniform2f(_uOffset, _offset.x, _offset.y);
                }
            });
            
            _animIdY = _animations.animate({
                object: _offset,
                property: 'y',
                to: _offset.y + _lastDelta.dy * scale,
                duration: 1200,
                easing: ANIM.EASE_QUINT_OUT,
                onupdate: function(val) {
                    _offset.y = val;
                    _gl.uniform2f(_uOffset, _offset.x, _offset.y);
                }
            });   
        }
    }
}

function mousemove(e) {
    if (_dragging) {
        var pt = screenToClipSpace({x: e.clientX, y: e.clientY});
        
        _lastDelta = {
            dx: pt.x - _lastPoint.x, 
            dy: pt.y - _lastPoint.y,
            timeStamp: Date.now()
        };
        
        _lastPoint = pt;
        var dx = (pt.x - _dragStart.x) / _scale;
        var dy = (pt.y - _dragStart.y) / _scale;
        _tmpOffset = {x: _offset.x + dx, y: _offset.y + dy};
        _gl.uniform2f(_uOffset, _tmpOffset.x, _tmpOffset.y);
    }
}

function wheel(e) {
    var sign = (e.deltaY > 0) ? -1 : 1;
    var zoomFactor = 1.9;
    var to = ((sign < 0) ? 1 / zoomFactor : zoomFactor) * _scale;
    
    _animations.animate({
        object: window,
        property: '_scale',
        to: to,
        duration: 800,
        easing: ANIM.EASE_QUINT_OUT,
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