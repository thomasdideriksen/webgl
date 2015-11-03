var ANIM = {};

ANIM.EASE_CUBIC_OUT = 1;
ANIM.EASE_QUINT_OUT = 2;

ANIM.Animations = function() {
    this.animations = {};
    this.uniqueId = 0;
}
ANIM.Animations.prototype = {
    
    constructor: ANIM.Animations,

    animate: function(params) {
        if (!params.object.uniqueAnimationId) {
            params.object.uniqueAnimationId = this.uniqueId++;
        }
        var objectId = params.object.uniqueAnimationId;
        if (!(objectId in this.animations)) {
            this.animations[objectId] = {};
        }
        this.animations[objectId][params.property] = {
            object: params.object,
            property: params.property,
            from: params.from ? params.from : params.object[params.property],
            to: params.to,
            duration: params.duration ? params.duration : 350,
            beginTime: Date.now(),
            easing: params.easing,
            oncomplete: params.oncomplete,
            onupdate: params.onupdate,
            delay: params.delay ? params.delay : 0
        };
        return {
            objectId: objectId,
            property: params.property
        }
    },
    
    active: function() {
        var active = false;
        for (var i in this.animations){
            active = true;
            break;
        }
        return active;
    },
    
    cancel: function(id) {
        if (id && id.objectId in this.animations) {
            if (id.property in this.animations[id.objectId]) {
                delete this.animations[id.objectId][id.property];
            }
        }
    },
    
    tick: function() {
        for (var objectId in this.animations) {
            for (var property in this.animations[objectId]) {
                var anim = this.animations[objectId][property];
                var dt = (Date.now() - (anim.beginTime + anim.delay)) / anim.duration;
                if (dt < 0) {
                    continue;
                }
                if (dt <= 1.0) {
                    var t;
                    switch (anim.easing) {
                        default:
                            t = dt; 
                            break;
                        case ANIM.EASE_CUBIC_OUT:
                            t = dt - 1.0;
                            t = t * t * t + 1.0;
                            break;
                        case ANIM.EASE_QUINT_OUT:
                            t = dt - 1.0;
                            t = t * t * t * t * t + 1.0;
                            break;
                    }
                    var value = anim.from + (anim.to - anim.from) * t;
                    anim.object[anim.property] = value;
                    if (anim.onupdate) {
                        anim.onupdate(value);
                    }
                } else {
                    anim.object[anim.property] = anim.to;
                    if (anim.onupdate) {
                        anim.onupdate(anim.to);
                    }
                    delete this.animations[objectId][property];
                    var empty = true;
                    for (var k in this.animations[objectId]) {
                        empty = false;
                        break;
                    }
                    if (empty) {
                        delete this.animations[objectId];
                    }
                    if (anim.oncomplete) {
                        anim.oncomplete();
                    }
                }
            }
        }
    }
}