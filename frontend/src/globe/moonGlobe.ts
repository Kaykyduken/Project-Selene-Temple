// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Lua em 3D do modo Educational: uma esfera com a textura oficial da NASA
// (CGI Moon Kit, dados da LRO) e um marcador em cada região candidata.
// O usuário gira com o mouse, aproxima com a rolagem e clica num marcador
// para abrir o mesmo painel que a lista e o mapa abrem.
//
// O Three.js só é baixado quando o usuário abre a Lua 3D (import dinâmico),
// para o site continuar abrindo rápido.

import type { SiteSummary } from '../data/contract';
import { t } from '../i18n';

/** Ponto extra na Lua 3D (marco histórico): só precisa de id, nome e posição. */
export interface GlobePoint {
  id: string;
  name: string;
  lat_deg: number;
  lon_deg: number;
}

type Three = typeof import('three');
type OrbitControlsClass = typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;

const TEXTURE_URL = `${import.meta.env.BASE_URL}data/globe/moon_globe_4k.jpg`;
const CREDIT = t("Moon color map: NASA's Scientific Visualization Studio (CGI Moon Kit, LRO/LROC data). South polar detail: LROC WAC mosaic, NASA/GSFC/Arizona State University");
const MARKER_COLOR = 0xf0a030; // laranja, igual aos marcadores do mapa
const SELECTED_COLOR = 0xffffff;
const LANDMARK_COLOR = 0x3fd0c9; // verde-água: marcos históricos (pousos Apollo)
const START_DISTANCE = 3.0; // raio da Lua = 1
const LANDMARK_ZOOM_DISTANCE = 1.75; // distância da câmera ao abrir um marco histórico (zoom)
const DEM_EDGE_LAT_DEG = -80; // o modelo de relevo cobre de 80°S até o polo

export class MoonGlobe {
  private readonly renderer: import('three').WebGLRenderer;
  private readonly scene: import('three').Scene;
  private readonly camera: import('three').PerspectiveCamera;
  private readonly controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
  private readonly sphere: import('three').Mesh;
  private readonly raycaster: import('three').Raycaster;
  private readonly markers = new Map<string, import('three').Mesh>();
  private readonly hitAreas: import('three').Mesh[] = [];
  private readonly baseColor = new Map<string, number>(); // cor normal de cada marcador
  private readonly tooltip: HTMLDivElement;
  private focusDirection: import('three').Vector3 | null = null;
  private focusDistance: number | null = null; // zoom pedido junto com o giro (só nos marcos)
  private readonly photoCard: HTMLDivElement; // foto oficial presa ao marco, na Lua
  private readonly photos = new Map<string, { url: string; title: string }>(); // foto de cada marco já carregada
  private shownPhoto: string | null = null; // marco cuja foto está no cartão agora
  private hoverLandmark: string | null = null; // marco sob o mouse (sem clicar)
  /** Avisado quando o mouse passa sobre um marco, para o site buscar a foto dele. */
  onLandmarkHover: (id: string) => void = () => {};
  /** Clique que não acertou nenhum marco nem região (Lua vazia ou espaço). */
  onBackgroundClick: () => void = () => {};
  private arrived = false; // o giro + zoom até o marco já terminou?
  private selectedId: string | null = null;
  private running = false;
  private frame = 0;
  private downX = 0;
  private downY = 0;

  private constructor(
    private readonly T: Three,
    OrbitControls: OrbitControlsClass,
    private readonly container: HTMLElement,
    private readonly sites: SiteSummary[],
    private readonly onSelect: (site: SiteSummary) => void,
    texture: import('three').Texture,
    private readonly landmarks: GlobePoint[],
    private readonly onLandmark: (id: string) => void,
  ) {
    const { T: three } = this;

    this.renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    texture.colorSpace = three.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new three.Scene();
    this.camera = new three.PerspectiveCamera(40, 1, 0.1, 50);
    this.camera.position.copy(this.toVector(-60, 20, START_DISTANCE));

    // MeshBasicMaterial: sem iluminação, para a Lua inteira ficar visível.
    // (A posição real do Sol é assunto dos gráficos do painel, não desta vista.)
    this.sphere = new three.Mesh(
      new three.SphereGeometry(1, 96, 64),
      new three.MeshBasicMaterial({ map: texture }),
    );
    this.scene.add(this.sphere);

    // Anel vermelho em 80°S: de lá até o polo temos o modelo de relevo (LOLA).
    const ringPoints: import('three').Vector3[] = [];
    for (let lon = 0; lon <= 360; lon += 2) ringPoints.push(this.toVector(DEM_EDGE_LAT_DEG, lon, 1.003));
    this.scene.add(
      new three.LineLoop(
        new three.BufferGeometry().setFromPoints(ringPoints),
        new three.LineBasicMaterial({ color: 0xff4d4d }),
      ),
    );

    // Um marcador visível (pequeno) e uma área de clique invisível (maior) por região.
    for (const site of sites) {
      const position = this.toVector(site.lat_deg, site.lon_deg, 1.012);
      const dot = new three.Mesh(new three.SphereGeometry(0.014, 16, 12), new three.MeshBasicMaterial({ color: MARKER_COLOR }));
      dot.position.copy(position);
      this.scene.add(dot);
      this.markers.set(site.id, dot);

      const hit = new three.Mesh(new three.SphereGeometry(0.03, 8, 6), new three.MeshBasicMaterial({ visible: false }));
      hit.position.copy(position);
      hit.userData.siteId = site.id;
      this.scene.add(hit);
      this.hitAreas.push(hit);
    }

    // Marcos históricos: mesmo esquema, em outra cor e em forma de losango.
    for (const mark of landmarks) {
      const position = this.toVector(mark.lat_deg, mark.lon_deg, 1.014);
      const dot = new three.Mesh(new three.OctahedronGeometry(0.02), new three.MeshBasicMaterial({ color: LANDMARK_COLOR }));
      dot.position.copy(position);
      this.scene.add(dot);
      this.markers.set(mark.id, dot);
      this.baseColor.set(mark.id, LANDMARK_COLOR);

      const hit = new three.Mesh(new three.SphereGeometry(0.035, 8, 6), new three.MeshBasicMaterial({ visible: false }));
      hit.position.copy(position);
      hit.userData.landmarkId = mark.id;
      this.scene.add(hit);
      this.hitAreas.push(hit);
    }

    this.raycaster = new three.Raycaster();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.35;
    this.controls.maxDistance = 6;
    this.controls.rotateSpeed = 0.6;

    // Textos sobre a vista: instrução, crédito da imagem e etiqueta ao passar o mouse.
    const hint = document.createElement('div');
    hint.className = 'globe-hint';
    const hintLine = (className: string, text: string): HTMLElement => {
      const line = document.createElement('div');
      line.className = className;
      line.textContent = text;
      return line;
    };
    hint.append(
      hintLine('', t('Drag to rotate · scroll to zoom · click a marker')),
      hintLine('globe-landmark', t('◆ Apollo landing sites (historic landmarks)')),
      hintLine('globe-ring', t('Red ring: 80°S. Custom points can be analysed only inside it.')),
    );
    const credit = document.createElement('div');
    credit.className = 'globe-credit';
    credit.textContent = CREDIT;
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'globe-tooltip';
    this.tooltip.hidden = true;
    this.photoCard = document.createElement('div');
    this.photoCard.className = 'globe-photo';
    this.photoCard.hidden = true;
    container.replaceChildren(this.renderer.domElement, hint, credit, this.photoCard, this.tooltip);

    // Clique x arrasto: só conta como clique se o mouse quase não saiu do lugar.
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      this.downX = e.clientX;
      this.downY = e.clientY;
    });
    canvas.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 5) return;
      const id = this.pick(e);
      const site = this.sites.find((s) => s.id === id);
      if (site) this.onSelect(site);
      else if (id && this.landmarks.some((m) => m.id === id)) this.onLandmark(id);
      else this.onBackgroundClick();
    });
    canvas.addEventListener('pointermove', (e) => this.showTooltip(e));
    canvas.addEventListener('pointerleave', () => {
      this.tooltip.hidden = true;
      this.hoverLandmark = null;
    });

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** Baixa o Three.js e a textura e monta a Lua. Chamar com o contêiner já visível. */
  static async create(
    container: HTMLElement,
    sites: SiteSummary[],
    onSelect: (site: SiteSummary) => void,
    landmarks: GlobePoint[] = [],
    onLandmark: (id: string) => void = () => {},
  ): Promise<MoonGlobe> {
    const [T, controlsModule] = await Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]);
    const texture = await new T.TextureLoader().loadAsync(TEXTURE_URL);
    return new MoonGlobe(T, controlsModule.OrbitControls, container, sites, onSelect, texture, landmarks, onLandmark);
  }

  /**
   * Latitude/longitude (graus, leste positivo) → ponto na esfera.
   * A textura tem a longitude 0° no centro e o leste à direita; no Three.js isso
   * dá x = cos(lat)·cos(lon), y = sin(lat), z = −cos(lat)·sin(lon).
   */
  private toVector(latDeg: number, lonDeg: number, radius: number): import('three').Vector3 {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    return new this.T.Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), -radius * Math.cos(lat) * Math.sin(lon));
  }

  /** Qual região está sob o ponteiro (ou null). A esfera entra na conta para esconder marcadores do outro lado. */
  private pick(event: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new this.T.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const first = this.raycaster.intersectObjects([this.sphere, ...this.hitAreas])[0];
    const data = first?.object.userData;
    return (data?.siteId as string | undefined) ?? (data?.landmarkId as string | undefined) ?? null;
  }

  private showTooltip(event: PointerEvent): void {
    const id = this.pick(event);
    const site = this.sites.find((s) => s.id === id) ?? this.landmarks.find((m) => m.id === id);
    this.renderer.domElement.style.cursor = site ? 'pointer' : 'grab';
    const overLandmark = id && this.landmarks.some((m) => m.id === id) ? id : null;
    if (overLandmark && overLandmark !== this.hoverLandmark) this.onLandmarkHover(overLandmark);
    this.hoverLandmark = overLandmark;
    if (!site) {
      this.tooltip.hidden = true;
      return;
    }
    const rect = this.container.getBoundingClientRect();
    this.tooltip.textContent = site.name;
    this.tooltip.style.left = `${event.clientX - rect.left + 12}px`;
    this.tooltip.style.top = `${event.clientY - rect.top + 12}px`;
    this.tooltip.hidden = false;
  }

  /** Destaca uma região ou um marco (ou nada) e gira a Lua suavemente até ele. */
  highlight(id: string | null): void {
    if (this.selectedId) this.paint(this.selectedId, this.baseColor.get(this.selectedId) ?? MARKER_COLOR, 1);
    this.selectedId = id;
    this.arrived = false;
    this.focusDistance = null;
    const site = this.sites.find((s) => s.id === id);
    if (site) {
      this.paint(site.id, SELECTED_COLOR, 2);
      // A câmera mira de uma latitude de −70° na mesma longitude: a região fica visível
      // perto da borda de baixo, sem ficar exatamente sobre o polo (onde o controle gira mal).
      this.focusDirection = this.toVector(-70, site.lon_deg, 1).normalize();
      return;
    }
    const mark = this.landmarks.find((m) => m.id === id);
    if (mark) {
      this.paint(mark.id, SELECTED_COLOR, 0.8); // menor: a câmera fica bem perto
      // Gira até o marco ficar no centro da vista e aproxima a câmera (zoom) ao mesmo tempo.
      this.focusDirection = this.toVector(mark.lat_deg, mark.lon_deg, 1).normalize();
      this.focusDistance = LANDMARK_ZOOM_DISTANCE;
    }
  }

  private paint(id: string, color: number, scale: number): void {
    const marker = this.markers.get(id);
    if (!marker) return;
    (marker.material as import('three').MeshBasicMaterial).color.setHex(color);
    marker.scale.setScalar(scale);
  }

  /**
   * Foto oficial do evento (acervo da NASA) para mostrar sobre a Lua, presa ao marco.
   * Ela só aparece quando o giro + zoom até o marco termina.
   */
  setLandmarkPhoto(id: string, url: string, title: string): void {
    this.photos.set(id, { url, title });
  }

  /** Aproxima a direção (giro) e a distância (zoom) da câmera do alvo, um pouco a cada quadro. */
  private stepFocus(): void {
    if (!this.focusDirection) return;
    const distance = this.camera.position.length();
    const target = this.focusDistance ?? distance;
    const current = this.camera.position.clone().normalize();
    if (current.angleTo(this.focusDirection) < 0.003 && Math.abs(distance - target) < 0.01) {
      this.focusDirection = null;
      this.focusDistance = null;
      this.arrived = true;
      return;
    }
    const next = distance + (target - distance) * 0.06;
    this.camera.position.copy(current.lerp(this.focusDirection, 0.08).normalize().multiplyScalar(next));
  }

  /** Mantém a foto ao lado do marco na tela; esconde se o marco for para o outro lado da Lua. */
  private placePhoto(): void {
    // Qual marco mostra a foto: o que está sob o mouse; senão, o selecionado (depois do zoom).
    const selected = this.selectedId && this.arrived && this.photos.has(this.selectedId) ? this.selectedId : null;
    const target = this.hoverLandmark && this.photos.has(this.hoverLandmark) ? this.hoverLandmark : selected;
    const marker = target ? this.markers.get(target) : null;
    if (!target || !marker) {
      this.photoCard.hidden = true;
      return;
    }
    if (target !== this.shownPhoto) {
      const photo = this.photos.get(target)!;
      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = photo.title;
      const caption = document.createElement('span');
      caption.textContent = `${photo.title} · NASA`;
      this.photoCard.replaceChildren(image, caption);
      this.shownPhoto = target;
    }
    const cameraDistance = this.camera.position.length();
    const facing = marker.position.clone().normalize().dot(this.camera.position.clone().normalize());
    if (facing < 1 / cameraDistance + 0.05) {
      this.photoCard.hidden = true; // marco atrás do horizonte da Lua
      return;
    }
    const screen = marker.position.clone().project(this.camera);
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const x = ((screen.x + 1) / 2) * width;
    const y = ((1 - screen.y) / 2) * height;
    this.photoCard.hidden = false;
    const cardWidth = this.photoCard.offsetWidth;
    const cardHeight = this.photoCard.offsetHeight;
    // À direita e acima do marco, sem sair da área da Lua 3D.
    this.photoCard.style.left = `${Math.min(Math.max(x + 18, 8), width - cardWidth - 8)}px`;
    this.photoCard.style.top = `${Math.min(Math.max(y - cardHeight - 18, 8), height - cardHeight - 8)}px`;
  }

  /** Ajusta o tamanho do desenho ao do contêiner. */
  resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return; // contêiner escondido
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Liga o desenho contínuo (só enquanto a Lua 3D está na tela). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = (): void => {
      if (!this.running) return;
      this.frame = requestAnimationFrame(loop);
      this.stepFocus();
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.placePhoto();
    };
    loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}
