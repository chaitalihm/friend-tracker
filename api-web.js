// Browser test shim. Lets the real app (app.js / styles.css) run in a normal
// browser by standing in for the Electron bridge. Data persists in
// localStorage when the browser allows it, otherwise it lives in memory for
// the session. The desktop build uses preload.js instead of this file.
(function () {
  const KEY = 'kit-data-v3';
  const PKEY = 'kit-photos-v3';
  const mem = { data: null, photos: {} };

  const hasLS = (() => {
    try { const t = '__t'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return true; }
    catch (e) { return false; }
  })();

  const loadStore = () => {
    if (hasLS) { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
    return mem.data;
  };
  const saveStore = (d) => {
    if (hasLS) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
    else { mem.data = d; }
  };
  const loadPhotos = () => {
    if (hasLS) { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; } }
    return mem.photos;
  };
  const savePhotos = (p) => {
    if (hasLS) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
    else { mem.photos = p; }
  };

  const ago = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const mmddIn = (days) => {
    const d = new Date(today.getTime() + days * 86400000);
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const inDays = (days) => {
    const d = new Date(today.getTime() + days * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const SEED = {
    settings: { fadeMaxDays: 90, birthdayLeadDays: 7, planLeadDays: 3, nudgeAfterDays: 30, textOverdueDays: 30, callOverdueDays: 45, fadeMode: 'smooth' },
    friends: [
      { id: 'm', name: 'Maya', color: 'pink', style: 'pin', birthday: mmddIn(4), note: '', plan: null, lastContact: ago(2), lastTexted: ago(2), lastCalled: ago(20), x: 90, y: 90, rot: -3, connections: ['a', 'n'], log: [] },
      { id: 'a', name: 'Arjun', color: 'blue', style: 'tape', birthday: null, note: '', plan: null, lastContact: ago(3), lastTexted: ago(3), lastCalled: ago(60), x: 540, y: 80, rot: 2, connections: ['m'], log: [] },
      { id: 'n', name: 'Nina', color: 'coral', style: 'pin', birthday: null, note: 'dinner at the thai place', plan: null, lastContact: ago(0), lastTexted: ago(0), lastCalled: ago(5), x: 130, y: 390, rot: -2, connections: ['m'], log: [{ date: ago(0), text: 'called: dinner at the new thai place' }] },
      { id: 'p', name: 'Priya', color: 'amber', style: 'pin', birthday: mmddIn(20), note: 'owes me a coffee', plan: { date: inDays(3), label: 'dinner' }, lastContact: ago(23), lastTexted: ago(40), lastCalled: ago(23), x: 430, y: 410, rot: 3, connections: [], log: [] },
      { id: 's', name: 'Sam', color: 'green', style: 'tape', birthday: null, note: '', plan: { date: inDays(6), label: 'coffee' }, lastContact: ago(41), lastTexted: ago(41), lastCalled: ago(80), x: 680, y: 420, rot: -2, connections: [], log: [] },
      { id: 'd', name: 'Dev', color: 'purple', style: 'pin', birthday: null, note: 'call him already!', plan: null, lastContact: ago(88), lastTexted: ago(88), lastCalled: ago(120), x: 940, y: 250, rot: 3, connections: [], log: [] }
    ]
  };

  window.api = {
    loadData: async () => {
      let d = loadStore();
      if (!d || !Array.isArray(d.friends)) { d = SEED; saveStore(d); }
      d.settings = Object.assign({}, SEED.settings, d.settings || {});
      return d;
    },
    saveData: async (d) => { saveStore(d); return true; },
    readPhoto: async (filename) => { const p = loadPhotos(); return p[filename] || null; },
    importPhoto: () => new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = () => {
        const file = inp.files[0];
        if (!file) return resolve(null);
        const r = new FileReader();
        r.onload = () => {
          const name = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          const p = loadPhotos(); p[name] = r.result; savePhotos(p);
          resolve(name);
        };
        r.readAsDataURL(file);
      };
      inp.click();
    }),
    importPhotoPath: async () => null
  };
})();
