import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { DeteccionFacial, FacialService } from '../../../services/facial';

type Estado = 'iniciando' | 'sin-https' | 'sin-camara' | 'permiso-denegado' | 'error'
  | 'buscando' | 'vivacidad' | 'capturando' | 'listo' | 'tiempo-agotado';

/**
 * Camara con reconocimiento facial. Detecta el rostro, comprueba que sea una persona real (parpadeo)
 * y emite los descriptores capturados: 1 para marcar, varios para registrar el rostro.
 *
 * <app-camara-facial [muestras]="1" (capturado)="..." />
 */
@Component({
  selector: 'app-camara-facial',
  standalone: true,
  template: `
    <div class="space-y-3">
      <div class="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl bg-stone-900">
        <video #video class="h-full w-full -scale-x-100 object-cover" autoplay muted playsinline></video>
        <canvas #lienzo class="pointer-events-none absolute inset-0 h-full w-full"></canvas>

        @if (estado === 'iniciando') {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-200">
            <span class="spinner border-stone-600! border-t-white!"></span>
            <p class="text-sm">{{ mensaje }}</p>
          </div>
        }
        @if (estado === 'listo') {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-900/70 text-white">
            <i class="bi bi-check-circle-fill text-5xl"></i>
            <p class="font-medium">Rostro capturado</p>
          </div>
        }
      </div>

      @if (esError) {
        <div class="alert-danger">
          <i class="bi bi-camera-video-off text-lg"></i>
          <div>
            <p class="font-semibold">{{ tituloError }}</p>
            <p>{{ mensaje }}</p>
            @if (estado !== 'sin-https') {
              <button type="button" class="btn-secondary btn-sm mt-3" (click)="reintentar()">
                <i class="bi bi-arrow-clockwise"></i> Intentar de nuevo
              </button>
            }
          </div>
        </div>
      } @else if (estado !== 'iniciando') {
        <div class="flex items-center gap-3 rounded-lg bg-stone-50 px-4 py-3 text-sm">
          @if (estado === 'listo') {
            <i class="bi bi-check-circle-fill text-emerald-600"></i>
          } @else {
            <span class="spinner size-4!"></span>
          }
          <span class="flex-1">{{ mensaje }}</span>
          @if (muestras > 1 && estado === 'capturando') {
            <span class="badge-vino tabular-nums">{{ capturas.length }}/{{ muestras }}</span>
          }
        </div>
        @if (muestras > 1) {
          <div class="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div class="h-full bg-vino-600 transition-all" [style.width.%]="capturas.length / muestras * 100"></div>
          </div>
        }
      }
    </div>
  `
})
export class CamaraFacialComponent implements AfterViewInit, OnDestroy {
  private facial = inject(FacialService);

  /** Capturas a tomar: 1 para marcar, 3 a 10 para registrar. */
  @Input() muestras = 1;
  @Output() capturado = new EventEmitter<number[][]>();

  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('lienzo') lienzoRef!: ElementRef<HTMLCanvasElement>;

  estado: Estado = 'iniciando';
  mensaje = 'Encendiendo la cámara…';
  capturas: number[][] = [];

  private stream: MediaStream | null = null;
  private activo = false;
  private temporizador: any;
  private inicio = 0;
  private ultimaCaptura = 0;
  private historialEar: number[] = [];
  private personaReal = false;

  private static readonly HISTORIAL_EAR = 12;
  private static readonly VARIANZA_EAR = 0.0004;
  private static readonly LIMITE_MS = 45000;

  get esError(): boolean {
    return ['sin-https', 'sin-camara', 'permiso-denegado', 'error', 'tiempo-agotado'].includes(this.estado);
  }

  get tituloError(): string {
    switch (this.estado) {
      case 'sin-https': return 'Se requiere conexión segura (HTTPS)';
      case 'sin-camara': return 'No se encontró una cámara';
      case 'permiso-denegado': return 'Permiso de cámara denegado';
      case 'tiempo-agotado': return 'No se pudo capturar el rostro';
      default: return 'No se pudo iniciar el reconocimiento facial';
    }
  }

  ngAfterViewInit() {
    this.iniciar();
  }

  ngOnDestroy() {
    this.detener();
  }

  reintentar() {
    this.detener();
    this.iniciar();
  }

  private async iniciar() {
    this.estado = 'iniciando';
    this.mensaje = 'Encendiendo la cámara…';
    this.capturas = [];
    this.historialEar = [];
    this.personaReal = false;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.estado = 'sin-https';
      this.mensaje = 'El navegador solo permite usar la cámara en páginas https://. Ingrese al sistema con https:// al inicio de la dirección.';
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
      });
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        this.estado = 'permiso-denegado';
        this.mensaje = 'Permita el acceso a la cámara desde el ícono del candado en la barra de direcciones y vuelva a intentarlo.';
      } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
        this.estado = 'sin-camara';
        this.mensaje = 'Conecte una cámara web a este equipo y vuelva a intentarlo.';
      } else {
        this.estado = 'error';
        this.mensaje = 'La cámara está siendo usada por otra aplicación o no está disponible.';
      }
      return;
    }

    const video = this.videoRef.nativeElement;
    video.srcObject = this.stream;
    try { await video.play(); } catch { /* autoplay silencioso */ }

    this.mensaje = 'Cargando reconocimiento facial…';
    try {
      await this.facial.cargarModelos();
    } catch {
      this.estado = 'error';
      this.mensaje = 'No se pudieron cargar los modelos de reconocimiento facial. Recargue la página.';
      this.detener();
      return;
    }

    this.estado = 'buscando';
    this.mensaje = 'Ubique su rostro frente a la cámara';
    this.activo = true;
    this.inicio = Date.now();
    this.ciclo();
  }

  private detener() {
    this.activo = false;
    clearTimeout(this.temporizador);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  private async ciclo() {
    if (!this.activo) return;
    const video = this.videoRef.nativeElement;

    if (Date.now() - this.inicio > CamaraFacialComponent.LIMITE_MS) {
      this.estado = 'tiempo-agotado';
      this.mensaje = 'Asegúrese de tener buena iluminación, mire de frente a la cámara y parpadee con normalidad.';
      this.limpiarLienzo();
      this.detener();
      return;
    }

    try {
      if (video.readyState >= 2) {
        // El descriptor solo se calcula cuando ya se confirmo que es una persona real
        const det = await this.facial.detectar(video, this.personaReal);
        if (!this.activo) return;
        this.dibujar(det);
        this.procesar(det);
      }
    } catch {
      // Un cuadro fallido no detiene el ciclo
    }
    if (this.activo) this.temporizador = setTimeout(() => this.ciclo(), 120);
  }

  private procesar(det: DeteccionFacial | null) {
    if (!det) {
      if (this.estado !== 'capturando') {
        this.estado = 'buscando';
        this.mensaje = 'Ubique su rostro frente a la cámara';
      }
      return;
    }

    if (!this.personaReal) {
      this.estado = 'vivacidad';
      this.historialEar.push(det.ear);
      if (this.historialEar.length > CamaraFacialComponent.HISTORIAL_EAR) this.historialEar.shift();
      const segundos = (Date.now() - this.inicio) / 1000;
      this.mensaje = segundos > 6 ? 'Parpadee con normalidad mirando a la cámara' : 'Verificando que sea una persona real…';
      if (this.historialEar.length >= CamaraFacialComponent.HISTORIAL_EAR) {
        const media = this.historialEar.reduce((a, b) => a + b, 0) / this.historialEar.length;
        const varianza = this.historialEar.reduce((s, v) => s + (v - media) ** 2, 0) / this.historialEar.length;
        if (varianza > CamaraFacialComponent.VARIANZA_EAR) this.personaReal = true;
      }
      return;
    }

    this.estado = 'capturando';
    this.mensaje = this.muestras > 1
      ? 'Mantenga el rostro frente a la cámara y muévalo levemente'
      : 'Capturando rostro…';
    if (!det.descriptor || det.puntaje < 0.7) return;
    if (this.muestras > 1 && Date.now() - this.ultimaCaptura < 500) return;

    this.capturas.push(det.descriptor);
    this.ultimaCaptura = Date.now();
    if (this.capturas.length >= this.muestras) {
      this.estado = 'listo';
      this.mensaje = 'Rostro capturado';
      this.limpiarLienzo();
      this.detener();
      this.capturado.emit(this.capturas);
    }
  }

  private dibujar(det: DeteccionFacial | null) {
    const video = this.videoRef.nativeElement;
    const lienzo = this.lienzoRef.nativeElement;
    const ctx = lienzo.getContext('2d');
    if (!ctx || !video.videoWidth) return;
    lienzo.width = lienzo.clientWidth;
    lienzo.height = lienzo.clientHeight;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    if (!det) return;

    // El video se muestra espejado y recortado (object-cover): se aplica la misma transformacion
    const escala = Math.max(lienzo.width / video.videoWidth, lienzo.height / video.videoHeight);
    const dx = (lienzo.width - video.videoWidth * escala) / 2;
    const dy = (lienzo.height - video.videoHeight * escala) / 2;
    const x = (px: number) => lienzo.width - (px * escala + dx);
    const y = (py: number) => py * escala + dy;

    const color = this.personaReal ? '#10b981' : '#E0922E';
    const b = det.caja;
    const bx = x(b.x + b.width), by = y(b.y), bw = b.width * escala, bh = b.height * escala;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    const esquina = Math.min(bw, bh) * 0.2;
    ctx.beginPath();
    ctx.moveTo(bx, by + esquina); ctx.lineTo(bx, by); ctx.lineTo(bx + esquina, by);
    ctx.moveTo(bx + bw - esquina, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + esquina);
    ctx.moveTo(bx, by + bh - esquina); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + esquina, by + bh);
    ctx.moveTo(bx + bw - esquina, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - esquina);
    ctx.stroke();

    ctx.fillStyle = color;
    for (const p of det.puntos) {
      ctx.beginPath();
      ctx.arc(x(p.x), y(p.y), 1.4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  private limpiarLienzo() {
    const lienzo = this.lienzoRef?.nativeElement;
    lienzo?.getContext('2d')?.clearRect(0, 0, lienzo.width, lienzo.height);
  }
}
