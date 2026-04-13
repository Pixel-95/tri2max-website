function triathlonClamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function triathlonEnsurePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(name + ' must be a positive finite number.');
  }
  return value;
}

function triathlonEnsureFinite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function triathlonSecondsPer100mToMps(secondsPer100m) {
  return 100 / triathlonEnsurePositiveFinite(secondsPer100m, 'swimThresholdSecondsPer100m');
}

function triathlonSecondsPerKmToMps(secondsPerKm) {
  return 1000 / triathlonEnsurePositiveFinite(secondsPerKm, 'runThresholdSecondsPerKm');
}

function triathlonFormatDuration(totalSeconds) {
  var rounded = Math.max(0, Math.round(totalSeconds));
  var hours = Math.floor(rounded / 3600);
  var minutes = Math.floor((rounded % 3600) / 60);
  var seconds = rounded % 60;
  return hours > 0
    ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
    : minutes + ':' + String(seconds).padStart(2, '0');
}

function triathlonFormatSwimPace(secondsPer100m) {
  var rounded = Math.round(secondsPer100m);
  return Math.floor(rounded / 60) + ':' + String(rounded % 60).padStart(2, '0') + '/100m';
}

function triathlonFormatRunPace(secondsPerKm) {
  var rounded = Math.round(secondsPerKm);
  return Math.floor(rounded / 60) + ':' + String(rounded % 60).padStart(2, '0') + '/km';
}

function triathlonParseClockToSeconds(clockValue, name) {
  var raw = String(clockValue || '').trim();
  if (!raw) {
    throw new Error(name + ' is required.');
  }

  var match = raw.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) {
    throw new Error(name + ' must use mm:ss.');
  }

  var minutes = Number(match[1]);
  var seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
    throw new Error(name + ' must use mm:ss.');
  }

  return minutes * 60 + seconds;
}

function triathlonFormatClockInput(totalSeconds) {
  var rounded = Math.max(0, Math.round(totalSeconds));
  return Math.floor(rounded / 60) + ':' + String(rounded % 60).padStart(2, '0');
}

function triathlonCalculateCyclingSpeedFromPower(weightPersonKg, powerW, bikePosition, weightBikeKg, muR, elevationGainPerKmM) {
  var rho = 1.2;
  var g = 9.81;
  var mass = weightPersonKg + weightBikeKg;
  var grade = elevationGainPerKmM / 1000;
  var cdaTt = 0.255 * Math.pow(weightPersonKg / 75, 0.762);
  var cdaRoad = 0.345 * Math.pow(weightPersonKg / 75, 0.762);
  var cdaUpright = 0.41 * Math.pow(weightPersonKg / 75, 0.762);
  var cda = bikePosition === 'tt' ? cdaTt : bikePosition === 'road' ? cdaRoad : cdaUpright;

  function solveSpeedForSignedGrade(signedGrade) {
    var low = 0;
    var high = 30;
    var mid = 15;
    for (var i = 0; i < 100 && high - low > 0.001; i++) {
      mid = (low + high) / 2;
      var estimatedPower =
        0.5 * rho * cda * Math.pow(mid, 3) +
        mass * g * muR * mid +
        mass * g * signedGrade * mid;
      if (estimatedPower > powerW) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return mid;
  }

  var speedUphill = solveSpeedForSignedGrade(grade);
  var speedDownhill = solveSpeedForSignedGrade(-grade);
  return 2 / (1 / speedUphill + 1 / speedDownhill);
}

function predictSwimmingTimeSeconds(input) {
  var distanceM = triathlonEnsurePositiveFinite(input.swimDistanceM, 'swimDistanceM');
  var thresholdSpeedMps = input.swimThresholdMps || triathlonSecondsPer100mToMps(input.swimThresholdSecondsPer100m);
  var timePoolEquivalentSeconds = (1000 / thresholdSpeedMps) * Math.pow(distanceM / 1000, 1.02977);
  var factorOpenWater = input.swimIsOpenWater ? 1.03 : 1;
  var factorWetsuit = input.swimUseWetsuit ? 0.98 : 1;
  return timePoolEquivalentSeconds * factorOpenWater * factorWetsuit;
}

function predictCyclingTimeSeconds(input) {
  var distanceM = triathlonEnsurePositiveFinite(input.bikeDistanceM, 'bikeDistanceM');
  var thresholdPowerW = triathlonEnsurePositiveFinite(input.bikeThresholdPowerW, 'bikeThresholdPowerW');
  var weightPersonKg = triathlonEnsureFinite(input.weightPersonKg, 75);
  var weightBikeKg = input.weightBikeKg > 0 ? input.weightBikeKg : 8;
  var bikePosition = input.bikePosition || 'road';
  var elevationGainM = Math.max(0, triathlonEnsureFinite(input.bikeElevationGainM, 0));
  var elevationGainPerKmM = elevationGainM > 0 ? elevationGainM / (distanceM / 1000) : 0;
  var bBike = 7.7;

  var durationSeconds =
    distanceM /
    triathlonCalculateCyclingSpeedFromPower(weightPersonKg, thresholdPowerW, bikePosition, weightBikeKg, 0.0038, elevationGainPerKmM);

  for (var i = 0; i < 12; i++) {
    var boundedDurationSeconds = triathlonClamp(durationSeconds, 20 * 60, 5 * 3600);
    var racePowerW = thresholdPowerW * Math.pow(3600 / boundedDurationSeconds, 1 / bBike);
    var speedMps = triathlonCalculateCyclingSpeedFromPower(weightPersonKg, racePowerW, bikePosition, weightBikeKg, 0.0038, elevationGainPerKmM);
    var nextDurationSeconds = distanceM / speedMps;
    if (Math.abs(nextDurationSeconds - durationSeconds) < 1) {
      return nextDurationSeconds;
    }
    durationSeconds = nextDurationSeconds;
  }

  return durationSeconds;
}

function predictRunningTimeSeconds(input) {
  var distanceM = triathlonEnsurePositiveFinite(input.runDistanceM, 'runDistanceM');
  var thresholdSpeedMps = input.runThresholdMps || triathlonSecondsPerKmToMps(input.runThresholdSecondsPerKm);
  var elevationGainM = Math.max(0, triathlonEnsureFinite(input.runElevationGainM, 0));
  var airTemperatureC = triathlonEnsureFinite(input.airTemperatureC, 17.5);
  var thresholdDistanceM = thresholdSpeedMps * 3600;
  var durationSeconds = 3600 * Math.pow(distanceM / thresholdDistanceM, 1.07732);
  var grade = triathlonClamp(elevationGainM / distanceM, 0, 0.12);
  var costFlat = 3.6;
  var costHilly =
    155.4 * Math.pow(grade, 5) -
    30.4 * Math.pow(grade, 4) -
    43.3 * Math.pow(grade, 3) +
    46.3 * Math.pow(grade, 2) +
    19.5 * grade +
    3.6;
  durationSeconds *= costHilly / costFlat;

  if (airTemperatureC > 17.5) {
    durationSeconds *= 1 + 0.003 * (airTemperatureC - 17.5);
  } else if (airTemperatureC < 10) {
    durationSeconds *= 1 + 0.0015 * (10 - airTemperatureC);
  }

  return durationSeconds;
}

function predictTriathlonRace(input) {
  var normalizedInput = {
    swimDistanceM: triathlonEnsurePositiveFinite(input.swimDistanceM, 'swimDistanceM'),
    swimThresholdSecondsPer100m: input.swimThresholdSecondsPer100m,
    swimThresholdMps: input.swimThresholdMps,
    swimUseWetsuit: !!input.swimUseWetsuit,
    swimIsOpenWater: !!input.swimIsOpenWater,
    bikeDistanceM: triathlonEnsurePositiveFinite(input.bikeDistanceM, 'bikeDistanceM'),
    bikeThresholdPowerW: triathlonEnsurePositiveFinite(input.bikeThresholdPowerW, 'bikeThresholdPowerW'),
    weightPersonKg: triathlonEnsureFinite(input.weightPersonKg, 75),
    weightBikeKg: input.weightBikeKg > 0 ? input.weightBikeKg : 8,
    bikePosition: input.bikePosition || 'road',
    bikeElevationGainM: Math.max(0, triathlonEnsureFinite(input.bikeElevationGainM, 0)),
    runDistanceM: triathlonEnsurePositiveFinite(input.runDistanceM, 'runDistanceM'),
    runThresholdSecondsPerKm: input.runThresholdSecondsPerKm,
    runThresholdMps: input.runThresholdMps,
    runElevationGainM: Math.max(0, triathlonEnsureFinite(input.runElevationGainM, 0)),
    airTemperatureC: triathlonEnsureFinite(input.airTemperatureC, 17.5),
    t1Seconds: Math.max(0, triathlonEnsureFinite(input.t1Seconds, 0)),
    t2Seconds: Math.max(0, triathlonEnsureFinite(input.t2Seconds, 0))
  };

  if (!normalizedInput.swimThresholdMps && !normalizedInput.swimThresholdSecondsPer100m) {
    throw new Error('Either swimThresholdSecondsPer100m or swimThresholdMps is required.');
  }
  if (!normalizedInput.runThresholdMps && !normalizedInput.runThresholdSecondsPerKm) {
    throw new Error('Either runThresholdSecondsPerKm or runThresholdMps is required.');
  }

  var singleSwimTimeSeconds = predictSwimmingTimeSeconds(normalizedInput);
  var singleBikeTimeSeconds = predictCyclingTimeSeconds(normalizedInput);
  var singleRunTimeSeconds = predictRunningTimeSeconds(normalizedInput);

  var swimTimeSeconds = singleSwimTimeSeconds * 1.01;
  var bikeThresholdReduction =
    triathlonClamp(
      0.01 +
        0.02 * Math.pow(singleRunTimeSeconds / 3600, 0.85) +
        0.008 * Math.pow(swimTimeSeconds / 1800, 0.5),
      0.01,
      0.10
    );
  var bikeTimeSeconds = predictCyclingTimeSeconds({
    bikeDistanceM: normalizedInput.bikeDistanceM,
    bikeThresholdPowerW: normalizedInput.bikeThresholdPowerW * (1 - bikeThresholdReduction),
    weightPersonKg: normalizedInput.weightPersonKg,
    weightBikeKg: normalizedInput.weightBikeKg,
    bikePosition: normalizedInput.bikePosition,
    bikeElevationGainM: normalizedInput.bikeElevationGainM
  });
  var runFactor =
    1 +
    0.015 * Math.pow(singleRunTimeSeconds / 3600, 0.9) +
    0.02 * Math.pow((swimTimeSeconds + bikeTimeSeconds) / 3600, 0.75);
  var runTimeSeconds = singleRunTimeSeconds * runFactor;
  var totalTimeSeconds =
    swimTimeSeconds +
    normalizedInput.t1Seconds +
    bikeTimeSeconds +
    normalizedInput.t2Seconds +
    runTimeSeconds;

  return {
    input: normalizedInput,
    single: {
      swimTimeSeconds: singleSwimTimeSeconds,
      bikeTimeSeconds: singleBikeTimeSeconds,
      runTimeSeconds: singleRunTimeSeconds
    },
    triathlon: {
      swimTimeSeconds: swimTimeSeconds,
      t1Seconds: normalizedInput.t1Seconds,
      bikeTimeSeconds: bikeTimeSeconds,
      t2Seconds: normalizedInput.t2Seconds,
      runTimeSeconds: runTimeSeconds,
      totalTimeSeconds: totalTimeSeconds,
      bikeThresholdReduction: bikeThresholdReduction,
      runFactor: runFactor
    },
    presentation: {
      swim: {
        formatted: triathlonFormatDuration(swimTimeSeconds),
        pacePer100m: triathlonFormatSwimPace(swimTimeSeconds / (normalizedInput.swimDistanceM / 100))
      },
      t1: {
        formatted: triathlonFormatDuration(normalizedInput.t1Seconds)
      },
      bike: {
        formatted: triathlonFormatDuration(bikeTimeSeconds),
        speedKmh: (normalizedInput.bikeDistanceM / (bikeTimeSeconds / 3600) / 1000).toFixed(1) + ' km/h'
      },
      t2: {
        formatted: triathlonFormatDuration(normalizedInput.t2Seconds)
      },
      run: {
        formatted: triathlonFormatDuration(runTimeSeconds),
        pacePerKm: triathlonFormatRunPace(runTimeSeconds / (normalizedInput.runDistanceM / 1000))
      },
      total: {
        formatted: triathlonFormatDuration(totalTimeSeconds)
      }
    }
  };
}

globalThis.TriathlonPredictions = {
  predictTriathlonRace: predictTriathlonRace,
  predictSwimmingTimeSeconds: predictSwimmingTimeSeconds,
  predictCyclingTimeSeconds: predictCyclingTimeSeconds,
  predictRunningTimeSeconds: predictRunningTimeSeconds,
  formatDuration: triathlonFormatDuration,
  formatSwimPace: triathlonFormatSwimPace,
  formatRunPace: triathlonFormatRunPace
};

(() => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = document.querySelector('#primary-nav');
  const feedback = document.querySelector('.form-feedback');
  const waitlistForm = document.querySelector('.waitlist-form');
  const heroSteps = document.querySelectorAll('.hero-step, .hero-headline');
  const planButtons = Array.from(document.querySelectorAll('.plan-day'));
  const planDetail = document.querySelector('[data-plan-detail]');
  const predictorForm = document.querySelector('[data-race-predictor-form]');
  const predictorFeedback = document.querySelector('[data-race-predictor-feedback]');
  const predictorValueNodes = {
    swim: Array.from(document.querySelectorAll('[data-predictor-value="swim"]')),
    t1: Array.from(document.querySelectorAll('[data-predictor-value="t1"]')),
    bike: Array.from(document.querySelectorAll('[data-predictor-value="bike"]')),
    t2: Array.from(document.querySelectorAll('[data-predictor-value="t2"]')),
    run: Array.from(document.querySelectorAll('[data-predictor-value="run"]')),
    total: Array.from(document.querySelectorAll('[data-predictor-value="total"]'))
  };
  const predictorMetricNodes = {
    swimPace: Array.from(document.querySelectorAll('[data-predictor-metric="swimPace"]')),
    bikeSpeed: Array.from(document.querySelectorAll('[data-predictor-metric="bikeSpeed"]')),
    runPace: Array.from(document.querySelectorAll('[data-predictor-metric="runPace"]'))
  };
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let predictorLiveTimer = 0;

  const setHeaderState = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  const closeMenu = () => {
    if (!primaryNav || !navToggle) return;
    primaryNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.classList.remove('is-open');
  };

  const setPredictorFeedback = (message, tone = 'neutral') => {
    if (!predictorFeedback) return;
    predictorFeedback.textContent = message;
    predictorFeedback.classList.remove('is-error', 'is-success');
    if (tone === 'error') predictorFeedback.classList.add('is-error');
    if (tone === 'success') predictorFeedback.classList.add('is-success');
  };

  const setPredictorFieldValidity = (field, isValid) => {
    if (!(field instanceof HTMLInputElement)) return;
    if (isValid) {
      field.removeAttribute('aria-invalid');
    } else {
      field.setAttribute('aria-invalid', 'true');
    }
  };

  const validatePredictorNumberField = (form, config) => {
    const field = form.elements.namedItem(config.name);
    if (!(field instanceof HTMLInputElement)) {
      return {
        valid: false,
        field: null,
        message: `${config.label} field is not available.`
      };
    }

    const raw = String(field.value || '').trim().replace(',', '.');
    const value = Number(raw);
    let valid = raw !== '' && Number.isFinite(value);

    if (valid && typeof config.minimum === 'number') {
      valid = config.inclusiveMinimum ? value >= config.minimum : value > config.minimum;
    }

    setPredictorFieldValidity(field, valid);

    if (valid) {
      return {
        valid: true,
        field,
        value
      };
    }

    let message = `${config.label} is required.`;
    if (raw !== '' && !Number.isFinite(value)) {
      message = `${config.label} must be a valid number.`;
    } else if (raw !== '' && typeof config.minimum === 'number') {
      message = config.inclusiveMinimum
        ? `${config.label} must be at least ${config.minimum}.`
        : `${config.label} must be greater than ${config.minimum}.`;
    }

    return {
      valid: false,
      field,
      message
    };
  };

  const validatePredictorClockField = (form, config) => {
    const field = form.elements.namedItem(config.name);
    if (!(field instanceof HTMLInputElement)) {
      return {
        valid: false,
        field: null,
        message: `${config.label} field is not available.`
      };
    }

    const raw = String(field.value || '').trim();
    let value = NaN;
    let valid = false;

    try {
      value = triathlonParseClockToSeconds(raw, config.label);
      valid = Number.isFinite(value);
    } catch (error) {
      valid = false;
    }

    setPredictorFieldValidity(field, valid);

    if (valid) {
      return {
        valid: true,
        field,
        value
      };
    }

    return {
      valid: false,
      field,
      message: raw ? `${config.label} must use mm:ss.` : `${config.label} is required.`
    };
  };

  const collectPredictorInput = (form) => {
    const numberFields = [
      { name: 'swimDistanceM', label: 'Swim distance', minimum: 0 },
      { name: 'bikeDistanceKm', label: 'Bike distance', minimum: 0 },
      { name: 'bikeThresholdPowerW', label: 'Bike threshold power', minimum: 0 },
      { name: 'weightPersonKg', label: 'Body weight', minimum: 0 },
      { name: 'weightBikeKg', label: 'Bike weight', minimum: 0 },
      { name: 'bikeElevationGainM', label: 'Bike elevation gain', minimum: 0, inclusiveMinimum: true },
      { name: 'runDistanceKm', label: 'Run distance', minimum: 0 },
      { name: 'runElevationGainM', label: 'Run elevation gain', minimum: 0, inclusiveMinimum: true },
      { name: 'airTemperatureC', label: 'Air temperature' }
    ];
    const clockFields = [
      { name: 'swimThresholdPace', label: 'Swim threshold pace' },
      { name: 'runThresholdPace', label: 'Run threshold pace' },
      { name: 't1Time', label: 'T1 time' },
      { name: 't2Time', label: 'T2 time' }
    ];
    const values = {};
    const clockValues = {};
    let firstInvalidField = null;
    let firstErrorMessage = '';

    numberFields.forEach((config) => {
      const result = validatePredictorNumberField(form, config);
      if (result.valid) {
        values[config.name] = result.value;
        return;
      }

      if (!firstInvalidField && result.field) firstInvalidField = result.field;
      if (!firstErrorMessage) firstErrorMessage = result.message;
    });

    clockFields.forEach((config) => {
      const result = validatePredictorClockField(form, config);
      if (result.valid) {
        clockValues[config.name] = result.value;
        return;
      }

      if (!firstInvalidField && result.field) firstInvalidField = result.field;
      if (!firstErrorMessage) firstErrorMessage = result.message;
    });

    const openWaterField = form.elements.namedItem('swimIsOpenWater');
    const wetsuitField = form.elements.namedItem('swimUseWetsuit');
    const bikePositionField = form.querySelector('input[name="bikePosition"]:checked');
    const bikePosition = bikePositionField instanceof HTMLInputElement ? bikePositionField.value : '';

    if (!['tt', 'road', 'upright'].includes(bikePosition) && !firstErrorMessage) {
      firstErrorMessage = 'Bike position must be selected.';
    }

    return {
      valid: !firstErrorMessage,
      firstInvalidField,
      errorMessage: firstErrorMessage,
      input: {
        swimDistanceM: values.swimDistanceM,
        swimThresholdSecondsPer100m: clockValues.swimThresholdPace,
        swimIsOpenWater: openWaterField instanceof HTMLInputElement ? openWaterField.checked : false,
        swimUseWetsuit: wetsuitField instanceof HTMLInputElement ? wetsuitField.checked : false,
        bikeDistanceM: values.bikeDistanceKm * 1000,
        bikeThresholdPowerW: values.bikeThresholdPowerW,
        weightPersonKg: values.weightPersonKg,
        weightBikeKg: values.weightBikeKg,
        bikePosition,
        bikeElevationGainM: values.bikeElevationGainM,
        runDistanceM: values.runDistanceKm * 1000,
        runThresholdSecondsPerKm: clockValues.runThresholdPace,
        runElevationGainM: values.runElevationGainM,
        airTemperatureC: values.airTemperatureC,
        t1Seconds: clockValues.t1Time,
        t2Seconds: clockValues.t2Time
      }
    };
  };

  const normalizePredictorClockField = (field) => {
    if (!(field instanceof HTMLInputElement)) return;
    try {
      field.value = triathlonFormatClockInput(
        triathlonParseClockToSeconds(field.value, field.name || 'Time')
      );
      setPredictorFieldValidity(field, true);
    } catch (error) {
      setPredictorFieldValidity(field, false);
    }
  };

  const setPredictorText = (nodes, value) => {
    nodes.forEach((node) => {
      node.textContent = value;
    });
  };

  const renderPredictorResult = (result) => {
    setPredictorText(predictorValueNodes.swim, result.presentation.swim.formatted);
    setPredictorText(predictorValueNodes.t1, result.presentation.t1.formatted);
    setPredictorText(predictorValueNodes.bike, result.presentation.bike.formatted);
    setPredictorText(predictorValueNodes.t2, result.presentation.t2.formatted);
    setPredictorText(predictorValueNodes.run, result.presentation.run.formatted);
    setPredictorText(predictorValueNodes.total, result.presentation.total.formatted);
    setPredictorText(predictorMetricNodes.swimPace, result.presentation.swim.pacePer100m);
    setPredictorText(predictorMetricNodes.bikeSpeed, result.presentation.bike.speedKmh);
    setPredictorText(predictorMetricNodes.runPace, result.presentation.run.pacePerKm);
  };

  const updatePredictor = ({ mode = 'live' } = {}) => {
    if (!(predictorForm instanceof HTMLFormElement)) return false;

    const collected = collectPredictorInput(predictorForm);
    if (!collected.valid) {
      if (mode === 'submit') {
        setPredictorFeedback(collected.errorMessage || 'Please review the highlighted fields.', 'error');
        if (collected.firstInvalidField) collected.firstInvalidField.focus();
      } else if (mode === 'live') {
        setPredictorFeedback('Update paused until all fields are valid.', 'error');
      }
      return false;
    }

    try {
      const result = globalThis.TriathlonPredictions.predictTriathlonRace(collected.input);
      renderPredictorResult(result);
      setPredictorFeedback('', 'neutral');

      return true;
    } catch (error) {
      setPredictorFeedback(
        error instanceof Error ? error.message : 'Prediction could not be calculated.',
        'error'
      );
      return false;
    }
  };

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open', !expanded);
      navToggle.classList.toggle('is-open', !expanded);
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.nav-shell')) return;
      closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    primaryNav.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => closeMenu());
    });
  }

  const sectionLinks = document.querySelectorAll('a[href^="#"]');
  sectionLinks.forEach((link) => {
    if (link.classList.contains('skip-link')) return;

    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      const headerOffset = header ? header.offsetHeight + 12 : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: 'smooth' });

      history.replaceState(null, '', href);
    });
  });

  const revealItems = document.querySelectorAll('.reveal');
  revealItems.forEach((item) => {
    const delay = Number(item.getAttribute('data-delay') || '0');
    item.style.setProperty('--delay', `${delay}ms`);
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  if (waitlistForm && feedback) {
    const submitButton = waitlistForm.querySelector('button[type="submit"]');
    const waitlistEndpoint =
      waitlistForm.getAttribute('data-endpoint') || 'https://api.web3forms.com/submit';
    const accessKeyAttr = String(waitlistForm.getAttribute('data-access-key') || '').trim();
    const accessKeyInput = waitlistForm.querySelector('input[name="access_key"]');

    const getAccessKey = () => {
      const inputValue =
        accessKeyInput instanceof HTMLInputElement ? String(accessKeyInput.value || '').trim() : '';
      return inputValue || accessKeyAttr;
    };

    const isAccessKeyConfigured = (key) =>
      Boolean(key) &&
      key !== 'REPLACE_WITH_WEB3FORMS_ACCESS_KEY' &&
      !key.toLowerCase().includes('replace_with');

    const getConnectionData = () => {
      const connection =
        navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
      if (!connection) return 'n/a';
      const parts = [
        connection.effectiveType || 'unknown',
        `downlink:${connection.downlink ?? 'n/a'}`,
        `rtt:${connection.rtt ?? 'n/a'}`,
        `saveData:${connection.saveData ? 'on' : 'off'}`
      ];
      return parts.join(', ');
    };

    const getDeviceData = () => ({
      userAgent: navigator.userAgent || 'n/a',
      platform: navigator.platform || 'n/a',
      language: navigator.language || 'n/a',
      languages: Array.isArray(navigator.languages) ? navigator.languages.join(', ') : 'n/a',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'n/a',
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      colorDepth: String(window.screen.colorDepth ?? 'n/a'),
      pixelRatio: String(window.devicePixelRatio ?? 'n/a'),
      touchPoints: String(navigator.maxTouchPoints ?? 0),
      cookiesEnabled: String(Boolean(navigator.cookieEnabled)),
      doNotTrack: navigator.doNotTrack || 'n/a',
      hardwareConcurrency: String(navigator.hardwareConcurrency ?? 'n/a'),
      deviceMemory: String(navigator.deviceMemory ?? 'n/a'),
      connection: getConnectionData(),
      referrer: document.referrer || 'direct',
      page: window.location.href
    });

    const getIpData = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json', { method: 'GET' });
        if (!response.ok) return 'n/a';
        const data = await response.json();
        return data.ip || 'n/a';
      } catch (error) {
        return 'n/a';
      }
    };

    const getBatteryData = async () => {
      if (!('getBattery' in navigator)) return 'unsupported';
      try {
        const battery = await navigator.getBattery();
        const pct = `${Math.round((battery.level || 0) * 100)}%`;
        const charging = battery.charging ? 'charging' : 'not-charging';
        return `${pct}, ${charging}`;
      } catch (error) {
        return 'unavailable';
      }
    };

    const getLocationData = async () => {
      if (!('geolocation' in navigator)) {
        return { status: 'unsupported' };
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const latitude = Number(position.coords.latitude).toFixed(6);
            const longitude = Number(position.coords.longitude).toFixed(6);
            let city = 'n/a';
            let country = 'n/a';
            let region = 'n/a';

            try {
              const reverse = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
                { method: 'GET' }
              );

              if (reverse.ok) {
                const geo = await reverse.json();
                city = geo.city || geo.locality || geo.principalSubdivision || 'n/a';
                country = geo.countryName || 'n/a';
                region = geo.principalSubdivision || 'n/a';
              }
            } catch (error) {
              city = 'lookup-failed';
              country = 'lookup-failed';
              region = 'lookup-failed';
            }

            resolve({
              status: 'granted',
              latitude,
              longitude,
              accuracy: `${Math.round(position.coords.accuracy || 0)}m`,
              city,
              region,
              country
            });
          },
          (error) => {
            const map = {
              1: 'denied',
              2: 'unavailable',
              3: 'timeout'
            };
            resolve({ status: map[error.code] || 'failed' });
          },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000
          }
        );
      });
    };

    waitlistForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(waitlistForm);
      const email = String(formData.get('email') || '').trim();
      const accessKey = getAccessKey();

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        feedback.textContent = 'Please enter a valid email address.';
        feedback.style.color = 'var(--accent)';
        return;
      }
      if (!isAccessKeyConfigured(accessKey)) {
        feedback.textContent = 'Waitlist service is not configured yet.';
        feedback.style.color = 'var(--accent)';
        return;
      }

      feedback.textContent = 'Sending request...';
      feedback.style.color = 'var(--text-muted)';
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;

      try {
        const [locationData, deviceData, ipAddress, batteryData] = await Promise.all([
          getLocationData(),
          Promise.resolve(getDeviceData()),
          getIpData(),
          getBatteryData()
        ]);
        const timestamp = new Date().toISOString();

        formData.set('access_key', accessKey);
        formData.set('email', email);
        formData.set('subject', 'tri2max waitlist signup');
        formData.set('from_name', 'tri2max.app waitlist');
        formData.append('submitted_at', timestamp);
        formData.append('location_status', locationData.status || 'unknown');
        formData.append('latitude', locationData.latitude || 'n/a');
        formData.append('longitude', locationData.longitude || 'n/a');
        formData.append('gps_accuracy', locationData.accuracy || 'n/a');
        formData.append('city', locationData.city || 'n/a');
        formData.append('region', locationData.region || 'n/a');
        formData.append('country', locationData.country || 'n/a');
        formData.append('device_user_agent', deviceData.userAgent);
        formData.append('device_platform', deviceData.platform);
        formData.append('device_language', deviceData.language);
        formData.append('device_languages', deviceData.languages);
        formData.append('device_timezone', deviceData.timezone);
        formData.append('device_viewport', deviceData.viewport);
        formData.append('device_screen', deviceData.screen);
        formData.append('device_color_depth', deviceData.colorDepth);
        formData.append('device_pixel_ratio', deviceData.pixelRatio);
        formData.append('device_touch_points', deviceData.touchPoints);
        formData.append('device_cookies_enabled', deviceData.cookiesEnabled);
        formData.append('device_do_not_track', deviceData.doNotTrack);
        formData.append('device_hardware_concurrency', deviceData.hardwareConcurrency);
        formData.append('device_memory', deviceData.deviceMemory);
        formData.append('device_connection', deviceData.connection);
        formData.append('device_battery', batteryData);
        formData.append('ip_address', ipAddress);
        formData.append('page', deviceData.page);
        formData.append('referrer', deviceData.referrer);

        const response = await fetch(waitlistEndpoint, {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json'
          }
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || (payload && payload.success === false)) {
          const reason =
            (payload && (payload.message || payload.error)) || `Waitlist request failed (${response.status})`;
          throw new Error(reason);
        }

        feedback.textContent = 'Thanks. Your waitlist request was sent.';
        feedback.style.color = 'var(--text-soft)';
        waitlistForm.reset();
      } catch (error) {
        feedback.textContent =
          error instanceof Error && error.message
            ? `Request failed: ${error.message}`
            : 'Request failed. Please try again in a moment.';
        feedback.style.color = 'var(--accent)';
      } finally {
        if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
      }
    });
  }

  if (heroSteps.length > 0) {
    heroSteps.forEach((step) => {
      const delay = Number(step.getAttribute('data-hero-delay') || '0');
      step.style.setProperty('--hero-delay', `${delay}ms`);
    });

    const armHero = () => document.body.classList.add('is-hero-ready');
    if (reducedMotionQuery.matches) {
      armHero();
    } else {
      window.setTimeout(armHero, 60);
    }
  }

  if (planButtons.length > 0 && planDetail) {
    const detailDay = planDetail.querySelector('.plan-detail-day');
    const detailTitle = planDetail.querySelector('.plan-detail-title');
    const detailMeta = planDetail.querySelector('.plan-detail-meta');
    const detailCopy = planDetail.querySelector('.plan-detail-copy');
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const setActiveDay = (button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.classList.contains('is-selected')) return;

      planButtons.forEach((entry) => {
        entry.classList.remove('is-selected');
        entry.setAttribute('aria-selected', 'false');
      });

      button.classList.add('is-selected');
      button.setAttribute('aria-selected', 'true');
      planDetail.classList.add('is-updating');

      window.setTimeout(() => {
        if (detailDay) detailDay.textContent = button.dataset.label || '';
        if (detailTitle) detailTitle.textContent = button.dataset.title || '';
        if (detailMeta) detailMeta.textContent = button.dataset.meta || '';
        if (detailCopy) detailCopy.textContent = button.dataset.copy || '';
        planDetail.classList.remove('is-updating');
      }, 130);
    };

    planButtons.forEach((button) => {
      button.addEventListener('click', () => setActiveDay(button));

      if (hasFinePointer) {
        button.addEventListener('mouseenter', () => setActiveDay(button));
      }

      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setActiveDay(button);
      });
    });
  }

  if (predictorForm instanceof HTMLFormElement) {
    predictorForm.querySelectorAll('input[name="swimThresholdPace"], input[name="runThresholdPace"], input[name="t1Time"], input[name="t2Time"]').forEach((field) => {
      field.addEventListener('blur', () => {
        normalizePredictorClockField(field);
        window.clearTimeout(predictorLiveTimer);
        updatePredictor({ mode: 'live' });
      });
    });

    predictorForm.addEventListener('submit', (event) => {
      event.preventDefault();
      updatePredictor({ mode: 'submit' });
    });

    predictorForm.addEventListener('input', (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      window.clearTimeout(predictorLiveTimer);
      predictorLiveTimer = window.setTimeout(() => {
        updatePredictor({ mode: 'live' });
      }, 120);
    });

    predictorForm.addEventListener('change', () => {
      window.clearTimeout(predictorLiveTimer);
      updatePredictor({ mode: 'live' });
    });

    updatePredictor({ mode: 'init' });
  }

  const year = document.querySelector('#year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });
})();
