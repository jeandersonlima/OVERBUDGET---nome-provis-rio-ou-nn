/**
 * Loads and caches generated pixel-art sprites through Astrocade's asset map.
 * Image work is done once during startup, never inside the render loop.
 */
const ART_IDS = [
  'hangar_background',
  'engine_standard', 'engine_advanced',
  'fuselage_standard', 'fuselage_advanced',
  'avionics_standard', 'avionics_advanced',
  'satellite_standard', 'satellite_advanced',
  'rover_standard', 'rover_advanced',
  'lab_propulsion', 'lab_avionics', 'lab_structure', 'lab_payload', 'lab_satellite',
  'launch_flame', 'launch_spark',
  'guide_calm', 'guide_worried', 'guide_panic', 'guide_happy',
  'surface_map_topdown', 'rover_map_scanner', 'rover_map_drill',
  'ice_crystal_topdown', 'rock_cluster_topdown', 'crater_topdown', 'relay_beacon_topdown',
  'title_background_ober', 'title_rocket_ober'
];

const LOCAL_ART_FILES = {
  hangar_background: 'WhatsApp Image 2026-11-15 at 17.18.48.jpeg',
  engine_standard: 'WhatsApp Image 2026-11-15 at 17.18.55.jpeg',
  engine_advanced: 'WhatsApp Image 2026-11-15 at 17.19.01.jpeg',
  fuselage_standard: 'WhatsApp Image 2026-11-15 at 17.19.05.jpeg',
  fuselage_advanced: 'WhatsApp Image 2026-11-15 at 17.19.10.jpeg',
  avionics_standard: 'WhatsApp Image 2026-11-15 at 17.19.15.jpeg',
  avionics_advanced: 'WhatsApp Image 2026-11-15 at 17.19.20.jpeg',
  satellite_standard: 'WhatsApp Image 2026-11-15 at 17.19.27.jpeg',
  satellite_advanced: 'WhatsApp Image 2026-11-15 at 17.21.57.jpeg',
  rover_standard: 'WhatsApp Image 2026-11-15 at 17.21.35.jpeg',
  rover_advanced: 'WhatsApp Image 2026-11-15 at 17.21.11.jpeg',
  lab_payload: 'WhatsApp Image 2026-11-15 at 17.20.51.jpeg',
  lab_satellite: 'WhatsApp Image 2026-11-15 at 17.20.45.jpeg',
  launch_flame: 'WhatsApp Image 2026-11-15 at 17.20.41.jpeg',
  launch_spark: 'WhatsApp Image 2026-11-15 at 17.20.21.jpeg',
  guide_calm: 'WhatsApp Image 2026-11-15 at 17.23.41.jpeg',
  guide_worried: 'WhatsApp Image 2026-11-15 at 17.24.12.jpeg',
  guide_panic: 'WhatsApp Image 2026-11-15 at 17.24.17.jpeg',
  guide_happy: 'WhatsApp Image 2026-11-15 at 17.24.22.jpeg',
  surface_map_topdown: 'WhatsApp Image 2026-11-15 at 17.24.46.jpeg',
  rover_map_scanner: 'WhatsApp Image 2026-11-15 at 17.24.51.jpeg',
  rover_map_drill: 'WhatsApp Image 2026-11-15 at 17.24.55.jpeg',
  ice_crystal_topdown: 'WhatsApp Image 2026-11-15 at 17.25.14.jpeg',
  rock_cluster_topdown: 'WhatsApp Image 2026-11-15 at 17.25.17.jpeg',
  crater_topdown: 'WhatsApp Image 2026-11-15 at 17.25.23.jpeg',
  relay_beacon_topdown: 'WhatsApp Image 2026-11-15 at 17.23.37.jpeg',
  title_background_ober: 'WhatsApp Image 2026-11-15 at 17.23.00.jpeg',
  title_rocket_ober: 'WhatsApp Image 2026-11-15 at 17.25.41.jpeg'
};

const FULL_FRAME_ART = new Set([
  'hangar_background',
  'surface_map_topdown',
  'title_background_ober'
]);

let cachedArtPromise = null;

function makeFallbackSvg(id) {
  const advanced = id.endsWith('_advanced');
  const accent = advanced ? '#f5bd55' : '#63d8ee';
  const dark = advanced ? '#713d28' : '#17445c';
  const metal = advanced ? '#d6a64c' : '#c5d8df';
  let content = '';
  let width = 220;
  let height = 260;

  if (id === 'title_rocket_ober') {
    width = 520;
    height = 240;
    content = `
      <path d="M24 128h84" stroke="#ff9d55" stroke-width="24" stroke-linecap="round" opacity=".8"/>
      <path d="M24 128h88" stroke="#fff0a7" stroke-width="7" stroke-linecap="round"/>
      <path d="M112 87h211l105 41-105 41H112z" fill="${metal}" stroke="#eaf7f8" stroke-width="6"/>
      <path d="M323 87l105 41-105 41z" fill="${accent}"/>
      <path d="M153 87l-43-48h76l43 48m94 82 43 48h-76l-43-48" fill="${dark}" stroke="${accent}" stroke-width="6"/>
      <path d="M214 87l-20-32h42l28 32m-70 82-22 33h45l30-33" fill="#8099a6"/>
      <rect x="245" y="101" width="48" height="54" rx="18" fill="#15334c" stroke="${accent}" stroke-width="6"/>
      <circle cx="269" cy="128" r="13" fill="#b9f4f4"/>
      <path d="M128 111h46v34h-46z" fill="${dark}"/>
      <path d="M350 108l26 20-26 20" fill="none" stroke="#fff1ba" stroke-width="5"/>
      <circle cx="457" cy="55" r="4" fill="#d5faff"/><circle cx="480" cy="192" r="3" fill="#d5faff"/>
    `;
  } else if (id === 'hangar_background' || id === 'title_background_ober') {
    width = 720;
    height = 1280;
    content = `
      <defs><linearGradient id="space" x2="0" y2="1"><stop stop-color="#091427"/><stop offset="1" stop-color="#101829"/></linearGradient></defs>
      <path fill="url(#space)" d="M0 0h720v1280H0z"/>
      <circle cx="552" cy="324" r="190" fill="#172c43" stroke="#34516a" stroke-width="3"/>
      <circle cx="552" cy="324" r="162" fill="#1d3448"/>
      <path d="M380 372q130-108 342-62v185H390z" fill="#111f32"/>
      <path d="M0 558h720v84H0z" fill="#172333"/>
      <path d="M75 558v-125h50v125m62 0V390h55v168m430 0V420h38v138" fill="#182a3d" stroke="#35516a" stroke-width="4"/>
      <path d="M0 642h720" stroke="#51c5dd" stroke-width="3" opacity=".7"/>
      <g fill="#c6edf5" opacity=".8"><circle cx="86" cy="104" r="3"/><circle cx="246" cy="202" r="2"/><circle cx="655" cy="97" r="3"/><circle cx="412" cy="165" r="2"/><circle cx="330" cy="64" r="2"/></g>
    `;
  } else if (id.startsWith('lab_')) {
    width = 220;
    height = 220;
    const lab = id.slice(4);
    const details = {
      propulsion: '<path d="M92 72h36v62l17 30H75l17-30z" fill="#c8dce2" stroke="#f1fbff" stroke-width="4"/><path d="M87 164l14 28h20l12-28" fill="#f59049"/><path d="M99 100h22v28H99z" fill="#17435b"/>',
      avionics: '<rect x="67" y="68" width="86" height="105" rx="10" fill="#244c63" stroke="#d7f5f7" stroke-width="4"/><rect x="81" y="82" width="58" height="34" rx="4" fill="#092334" stroke="#61dbe8" stroke-width="3"/><path d="M90 100h12m8 0h22M84 135h50m-50 13h36" stroke="#64e0c3" stroke-width="4"/><path d="M110 68V42m0 0-17-12m17 12 17-12" stroke="#a9d8e2" stroke-width="4"/>',
      structure: '<path d="M110 50 161 82v66l-51 30-51-30V82z" fill="#647b8a" stroke="#e5f1f3" stroke-width="4"/><path d="M110 50v128m-51-96 102 66m0-66-102 66" stroke="#d4b768" stroke-width="5"/><circle cx="110" cy="114" r="15" fill="#17344a"/>',
      payload: '<path d="M61 139h101l-12-43H78z" fill="#466a79" stroke="#d9edf0" stroke-width="4"/><circle cx="83" cy="154" r="15" fill="#111e2a" stroke="#d4b768" stroke-width="6"/><circle cx="141" cy="154" r="15" fill="#111e2a" stroke="#d4b768" stroke-width="6"/><path d="m93 96 24-23 23 23m-23-23V58" fill="none" stroke="#63d8ee" stroke-width="5"/><circle cx="117" cy="53" r="8" fill="#f5bd55"/>',
      satellite: '<path d="M94 91h32v48H94z" fill="#c9dce1" stroke="#f3fbff" stroke-width="4"/><path d="M94 100H45v30h49m32-30h49v30h-49" fill="#17445c" stroke="#62d9ec" stroke-width="4"/><path d="M56 100v30m13-30v30m13-30v30m13-30v30m24-30v30m13-30v30m13-30v30m13-30v30" stroke="#8ee5ee" stroke-width="2"/><path d="M110 91V60m-12 0h24" stroke="#f4c769" stroke-width="4"/>'
    };
    content = `<circle cx="110" cy="110" r="94" fill="#10243a" stroke="${accent}" stroke-width="4"/><path d="M24 182h172" stroke="#426178" stroke-width="4"/>${details[lab] || ''}<circle cx="42" cy="48" r="4" fill="#d7f7ff"/><circle cx="178" cy="51" r="3" fill="#d7f7ff"/>`;
  } else if (/^(engine|avionics|fuselage|satellite|rover)_/.test(id)) {
    const family = id.split('_')[0];
    if (family === 'engine') {
      content = `<path d="M75 35h70v100l28 51-20 27H67l-20-27 28-51z" fill="${metal}" stroke="#effaff" stroke-width="6"/><path d="M86 57h48v58H86z" fill="${dark}" stroke="${accent}" stroke-width="5"/><path d="M68 162h84l20 24-20 18H68l-20-18z" fill="${dark}" stroke="${accent}" stroke-width="5"/><path d="M87 205l23 37 23-37" fill="#ff9850"/><path d="M97 207l13 22 13-22" fill="#fff1ad"/>`;
    } else if (family === 'avionics') {
      content = `<path d="M65 45h90v154H65z" rx="12" fill="${dark}" stroke="${metal}" stroke-width="6"/><rect x="79" y="63" width="62" height="48" rx="5" fill="#071729" stroke="${accent}" stroke-width="4"/><path d="M88 86h15m8 0h20M82 130h56m-56 17h42m-42 17h50" stroke="${accent}" stroke-width="5"/><path d="M110 45V20m-14 0h28" stroke="${metal}" stroke-width="5"/>`;
    } else if (family === 'fuselage') {
      content = `<path d="M110 22 159 75v112l-49 47-49-47V75z" fill="${metal}" stroke="#f3fbff" stroke-width="6"/><path d="M72 79h76v97H72z" fill="${dark}" stroke="${accent}" stroke-width="5"/><path d="M79 102h62m-62 24h62m-62 24h62" stroke="${metal}" stroke-width="5"/><circle cx="110" cy="66" r="12" fill="${accent}"/>`;
    } else if (family === 'satellite') {
      content = `<path d="M87 86h46v78H87z" fill="${metal}" stroke="#effaff" stroke-width="5"/><path d="M87 97H27v56h60m46-56h60v56h-60" fill="${dark}" stroke="${accent}" stroke-width="5"/><path d="M39 97v56m14-56v56m14-56v56m46-56v56m14-56v56m14-56v56m14-56v56m14-56v56" stroke="#9de9f0" stroke-width="3"/><path d="M110 86V54m-15 0h30" stroke="${metal}" stroke-width="5"/>`;
    } else {
      content = `<path d="M46 142h126l-15-58H65z" fill="${metal}" stroke="#effaff" stroke-width="5"/><circle cx="76" cy="165" r="21" fill="#111d2a" stroke="${accent}" stroke-width="7"/><circle cx="148" cy="165" r="21" fill="#111d2a" stroke="${accent}" stroke-width="7"/><path d="m91 84 19-30 20 30m-20-30V36" fill="none" stroke="${accent}" stroke-width="6"/><circle cx="110" cy="32" r="9" fill="${metal}"/><path d="M92 110h37m-18-17v34" stroke="${dark}" stroke-width="5"/>`;
    }
  } else {
    return null;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadOneImage(url, removeBackground = false) {
  return new Promise((resolve) => {
    if (!url || typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (!removeBackground) {
        resolve(image);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        resolve(image);
        return;
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const corners = [
        0,
        (canvas.width - 1) * 4,
        (canvas.height - 1) * canvas.width * 4,
        (canvas.height * canvas.width - 1) * 4
      ];
      const darkCorners = corners.filter((offset) => Math.max(
        pixels.data[offset],
        pixels.data[offset + 1],
        pixels.data[offset + 2]
      ) < 48).length;
      const lightCorners = corners.filter((offset) => Math.min(
        pixels.data[offset],
        pixels.data[offset + 1],
        pixels.data[offset + 2]
      ) > 232).length;
      const background = darkCorners >= 3 ? 'dark' : lightCorners >= 3 ? 'light' : null;
      if (!background) {
        resolve(image);
        return;
      }

      for (let offset = 0; offset < pixels.data.length; offset += 4) {
        const red = pixels.data[offset];
        const green = pixels.data[offset + 1];
        const blue = pixels.data[offset + 2];
        const distance = background === 'dark'
          ? Math.max(red, green, blue)
          : 255 - Math.min(red, green, blue);
        if (distance < 48) pixels.data[offset + 3] = 0;
        else if (distance < 88) pixels.data[offset + 3] = Math.round((distance - 48) / 40 * 255);
      }
      context.putImageData(pixels, 0, 0);

      const cutout = new Image();
      cutout.onload = () => resolve(cutout);
      cutout.onerror = () => resolve(image);
      cutout.src = canvas.toDataURL('image/png');
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export function loadGameArt(getAsset) {
  if (!cachedArtPromise) {
    cachedArtPromise = Promise.all(ART_IDS.map(async (id) => {
      let entry;
      try {
        entry = typeof getAsset === 'function' ? getAsset(id) : null;
      } catch {
        entry = null;
      }
      const localFile = LOCAL_ART_FILES[id];
      const localUrl = localFile ? `./assets.jogo/${encodeURIComponent(localFile).replace(/%2F/g, '/')}` : null;
      const useLocalAsset = Boolean(localFile);
      const source = localUrl || entry?.url || makeFallbackSvg(id);
      const image = await loadOneImage(source, Boolean(useLocalAsset && !FULL_FRAME_ART.has(id)));
      return [id, image];
    })).then((entries) => Object.fromEntries(entries));
  }
  return cachedArtPromise;
}
