// Icone a linea, disegnate a mano (24×24, tratto arrotondato).
import { raw } from './utils.js';

const P = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9"/>',
  basket: '<path d="M3 9.5h18l-1.7 9.6a2 2 0 0 1-2 1.6H6.7a2 2 0 0 1-2-1.6z"/><path d="M8 9.5 11 3.5M16 9.5 13 3.5"/><path d="M9.5 13.5v3.5M14.5 13.5v3.5"/>',
  checks: '<path d="m3.5 6.5 2 2 3.5-4"/><path d="m3.5 15.5 2 2 3.5-4"/><path d="M13 7h7.5M13 16h7.5"/>',
  chef: '<path d="M6.5 14.5a4 4 0 0 1-.4-7.9 6 6 0 0 1 11.8 0 4 4 0 0 1-.4 7.9v5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><path d="M6.5 16.5h11"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/><path d="M12 8v12.5"/><path d="M12 8C10.8 4.3 8.6 3.3 7.4 4.3 6.2 5.4 7.5 8 12 8zM12 8c1.2-3.7 3.4-4.7 4.6-3.7C17.8 5.4 16.5 8 12 8z"/>',
  cat: '<path d="M12 20.5c-4.6 0-8-2.8-8-7 0-1.5.4-2.9 1.1-4L4.6 3.5l4.6 2.7A8.7 8.7 0 0 1 12 5.8c1 0 1.9.1 2.8.4l4.6-2.7-.5 6c.7 1.1 1.1 2.5 1.1 4 0 4.2-3.4 7-8 7z"/><path d="M9 12.5v.5M15 12.5v.5"/><path d="M10.8 15.5h2.4L12 16.8z"/>',
  sliders: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h10M18 17.5h2"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="17.5" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  trash: '<path d="M4 7h16"/><path d="M6 7l1 12.2a1.9 1.9 0 0 0 1.9 1.8h6.2a1.9 1.9 0 0 0 1.9-1.8L18 7"/><path d="M9.5 7V4.5h5V7"/><path d="M10 11v6M14 11v6"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
  heart: '<path d="M12 20s-7.4-4.4-9.1-9.1C1.8 7.6 3.8 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.2 3.1 4.1 6.4C19.4 15.6 12 20 12 20z"/>',
  link: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  repeat: '<path d="M4 11.5A8 8 0 0 1 17.7 6l2.3 2.2"/><path d="M20 3.8v4.6h-4.6"/><path d="M20 12.5A8 8 0 0 1 6.3 18L4 15.8"/><path d="M4 20.2v-4.6h4.6"/>',
  hammer: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bin: '<path d="M5 8h14l-1.3 11.3a2 2 0 0 1-2 1.7H8.3a2 2 0 0 1-2-1.7z"/><path d="M3.5 5.5h17"/><path d="M9.5 5.5 10.2 3h3.6l.7 2.5"/><path d="M10 12l1.2 1.6L14 11"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r=".6" fill="currentColor"/><circle cx="15" cy="15" r=".6" fill="currentColor"/><circle cx="15" cy="9" r=".6" fill="currentColor"/><circle cx="9" cy="15" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  note: '<path d="M5 4h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M15 20v-4a1 1 0 0 1 1-1h4"/><path d="M8 9h8M8 12.5h5"/>',
  paw: '<circle cx="6.5" cy="10.5" r="1.7"/><circle cx="10" cy="6.5" r="1.7"/><circle cx="14.5" cy="6.5" r="1.7"/><circle cx="18" cy="10.5" r="1.7"/><path d="M12.2 11.5c-2.5 0-5 3.4-5 5.9 0 1.6 1.2 2.6 2.7 2.6 1 0 1.5-.6 2.3-.6s1.4.6 2.3.6c1.5 0 2.7-1 2.7-2.6 0-2.5-2.5-5.9-5-5.9z"/>',
  pill: '<path d="M10.2 20.3a4.7 4.7 0 0 1-6.6-6.6l6.1-6.1a4.7 4.7 0 0 1 6.6 6.6z"/><path d="m7 10.5 6.5 6.5"/>',
  syringe: '<path d="m18 2.5 3.5 3.5M16.5 4l3.5 3.5M19 5l-3.5 3.5"/><path d="M15.5 8.5 7 17l-3 .5.5-3L13 6z"/><path d="M4 20l2.5-2.5M10 10l1.5 1.5M8 12l1.5 1.5"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M7.5 10a6 6 0 0 1 9 0l-2.6 2.2a2.5 2.5 0 0 0-3.8 0z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-8A6 6 0 0 0 6.5 12 3.3 3.3 0 0 0 7 18.5z"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  leaf: '<path d="M5 19.5C5 11 10 5 20 4.5 20 14 14.5 19.5 6.5 19.5"/><path d="M5 19.5C8 15.5 11 13 15 11"/>',
  tree: '<path d="M12 3l5 6h-2.5l4 5h-3l3.5 4.5h-14L8.5 14h-3l4-5H7z"/><path d="M12 18.5V21"/>',
  sparkles: '<path d="M10 3.5l1.6 4.4 4.4 1.6-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z"/><path d="M18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z"/>',
  egg: '<path d="M12 3c-3.5 0-6.5 6-6.5 10.5a6.5 6.5 0 0 0 13 0C18.5 9 15.5 3 12 3z"/><path d="M7 12.5l2.5-1.5 2.5 1.5 2.5-1.5 2.5 1.5"/>',
  pumpkin: '<path d="M12 7.2c-.4-2 .4-3.4 2.2-4"/><path d="M12 7.2C7.5 5.6 3.5 8.5 3.5 13.5S7.2 21 12 20.2c4.8.8 8.5-2 8.5-6.7S16.5 5.6 12 7.2z"/><path d="M12 7.2c-2.2 2.4-2.6 9.6 0 13M12 7.2c2.2 2.4 2.6 9.6 0 13"/>',
  cake: '<path d="M4 20.5h16v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16.5c1.4 1 2.6 1 4 0s2.6-1 4 0 2.6 1 4 0 2.6-1 4 0"/><path d="M12 12.5V9M12 6.5c-.9-.9-.9-1.9 0-3 .9 1.1.9 2.1 0 3z"/>',
  bowl: '<path d="M3 11.5h18a9 9 0 0 1-18 0z"/><path d="M8.5 8c0-1.4 1.2-1.6 1.2-3.2M12.5 8c0-1.4 1.2-1.6 1.2-3.2"/>',
  wave: '<path d="M2.5 15c2.2 0 2.2-2 4.4-2s2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2"/><path d="M2.5 19c2.2 0 2.2-2 4.4-2s2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2"/><circle cx="16" cy="7" r="3"/>',
  logout: '<path d="M14.5 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16"/><path d="M14.5 12h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 8h.01"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  shirt: '<path d="M8.5 3.5 4 6l1.5 4.5 2-1V20.5h9V9.5l2 1L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/>',
  drop: '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z"/>',
  vacuum: '<path d="M4 20.5h9"/><path d="M8.5 20.5V8a4.5 4.5 0 0 1 9 0v1"/><rect x="14" y="9" width="7" height="8" rx="2"/><circle cx="17.5" cy="20" r="1"/>',
  bed: '<path d="M3 19.5V6M3 15.5h18v4M21 15.5v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11.5" r="2"/>',
  bath: '<path d="M3 12h18v2.5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M6 12V5.5A2 2 0 0 1 8 3.5c1.2 0 2 .9 2 2"/><path d="M7 19.5 6 21M17 19.5l1 1.5"/>',
  plant: '<path d="M7 14.5h10l-1.2 6H8.2z"/><path d="M12 14.5V9"/><path d="M12 10c0-3.5 2.5-5.5 6-5.5 0 3.5-2.5 5.5-6 5.5zM12 11.5C12 8.8 10 7 7 7c0 2.7 2 4.5 5 4.5z"/>',
  euro: '<path d="M17.5 6.2A7 7 0 0 0 6.5 12a7 7 0 0 0 11 5.8"/><path d="M4 10h9M4 14h9"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 6.5a5.5 5.5 0 0 0-5.5 5.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  film: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17M3.5 15h17M8 4.5V9M16 4.5V9M8 15v4.5M16 15v4.5"/>',
  tv: '<rect x="3" y="5" width="18" height="12.5" rx="2"/><path d="M8 21h8M12 17.5V21"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M20 11.5A8 8 0 0 0 6.3 6L4 8.2"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.5A8 8 0 0 0 17.7 18l2.3-2.2"/><path d="M20 20.2v-4.6h-4.6"/>',
  eiffel: '<path d="M12 2.5v2"/><path d="M10.6 4.5h2.8L15 11H9z"/><path d="M8 11h8M7.6 15h8.8"/><path d="M9 11 5.5 21M15 11l3.5 10"/><path d="M9.3 21a2.7 2.7 0 0 1 5.4 0"/>',
  palm: '<path d="M11 21c.4-4 1.2-8 3-11.5"/><path d="M14 9.5C12.2 6.3 8.7 5.6 5.5 7c3-.1 5.5 1 7 3"/><path d="M14 9.5c1-3.4 4.4-5 7.5-4-3 .4-5 2-6 4"/><path d="M14 9.5c3 0 5.6 2 6 5-1.4-2-3.5-3-6-3"/><path d="M14 9.5c-3-.8-6 .3-7.5 3 2-1.4 4.5-1.9 7-1.4"/><path d="M4 21h16"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M8 10.5H6.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H16"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  pin: '<path d="M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  map: '<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>',
  battery: '<rect x="3" y="7.5" width="16" height="9" rx="2.2"/><path d="M21 10.5v3"/><path d="M6 10.5v3M9 10.5v3"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.2"/><path d="M9 7.5V5.8A1.3 1.3 0 0 1 10.3 4.5h3.4A1.3 1.3 0 0 1 15 5.8v1.7"/><path d="M3.5 12.5h17"/>',
  sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.6"/><path d="M9.5 4.5v15"/><path d="M5.8 8.5h1.5M5.8 11.5h1.5"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/>',
  prev: '<path d="M18 6.2v11.6L9.8 12z"/><path d="M6.5 6v12"/>',
  next: '<path d="M6 6.2v11.6l8.2-5.8z"/><path d="M17.5 6v12"/>',
  shuffle: '<path d="M3.5 7.5h2.8c1.9 0 3.1.9 4.1 2.4l2.2 3.4c1 1.5 2.2 2.2 4.1 2.2h3.3"/><path d="M3.5 16.5h2.8c1.3 0 2.2-.4 3-1.1M13.4 8.6c.8-.7 1.7-1.1 3.1-1.1h3.5"/><path d="M17.5 5 20 7.5 17.5 10M17.5 13 20 15.5 17.5 18"/>',
  volume: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4"/>',
  speaker: '<rect x="6" y="3" width="12" height="18" rx="6"/><circle cx="12" cy="14.2" r="2.6"/><path d="M10.6 7.6h2.8"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.8 18.5h2.4"/>',
  tablet: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.4"/><path d="M10.8 18.5h2.4"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10.5" rx="1.6"/><path d="M2.5 19h19"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.5"/>',
};

/** Il disegno "nudo" di un'icona (per ridisegnarla altrove, es. sulla mappa). */
export const iconMarkup = (name) => P[name] || '';

export function icon(name, cls = '') {
  return raw(`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.info}</svg>`);
}

// Musetto di gatto colorpoint (Thor & Minù sono dei bei "point" pelosi)
export function catFace(variant = 'a') {
  const mask = variant === 'b' ? '#7A6150' : '#5E4A3C';
  const eye = '#7FA8C4';
  return raw(`<svg class="cat-face" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 26 8 6l16 10a28 28 0 0 1 16 0L56 6l-2 20c2 4 3 7 3 11 0 13-11 21-25 21S7 50 7 37c0-4 1-7 3-11z" fill="#F3EADF" stroke="#D9C9B6" stroke-width="1.5"/>
    <path d="M12 10l9 7-8 5zM52 10l-9 7 8 5z" fill="${mask}" opacity=".55"/>
    <ellipse cx="32" cy="41" rx="12" ry="10" fill="${mask}" opacity=".5"/>
    <ellipse cx="23" cy="33" rx="4" ry="4.4" fill="${eye}"/><ellipse cx="41" cy="33" rx="4" ry="4.4" fill="${eye}"/>
    <ellipse cx="23" cy="33.4" rx="1.4" ry="3" fill="#1F2A33"/><ellipse cx="41" cy="33.4" rx="1.4" ry="3" fill="#1F2A33"/>
    <path d="M29.5 41h5L32 44z" fill="#C98F86"/>
    <path d="M32 44v2.5m0 0c-1.5 1.8-3.5 1.8-5 .6m5-.6c1.5 1.8 3.5 1.8 5 .6" stroke="#4A3A2E" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  </svg>`);
}
