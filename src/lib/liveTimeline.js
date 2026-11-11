function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

function seekableWindow(video) {
  const ranges = video.seekable;
  if (!ranges.length) return null;
  const start = ranges.start(0);
  const end = ranges.end(ranges.length - 1);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { ranges, start, end } : null;
}

export function addLiveTimeline(controls, video, signal) {
  const progress = document.createElement('div');
  progress.className = 'plyr__controls__item plyr__progress__container';
  const track = document.createElement('div');
  track.className = 'plyr__progress';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '0.1';
  slider.className = 'stream-live-seek';
  slider.setAttribute('aria-label', 'Posición en el directo');
  const time = document.createElement('div');
  time.className = 'plyr__controls__item plyr__time plyr__time--current';
  time.setAttribute('role', 'timer');
  track.append(slider);
  progress.append(track);
  const mute = controls.querySelector(':scope > .plyr__volume, :scope > [data-plyr="mute"]');
  controls.insertBefore(progress, mute);
  controls.insertBefore(time, mute);

  let editing = false;
  const show = (percentage, elapsed) => {
    slider.style.setProperty('--value', `${percentage}%`);
    time.textContent = formatTime(elapsed);
    slider.setAttribute('aria-valuetext', time.textContent);
  };
  const sync = () => {
    const window = seekableWindow(video);
    slider.disabled = !window;
    if (editing && window) return;
    const elapsed = window ? Math.max(0, Math.min(window.end - window.start, video.currentTime - window.start)) : 0;
    const percentage = window ? 100 * elapsed / (window.end - window.start) : 0;
    slider.value = percentage;
    show(percentage, elapsed);
  };
  slider.addEventListener('input', () => {
    const window = seekableWindow(video);
    if (!window) return;
    editing = true;
    show(slider.valueAsNumber, (window.end - window.start) * slider.valueAsNumber / 100);
  }, { signal });
  slider.addEventListener('change', () => {
    const window = seekableWindow(video);
    editing = false;
    if (window) {
      const target = window.start + (window.end - window.start) * slider.valueAsNumber / 100;
      let closest = window.start;
      for (let index = 0; index < window.ranges.length; index++) {
        const start = window.ranges.start(index);
        const end = Math.max(start, window.ranges.end(index) - 0.1);
        const candidate = Math.max(start, Math.min(target, end));
        if (Math.abs(target - candidate) < Math.abs(target - closest)) closest = candidate;
      }
      video.currentTime = closest;
    }
    sync();
  }, { signal });
  for (const event of ['blur', 'pointercancel']) {
    slider.addEventListener(event, () => { editing = false; sync(); }, { signal });
  }
  for (const event of ['timeupdate', 'progress', 'loadedmetadata', 'durationchange', 'seeking', 'seeked', 'emptied']) {
    video.addEventListener(event, sync, { signal });
  }
  sync();
}
