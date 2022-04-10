var width = 1000;
var height = 1000;
var centerX = width / 2;
var centerY = height / 2;
var outerRadius = Math.min(centerX, centerY);
var innerRadius = outerRadius / 2;
const PI = Math.PI;
const localStorageName = 'fractal-clock-settings';
var positionRelatively = document.getElementById('position-relatively');
var runningInput = document.getElementById('running');
var equilateralInput = document.getElementById('equilateral');
const consecutivePruneCount = 4;
var currentPruneCount = consecutivePruneCount;
var pruneTimeThreshold = 40;

var frontCanvas = document.getElementById('canvas');
frontCanvas.width = width;
frontCanvas.height = height;
var frontCtx = frontCanvas.getContext('2d');
var backgroundCanvas = document.createElement('canvas');
var backgroundCtx = backgroundCanvas.getContext('2d');
backgroundCanvas.width = width;
backgroundCanvas.height = height;
var bigClockFaceCanvas = document.createElement('canvas');
bigClockFaceCanvas.width = width;
bigClockFaceCanvas.height = height;
var clockFaceCanvas = document.createElement('canvas');
clockFaceCanvas.width = width;
clockFaceCanvas.height = height;
var bigClockFaceCtx = bigClockFaceCanvas.getContext('2d');
var clockFaceCtx = clockFaceCanvas.getContext('2d');

var hoursInput = { element: document.getElementById('hours-input'), maxTensValue: 1, offset: 12, base: 12 };
var minutesInput = { element: document.getElementById('minutes-input'), maxTensValue: 5, base: 60 };
var secondsInput = { element: document.getElementById('seconds-input'), maxTensValue: 5, base: 60 };

var previousInput = null;
var keyNums = '0123456789';
var clockElements = [
  hoursInput,
  minutesInput,
  secondsInput
];

clockElements.forEach(function (item, i) {
  var { element, maxTensValue, offset, base } = item;
  function updateElement() {
    if (offset) {
      item.value = (item.value + offset - 1) % base + 1;
    } else {
      item.value = (item.value + base) % base;
    }
    element.value = item.value.toString().padStart(2, '0');
  }
  item.updateElement = updateElement;
  element.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') {
      e.preventDefault();
    }
    var key = keyNums.indexOf(e.key);
    var next = false;
    if (key !== -1) {
      if (previousInput !== null) {
        item.value = previousInput * 10 + key;
        next = true;
      } else {
        item.value = key;
        if (item.value <= maxTensValue) {
          previousInput = item.value;
        } else {
          next = true;
        }
      }
      updateElement();
      if (next) {
        clockElements[ (i + 1) % 3].element.focus();
      }
      clockTimeInputUpdated()
    } else if (e.key === 'ArrowUp') {
      previousInput = null;
      item.value = (item.value || 0) + 1;
      updateElement();
      clockTimeInputUpdated()
    } else if (e.key === 'ArrowDown') {
      previousInput = null;
      item.value = (item.value || 0) - 1;
      updateElement();
      clockTimeInputUpdated()
    } else if (e.key === 'ArrowRight') {
      clockElements[ (i + 1) % 3].element.focus();
      previousInput = null;
    } else if (e.key === 'ArrowLeft') {
      clockElements[ (i + 2) % 3].element.focus();
      previousInput = null;
    }
  });
  element.addEventListener('focusin', function () {
    previousInput = null;
  });
  updateElement();
})
document.body.addEventListener('mousedown', function () {
  previousInput = null;
});


function drawClockFace({
  ctx,
  circleRadius,
  innerRadius,
  outerRadius,
  tickWidth,
  circleWidth
}) {
  ctx.lineWidth = circleWidth;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, circleRadius, 0, 2 * PI);
  ctx.stroke();
  ctx.lineWidth = tickWidth;
  ctx.beginPath();
  ctx.lineCap = 'butt';

  for (let angle = 0; angle < 360; angle += 30) {
    var cosFraction = Math.cos(angle * PI / 180);
    var sinFraction = Math.sin(angle * PI / 180);
    ctx.moveTo(width / 2 + cosFraction * innerRadius, height / 2 + sinFraction * innerRadius);
    ctx.lineTo(width / 2 + cosFraction * outerRadius, height / 2 + sinFraction * outerRadius);
  }
  ctx.stroke();
}

function clockTimeInputUpdated() {
  var hours = hoursInput.value;
  var minutes = minutesInput.value;
  var seconds = secondsInput.value;
  if (pauseDate) {
    pauseDate.setMinutes(minutes);
    pauseDate.setHours(hours);
    pauseDate.setSeconds(seconds);    
  } else {
    timeOffset = calculateOffset(hours, minutes, seconds);
  }
  updateClock();
  transitionAngles();
}

function setClockInputTime(hours, minutes, seconds) {
  // can also check whether document.activeElement !== input.element
  hoursInput.value = hours;
  hoursInput.updateElement();
  minutesInput.value = minutes;
  minutesInput.updateElement();
  secondsInput.value = seconds;
  secondsInput.updateElement();
}

function getRelativeAngle(a, b) {
  var difference = (b - a) % 360;
  if (difference > 180) {
    return difference - 360;
  } else if (difference < -180) {
    return difference + 360;
  }
  return difference;
}

var randomBetween = function (a, b) {
  return Math.random() * (b-a) + a;
};

var randomIntBetween = function (a, b) {
  return Math.floor(randomBetween(a, b));
};

function updateTransition(transition, easing) {
  transition.progress += frameDelta / transition.duration;
  if (transition.progress >= 1) {
    transition.progress = 1;
    transition.currentValue = transition.endValue;
  }
  transition.currentValue = transition.startValue + easing(transition.progress) * (transition.endValue - transition.startValue);
}

function transitionAngles() {
  nodes.forEach(function (node, i) {
    markRelativeAngle(node, -90 + angles[i]);
  });  
}
positionRelatively.addEventListener('change', function () {
  saveSettings();
  relativePosition = positionRelatively.checked;
  transitionAngles();
});

function updateEquilateral() {
  if (equilateralInput.checked) {
    currentLengths = equilateralLengths;
  } else {
    currentLengths = unevenLengths;
  }
  nodes.forEach(function(node, i) {
    markLineLength(node, currentLengths[i] / 2);
  })
}

equilateralInput.addEventListener('change', function () {
  saveSettings();
  updateEquilateral();
});

function updateRunning() {
  if (runningInput.checked) {
    if (pauseDate) {
      timeOffset = calculateOffset(pauseDate.getHours(), pauseDate.getMinutes(), pauseDate.getSeconds());
    } else {
      timeOffset = 0;
    }
    pauseDate = null;
  } else {
    pauseDate = new Date(Math.floor(getDate().valueOf() / 1000) * 1000 + 500);
  }
  updateClock();
  transitionAngles();  
}
runningInput.addEventListener('change', function () {
  saveSettings();
  updateRunning();
});

var settings = {
  equilateral: false,
  running: true,
  relative: false,
  pauseDate: new Date().getTime()
};

function restoreSettings() {
  var json = localStorage.getItem(localStorageName), storedSettings;
  if (json) {
    try {
      storedSettings = JSON.parse(json);
      Object.assign(settings, storedSettings);
    } catch (e) {
      console.log(e);
    }
  }
  equilateralInput.checked = !!settings.equilateral;
  runningInput.checked = !!settings.running;
  if (!settings.running) {
    pauseDate = new Date(settings.pauseDate || Date.getTime());
  }
  positionRelatively.checked = relativePosition = !!settings.relative;
  updateEquilateral();
  updateRunning();
}
function saveSettings() {
  settings.equilateral = equilateralInput.checked;
  settings.running = runningInput.checked;
  settings.relative = positionRelatively.checked;
  settings.pauseDate = getDate().getTime();
  localStorage.setItem(localStorageName, JSON.stringify(settings));
}