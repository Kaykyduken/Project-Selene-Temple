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

type Three = typeof import('three');
type OrbitControlsClass = typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;

const TEXTURE_URL = `${import.meta.env.BASE_URL}data/globe/moon_globe_4k.jpg`;
const CREDIT = "Moon color map: NASA's Scientific Visualization Studio (CGI Moon Kit, LRO/LROC data). South polar detail: LROC WAC mosaic, NASA/GSFC/Arizona State University";
const MARKER_COLOR = 0xf0a030; // laranja, igual aos marcadores do mapa
const SELECTED_COLOR = 0xffffff;
const START_DISTANCE = 3.0; // raio da Lua = 1
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
  private readonly tooltip: HTMLDivElement;
  private focusDirection: import('three').Vector3 | null = null;
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
    hint.innerHTML = 'Drag to rotate · scroll to zoom · click an orange marker<br><span class="globe-ring">Red ring: 80°S. Custom points can be analysed only inside it.</span>';
    const credit = document.createElement('div');
    credit.className = 'globe-credit';
    credit.textContent = CREDIT;
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'globe-tooltip';
    this.tooltip.hidden = true;
    container.replaceChildren(this.renderer.domElement, hint, credit, this.tooltip);

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
    });
    canvas.addEventListener('pointermove', (e) => this.showTooltip(e));
    canvas.addEventListener('pointerleave', () => (this.tooltip.hidden = true));

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** Baixa o Three.js e a textura e monta a Lua. Chamar com o contêiner já visível. */
  static async create(container: HTMLElement, sites: SiteSummary[], onSelect: (site: SiteSummary) => void): Promise<MoonGlobe> {
    const [T, controlsModule] = await Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]);
    const texture = await new T.TextureLoader().loadAsync(TEXTURE_URL);
    return new MoonGlobe(T, controlsModule.OrbitControls, container, sites, onSelect, texture);
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
    return (first?.object.userData.siteId as string | undefined) ?? null;
  }

  private showTooltip(event: PointerEvent): void {
    const id = this.pick(event);
    const site = this.sites.find((s) => s.id === id);
    this.renderer.domElement.style.cursor = site ? 'pointer' : 'grab';
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

  /** Destaca uma região (ou nenhuma) e gira a Lua suavemente até ela. */
  highlight(id: string | null): void {
    if (this.selectedId) this.paint(this.selectedId, MARKER_COLOR, 1);
    this.selectedId = id;
    const site = this.sites.find((s) => s.id === id);
    if (!site) return;
    this.paint(site.id, SELECTED_COLOR, 2);
    // A câmera mira de uma latitude de −70° na mesma longitude: a região fica visível
    // perto da borda de baixo, sem ficar exatamente sobre o polo (onde o controle gira mal).
    this.focusDirection = this.toVector(-70, site.lon_deg, 1).normalize();
  }

  private paint(id: string, color: number, scale: number): void {
    const marker = this.markers.get(id);
    if (!marker) return;
    (marker.material as import('three').MeshBasicMaterial).color.setHex(color);
    marker.scale.setScalar(scale);
  }

  /** Aproxima a direção da câmera da direção pedida, um pouco a cada quadro. */
  private stepFocus(): void {
    if (!this.focusDirection) return;
    const distance = this.camera.position.length();
    const current = this.camera.position.clone().normalize();
    if (current.angleTo(this.focusDirection) < 0.003) {
      this.focusDirection = null;
      return;
    }
    this.camera.position.copy(current.lerp(this.focusDirection, 0.08).normalize().multiplyScalar(distance));
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
    };
    loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}
