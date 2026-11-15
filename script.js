(() => {
  const scenes = [...document.querySelectorAll('[data-scene]')];
  const story = document.getElementById('story');
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
  const prevButton = document.getElementById('prevScene');
  const nextButton = document.getElementById('nextScene');
  // Must be declared before setActive(): stage initialisation calls setActive()
  // before the numbered navigation markup is populated later in this file.
  const chapterNumberList = document.getElementById('chapterNumberList');
  let activeIndex = 0;
  let scrollRatio = 0;

  // ---------------------------------------------------------------------------
  // Page transitions ("stage" mode)
  // Every chapter is stacked on one fixed stage. Moving between chapters plays one
  // directed transition on desktop and mobile alike: the outgoing text lifts away,
  // the next photograph opens with a soft wipe and a slow settle, and the new text
  // follows a beat later. If the browser cannot animate this (or the visitor prefers
  // reduced motion) the page falls back to ordinary scrolling, exactly as before.
  // ---------------------------------------------------------------------------
  const canAnimate = 'animate' in Element.prototype && !!(window.CSS && CSS.supports && CSS.supports('clip-path', 'inset(0% 0% 0% 0% round 0px)'));
  const stage = !reducedMotion && canAnimate && !!story && scenes.length > 1;

  // Tuning: durations are in milliseconds.
  const T = {
    wipe: isMobile ? 1050 : 950,        // photograph reveal
    wipeDelay: 140,                    // outgoing text leaves first
    copyAt: isMobile ? 560 : 520,       // when the new text begins, measured from the start
    stagger: 85,                       // gap between lines of text
    child: 700,                        // each line's fade and rise
    cooldown: 100,                     // brief settle before the next queued change
    drift: isMobile ? 9000 : 9500      // slow cinematic push-in on each photograph
  };
  const EASE_WIPE = 'cubic-bezier(.22,1,.36,1)';
  const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
  const EASE_ZOOM = 'cubic-bezier(.25,.46,.45,.94)'; // steady, gentle zoom-in on mobile

  // Guided auto-advance: give each chapter time to be viewed, but hand over
  // control permanently as soon as the visitor interacts with the page.
  const scrollCue = document.getElementById('scrollCue');
  const AUTO_ADVANCE_DELAY = 9000;
  let autoAdvancePaused = reducedMotion;
  let autoAdvanceTimer = null;

  const hideScrollCue = () => scrollCue?.classList.add('is-hidden');
  const pauseAutoAdvance = () => {
    if (autoAdvancePaused) return;
    autoAdvancePaused = true;
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
    hideScrollCue();
  };

  const scheduleAutoAdvance = () => {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
    if (autoAdvancePaused || activeIndex >= scenes.length - 1) {
      hideScrollCue();
      return;
    }
    scrollCue?.classList.remove('is-hidden');
    autoAdvanceTimer = window.setTimeout(() => {
      if (!autoAdvancePaused) goToScene(activeIndex + 1);
    }, AUTO_ADVANCE_DELAY);
  };

  // Any deliberate input means the visitor wants manual control. We do not
  // restart automatic movement later in the same visit.
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => {
    document.addEventListener(type, pauseAutoAdvance, { passive: type !== 'keydown', capture: true });
  });

  let busy = false;
  let lockUntil = 0;
  let pendingSteps = 0;
  let transitionTo = () => {};
  const clamp = index => Math.max(0, Math.min(scenes.length - 1, index));
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const nextFrames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const goToScene = (index) => {
    const target = clamp(index);
    if (!stage) {
      scenes[target].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (target === activeIndex && !busy) return;
    if (busy) {
      // Keep deliberate input received mid-transition. Previously it was discarded,
      // making visitors press the button or swipe a second time.
      if (target > activeIndex) pendingSteps = Math.min(pendingSteps + 1, scenes.length);
      else if (target < activeIndex) pendingSteps = Math.max(pendingSteps - 1, -scenes.length);
      return;
    }
    if (target === activeIndex) return;
    transitionTo(target, target > activeIndex ? 1 : -1);
  };

  function setActive(index, schedule = true) {
    const nextIndex = clamp(index);
    const changed = nextIndex !== activeIndex;
    activeIndex = nextIndex;
    if (chapterNumberList) {
      chapterNumberList.querySelectorAll('.chapter-number').forEach((button, index) => {
        const active = index === activeIndex;
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    }
    scenes.forEach((scene, i) => {
      scene.classList.toggle('is-current', i === activeIndex);
      if (isMobile && !stage) scene.classList.toggle('show-copy', i === activeIndex);
    });
    if (prevButton) prevButton.disabled = activeIndex === 0;
    if (nextButton) nextButton.disabled = activeIndex === scenes.length - 1;
    const progress = document.querySelector('.story-progress__fill');
    if (progress) progress.style.height = `${((activeIndex + 1) / scenes.length) * 100}%`;
    const count = document.querySelector('.story-progress__count');
    if (count) count.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
    if (stage) scrollRatio = activeIndex / Math.max(1, scenes.length - 1);
    if (schedule && (changed || autoAdvanceTimer === null)) scheduleAutoAdvance();
  }

  if (stage) {
    // ----- helpers -----------------------------------------------------------
    const partsOf = scene => {
      if (scene._parts) return scene._parts;
      const image = scene.querySelector('.scene-image');
      const copy = scene.querySelector('.scene-copy');
      let items = [];
      if (copy) {
        const heroTitle = scene.classList.contains('hero') ? copy.querySelector('h1') : null;
        if (heroTitle) items = [...heroTitle.children];
        else {
          items = [...copy.querySelectorAll('.eyebrow, h1, h2, p, .date-lockup, .countdown, .calendar-wrap, .map-frame, .venue-map-link, .station-list, .family-columns, .back-to-top')];
          items = items.filter(el => !items.some(other => other !== el && other.contains(el)));
        }
      }
      const extras = [...scene.querySelectorAll('.profile-carousel')];
      items = items.concat(extras);
      scene._parts = { image, copy, items, extras };
      scene._anims = [];
      scene._temp = [];
      return scene._parts;
    };

    const track = (list, animation) => { list.push(animation); return animation; };
    const cancelList = list => { list.splice(0).forEach(a => { try { a.cancel(); } catch (e) {} }); };

    // Photographs: only neighbouring chapters are kept in the layout, so their
    // images are fetched ahead of time without downloading everything at once.
    const prime = scene => {
      scene.style.display = '';
      const { image } = partsOf(scene);
      if (image && image.loading === 'lazy') image.loading = 'eager';
    };

    const refreshVisibility = () => {
      scenes.forEach((scene, i) => {
        const distance = Math.abs(i - activeIndex);
        if (distance === 0) { prime(scene); scene.style.visibility = 'visible'; }
        else if (distance === 1) { prime(scene); scene.style.visibility = 'hidden'; }
        else { scene.style.display = 'none'; scene.style.visibility = 'hidden'; }
      });
    };

    const ready = async scene => {
      prime(scene);
      const { image } = partsOf(scene);
      const jobs = [nextFrames()];
      if (image) {
        if (!image.complete || !image.naturalWidth) {
          jobs.push(Promise.race([
            new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }),
            wait(1400)
          ]));
        } else if (image.decode) jobs.push(image.decode().catch(() => {}));
      }
      await Promise.all(jobs);
    };

    // ----- text -----------------------------------------------------------
    const hideCopyInstantly = scene => {
      const { copy, extras } = partsOf(scene);
      extras.forEach(el => { el.style.opacity = '0'; });
      if (!copy) return;
      copy.classList.add('stage-snap');
      copy.classList.remove('stage-leave');
      copy.classList.add('stage-hide');
      void copy.offsetWidth;
      copy.classList.remove('stage-snap');
    };

    const leaveCopy = (scene, dir) => {
      const { copy, extras } = partsOf(scene);
      extras.forEach(el => {
        track(scene._anims, el.animate(
          [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${-18 * dir}px)` }],
          { duration: 420, easing: 'ease', fill: 'both' }
        ));
      });
      if (!copy) return;
      copy.style.setProperty('--stage-y', `${-18 * dir}px`);
      copy.classList.add('stage-leave');
    };

    const revealCopy = scene => {
      const { copy, items, extras } = partsOf(scene);
      if (copy) {
        copy.classList.remove('stage-hide', 'stage-leave');
      }
      items.forEach((el, i) => {
        const a = track(scene._anims, el.animate(
          [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: T.child, delay: i * T.stagger, easing: EASE_OUT, fill: 'both' }
        ));
        a.onfinish = () => { try { a.cancel(); } catch (e) {} };
        if (extras.includes(el)) el.style.opacity = '';
      });
    };

    // ----- photographs -------------------------------------------------------
    const photoEnter = (scene, dir) => {
      const { image } = partsOf(scene);
      const isFamily = scene.classList.contains('family-scene');
      if (!image || (getComputedStyle(image).objectFit === 'contain' && !isFamily)) return;
      const index = scenes.indexOf(scene);
      const from = 1;
      // The family photograph is shown whole (never cropped), so its zoom is kept extra gentle.
      const to = isFamily ? (isMobile ? 1.04 : 1.03) : isMobile ? 1.06 : ([4, 5, 6].includes(index) ? 1.075 : 1.035);
      const shift = isMobile ? 0 : dir * ((from - 1) / 2) * 85;
      track(scene._anims, image.animate(
        [{ scale: from, translate: `0 ${shift}%` }, { scale: to, translate: '0 0%' }],
        { duration: T.drift, easing: isMobile ? EASE_ZOOM : EASE_OUT, fill: 'both' }
      ));
    };

    // ----- the transition ----------------------------------------------------
    transitionTo = async (target, dir) => {
      busy = true;
      window.clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
      const from = scenes[activeIndex];
      const to = scenes[target];
      partsOf(from); partsOf(to);

      await ready(to);

      from.style.zIndex = '1';
      to.style.zIndex = '2';
      to.style.visibility = 'visible';
      // Match the uploaded reference: mobile copy begins its reveal with the wipe.
      if (isMobile) to.classList.add('show-copy');
      setActive(target, false);

      // 1. the outgoing text lifts away
      leaveCopy(from, dir);

      // 2. Reveal the next photograph with the original directional wipe
      // on BOTH desktop and mobile. Only the incoming scene is masked; the
      // outgoing scene remains a complete, stationary frame underneath it.
      const timing = { duration: T.wipe, delay: T.wipeDelay, easing: EASE_WIPE, fill: 'both' };
      let veil = null;
      const wipeFrames = dir > 0
        ? [{ clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }]
        : [{ clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }];
      track(to._temp, to.animate(wipeFrames, timing));
      track(from._temp, from.animate([{ opacity: 1 }, { opacity: 1 }], timing));
      photoEnter(to, dir);

      // 3. the new text arrives once the photograph has landed
      await wait(T.copyAt);
      revealCopy(to);
      await wait(Math.max(0, T.wipe + T.wipeDelay - T.copyAt) + 40);

      // 4. tidy up
      cancelList(from._temp);
      cancelList(to._temp);
      veil?.remove();
      cancelList(from._anims);
      from.style.zIndex = '';
      to.style.zIndex = '';
      from.classList.remove('show-copy');
      hideCopyInstantly(from);
      refreshVisibility();
      lockUntil = performance.now() + T.cooldown;
      await wait(T.cooldown);
      busy = false;
      if (pendingSteps !== 0) {
        const step = pendingSteps > 0 ? 1 : -1;
        pendingSteps -= step;
        const nextTarget = clamp(activeIndex + step);
        if (nextTarget !== activeIndex) {
          transitionTo(nextTarget, step);
          return;
        }
        pendingSteps = 0;
      }
      scheduleAutoAdvance();
    };

    // ----- first view --------------------------------------------------------
    root.classList.add('stage');
    if (!isMobile) {
      scenes.forEach(scene => {
        const { image } = partsOf(scene);
        if (!image) return;
        image.style.transform = 'translateY(-1%) scale(1.015)';
        image.style.filter = 'saturate(1) brightness(.96)';
      });
    }
    scenes.forEach(scene => { partsOf(scene); hideCopyInstantly(scene); });
    if (isMobile) scenes[0].classList.add('show-copy');
    setActive(0, false);
    refreshVisibility();
    busy = true;
    (async () => {
      await ready(scenes[0]);
      track(scenes[0]._temp, scenes[0].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' }));
      photoEnter(scenes[0], 0);
      await wait(480);
      revealCopy(scenes[0]);
      busy = false;
      scheduleAutoAdvance();
    })();

    // ----- input: wheel, touch, keys ------------------------------------------
    const scrollerOf = (el, dir) => {
      for (let node = el instanceof Element ? el : null; node && node !== story; node = node.parentElement) {
        const overflowY = getComputedStyle(node).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 2) {
          if (dir === 0) return node;
          if (dir > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 2 : node.scrollTop > 2) return node;
        }
      }
      return null;
    };

    // One vertical wheel gesture advances exactly one chapter.
    // Capture phase makes this reliable even when an overlay or child control
    // stops bubbling. The idle timer groups trackpad momentum into one gesture.
    let wheelGestureLocked = false;
    let wheelResetTimer = null;
    document.addEventListener('wheel', event => {
      if (event.ctrlKey || event.metaKey) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || Math.abs(event.deltaY) < 10) return;
      // The wishes panel is a reading area, not a chapter-navigation gesture
      // zone. Never change chapters while the pointer is over the wish text,
      // even when the wish has reached its top or bottom edge.
      const inWishReadingArea = event.target instanceof Element &&
        event.target.closest('#scene-15 .guestbook-wishes-card .wish-card');
      if (inWishReadingArea) return;
      if (scrollerOf(event.target, event.deltaY > 0 ? 1 : -1)) return;
      event.preventDefault();

      window.clearTimeout(wheelResetTimer);
      wheelResetTimer = window.setTimeout(() => {
        wheelGestureLocked = false;
      }, 520);

      if (wheelGestureLocked) return;
      wheelGestureLocked = true;
      goToScene(activeIndex + (event.deltaY > 0 ? 1 : -1));
    }, { passive: false, capture: true });

    // A vertical finger swipe advances one chapter. Do not delegate vertical
    // swipes to nested text panels: that was making page navigation feel frozen.
    let touch = null;
    let touchNavigationLocked = false;
    let touchResetTimer = null;
    document.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { touch = null; return; }
      const point = event.touches[0];
      // The guestbook wish is an independently scrollable reading area.
      // Finger gestures that begin there must never be converted into chapter changes.
      const wishScroller = event.target instanceof Element
        ? event.target.closest('#scene-15 .wish-card')
        : null;
      touch = { x: point.clientX, y: point.clientY, inWishScroller: !!wishScroller };
    }, { passive: true, capture: true });

    document.addEventListener('touchmove', event => {
      if (!touch || event.touches.length !== 1) return;
      // Let the browser perform native momentum scrolling inside a long wish.
      if (touch.inWishScroller) return;
      const point = event.touches[0];
      const dy = touch.y - point.clientY;
      const dx = touch.x - point.clientX;
      if (Math.abs(dy) > Math.abs(dx) && event.cancelable) event.preventDefault();
    }, { passive: false, capture: true });

    document.addEventListener('touchend', event => {
      if (!touch || !event.changedTouches.length) { touch = null; return; }
      const point = event.changedTouches[0];
      const dy = touch.y - point.clientY;
      const dx = touch.x - point.clientX;
      const beganInWishScroller = touch.inWishScroller;
      touch = null;

      if (beganInWishScroller) return;
      if (touchNavigationLocked) return;
      if (Math.abs(dy) < 38 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
      if (scrollerOf(event.target, dy > 0 ? 1 : -1)) return;

      touchNavigationLocked = true;
      window.clearTimeout(touchResetTimer);
      touchResetTimer = window.setTimeout(() => {
        touchNavigationLocked = false;
      }, 520);
      goToScene(activeIndex + (dy > 0 ? 1 : -1));
    }, { passive: true, capture: true });

    document.addEventListener('touchcancel', () => { touch = null; }, { passive: true, capture: true });
  } else {
    // Graceful fallback for older browsers and visitors requesting reduced motion.
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= .45) {
          const index = scenes.indexOf(entry.target);
          if (index >= 0) setActive(index);
        }
      });
    }, { threshold: [.45, .65] });
    scenes.forEach(scene => observer.observe(scene));
    scenes.forEach(scene => scene.classList.add('motion-fallback'));
    setActive(0);
  }


  // Numbered chapter navigation: each circle jumps directly to its scene.
  const storyProgress = document.getElementById('storyProgress');
  if (chapterNumberList) {
    chapterNumberList.innerHTML = scenes.map((scene, index) =>
      `<button class="chapter-number" type="button" data-chapter-index="${index}" aria-label="Go to page ${index + 1}" title="Page ${index + 1}">${index + 1}</button>`
    ).join('');
    chapterNumberList.addEventListener('click', event => {
      const button = event.target.closest('[data-chapter-index]');
      if (!button) return;
      goToScene(Number(button.dataset.chapterIndex));
    });
  }

  prevButton?.addEventListener('click', () => goToScene(activeIndex - 1));
  nextButton?.addEventListener('click', () => goToScene(activeIndex + 1));
  document.addEventListener('keydown', event => {
    const tag = event.target?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || event.altKey || event.ctrlKey || event.metaKey) return;
    const interactive = ['button', 'a'].includes(tag);
    const key = event.key;
    let target = null;
    if (key === 'ArrowDown' || key === 'PageDown' || (key === ' ' && !interactive && !event.shiftKey)) target = activeIndex + 1;
    else if (key === 'ArrowUp' || key === 'PageUp' || (key === ' ' && !interactive && event.shiftKey)) target = activeIndex - 1;
    else if (key === 'Home' && stage) target = 0;
    else if (key === 'End' && stage) target = scenes.length - 1;
    if (target === null) return;
    event.preventDefault();
    goToScene(target);
  });
  document.getElementById('backToTop')?.addEventListener('click', () => goToScene(0));

  // Lightweight canvas motion graphics: drifting champagne particles and
  // fine orbit lines. The canvas responds to scroll without blocking touch.
  const canvas = document.getElementById('motionCanvas');
  if (canvas && !reducedMotion && !isMobile) {
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, frame = 0, drawScroll = 0;
    const particles = Array.from({ length: 42 }, (_, i) => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + .35,
      speed: Math.random() * .00022 + .00006, phase: Math.random() * Math.PI * 2,
      alpha: Math.random() * .3 + .08
    }));
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 1.6); width = innerWidth; height = innerHeight; canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', () => { scrollRatio = window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); }, { passive: true });
    const draw = () => {
      drawScroll += (scrollRatio - drawScroll) * .04;
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p, i) => {
        const drift = Math.sin(frame * .006 + p.phase) * 13;
        const x = p.x * width + drift;
        const y = ((p.y * height - frame * p.speed * height * 2 + drawScroll * 34) % height + height) % height;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(236,211,161,${p.alpha})`; ctx.fill();
        if (i % 7 === 0) {
          ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y);
          ctx.strokeStyle = `rgba(236,211,161,${p.alpha * .32})`; ctx.lineWidth = .5; ctx.stroke();
        }
      });
      frame += 1; requestAnimationFrame(draw);
    };
    draw();
  }

  // Background music is muted by default and starts only on an explicit tap.
  const weddingMusic = document.getElementById('weddingMusic');
  const musicToggle = document.getElementById('musicToggle');
  let musicEnabled = false;
  weddingMusic.loop = true; weddingMusic.preload = 'none'; weddingMusic.volume = .72; weddingMusic.muted = true;
  function updateMusicControl() {
    musicToggle.classList.toggle('is-muted', !musicEnabled);
    musicToggle.setAttribute('aria-pressed', String(musicEnabled));
    musicToggle.setAttribute('aria-label', musicEnabled ? 'Mute background music' : 'Play background music');
    musicToggle.querySelector('.music-label').textContent = musicEnabled ? 'MUSIC' : 'MUTED';
    weddingMusic.muted = !musicEnabled;
  }
  musicToggle.addEventListener('click', () => {
    musicEnabled = !musicEnabled; updateMusicControl();
    if (musicEnabled) {
      const attempt = weddingMusic.play();
      if (attempt?.catch) attempt.catch(() => { musicEnabled = false; updateMusicControl(); });
    } else weddingMusic.pause();
  });
  updateMusicControl();

  // Add directly to Google Calendar (no secondary calendar menu).
  const start = new Date('2027-01-20T10:00:00+05:30');
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const fmtGoogle = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const googleUrl = new URL('https://calendar.google.com/calendar/render');
  googleUrl.search = new URLSearchParams({ action: 'TEMPLATE', text: 'Balaji & Gajapriya — Wedding', dates: `${fmtGoogle(start)}/${fmtGoogle(end)}`, details: 'Come and celebrate the wedding of Balaji & Gajapriya.', location: 'Cauvery Mahal, Trichy Main Road, Ariyalur' }).toString();
  const googleCalendar = document.getElementById('googleCalendar');
  if (googleCalendar) googleCalendar.href = googleUrl.toString();

  // Live countdown to 20 January 2027, 10:00 AM IST.
  const target = start.getTime();
  function updateCountdown() {
    let remaining = target - Date.now();
    const countdown = document.getElementById('countdown');
    if (!countdown) return;
    if (remaining <= 0) { countdown.innerHTML = '<p class="just-married">Just Married ♡</p>'; return; }
    const day = Math.floor(remaining / 86400000); remaining %= 86400000;
    const hour = Math.floor(remaining / 3600000); remaining %= 3600000;
    const minute = Math.floor(remaining / 60000); remaining %= 60000;
    const second = Math.floor(remaining / 1000);
    document.getElementById('days').textContent = day;
    document.getElementById('hours').textContent = String(hour).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minute).padStart(2, '0');
    document.getElementById('seconds').textContent = String(second).padStart(2, '0');
  }
  updateCountdown(); window.setInterval(updateCountdown, 1000);
})();

// Independent automatic carousels for the Bride and Groom story chapters.
// Each carousel resets to photo 01 whenever its chapter becomes active, and
// only advances while that chapter is on screen.
(() => {
 const sets={bride:{path:'assets/bride/',files:['01.webp','02.webp','03.webp','04.webp','05.webp','06.webp','07.webp','08.webp','09.webp','10.webp','11.webp']},groom:{path:'assets/groom/',files:['01.webp','02.webp','03.webp','04.webp','05.webp','06.webp','07.webp','08.webp','09.webp','10.webp','11.webp','12.webp']}};
 document.querySelectorAll('[data-carousel]').forEach(box=>{
   const key=box.dataset.carousel, data=sets[key];
   if(!data)return;
   const slides=box.querySelector('.profile-slides'),dots=box.querySelector('.profile-dots'),counter=box.querySelector('.profile-count');
   const chapter=box.closest('.scene');
   let index=0,timer=null;
   data.files.forEach((file,i)=>{
     const slide=document.createElement('div');
     slide.className='profile-slide'+(!i?' active':'');
     const img=document.createElement('img');
     img.src=data.path+file;
     img.alt=(key==='bride'?'Gajapriya':'Balaji')+' photograph '+(i+1);
     img.loading=i===0?'eager':'lazy';
     slide.append(img);slides.append(slide);
     const dot=document.createElement('i');
     if(!i)dot.className='active';
     dots.append(dot);
   });
   const show=n=>{
     index=(n+data.files.length)%data.files.length;
     [...slides.children].forEach((x,i)=>x.classList.toggle('active',i===index));
     [...dots.children].forEach((x,i)=>x.classList.toggle('active',i===index));
     counter.textContent=String(index+1).padStart(2,'0')+' / '+String(data.files.length).padStart(2,'0');
   };
   const stop=()=>{if(timer!==null){clearInterval(timer);timer=null;}};
   const start=()=>{
     stop();
     timer=setInterval(()=>show(index+1),4200);
   };
   const enterChapter=()=>{show(0);start();};
   box.querySelector('[data-prev]').addEventListener('click',()=>{show(index-1);if(chapter?.classList.contains('is-current'))start();});
   box.querySelector('[data-next]').addEventListener('click',()=>{show(index+1);if(chapter?.classList.contains('is-current'))start();});
   // Mobile-only horizontal swipe support. Vertical gestures remain available for page navigation.
   const swipeArea=box.querySelector('.profile-slides');
   if(window.matchMedia('(max-width: 700px)').matches && swipeArea){
     let startX=0,startY=0;
     swipeArea.addEventListener('touchstart',event=>{
       if(!event.touches || event.touches.length!==1)return;
       startX=event.touches[0].clientX;startY=event.touches[0].clientY;
     },{passive:true});
     swipeArea.addEventListener('touchend',event=>{
       if(!event.changedTouches || event.changedTouches.length!==1)return;
       const dx=event.changedTouches[0].clientX-startX;
       const dy=event.changedTouches[0].clientY-startY;
       if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.2){
         show(index+(dx<0?1:-1));
         if(chapter?.classList.contains('is-current'))start();
       }
     },{passive:true});
   }
   if(chapter){
     const observer=new MutationObserver(()=>{
       if(chapter.classList.contains('is-current'))enterChapter();
       else stop();
     });
     observer.observe(chapter,{attributes:true,attributeFilter:['class']});
     if(chapter.classList.contains('is-current'))enterChapter();
   } else {
     start();
   }
 });
})();
