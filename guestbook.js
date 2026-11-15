(() => {
  const SUPABASE_URL = 'https://fcvdcjcfjozcxgvvyxbt.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OSy9S3VU5pFFVB5AFRsSCA_o3FZz5Us';
  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/submit-guestbook`;
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let turnstileToken = '';
  let wishes = [];
  let current = 0;
  let rotateTimer = null;
  let channel = null;
  const $ = id => document.getElementById(id);
  const form = $('guestbookForm');
  if (!form) return;

  window.guestbookTurnstileSolved = token => { turnstileToken = token || ''; };
  window.guestbookTurnstileExpired = () => { turnstileToken = ''; };
  const shuffle = list => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const renderWish = () => {
    const message = $('wishMessage'), name = $('wishName');
    if (!wishes.length) {
      message.textContent = 'Be the first to leave us a wish.';
      name.textContent = 'With love, Balaji & Gajapriya';
      $('wishCount').textContent = 'No wishes yet';
      $('wishPosition').textContent = '—';
      $('wishPrev').disabled = $('wishNext').disabled = true;
      return;
    }
    const item = wishes[current];
    message.textContent = item.message;
    // Reset immediately and again after layout: some mobile browsers calculate
    // the scroll height only after the updated text has been painted.
    const wishScroller = message.closest('.wish-card');
    if (wishScroller) {
      wishScroller.scrollTop = 0;
      requestAnimationFrame(() => {
        wishScroller.scrollTop = 0;
        wishScroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }
    name.textContent = `— ${item.name}`;
    $('wishCount').textContent = `${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'}`;
    $('wishPosition').textContent = `${current + 1} / ${wishes.length}`;
    $('wishPrev').disabled = $('wishNext').disabled = wishes.length < 2;
  };
  const move = direction => {
    if (wishes.length < 2) return;
    current = (current + direction + wishes.length) % wishes.length;
    renderWish();
    restartRotation();
  };
  const restartRotation = () => {
    if (rotateTimer) clearInterval(rotateTimer);
    const currentMessage = wishes[current]?.message || '';
    const wordCount = currentMessage.trim() ? currentMessage.trim().split(/\\s+/).length : 0;
    // Give long wishes time to read: visitors can move them manually with the arrows.
    rotateTimer = wishes.length > 1 && wordCount <= 80
      ? setInterval(() => move(1), 5000)
      : null;
  };
  const addWish = row => {
    if (!row || wishes.some(w => w.id === row.id)) return;
    wishes.push(row);
    // Keep the visitor's current wish on screen; the new wish joins the next rotation.
    if (wishes.length === 1) current = 0;
    renderWish();
    restartRotation();
  };
  const loadWishes = async () => {
    if (!client) {
      $('wishCount').textContent = 'Guestbook unavailable';
      $('wishMessage').textContent = 'Please check back soon.';
      return;
    }
    const { data, error } = await client.from('guestbook_wishes')
      .select('id,name,message,created_at').eq('is_visible', true)
      .order('created_at', { ascending: false }).limit(200);
    if (error) {
      console.error('Guestbook load failed:', error);
      $('wishCount').textContent = 'Unable to load wishes';
      $('wishMessage').textContent = 'Please refresh the page in a little while.';
      return;
    }
    wishes = shuffle(data || []);
    current = 0;
    renderWish();
    restartRotation();
  };

  $('wishPrev').addEventListener('click', () => move(-1));
  $('wishNext').addEventListener('click', () => move(1));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('guestName').value.trim();
    const message = $('guestMessage').value.trim();
    const status = $('guestbookStatus');
    const button = $('guestbookSubmit');
    status.className = 'guestbook-status';
    if (!name || name.length > 60 || !message || message.length > 1000) {
      status.textContent = 'Please enter your name and a wish (up to 1,000 characters).';
      status.classList.add('is-error'); return;
    }
    if (!turnstileToken) {
      status.textContent = 'Please complete the security check first.';
      status.classList.add('is-error'); return;
    }
    button.disabled = true; button.textContent = 'SENDING…';
    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message, turnstileToken })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not save your wish. Please try again.');
      status.textContent = 'Your wish has been saved. Thank you for being part of our story!';
      status.classList.add('is-success');
      form.reset(); turnstileToken = '';
      if (window.turnstile) window.turnstile.reset();
    } catch (error) {
      status.textContent = error.message || 'Something went wrong. Please try again.';
      status.classList.add('is-error');
      turnstileToken = '';
      if (window.turnstile) window.turnstile.reset();
    } finally {
      button.disabled = false; button.innerHTML = 'SEND YOUR WISH <span>↗</span>';
    }
  });

  // Admin visibility changes and deletions are announced over Broadcast.
  // This is deliberate: an anonymous visitor may no longer be allowed to
  // receive a Postgres UPDATE event once a wish becomes hidden under RLS.
  let refreshInProgress = false;
  let refreshQueued = false;
  const refreshWishes = async () => {
    if (refreshInProgress) { refreshQueued = true; return; }
    refreshInProgress = true;
    try {
      do {
        refreshQueued = false;
        await loadWishes();
      } while (refreshQueued);
    } finally {
      refreshInProgress = false;
    }
  };

  loadWishes();
  if (client) {
    channel = client.channel('public-guestbook-wishes')
      .on('broadcast', { event: 'guestbook-changed' }, () => {
        refreshWishes();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook_wishes' }, payload => {
        if (payload.new?.is_visible) addWish(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guestbook_wishes' }, () => {
        refreshWishes();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guestbook_wishes' }, () => {
        refreshWishes();
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Guestbook live updates unavailable; refresh to see new wishes.');
        }
      });
  }
  window.addEventListener('beforeunload', () => { if (rotateTimer) clearInterval(rotateTimer); if (channel && client) client.removeChannel(channel); });
})();
