var maxDepth = 11;
var minDepth = 4;
var timeOffset = 0;
var trackingAngle = false;
var unevenLengths = [ outerRadius * 45 / 64, outerRadius * 15 / 16, outerRadius];
var equilateralLengths = [ innerRadius * 2, innerRadius * 2, innerRadius * 2];
var currentLengths = unevenLengths;
var colors = [ '250,0,0', '0,190,0', '130,130,255'];
var thicknesses = [ height / 62.5, height / 72.5, height / 133 ];
var handBalances = [ 0, 0, height / 20 ];
var angles;
var tickEasing = d3.easeElasticOut.amplitude(1.2).period(0.3);
var growEasing = d3.easeElasticOut.amplitude(1.2).period(0.3);
var positionTransition = d3.easeCubicInOut;
var pauseDate = null;
var smoothTicks = false;

function calculateOffset(targetHours, targetMinutes, targetSeconds, targetMilliseconds) {
  var currentDate = new Date();
  if (typeof targetSeconds === 'undefined') {
    targetSeconds = currentDate.getSeconds();
  }
  var seconds = (targetMinutes + targetHours * 60) * 60 + targetSeconds;
  var currentSeconds = (currentDate.getMinutes() + currentDate.getHours() * 60) * 60 + currentDate.getSeconds();
  // can also add an adjustment, e.g. ` + 900 - currentDate.getMilliseconds()`
  return (seconds - currentSeconds) * 1000;
}

function getDate() {
  if (pauseDate) {
    return pauseDate;
  } else {
    return new Date((new Date().valueOf()) + timeOffset);
  }
}

bigClockFaceCtx.strokeStyle = 'rgb(255, 255, 255)';
drawClockFace({
  ctx: bigClockFaceCtx,
  circleRadius: outerRadius - 7,
  innerRadius: outerRadius - 60,
  outerRadius: outerRadius - 7,
  tickWidth: 16, 
  circleWidth: 14
});

clockFaceCtx.strokeStyle = 'rgb(255, 255, 255)';
drawClockFace({
  ctx: clockFaceCtx,
  circleRadius: innerRadius,
  innerRadius: innerRadius - 40,
  outerRadius: innerRadius,
  tickWidth: 14,
  circleWidth: 16
});

function updateClock() {
  var currentDate = getDate();
  var jiggleDate = new Date((currentDate.valueOf()) - 900);
  var seconds = jiggleDate.getSeconds();
  var minutes = jiggleDate.getMinutes();
  var hours = jiggleDate.getHours();
  var milliseconds = jiggleDate.getMilliseconds();
  var jiggle = tickEasing(milliseconds / 1000);
  setClockInputTime(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds());
  if (smoothTicks) {
    angles = [
      ((currentDate.getHours() % 12) + currentDate.getMinutes() / 60 + currentDate.getSeconds() / 3600) * 360 / 12,
      (currentDate.getMinutes() + currentDate.getSeconds() / 60) * 360 / 60 ,
      (currentDate.getSeconds() + currentDate.getMilliseconds() / 1000) * 360 / 60
      // (seconds + jiggle) * 360 / 60 // for a ticking one
    ];
  } else {
    angles = [
      (hours % 12 + (minutes === 59 && seconds === 59 ? jiggle: 0)) * 360 / 12,
      (minutes + (seconds === 59 ? jiggle : 0)) * 360 / 60 ,
      (seconds + jiggle) * 360 / 60
    ];    
  }
}

function updateTime() {
  requestAnimationFrame(updateTime);
  updateClock();
}
updateTime();

function makeChildren(depth) {
  return [0,0,0].map(function (length, i) {
    return {
      lineLength: {
        currentValue: length,
        startValue: length,
        endValue: currentLengths[i] / Math.pow(2, depth),
        progress: 0,
        duration: randomBetween(1100, 2000)
      },
      transitionAngle: {
        startValue: 0,
        endValue: 0,
        currentValue:  0,
        progress: 1,
        duration: 800,
      },
      baseAngle: -90 + angles[i],
      type: i,
      depth
    };
  });
}

var angle = 10;
var nodes = makeChildren(1);
var frameDelta = 0;
var lastAnimationFrameTime = Date.now();
var relativePosition = false;
function markRelativeAngle(node, targetAngle) {
  node.transitionAngle.startValue = getRelativeAngle(node.baseAngle - node.transitionAngle.currentValue, targetAngle);
  node.transitionAngle.progress = 0;
  if (node.children) {
    node.children.forEach(function (childNode, i) {
      markRelativeAngle(childNode, (relativePosition ? targetAngle : -90) + angles[i]);
    });
  }
}

function markLineLength(node, targetLength) {
  node.lineLength.startValue = node.lineLength.currentValue;
  node.lineLength.endValue = targetLength;
  node.lineLength.progress = 0;
  if (node.children) {
    node.children.forEach(function (childNode, i) {
      markLineLength(childNode, currentLengths[i] / Math.pow(2, childNode.depth));
    });
  }
}

function reduceDepth(node) {
  if (node.depth === maxDepth) {
    node.children = null;
  } else if (node.children) {
    node.children.forEach(reduceDepth);
  }
}

function updateAndRenderNode(node, x, y, fractalAngle) {
  updateTransition(node.transitionAngle, positionTransition);
  var transitionAngle = node.transitionAngle.currentValue;
  if (relativePosition) {
    node.baseAngle = fractalAngle ;
  } else {
    node.baseAngle = -90 + angles[node.type];
  }
  var currentAngle = node.baseAngle - transitionAngle;
  updateTransition(node.lineLength, growEasing);
  if (node.lineLength.progress >= 1) {
    if (!node.children && node.depth !== maxDepth) {
      node.children = makeChildren(node.depth + 1);
    }
  }
  var length = node.lineLength.currentValue;
  var x2 = x + length * Math.cos(currentAngle * PI / 180);
  var y2 = y + length * Math.sin(currentAngle * PI / 180);
  if (node.children) {
    node.children.forEach(function (childNode, i) {
      updateAndRenderNode(childNode, x2, y2, fractalAngle + angles[i]);
    });
  }
  if (node.depth !== 1) {
    backgroundCtx.beginPath();
    backgroundCtx.moveTo(x,y);
    backgroundCtx.lineCap = 'butt';
    backgroundCtx.strokeStyle = `rgba(${colors[node.type]},1)`;
    backgroundCtx.lineWidth = Math.max(10 - node.depth * 2, 1);
    backgroundCtx.lineTo(x2, y2);
    backgroundCtx.stroke();
  }
}

var updateAndRender = function() {
  var currentTime = Date.now();
  frameDelta = currentTime - lastAnimationFrameTime;
  lastAnimationFrameTime = currentTime;
  requestAnimationFrame(updateAndRender);
  backgroundCtx.clearRect(0, 0, width, height);
  frontCtx.fillStyle = 'black';
  frontCtx.fillRect(0, 0, width, height);

  nodes.forEach(function (node, i) {
    updateAndRenderNode(node, width/2, height/2, -90 + angles[i]);
  });

  frontCtx.globalAlpha = 0.6;
  frontCtx.drawImage(backgroundCanvas, 0, 0);
  frontCtx.globalAlpha = 0.12;
  frontCtx.drawImage(bigClockFaceCanvas, 0, 0);
  frontCtx.globalAlpha = 0.14;
  frontCtx.drawImage(clockFaceCanvas, 0, 0);
  frontCtx.globalAlpha = 1;

  frontCtx.textAlign = 'left-align';
  frontCtx.textBaseline = 'top';
  frontCtx.fillStyle = 'white';
  frontCtx.font = '40px sans-serif';
  nodes.forEach(function (node, i) {
    // we'll draw the actual lines separately so they'll go on top
    var length = node.lineLength.currentValue;
    var angle = node.baseAngle - node.transitionAngle.currentValue;
    var cosFraction = Math.cos(angle * PI / 180);
    var sinFraction = Math.sin(angle * PI / 180);
    var x2 = width / 2 + length * cosFraction;
    var y2 = height / 2 + length * sinFraction;
    frontCtx.beginPath();
    frontCtx.moveTo(width / 2 - cosFraction * handBalances[i], height / 2 - sinFraction * handBalances[i]);
    frontCtx.lineCap = 'round';
    frontCtx.strokeStyle = `rgba(${colors[node.type]},1)`;
    frontCtx.lineWidth = thicknesses[i];
    frontCtx.lineTo(x2, y2);
    frontCtx.stroke();
  });
  frontCtx.fillStyle = 'yellow';
  frontCtx.strokeStyle = 'black';
  frontCtx.lineWidth = 2;
  frontCtx.beginPath();
  frontCtx.arc(width / 2, height / 2, 3, 0, 2 * PI);
  frontCtx.fill();
  frontCtx.stroke();
  if (Date.now() - currentTime > pruneTimeThreshold) {
    currentPruneCount--;
    if (currentPruneCount === 0 && maxDepth > minDepth) {
      maxDepth--;
      console.warn(`Rendering took too long, reducing depth to ${maxDepth}`);
      nodes.forEach(reduceDepth);
      currentPruneCount = consecutivePruneCount;
    }
  } else {
    currentPruneCount = consecutivePruneCount;
  }
};
restoreSettings();
updateAndRender();