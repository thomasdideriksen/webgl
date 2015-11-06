'use strict';

var _gl;
var _ext0;
var _uNow;
var _uScale;
var _scale = 1.0;
var _uOffset;
var _offset = {x: 0, y: 0};
var _timeOffset = Date.now();
var _aAnim;
var _aVertexPos;
var _aUV;
var _worker;
var _itemCount = 0;
var _initPos = [];
var _animations;
var _canvas;
var _aPosFrom;
var _aPosTo;
var _aThetaFromTo;

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
    var dataPosFrom = [];
    var dataPosTo = [];
    var dataThetaFromTo = [];
    var dataUVScaleOffsets = [];
    var dataAnim = [];
    var startTime = Date.now() - _timeOffset;
    for (var y = 0; y <= 1 - dim; y += dim) {
        for (var x = 0; x <= 1 - dim; x += dim) {
            
            dataUVScaleOffsets.push(dim, dim, x, y);
            dataAnim.push(startTime, 0, 0, 0);            
            dataThetaFromTo.push(0, 0);
            
            var initX = 2 * ((x) - 0.5);
            var initY = 2 * ((1 - y) - 0.5);
            
            dataPosFrom.push(initX, initY);
            dataPosTo.push(initX, initY);
            
            _initPos.push(initX, initY);
            
            _itemCount++;
        }
    }
    
    console.log('Quads: ' + _itemCount);
    
    // Assign source/destination angle
    _aThetaFromTo = new Attribute({
        program: program,
        name: "aThetaFromTo",
        size: 2,
        usage: _gl.DYNAMIC_DRAW,
        instanceDivisor: 1,
    });
    _aThetaFromTo.setData(new Float32Array(dataThetaFromTo));
    
    // Assign animation source position
    _aPosFrom = new Attribute({
        program: program,
        name: "aPosFrom",
        size: 2,
        usage: _gl.DYNAMIC_DRAW,
        instanceDivisor: 1,
    });
    _aPosFrom.setData(new Float32Array(dataPosFrom));
    
    // Assign animation destination position
    _aPosTo = new Attribute({
        program: program,
        name: "aPosTo",
        size: 2,
        usage: _gl.DYNAMIC_DRAW,
        instanceDivisor: 1,
    });
    _aPosTo.setData(new Float32Array(dataPosTo));
       
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
    
    // Initialize worker
    if (window.Worker) {
        _worker = new Worker('worker.js');
        _worker.onmessage = function(e) {
            setResult(e.data);
        }
    }
    
    // Initialize animation manager
    _animations = new ANIM.Animations();
    
    // Listen for key/mouse events
    _canvas.addEventListener('wheel', wheel);
    _canvas.addEventListener('mousedown', mousedown);
    window.addEventListener('mouseup', mouseup);
    window.addEventListener('mousemove', mousemove);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
}

function render() {
    requestAnimationFrame(render);
    evaluateFPS();
    _animations.tick();
    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
    _gl.uniform1f(_uNow,  Date.now() - _timeOffset);
    _ext0.drawArraysInstancedANGLE(_gl.TRIANGLES, 0, 6, _itemCount);
}

function createTransferList(obj) {
    var result = [];
    for (var i in obj) {
        if (obj[i] instanceof ArrayBuffer) {
            result.push(obj[i]);
        }
        if (obj[i].buffer && obj[i].buffer instanceof ArrayBuffer) {
            result.push(obj[i].buffer);
        }
    }
}

function workerFunc(e) {

    var itemCount = e.data.itemCount;
    var effect = e.data.effect;
    var oldNow = Date.now() - e.data.oldTimeOffset;
    
    var newAnim = new Float32Array(itemCount * 4);
    var oldAnim = e.data.anim;    
    
    var newPosFrom = new Float32Array(itemCount * 2);
    var oldPosFrom = e.data.posFrom;
    
    var newPosTo = new Float32Array(itemCount * 2);
    var oldPosTo = e.data.posTo;
    
    var newThetaFromTo = new Float32Array(itemCount * 2);
    var oldThetaFromTo = e.data.thetaFromTo;

    var currentAnimationTime = function(i) {
        var i4 = i * 4;
        var oldStartTime = oldAnim[i4 + 0];
        var oldDuration = oldAnim[i4 + 1];
        var dt = oldNow - oldStartTime;
        if (oldDuration == 0) {
            t = 1;
        } else {
            var t = dt / oldDuration;
            t = Math.max(0, t);
            t = Math.min(1, t);
        }
        t -= 1.0;
        t = t * t * t * t * t + 1.0;
        return t;
    }
    
    var currentPosition = function(i, t) {
        var i2 = i * 2;
        var fx = oldPosFrom[i2 + 0];
        var fy = oldPosFrom[i2 + 1];
        var tx = oldPosTo[i2 + 0];
        var ty = oldPosTo[i2 + 1];
        return {
            x: fx + (tx - fx) * t,
            y: fy + (ty - fy) * t 
        };
    }
    
    var currentTheta = function(i, t) {
        var i2 = i * 2;
        var theta0 = oldThetaFromTo[i2 + 0]
        var theta1 = oldThetaFromTo[i2 + 1]
        return (theta0 + (theta1 - theta0) * t) % (2 * Math.PI);
    }
      
    if (effect == EFFECT_RESET || effect == EFFECT_RANDOMIZE) {
        for (var i = 0; i < itemCount; i++) {
            var i2 = i * 2;
            var i4 = i * 4;
            var t = currentAnimationTime(i);
            var pt0 = currentPosition(i, t);
            newPosFrom[i2 + 0] = pt0.x;
            newPosFrom[i2 + 1] = pt0.y;
            newPosTo[i2 + 0] = e.data.initPos[i2 + 0];
            newPosTo[i2 + 1] = e.data.initPos[i2 + 1];
            newThetaFromTo[i2 + 0] = currentTheta(i, t);
            newThetaFromTo[i2 + 1] = 0;
            newAnim[i4 + 0] = 0;
            newAnim[i4 + 1] = 800 + Math.random() * 600;
        }
        if (effect == EFFECT_RANDOMIZE) {
            shufflePairs(newPosTo);
        }
    }
    
    if (effect == EFFECT_EXPLODE) {
        for (var i = 0; i < itemCount; i++) {
            var i2 = i * 2;
            var i4 = i * 4;
            var t = currentAnimationTime(i);
            var pt0 = currentPosition(i, t);
            var r = (Math.random() - 0.5) * 1.75;
            var t = Math.random() * Math.PI;
            newPosFrom[i2 + 0] = pt0.x;
            newPosFrom[i2 + 1] = pt0.y;
            newPosTo[i2 + 0] = pt0.x + r * Math.sin(t);
            newPosTo[i2 + 1] = pt0.y + r * Math.cos(t);
            newThetaFromTo[i2 + 0] = currentTheta(i, t);
            newThetaFromTo[i2 + 1] = Math.random() * 4 * Math.PI;
            newAnim[i4 + 0] = 0;
            newAnim[i4 + 1] = 1200 + Math.random() * 2000;
        }
    }
    
    if (effect == EFFECT_PILES) {
        var pileCount = e.data.pileCount;
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
        var theta = 0;
        for (var i = 0; i < pileCount; i++) {
            var pileX = dist * Math.cos(theta);
            var pileY = dist * Math.sin(theta);
            theta += tDelta;
            var lastPile = (i == pileCount - 1);
            var first = idx;
            var last = lastPile ? itemCount : idx + itemsPerPile;
            for (var j = first; j < last; j++) {
                var j2 = j * 2;
                var j4 = j * 4;
                var t = currentAnimationTime(j);
                var pt0 = currentPosition(j, t);
                var pt1 = createPilePos(pileX, pileY);
                newPosFrom[j2 + 0] = pt0.x;
                newPosFrom[j2 + 1] = pt0.y;
                newPosTo[j2 + 0] = pt1.x;
                newPosTo[j2 + 1] = pt1.y;
                newThetaFromTo[j2 + 0] = currentTheta(j, t);
                newThetaFromTo[j2 + 1] = Math.random() * 4 * Math.PI;
                newAnim[j4 + 0] = 0;
                newAnim[j4 + 1] = 500 + Math.random() * Math.random() * 2000;
            }
            idx += itemsPerPile;
        }
        shufflePairs(newPosTo);
    }
    
    if (effect == EFFECT_LOCALEXPLODE) {
        var pt = e.data.pt;
        // TODO
    }
           
    return {
        anim: newAnim,
        posTo: newPosTo,
        posFrom: newPosFrom,
        thetaFromTo: newThetaFromTo,
        workerFuncStartTime: e.data.workerFuncStartTime,
        newTimeOffset: Date.now()
    };
}

function setResult(result) {
    if (typeof result === 'undefined') {
        return;
    }
    if (_worker) {
        _worker.busy = false;
    }
    console.log('Worker: ' + (Date.now() - result.workerFuncStartTime) + ' ms');
    _timeOffset = result.newTimeOffset;
    _aAnim.setData(result.anim);
    _aPosFrom.setData(result.posFrom);
    _aPosTo.setData(result.posTo);
    _aThetaFromTo.setData(result.thetaFromTo);
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

var EFFECT_RESET        = 0;
var EFFECT_EXPLODE      = 1;
var EFFECT_RANDOMIZE    = 2
var EFFECT_PILES        = 3
var EFFECT_LOCALEXPLODE = 4;
var _ctrlDown = false;

function keydown(e) {

    if (e.keyCode == 17) {
        _ctrlDown = true;
    }
    
    var effect;
    switch (e.keyCode) {
        case 82: effect = EFFECT_RESET; break;
        case 32: effect = EFFECT_EXPLODE; break;
        case 83: effect = EFFECT_RANDOMIZE; break;
        case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: effect = EFFECT_PILES; break;
        default: return;
    }
    
    doShaderAnimation(effect, {pileCount: e.keyCode - 48});
}

function keyup(e) {
    if (e.keyCode == 17) {
        _ctrlDown = false;
    }
}

function doShaderAnimation(effect, props) {
    
    if (_worker.busy) {
        return;
    }
    
    var message = {
        anim: _aAnim.data, 
        posFrom: _aPosFrom.data,
        posTo: _aPosTo.data,
        thetaFromTo: _aThetaFromTo.data,
        oldTimeOffset: _timeOffset,
        itemCount: _itemCount,
        initPos: new Float32Array(_initPos),
        effect: effect,
        workerFuncStartTime: Date.now()};
        
    for (var i in props) {
        message[i] = props[i];
    }
    
    if (_worker) {
        _worker.postMessage(message, createTransferList(message));
        _worker.busy = true;
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
    if (_ctrlDown) {
        var pt = screenToClipSpace({x: e.clientX, y: e.clientY});
        doShaderAnimation(EFFECT_LOCALEXPLODE, {pt: pt});
        return;
    }
    
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