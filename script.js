(() => {
  const scenes = [...document.querySelectorAll('[data-scene]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
  const prevButton = document.getElementById('prevScene');
  const nextButton = document.getElementById('nextScene');
  let activeIndex = 0;
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

  const goToScene = (index) => {
    const target = Math.max(0, Math.min(scenes.length - 1, index));
    scenes[target].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  function setActive(index) {
    const nextIndex = Math.max(0, Math.min(scenes.length - 1, index));
    const changed = nextIndex !== activeIndex;
    activeIndex = nextIndex;
    scenes.forEach((scene, i) => {
      scene.classList.toggle('is-current', i === activeIndex);
      if (isMobile) scene.classList.toggle('show-copy', i === activeIndex);
    });
    if (prevButton) prevButton.disabled = activeIndex === 0;
    if (nextButton) nextButton.disabled = activeIndex === scenes.length - 1;
    const progress = document.querySelector('.story-progress__fill');
    if (progress) progress.style.height = `${((activeIndex + 1) / scenes.length) * 100}%`;
    const count = document.querySelector('.story-progress__count');
    if (count) count.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
    if (changed || autoAdvanceTimer === null) scheduleAutoAdvance();
  }

  // Scroll-led visual storytelling. Every animation is tied to scroll position,
  // so reversing the scroll reverses the image and typography movement as well.
  if (window.gsap && window.ScrollTrigger && !reducedMotion && !isMobile) {
    gsap.registerPlugin(ScrollTrigger);
    scenes.forEach((scene, index) => {
      const image = scene.querySelector('.scene-image');
      const copy = scene.querySelector('.scene-copy');
      const title = copy?.querySelector('h1, h2');
      const eyebrow = copy?.querySelector('.eyebrow');
      const details = copy ? [...copy.querySelectorAll('p:not(.eyebrow), .date-lockup, .countdown, .calendar-wrap, .map-frame, .station-list, .family-columns, .back-to-top')] : [];

      if (image) {
        // Incoming photographs begin as softly rounded, inset frames and expand
        // into full-bleed cinematic images as their chapters enter view.
        // Scrubbing makes the morph reverse naturally when scrolling upwards.
        gsap.fromTo(image,
          {
            scale: 1.22,
            yPercent: 2.5,
            clipPath: 'inset(10% 7% 10% 7% round 38px)',
            borderRadius: '38px',
            filter: 'saturate(.78) brightness(.68)'
          },
          {
            scale: 1.015,
            yPercent: -1,
            clipPath: 'inset(0% 0% 0% 0% round 0px)',
            borderRadius: '0px',
            filter: 'saturate(1) brightness(.96)',
            ease: 'none',
            scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom 18%', scrub: 1.25 }
          }
        );
      }

      if (copy) {
        // Pages 8 (Engagement) and 13 (Heartfelt Invitation): let the image arrive
        // first, then reveal the copy after a deliberate three-second pause.
        // The delay is cancelled if the visitor leaves the scene before it ends.
        if (index === 7 || index === 12) {
          let revealTimer = null;
          gsap.set(copy, { autoAlpha: 0, y: 34, filter: '' });
          const revealCopy = () => {
            if (revealTimer) revealTimer.kill();
            gsap.set(copy, { autoAlpha: 0, y: 34, filter: '' });
            revealTimer = gsap.delayedCall([7, 12].includes(index) ? 0 : 3, () => {
              gsap.to(copy, { autoAlpha: 1, y: 0, filter: '', duration: .8, ease: 'power2.out', overwrite: true });
              if (title) gsap.fromTo(title, { letterSpacing: '.025em' }, { letterSpacing: '-.045em', duration: .65, ease: 'power2.out', overwrite: true });
              if (eyebrow) gsap.fromTo(eyebrow, { x: -18, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .55, ease: 'power2.out', overwrite: true });
              if (details.length) gsap.fromTo(details, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .65, stagger: .07, ease: 'power2.out', overwrite: true });
            });
          };
          ScrollTrigger.create({
            trigger: scene,
            start: 'top 58%',
            end: 'bottom 35%',
            onEnter: revealCopy,
            onEnterBack: revealCopy,
            onLeave: () => { if (revealTimer) revealTimer.kill(); },
            onLeaveBack: () => { if (revealTimer) revealTimer.kill(); gsap.set(copy, { autoAlpha: 0 }); }
          });
        } else {
          // Other pages retain their original scroll-synchronised text timing.
          const tl = gsap.timeline({
            scrollTrigger: { trigger: scene, start: 'top 78%', end: 'bottom 22%', scrub: 0.8 }
          });
          tl.fromTo(copy, { autoAlpha: 0, '--copy-shift': '48px', filter: '', scale: .975 }, { autoAlpha: 1, '--copy-shift': '0px', filter: '', scale: 1, duration: .42, ease: 'none' });
          if (title) tl.fromTo(title, { letterSpacing: '.025em' }, { letterSpacing: '-.045em', duration: .22, ease: 'none' }, .12);
          if (eyebrow) tl.fromTo(eyebrow, { x: -22, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .2, ease: 'none' }, .2);
          if (details.length) tl.fromTo(details, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: .045, duration: .25, ease: 'none' }, .22);
          tl.to(copy, { autoAlpha: 0, '--copy-shift': '-30px', filter: '', scale: 1.015, duration: .28, ease: 'none' }, .76);
        }
      }

      // The three central relationship photographs receive a slightly more
      // expressive image-plane movement, like a restrained 2.5D film transition.
      if ([4, 5, 6].includes(index) && image) {
        gsap.to(image, {
          scale: 1.085,
          transformOrigin: index === 4 ? '48% 50%' : index === 5 ? '52% 46%' : '50% 50%',
          ease: 'none',
          scrollTrigger: { trigger: scene, start: 'top 70%', end: 'bottom 30%', scrub: 1.4 }
        });
      }

      ScrollTrigger.create({
        trigger: scene,
        start: 'top center',
        end: 'bottom center',
        onEnter: () => setActive(index),
        onEnterBack: () => setActive(index)
      });
    });
    ScrollTrigger.refresh();
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
  }

  prevButton?.addEventListener('click', () => goToScene(activeIndex - 1));
  nextButton?.addEventListener('click', () => goToScene(activeIndex + 1));
  document.addEventListener('keydown', event => {
    const tag = event.target?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select', 'button', 'a'].includes(tag)) return;
    if (['ArrowDown', 'PageDown'].includes(event.key)) { event.preventDefault(); goToScene(activeIndex + 1); }
    if (['ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); goToScene(activeIndex - 1); }
  });
  document.getElementById('backToTop')?.addEventListener('click', () => goToScene(0));
  setActive(0);

  // Lightweight canvas motion graphics: drifting champagne particles and
  // fine orbit lines. The canvas responds to scroll without blocking touch.
  const canvas = document.getElementById('motionCanvas');
  if (canvas && !reducedMotion && !isMobile) {
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, frame = 0, scrollRatio = 0;
    const particles = Array.from({ length: 42 }, (_, i) => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + .35,
      speed: Math.random() * .00022 + .00006, phase: Math.random() * Math.PI * 2,
      alpha: Math.random() * .3 + .08
    }));
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 1.6); width = innerWidth; height = innerHeight; canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', () => { scrollRatio = window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); }, { passive: true });
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p, i) => {
        const drift = Math.sin(frame * .006 + p.phase) * 13;
        const x = p.x * width + drift;
        const y = ((p.y * height - frame * p.speed * height * 2 + scrollRatio * 34) % height + height) % height;
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
(() => {
 const sets={bride:{path:'assets/bride/',files:['01.webp','02.webp','03.webp','04.webp','05.webp','06.webp','07.webp','08.webp','09.webp','10.webp','11.webp']},groom:{path:'assets/groom/',files:['01.webp','02.webp','03.webp','04.webp','05.webp','06.webp','07.webp','08.webp','09.webp','10.webp','11.webp','12.webp']}};
 document.querySelectorAll('[data-carousel]').forEach(box=>{const key=box.dataset.carousel, data=sets[key];if(!data)return;const slides=box.querySelector('.profile-slides'),dots=box.querySelector('.profile-dots'),counter=box.querySelector('.profile-count');let index=0,timer;
 data.files.forEach((file,i)=>{const slide=document.createElement('div');slide.className='profile-slide'+(!i?' active':'');const img=document.createElement('img');img.src=data.path+file;img.alt=(key==='bride'?'Gajapriya':'Balaji')+' photograph '+(i+1);img.loading=i===0?'eager':'lazy';slide.append(img);slides.append(slide);const dot=document.createElement('i');if(!i)dot.className='active';dots.append(dot)});
 const show=n=>{index=(n+data.files.length)%data.files.length;[...slides.children].forEach((x,i)=>x.classList.toggle('active',i===index));[...dots.children].forEach((x,i)=>x.classList.toggle('active',i===index));counter.textContent=String(index+1).padStart(2,'0')+' / '+String(data.files.length).padStart(2,'0')};const restart=()=>{clearInterval(timer);timer=setInterval(()=>show(index+1),4200)};box.querySelector('[data-prev]').addEventListener('click',()=>{show(index-1);restart()});box.querySelector('[data-next]').addEventListener('click',()=>{show(index+1);restart()});
 // Mobile-only horizontal swipe support. Vertical gestures remain available for page scrolling.
 const swipeArea=box.querySelector('.profile-slides');
 if(window.matchMedia('(max-width: 700px)').matches && swipeArea){
   let startX=0,startY=0;
   swipeArea.addEventListener('touchstart',event=>{
     if(!event.touches || event.touches.length!==1)return;
     startX=event.touches[0].clientX;
     startY=event.touches[0].clientY;
   },{passive:true});
   swipeArea.addEventListener('touchend',event=>{
     if(!event.changedTouches || event.changedTouches.length!==1)return;
     const dx=event.changedTouches[0].clientX-startX;
     const dy=event.changedTouches[0].clientY-startY;
     if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.2){
       show(index+(dx<0?1:-1));
       restart();
     }
   },{passive:true});
 }
 restart();
 });
})();
