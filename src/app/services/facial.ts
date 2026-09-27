import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { EstadoFacial, PruebaMarcacion, PruebaRegistro, ResumenFacial } from '../interfaces/facial';

type FaceApi = typeof import('face-api.js');

/** Rostro detectado en un cuadro de video. */
export interface DeteccionFacial {
  caja: { x: number; y: number; width: number; height: number };
  puntos: { x: number; y: number }[];
  puntaje: number;
  /** Eye Aspect Ratio promedio (para detectar parpadeo). */
  ear: number;
  descriptor?: number[];
}

/**
 * Reconocimiento facial con face-api.js. El navegador solo calcula el descriptor del rostro;
 * la comparacion con el rostro registrado la hace el servidor.
 */
@Injectable({ providedIn: 'root' })
export class FacialService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private faceapi: FaceApi | null = null;
  private cargando: Promise<FaceApi> | null = null;

  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/face`;
  }

  // ==================== API ====================

  miEstado(): Observable<EstadoFacial> {
    return this.http.get<EstadoFacial>(`${this.apiUrl}/mi-estado`);
  }

  /** El propio colaborador registra su rostro (una sola vez). */
  registrar(descriptores: number[][], consentimiento: boolean): Observable<EstadoFacial> {
    return this.http.post<EstadoFacial>(`${this.apiUrl}/registrar`, { descriptores, consentimiento });
  }

  /** Registro en persona por la jefatura o el admin. */
  registrarPara(empleadoId: number, descriptores: number[][], consentimiento: boolean): Observable<EstadoFacial> {
    return this.http.post<EstadoFacial>(`${this.apiUrl}/registrar/${empleadoId}`, { descriptores, consentimiento });
  }

  /** Borra el rostro para que el colaborador lo registre de nuevo. */
  restablecer(empleadoId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${empleadoId}`);
  }

  /** Ids de los empleados con rostro registrado (jefaturas y admin). */
  registrados(): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/registrados`);
  }

  // ==================== PRUEBAS (panel admin) ====================

  resumenAdmin(): Observable<ResumenFacial> {
    return this.http.get<ResumenFacial>(`${this.apiUrl}/admin/resumen`);
  }

  /** A quien reconoce el sistema con este rostro. No registra asistencia. */
  probarMarcacion(descriptor: number[], empleadoId?: number | null): Observable<PruebaMarcacion> {
    return this.http.post<PruebaMarcacion>(`${this.apiUrl}/admin/probar-marcacion`, { descriptor, empleadoId: empleadoId || null });
  }

  /** Calidad de las capturas de un registro y si el rostro ya pertenece a alguien. No guarda nada. */
  probarRegistro(descriptores: number[][]): Observable<PruebaRegistro> {
    return this.http.post<PruebaRegistro>(`${this.apiUrl}/admin/probar-registro`, { descriptores });
  }

  // ==================== DETECCION ====================

  /** Carga face-api.js y sus modelos (desde /models, sin CDN) solo cuando se necesitan. */
  cargarModelos(): Promise<FaceApi> {
    if (this.faceapi) return Promise.resolve(this.faceapi);
    if (!this.cargando) {
      this.cargando = (async () => {
        const faceapi = await import('face-api.js');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        this.faceapi = faceapi;
        return faceapi;
      })();
      this.cargando.catch(() => this.cargando = null);
    }
    return this.cargando;
  }

  /** Detecta un rostro en el video. Con conDescriptor calcula tambien el descriptor (mas lento). */
  async detectar(video: HTMLVideoElement, conDescriptor = false): Promise<DeteccionFacial | null> {
    const faceapi = await this.cargarModelos();
    const opciones = new faceapi.TinyFaceDetectorOptions({ inputSize: conDescriptor ? 416 : 224, scoreThreshold: 0.5 });
    const base = faceapi.detectSingleFace(video, opciones).withFaceLandmarks();
    const r = conDescriptor ? await base.withFaceDescriptor() : await base;
    if (!r) return null;
    const lm = r.landmarks;
    return {
      caja: r.detection.box,
      puntos: lm.positions.map(p => ({ x: p.x, y: p.y })),
      puntaje: r.detection.score,
      ear: (this.ear(lm.getLeftEye()) + this.ear(lm.getRightEye())) / 2,
      descriptor: 'descriptor' in r ? Array.from((r as any).descriptor as Float32Array) : undefined
    };
  }

  /** Eye Aspect Ratio: (|p2-p6| + |p3-p5|) / (2 |p1-p4|). Baja al parpadear. */
  private ear(ojo: { x: number; y: number }[]): number {
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    return (d(ojo[1], ojo[5]) + d(ojo[2], ojo[4])) / (2 * d(ojo[0], ojo[3]));
  }
}
