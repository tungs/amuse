var canvas = document.getElementById('draw-canvas');
var defaultText = 'Hello, World!';
var justification = 'center';
var horizontalPadding = 40;
var verticalPadding = 20;
var fontSize = 128;
var lineHeight = 120;
var dotWidth = 1;
var randomize = true;
var clockwise = true;
var ctx;
var svg = document.getElementById('offscreen');
var cancelPrevious;

var createAndAppendSVGPath = function (d) {
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttributeNS(null, 'd', d);
  svg.appendChild(path);
  return path;
};

var drawPaths = function (paths, offsetX, offsetY) {
  var cancels = paths.map(function (path) {
    var length = path.getTotalLength();
    var animationId;
    var s = length;
    var pos = (randomize ? Math.random() : 1) * length;
    var loop = function () {
      if (s < 0) {
        return;
      }
      animationId = requestAnimationFrame(loop);
      if (pos < 0) {
        pos += length;
      }
      point = path.getPointAtLength(clockwise ? pos : length - pos);
      ctx.fillRect(point.x + offsetX, point.y + offsetY, dotWidth, dotWidth);
      s -= 1;
      pos -= 1;
    };
    animationId = requestAnimationFrame(loop);
    return function () {
      cancelAnimationFrame(animationId);
    };
  });
  return function () {
    cancels.forEach(function (cancel) {
      cancel();
    });
  };
};

var fontLoadPromise = new Promise(function (resolve, reject) {
  opentype.load('OverpassBold.otf', function (err, font) {
    if (err) {
      reject(err);
    } else {
      resolve(font);
    }
  });
});
var drawText = function (config) {
  fontLoadPromise.then(function (font) {
    var text = config.text || defaultText;
    var textLines = text.split('\n').map(function (line) {
      var pathData = (font.getPath(line, 0, 0, fontSize)).toPathData();
      var overallPath = createAndAppendSVGPath(pathData);
      var bbox = overallPath.getBBox();
      if (pathData.endsWith('Z')) {
        pathData = pathData.substring(0, pathData.length - 1);
      }
      var pathsData = pathData.split('Z').map(function (d) {
        return d + 'Z';
      });
      var paths = pathsData.map(createAndAppendSVGPath);
      var cancel;
      return {
        width: bbox.width,
        height: bbox.height,
        draw: function (offsetX, offsetY) {
          cancel = drawPaths(paths, offsetX - bbox.x, offsetY - bbox.y);
        },
        cancel: function () {
          if (cancel) {
            cancel();
            cancel = null;
          }
        }
      }
    });
    var height = textLines.length * lineHeight + 2 * verticalPadding;
    var maxTextLineWidth = textLines.reduce(function (a, b) {
      return Math.max(a, b.width);
    }, 0);
    var width = 2 * horizontalPadding + maxTextLineWidth;
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
    if (cancelPrevious) {
      cancelPrevious();
    }
    textLines.forEach(function (textLine, i) {
      var offset;
      if (justification === 'left') {
        offset = 0;
      } else if (justification === 'right') {
        offset = (maxTextLineWidth - textLine.width);
      } else {
        offset = (maxTextLineWidth - textLine.width)/2;
      }
      textLine.draw(horizontalPadding + offset, verticalPadding + lineHeight * i);
    });
    cancelPrevious = function () {
      textLines.forEach(function (textLine) {
        textLine.cancel();
      });
    };
  });  
};

document.getElementById('draw-button').addEventListener('click', function () {
  var text = document.getElementById('textarea-input').value;
  drawText({ text: text });
  if (window.history.replaceState) {
    window.history.replaceState(null, null, '#message=' + encodeURIComponent(text));    
  } else {
    window.location.hash = '#message=' + encodeURIComponent(text);
  }
});

var fragment = window.location.hash;
var fragmentObj = {};
if (fragment) {
  fragment = fragment.substring(1);
  fragment.split('&').forEach(function (keyValue) {
    var keyValueComponents = keyValue.split('=');
    var key = keyValueComponents[0];
    var values = keyValueComponents.slice(1);
    if (values.length === 0) {
      fragmentObj.message = decodeURIComponent(key);
    } else {
      fragmentObj[key] = decodeURIComponent(values.join('='));
    }
  });
  if (fragmentObj.message) {
    document.getElementById('textarea-input').value = fragmentObj.message;
  }
}
drawText({ text: fragmentObj.message });