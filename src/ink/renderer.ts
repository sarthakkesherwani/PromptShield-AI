import type { Theme } from './types';
import { createProgram, type Program } from './program';
import { createNoiseTexture } from './noiseTexture';
import { inkParams, RIM_COLOR } from './params';
import { FULLSCREEN_VERT, INK_FRAG } from './shaders';

export interface Snapshot {
  theme: Theme;
  canvas: HTMLCanvasElement;
  scale: number;
  ms: number;
}

export interface InkFrame {
  from: Theme;
  to: Theme;
  center: { x: number; y: number };
  progress: number;
  radius: number;
  cleanup: number;
  maxDist: number;
  time: number;
  seed: { x: number; y: number; angle: number };
}

interface ThemeTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  scale: number;
}

export class InkRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly maxTextureSize: number;

  private gl: WebGL2RenderingContext;
  private program!: Program;
  private vao!: WebGLVertexArrayObject;
  private noise!: WebGLTexture;
  private textures = new Map<Theme, ThemeTexture>();
  private canvasScale = 1;
  private lost = false;

  static create(canvas: HTMLCanvasElement): InkRenderer | null {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return null;
    try {
      return new InkRenderer(canvas, gl);
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    this.init();
  }

  private init(): void {
    const gl = this.gl;
    this.program = createProgram(gl, FULLSCREEN_VERT, INK_FRAG);
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('createVertexArray failed');
    this.vao = vao;
    this.noise = createNoiseTexture(gl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }

  watchContext(onLost: () => void, onRestored: () => void): void {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.textures.clear();
      onLost();
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.init();
      onRestored();
    });
  }

  get isLost(): boolean {
    return this.lost;
  }

  resize(scale: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * scale));
    const h = Math.max(1, Math.round(rect.height * scale));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.canvasScale = rect.width > 0 ? w / rect.width : scale;
  }

  upload(snapshot: Snapshot): void {
    if (this.lost) return;
    const gl = this.gl;
    let entry = this.textures.get(snapshot.theme);
    if (!entry) {
      const texture = gl.createTexture();
      if (!texture) throw new Error('createTexture failed');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      entry = { texture, width: 0, height: 0, scale: 0 };
      this.textures.set(snapshot.theme, entry);
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.canvas);
    entry.width = snapshot.canvas.width;
    entry.height = snapshot.canvas.height;
    entry.scale = snapshot.scale;
  }

  draw(frame: InkFrame): void {
    if (this.lost) return;
    const from = this.textures.get(frame.from);
    if (!from) return;

    const gl = this.gl;
    const { program, uniform } = this.program;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, from.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.noise);

    gl.uniform1i(uniform('uFrom'), 0);
    gl.uniform1i(uniform('uNoise'), 1);
    gl.uniform2f(uniform('uFromSize'), from.width, from.height);
    gl.uniform4f(uniform('uFromMap'), from.scale / this.canvasScale, 0, 0, 0);
    gl.uniform1f(uniform('uCanvasScale'), this.canvasScale);
    gl.uniform2f(uniform('uRes'), this.canvas.width, this.canvas.height);
    gl.uniform2f(uniform('uCenter'), frame.center.x, frame.center.y);
    gl.uniform1f(uniform('uRadius'), frame.radius);
    gl.uniform1f(uniform('uCleanup'), frame.cleanup);
    gl.uniform1f(uniform('uTime'), frame.time);
    gl.uniform1f(uniform('uRef'), Math.max(this.canvas.width, this.canvas.height) / this.canvasScale);
    gl.uniform2f(uniform('uSeed'), frame.seed.x, frame.seed.y);
    const cos = Math.cos(frame.seed.angle);
    const sin = Math.sin(frame.seed.angle);
    gl.uniformMatrix2fv(uniform('uSeedRot'), false, [cos, sin, -sin, cos]);

    gl.uniform1f(uniform('uTendril'), inkParams.tendril);
    gl.uniform1f(uniform('uNoiseScale'), inkParams.noiseScale);
    gl.uniform1f(uniform('uSoftness'), inkParams.softness);
    gl.uniform1f(uniform('uDrift'), inkParams.drift);
    gl.uniform3fv(uniform('uRimColor'), RIM_COLOR[frame.to]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
