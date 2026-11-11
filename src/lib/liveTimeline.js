function formatRemaining(seconds) {
  if (seconds === null) return '--:--';
  const whole = Math.floor(Math.max(0, seconds));
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  return `${whole > 0 ? '-' : ''}${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

function seekableWindow(video) {
  const ranges = video.seekable;
  if (!ranges.length) return null;
  const start = ranges.start(0);
  const end = ranges.end(ranges.length - 1);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { ranges, start, end } : null;
}

function remainingTime(video, window, position) {
  if (!Number.isFinite(position)) return null;
  // On desktop Plyr counts down to the end of the playlist. Live HLS can
  // report an infinite duration on Android, so use its seekable edge instead.
  if (window) return window.end - position;
  const duration = video.duration;
  if (Number.isFinite(duration) && duration > 0) return duration - position;
  const buffered = video.buffered;
  for (let index = 0; index < buffered.length; index++) {
    const end = buffered.end(index);
    if (position >= buffered.start(index) && position <= end) return end - position;
  }
  return null;
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
  time.setAttribute('aria-label', 'Tiempo restante del tramo disponible');
  track.append(slider);
  progress.append(track);
  const mute = controls.querySelector(':scope > .plyr__volume, :scope > [data-plyr="mute"]');
  controls.insertBefore(progress, mute);
  controls.insertBefore(time, mute);

  let editing = false;
  const show = (percentage, remaining) => {
    slider.style.setProperty('--value', `${percentage}%`);
    time.textContent = formatRemaining(remaining);
    slider.setAttribute('aria-valuetext', time.textContent);
  };
  const sync = () => {
    const window = seekableWindow(video);
    const position = video.currentTime;
    slider.disabled = !window;
    if (editing && window) return;
    if (!window) editing = false;
    const percentage = window && Number.isFinite(position)
      ? Math.max(0, Math.min(100, 100 * (position - window.start) / (window.end - window.start))) : 0;
    slider.value = percentage;
    show(percentage, remainingTime(video, window, position));
  };
  slider.addEventListener('input', () => {
    const window = seekableWindow(video);
    if (!window) return;
    editing = true;
    show(slider.valueAsNumber, (window.end - window.start) * (100 - slider.valueAsNumber) / 100);
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
  for (const event of ['timeupdate', 'progress', 'loadedmetadata', 'durationchange', 'playing', 'seeking', 'seeked']) {
    video.addEventListener(event, sync, { signal });
  }
  video.addEventListener('emptied', () => {
    editing = false;
    slider.disabled = true;
    slider.value = 0;
    show(0, null);
  }, { signal });
  sync();
}
