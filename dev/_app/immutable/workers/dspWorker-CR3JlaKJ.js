(function() {
	var cI = Object.defineProperty, iA = (E, I) => () => (E && (I = E(E = 0)), I), VI = (E, I) => {
		let A = {};
		for (var i in E) cI(A, i, {
			get: E[i],
			enumerable: !0
		});
		return I || cI(A, Symbol.toStringTag, { value: "Module" }), A;
	};
	typeof window < "u" && import("webfft").then((E) => {
		E && E.default && new E.default(8192);
	}).catch(() => {});
	function XI(E, I) {
		let A = 0;
		for (let i = 0; i < I; i++) A = A << 1 | E & 1, E >>= 1;
		return A;
	}
	function wI(E, I, A) {
		const i = E.length, C = Math.log2(i);
		for (let Q = 0; Q < i; Q++) {
			const r = XI(Q, C);
			if (r > Q) {
				const o = E[Q], t = I[Q];
				E[Q] = E[r], I[Q] = I[r], E[r] = o, I[r] = t;
			}
		}
		for (let Q = 2; Q <= i; Q <<= 1) {
			const r = Q >> 1, o = (A ? 2 : -2) * Math.PI / Q, t = Math.cos(o), e = Math.sin(o);
			for (let c = 0; c < i; c += Q) {
				let w = 1, s = 0;
				for (let h = 0; h < r; h++) {
					const D = E[c + h], f = I[c + h], N = c + h + r, F = w * E[N] - s * I[N], l = w * I[N] + s * E[N];
					E[c + h] = D + F, I[c + h] = f + l, E[N] = D - F, I[N] = f - l;
					const y = w * t - s * e;
					s = w * e + s * t, w = y;
				}
			}
		}
		if (A) for (let Q = 0; Q < i; Q++) E[Q] /= i, I[Q] /= i;
	}
	function fI(E, I, A) {
		const i = E.length, C = I || new Float32Array(i), Q = A || new Float32Array(i);
		return C.set(E), Q.fill(0), wI(C, Q, !1), {
			real: C,
			imag: Q
		};
	}
	function ZI(E, I, A, i) {
		const C = E.length, Q = A || new Float32Array(C), r = i || new Float32Array(C);
		return Q.set(E), r.set(I), wI(Q, r, !0), Q;
	}
	function OI(E, I, A, i, C, Q, r) {
		const o = C.length;
		for (let t = 0; t < o; t++) {
			const e = A[t] * A[t] + i[t] * i[t] + 1e-12, c = (E[t] * A[t] + I[t] * i[t]) / e, w = (I[t] * A[t] - E[t] * i[t]) / e;
			Q && (Q[t] = c), r && (r[t] = w);
			const s = Math.sqrt(c * c + w * w);
			C[t] = 20 * Math.log10(s + 1e-8);
		}
	}
	function zI(E, I, A, i, C) {
		const Q = C.length;
		for (let r = 0; r < Q; r++) {
			const o = A[r] * A[r] + i[r] * i[r] + 1e-12, t = (E[r] * A[r] + I[r] * i[r]) / o, e = (I[r] * A[r] - E[r] * i[r]) / o;
			C[r] = Math.atan2(e, t) * (180 / Math.PI);
		}
	}
	function _I(E, I, A = 48e3) {
		let i = 0;
		const C = E.length, Q = 1 / A;
		for (let r = 0; r < C; r++) i += E[r] * Q * 1e3, I[r] = i;
	}
	function $I(E, I, A) {
		const i = A.length;
		A[0] = 0;
		const C = 2 * Math.PI * I;
		for (let Q = 1; Q < i; Q++) {
			let r = E[Q] - E[Q - 1];
			for (; r > Math.PI;) r -= 2 * Math.PI;
			for (; r < -Math.PI;) r += 2 * Math.PI;
			A[Q] = -r / C * 1e3;
		}
	}
	function FI(E) {
		let I = 0, A = 0;
		const i = E.length;
		for (let C = 0; C < i; C++) {
			const Q = Math.abs(E[C]);
			Q > I && (I = Q), A += E[C] * E[C];
		}
		return {
			peakDb: 20 * Math.log10(I + 1e-9),
			rmsDb: 20 * Math.log10(Math.sqrt(A / Math.max(1, i)) + 1e-9)
		};
	}
	var Ag = class {
		depth;
		bins;
		bufferReal;
		bufferImag;
		writeIdx = 0;
		count = 0;
		lpfReal;
		lpfImag;
		constructor(E, I = 16) {
			this.bins = E, this.depth = I, this.bufferReal = Array.from({ length: I }, () => new Float32Array(E)), this.bufferImag = Array.from({ length: I }, () => new Float32Array(E)), this.lpfReal = new Float32Array(E), this.lpfImag = new Float32Array(E);
		}
		processFIFO(E, I, A, i) {
			this.bufferReal[this.writeIdx].set(E), this.bufferImag[this.writeIdx].set(I), this.writeIdx = (this.writeIdx + 1) % this.depth, this.count < this.depth && this.count++, A.fill(0), i.fill(0);
			for (let C = 0; C < this.count; C++) for (let Q = 0; Q < this.bins; Q++) A[Q] += this.bufferReal[C][Q], i[Q] += this.bufferImag[C][Q];
			for (let C = 0; C < this.bins; C++) A[C] /= this.count, i[C] /= this.count;
		}
		processLPF(E, I, A, i, C) {
			for (let Q = 0; Q < this.bins; Q++) this.lpfReal[Q] += (E[Q] - this.lpfReal[Q]) * C, this.lpfImag[Q] += (I[Q] - this.lpfImag[Q]) * C, A[Q] = this.lpfReal[Q], i[Q] = this.lpfImag[Q];
		}
		setDepth(E) {
			E !== this.depth && (this.depth = Math.max(1, Math.min(64, E)), this.bufferReal = Array.from({ length: this.depth }, () => new Float32Array(this.bins)), this.bufferImag = Array.from({ length: this.depth }, () => new Float32Array(this.bins)), this.writeIdx = 0, this.count = 0);
		}
		reset() {
			this.writeIdx = 0, this.count = 0, this.lpfReal.fill(0), this.lpfImag.fill(0);
		}
	};
	function Ig(E, I, A, i, C, Q, r, o, t) {
		const e = E.length, c = e * 2, w = 1e-10;
		for (let s = 0; s < e; s++) {
			const h = A[s] * A[s] + i[s] * i[s] + w, D = (E[s] * A[s] + I[s] * i[s]) / h, f = (I[s] * A[s] - E[s] * i[s]) / h;
			Q[s] = D, r[s] = f;
		}
		for (let s = 1; s < e; s++) Q[c - s] = Q[s], r[c - s] = -r[s];
		ZI(Q, r, o, t), C.set(o);
	}
	function gg(E, I, A, i = 48e3) {
		const C = E.length, Q = Math.round(A / 1e3 * i), r = Math.round(I / 2 / 1e3 * i), o = Math.max(0, Q - r), t = Math.min(C - 1, Q + r), e = Math.round(r * .2);
		for (let c = 0; c < C; c++) if (c < o || c > t) E[c] = 0;
		else if (c < o + e) {
			const w = (c - o) / e, s = .5 * (1 - Math.cos(w * Math.PI));
			E[c] *= s;
		} else if (c > t - e) {
			const w = (t - c) / e, s = .5 * (1 - Math.cos(w * Math.PI));
			E[c] *= s;
		}
	}
	var Bg = class {
		cache = {};
		getWindow(E, I) {
			const A = `${E}_${I}`;
			if (!this.cache[A]) {
				const i = new Float32Array(E);
				let C = 0, Q = 0;
				for (let o = 0; o < E; o++) {
					let t = 1;
					const e = 2 * Math.PI * o / (E - 1);
					if (I === "Hann") t = .5 * (1 - Math.cos(e));
					else if (I === "Hamming") t = .54 - .46 * Math.cos(e);
					else if (I === "FlatTop") t = 1 - 1.93 * Math.cos(e) + 1.29 * Math.cos(2 * e) - .388 * Math.cos(3 * e) + .0322 * Math.cos(4 * e);
					else if (I === "BlackmanHarris") t = .35875 - .48829 * Math.cos(e) + .14128 * Math.cos(2 * e) - .01168 * Math.cos(3 * e);
					else if (I === "HFT223D") t = 1 - 1.9329348896 * Math.cos(e) + 1.2813988316 * Math.cos(2 * e) - .3807315853 * Math.cos(3 * e) + .0293292167 * Math.cos(4 * e);
					else if (I === "Exponential") {
						const c = E / 5;
						t = Math.exp(-o / c);
					}
					i[o] = t, C += t, Q += t * t;
				}
				const r = C / E;
				for (let o = 0; o < E; o++) i[o] /= r;
				this.cache[A] = i;
			}
			return this.cache[A];
		}
		apply(E, I) {
			if (I === "Rectangular") return;
			const A = E.length, i = this.getWindow(A, I);
			for (let C = 0; C < A; C++) E[C] *= i[C];
		}
	}, lI, Cg = iA((() => {
		lI = (() => {
			var E = self.location.href;
			return (function(I = {}) {
				var A = I, i, C;
				A.ready = new Promise((g, a) => {
					i = g, C = a;
				});
				var Q = Object.assign({}, A), r = !0, o = !1, t = "";
				function e(g) {
					return A.locateFile ? A.locateFile(g, t) : t + g;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), E && (t = E), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (g) => {
					var a = new XMLHttpRequest();
					return a.open("GET", g, !1), a.responseType = "arraybuffer", a.send(null), new Uint8Array(a.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, Q), Q = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && x("no native wasm support detected");
				var h, D, f = !1, N, F;
				function l() {
					var g = h.buffer;
					A.HEAP8 = N = new Int8Array(g), A.HEAP16 = new Int16Array(g), A.HEAP32 = new Int32Array(g), A.HEAPU8 = F = new Uint8Array(g), A.HEAPU16 = new Uint16Array(g), A.HEAPU32 = new Uint32Array(g), A.HEAPF32 = new Float32Array(g), A.HEAPF64 = new Float64Array(g);
				}
				var y = [], Y = [], v = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) Z(A.preRun.shift());
					p(y);
				}
				function K() {
					p(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) O(A.postRun.shift());
					p(v);
				}
				function Z(g) {
					y.unshift(g);
				}
				function W(g) {
					Y.unshift(g);
				}
				function O(g) {
					v.unshift(g);
				}
				var d = 0, L = null, H = null;
				function z(g) {
					d++, A.monitorRunDependencies && A.monitorRunDependencies(d);
				}
				function _(g) {
					if (d--, A.monitorRunDependencies && A.monitorRunDependencies(d), d == 0 && (L !== null && (clearInterval(L), L = null), H)) {
						var a = H;
						H = null, a();
					}
				}
				function x(g) {
					A.onAbort && A.onAbort(g), g = "Aborted(" + g + ")", w(g), f = !0, g += ". Build with -sASSERTIONS for more info.";
					var a = new WebAssembly.RuntimeError(g);
					throw C(a), a;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(g) {
					return g.startsWith($);
				}
				var J = "data:application/octet-stream;base64,AGFzbQEAAAABRgxgAX8Bf2ABfwBgA39/fwBgAXwBfGADfHx/AXxgAnx8AXxgAnx/AXxgBn9/f39/fwBgAABgAnx/AX9gBH9/f38Bf2AAAX8CDQIBYQFhAAABYQFiAAIDEhEABAUGAQAHCAMJAwIKAAELAQQFAXABAQEFBgEBgAKAAgYIAX8BQaCiBAsHLQsBYwIAAWQACQFlABIBZgAGAWcADgFoAAcBaQANAWoBAAFrABEBbAAQAW0ADwqUbBFPAQJ/QaAeKAIAIgEgAEEHakF4cSICaiEAAkAgAkEAIAAgAU0bDQAgAD8AQRB0SwRAIAAQAEUNAQtBoB4gADYCACABDwtBpB5BMDYCAEF/C5kBAQN8IAAgAKIiAyADIAOioiADRHzVz1o62eU9okTrnCuK5uVavqCiIAMgA0R9/rFX4x3HPqJE1WHBGaABKr+gokSm+BARERGBP6CgIQUgAyAAoiEEIAJFBEAgBCADIAWiRElVVVVVVcW/oKIgAKAPCyAAIAMgAUQAAAAAAADgP6IgBSAEoqGiIAGhIARESVVVVVVVxT+ioKELkgEBA3xEAAAAAAAA8D8gACAAoiICRAAAAAAAAOA/oiIDoSIERAAAAAAAAPA/IAShIAOhIAIgAiACIAJEkBXLGaAB+j6iRHdRwRZswVa/oKJETFVVVVVVpT+goiACIAKiIgMgA6IgAiACRNQ4iL7p+qi9okTEsbS9nu4hPqCiRK1SnIBPfpK+oKKgoiAAIAGioaCgC6gBAAJAIAFBgAhOBEAgAEQAAAAAAADgf6IhACABQf8PSQRAIAFB/wdrIQEMAgsgAEQAAAAAAADgf6IhAEH9FyABIAFB/RdOG0H+D2shAQwBCyABQYF4Sg0AIABEAAAAAAAAYAOiIQAgAUG4cEsEQCABQckHaiEBDAELIABEAAAAAAAAYAOiIQBB8GggASABQfBoTBtBkg9qIQELIAAgAUH/B2qtQjSGv6IL0gsBB38CQCAARQ0AIABBCGsiAiAAQQRrKAIAIgFBeHEiAGohBQJAIAFBAXENACABQQNxRQ0BIAIgAigCACIBayICQbgeKAIASQ0BIAAgAWohAAJAAkBBvB4oAgAgAkcEQCABQf8BTQRAIAFBA3YhBCACKAIMIgEgAigCCCIDRgRAQageQageKAIAQX4gBHdxNgIADAULIAMgATYCDCABIAM2AggMBAsgAigCGCEGIAIgAigCDCIBRwRAIAIoAggiAyABNgIMIAEgAzYCCAwDCyACQRRqIgQoAgAiA0UEQCACKAIQIgNFDQIgAkEQaiEECwNAIAQhByADIgFBFGoiBCgCACIDDQAgAUEQaiEEIAEoAhAiAw0ACyAHQQA2AgAMAgsgBSgCBCIBQQNxQQNHDQJBsB4gADYCACAFIAFBfnE2AgQgAiAAQQFyNgIEIAUgADYCAA8LQQAhAQsgBkUNAAJAIAIoAhwiA0ECdEHYIGoiBCgCACACRgRAIAQgATYCACABDQFBrB5BrB4oAgBBfiADd3E2AgAMAgsgBkEQQRQgBigCECACRhtqIAE2AgAgAUUNAQsgASAGNgIYIAIoAhAiAwRAIAEgAzYCECADIAE2AhgLIAIoAhQiA0UNACABIAM2AhQgAyABNgIYCyACIAVPDQAgBSgCBCIBQQFxRQ0AAkACQAJAAkAgAUECcUUEQEHAHigCACAFRgRAQcAeIAI2AgBBtB5BtB4oAgAgAGoiADYCACACIABBAXI2AgQgAkG8HigCAEcNBkGwHkEANgIAQbweQQA2AgAPC0G8HigCACAFRgRAQbweIAI2AgBBsB5BsB4oAgAgAGoiADYCACACIABBAXI2AgQgACACaiAANgIADwsgAUF4cSAAaiEAIAFB/wFNBEAgAUEDdiEEIAUoAgwiASAFKAIIIgNGBEBBqB5BqB4oAgBBfiAEd3E2AgAMBQsgAyABNgIMIAEgAzYCCAwECyAFKAIYIQYgBSAFKAIMIgFHBEBBuB4oAgAaIAUoAggiAyABNgIMIAEgAzYCCAwDCyAFQRRqIgQoAgAiA0UEQCAFKAIQIgNFDQIgBUEQaiEECwNAIAQhByADIgFBFGoiBCgCACIDDQAgAUEQaiEEIAEoAhAiAw0ACyAHQQA2AgAMAgsgBSABQX5xNgIEIAIgAEEBcjYCBCAAIAJqIAA2AgAMAwtBACEBCyAGRQ0AAkAgBSgCHCIDQQJ0QdggaiIEKAIAIAVGBEAgBCABNgIAIAENAUGsHkGsHigCAEF+IAN3cTYCAAwCCyAGQRBBFCAGKAIQIAVGG2ogATYCACABRQ0BCyABIAY2AhggBSgCECIDBEAgASADNgIQIAMgATYCGAsgBSgCFCIDRQ0AIAEgAzYCFCADIAE2AhgLIAIgAEEBcjYCBCAAIAJqIAA2AgAgAkG8HigCAEcNAEGwHiAANgIADwsgAEH/AU0EQCAAQXhxQdAeaiEBAn9BqB4oAgAiA0EBIABBA3Z0IgBxRQRAQageIAAgA3I2AgAgAQwBCyABKAIICyEAIAEgAjYCCCAAIAI2AgwgAiABNgIMIAIgADYCCA8LQR8hAyAAQf///wdNBEAgAEEmIABBCHZnIgFrdkEBcSABQQF0a0E+aiEDCyACIAM2AhwgAkIANwIQIANBAnRB2CBqIQECQAJAAkBBrB4oAgAiBEEBIAN0IgdxRQRAQaweIAQgB3I2AgAgASACNgIAIAIgATYCGAwBCyAAQRkgA0EBdmtBACADQR9HG3QhAyABKAIAIQEDQCABIgQoAgRBeHEgAEYNAiADQR12IQEgA0EBdCEDIAQgAUEEcWoiB0EQaigCACIBDQALIAcgAjYCECACIAQ2AhgLIAIgAjYCDCACIAI2AggMAQsgBCgCCCIAIAI2AgwgBCACNgIIIAJBADYCGCACIAQ2AgwgAiAANgIIC0HIHkHIHigCAEEBayIAQX8gABs2AgALC8YnAQt/IwBBEGsiCiQAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAAQfQBTQRAQageKAIAIgZBECAAQQtqQXhxIABBC0kbIgVBA3YiAHYiAUEDcQRAAkAgAUF/c0EBcSAAaiICQQN0IgFB0B5qIgAgAUHYHmooAgAiASgCCCIERgRAQageIAZBfiACd3E2AgAMAQsgBCAANgIMIAAgBDYCCAsgAUEIaiEAIAEgAkEDdCICQQNyNgIEIAEgAmoiASABKAIEQQFyNgIEDA8LIAVBsB4oAgAiB00NASABBEACQEECIAB0IgJBACACa3IgASAAdHFoIgFBA3QiAEHQHmoiAiAAQdgeaigCACIAKAIIIgRGBEBBqB4gBkF+IAF3cSIGNgIADAELIAQgAjYCDCACIAQ2AggLIAAgBUEDcjYCBCAAIAVqIgggAUEDdCIBIAVrIgRBAXI2AgQgACABaiAENgIAIAcEQCAHQXhxQdAeaiEBQbweKAIAIQICfyAGQQEgB0EDdnQiA3FFBEBBqB4gAyAGcjYCACABDAELIAEoAggLIQMgASACNgIIIAMgAjYCDCACIAE2AgwgAiADNgIICyAAQQhqIQBBvB4gCDYCAEGwHiAENgIADA8LQaweKAIAIgtFDQEgC2hBAnRB2CBqKAIAIgIoAgRBeHEgBWshAyACIQEDQAJAIAEoAhAiAEUEQCABKAIUIgBFDQELIAAoAgRBeHEgBWsiASADIAEgA0kiARshAyAAIAIgARshAiAAIQEMAQsLIAIoAhghCSACIAIoAgwiBEcEQEG4HigCABogAigCCCIAIAQ2AgwgBCAANgIIDA4LIAJBFGoiASgCACIARQRAIAIoAhAiAEUNAyACQRBqIQELA0AgASEIIAAiBEEUaiIBKAIAIgANACAEQRBqIQEgBCgCECIADQALIAhBADYCAAwNC0F/IQUgAEG/f0sNACAAQQtqIgBBeHEhBUGsHigCACIIRQ0AQQAgBWshAwJAAkACQAJ/QQAgBUGAAkkNABpBHyAFQf///wdLDQAaIAVBJiAAQQh2ZyIAa3ZBAXEgAEEBdGtBPmoLIgdBAnRB2CBqKAIAIgFFBEBBACEADAELQQAhACAFQRkgB0EBdmtBACAHQR9HG3QhAgNAAkAgASgCBEF4cSAFayIGIANPDQAgASEEIAYiAw0AQQAhAyABIQAMAwsgACABKAIUIgYgBiABIAJBHXZBBHFqKAIQIgFGGyAAIAYbIQAgAkEBdCECIAENAAsLIAAgBHJFBEBBACEEQQIgB3QiAEEAIABrciAIcSIARQ0DIABoQQJ0QdggaigCACEACyAARQ0BCwNAIAAoAgRBeHEgBWsiAiADSSEBIAIgAyABGyEDIAAgBCABGyEEIAAoAhAiAQR/IAEFIAAoAhQLIgANAAsLIARFDQAgA0GwHigCACAFa08NACAEKAIYIQcgBCAEKAIMIgJHBEBBuB4oAgAaIAQoAggiACACNgIMIAIgADYCCAwMCyAEQRRqIgEoAgAiAEUEQCAEKAIQIgBFDQMgBEEQaiEBCwNAIAEhBiAAIgJBFGoiASgCACIADQAgAkEQaiEBIAIoAhAiAA0ACyAGQQA2AgAMCwsgBUGwHigCACIETQRAQbweKAIAIQACQCAEIAVrIgFBEE8EQCAAIAVqIgIgAUEBcjYCBCAAIARqIAE2AgAgACAFQQNyNgIEDAELIAAgBEEDcjYCBCAAIARqIgEgASgCBEEBcjYCBEEAIQJBACEBC0GwHiABNgIAQbweIAI2AgAgAEEIaiEADA0LIAVBtB4oAgAiAkkEQEG0HiACIAVrIgE2AgBBwB5BwB4oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADA0LQQAhACAFQS9qIgMCf0GAIigCAARAQYgiKAIADAELQYwiQn83AgBBhCJCgKCAgICABDcCAEGAIiAKQQxqQXBxQdiq1aoFczYCAEGUIkEANgIAQeQhQQA2AgBBgCALIgFqIgZBACABayIIcSIBIAVNDQxB4CEoAgAiBARAQdghKAIAIgcgAWoiCSAHTQ0NIAQgCUkNDQsCQEHkIS0AAEEEcUUEQAJAAkACQAJAQcAeKAIAIgQEQEHoISEAA0AgBCAAKAIAIgdPBEAgByAAKAIEaiAESw0DCyAAKAIIIgANAAsLQQAQAiICQX9GDQMgASEGQYQiKAIAIgBBAWsiBCACcQRAIAEgAmsgAiAEakEAIABrcWohBgsgBSAGTw0DQeAhKAIAIgAEQEHYISgCACIEIAZqIgggBE0NBCAAIAhJDQQLIAYQAiIAIAJHDQEMBQsgBiACayAIcSIGEAIiAiAAKAIAIAAoAgRqRg0BIAIhAAsgAEF/Rg0BIAVBMGogBk0EQCAAIQIMBAtBiCIoAgAiAiADIAZrakEAIAJrcSICEAJBf0YNASACIAZqIQYgACECDAMLIAJBf0cNAgtB5CFB5CEoAgBBBHI2AgALIAEQAiECQQAQAiEAIAJBf0YNBSAAQX9GDQUgACACTQ0FIAAgAmsiBiAFQShqTQ0FC0HYIUHYISgCACAGaiIANgIAQdwhKAIAIABJBEBB3CEgADYCAAsCQEHAHigCACIDBEBB6CEhAANAIAIgACgCACIBIAAoAgQiBGpGDQIgACgCCCIADQALDAQLQbgeKAIAIgBBACAAIAJNG0UEQEG4HiACNgIAC0EAIQBB7CEgBjYCAEHoISACNgIAQcgeQX82AgBBzB5BgCIoAgA2AgBB9CFBADYCAANAIABBA3QiAUHYHmogAUHQHmoiBDYCACABQdweaiAENgIAIABBAWoiAEEgRw0AC0G0HiAGQShrIgBBeCACa0EHcSIBayIENgIAQcAeIAEgAmoiATYCACABIARBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIADAQLIAIgA00NAiABIANLDQIgACgCDEEIcQ0CIAAgBCAGajYCBEHAHiADQXggA2tBB3EiAGoiATYCAEG0HkG0HigCACAGaiICIABrIgA2AgAgASAAQQFyNgIEIAIgA2pBKDYCBEHEHkGQIigCADYCAAwDC0EAIQQMCgtBACECDAgLQbgeKAIAIAJLBEBBuB4gAjYCAAsgAiAGaiEBQeghIQACQAJAAkADQCABIAAoAgBHBEAgACgCCCIADQEMAgsLIAAtAAxBCHFFDQELQeghIQADQCADIAAoAgAiAU8EQCABIAAoAgRqIgQgA0sNAwsgACgCCCEADAALAAsgACACNgIAIAAgACgCBCAGajYCBCACQXggAmtBB3FqIgcgBUEDcjYCBCABQXggAWtBB3FqIgYgBSAHaiIFayEAIAMgBkYEQEHAHiAFNgIAQbQeQbQeKAIAIABqIgA2AgAgBSAAQQFyNgIEDAgLQbweKAIAIAZGBEBBvB4gBTYCAEGwHkGwHigCACAAaiIANgIAIAUgAEEBcjYCBCAAIAVqIAA2AgAMCAsgBigCBCIDQQNxQQFHDQYgA0F4cSEJIANB/wFNBEAgBigCDCIBIAYoAggiAkYEQEGoHkGoHigCAEF+IANBA3Z3cTYCAAwHCyACIAE2AgwgASACNgIIDAYLIAYoAhghCCAGIAYoAgwiAkcEQCAGKAIIIgEgAjYCDCACIAE2AggMBQsgBkEUaiIBKAIAIgNFBEAgBigCECIDRQ0EIAZBEGohAQsDQCABIQQgAyICQRRqIgEoAgAiAw0AIAJBEGohASACKAIQIgMNAAsgBEEANgIADAQLQbQeIAZBKGsiAEF4IAJrQQdxIgFrIgg2AgBBwB4gASACaiIBNgIAIAEgCEEBcjYCBCAAIAJqQSg2AgRBxB5BkCIoAgA2AgAgAyAEQScgBGtBB3FqQS9rIgAgACADQRBqSRsiAUEbNgIEIAFB8CEpAgA3AhAgAUHoISkCADcCCEHwISABQQhqNgIAQewhIAY2AgBB6CEgAjYCAEH0IUEANgIAIAFBGGohAANAIABBBzYCBCAAQQhqIQIgAEEEaiEAIAIgBEkNAAsgASADRg0AIAEgASgCBEF+cTYCBCADIAEgA2siAkEBcjYCBCABIAI2AgAgAkH/AU0EQCACQXhxQdAeaiEAAn9BqB4oAgAiAUEBIAJBA3Z0IgJxRQRAQageIAEgAnI2AgAgAAwBCyAAKAIICyEBIAAgAzYCCCABIAM2AgwgAyAANgIMIAMgATYCCAwBC0EfIQAgAkH///8HTQRAIAJBJiACQQh2ZyIAa3ZBAXEgAEEBdGtBPmohAAsgAyAANgIcIANCADcCECAAQQJ0QdggaiEBAkACQEGsHigCACIEQQEgAHQiBnFFBEBBrB4gBCAGcjYCACABIAM2AgAMAQsgAkEZIABBAXZrQQAgAEEfRxt0IQAgASgCACEEA0AgBCIBKAIEQXhxIAJGDQIgAEEddiEEIABBAXQhACABIARBBHFqIgYoAhAiBA0ACyAGIAM2AhALIAMgATYCGCADIAM2AgwgAyADNgIIDAELIAEoAggiACADNgIMIAEgAzYCCCADQQA2AhggAyABNgIMIAMgADYCCAtBtB4oAgAiACAFTQ0AQbQeIAAgBWsiATYCAEHAHkHAHigCACIAIAVqIgI2AgAgAiABQQFyNgIEIAAgBUEDcjYCBCAAQQhqIQAMCAtBpB5BMDYCAEEAIQAMBwtBACECCyAIRQ0AAkAgBigCHCIBQQJ0QdggaiIEKAIAIAZGBEAgBCACNgIAIAINAUGsHkGsHigCAEF+IAF3cTYCAAwCCyAIQRBBFCAIKAIQIAZGG2ogAjYCACACRQ0BCyACIAg2AhggBigCECIBBEAgAiABNgIQIAEgAjYCGAsgBigCFCIBRQ0AIAIgATYCFCABIAI2AhgLIAAgCWohACAGIAlqIgYoAgQhAwsgBiADQX5xNgIEIAUgAEEBcjYCBCAAIAVqIAA2AgAgAEH/AU0EQCAAQXhxQdAeaiEBAn9BqB4oAgAiAkEBIABBA3Z0IgBxRQRAQageIAAgAnI2AgAgAQwBCyABKAIICyEAIAEgBTYCCCAAIAU2AgwgBSABNgIMIAUgADYCCAwBC0EfIQMgAEH///8HTQRAIABBJiAAQQh2ZyIBa3ZBAXEgAUEBdGtBPmohAwsgBSADNgIcIAVCADcCECADQQJ0QdggaiEBAkACQEGsHigCACICQQEgA3QiBHFFBEBBrB4gAiAEcjYCACABIAU2AgAMAQsgAEEZIANBAXZrQQAgA0EfRxt0IQMgASgCACECA0AgAiIBKAIEQXhxIABGDQIgA0EddiECIANBAXQhAyABIAJBBHFqIgQoAhAiAg0ACyAEIAU2AhALIAUgATYCGCAFIAU2AgwgBSAFNgIIDAELIAEoAggiACAFNgIMIAEgBTYCCCAFQQA2AhggBSABNgIMIAUgADYCCAsgB0EIaiEADAILAkAgB0UNAAJAIAQoAhwiAEECdEHYIGoiASgCACAERgRAIAEgAjYCACACDQFBrB4gCEF+IAB3cSIINgIADAILIAdBEEEUIAcoAhAgBEYbaiACNgIAIAJFDQELIAIgBzYCGCAEKAIQIgAEQCACIAA2AhAgACACNgIYCyAEKAIUIgBFDQAgAiAANgIUIAAgAjYCGAsCQCADQQ9NBEAgBCADIAVqIgBBA3I2AgQgACAEaiIAIAAoAgRBAXI2AgQMAQsgBCAFQQNyNgIEIAQgBWoiAiADQQFyNgIEIAIgA2ogAzYCACADQf8BTQRAIANBeHFB0B5qIQACf0GoHigCACIBQQEgA0EDdnQiA3FFBEBBqB4gASADcjYCACAADAELIAAoAggLIQEgACACNgIIIAEgAjYCDCACIAA2AgwgAiABNgIIDAELQR8hACADQf///wdNBEAgA0EmIANBCHZnIgBrdkEBcSAAQQF0a0E+aiEACyACIAA2AhwgAkIANwIQIABBAnRB2CBqIQECQAJAIAhBASAAdCIGcUUEQEGsHiAGIAhyNgIAIAEgAjYCAAwBCyADQRkgAEEBdmtBACAAQR9HG3QhACABKAIAIQUDQCAFIgEoAgRBeHEgA0YNAiAAQR12IQYgAEEBdCEAIAEgBkEEcWoiBigCECIFDQALIAYgAjYCEAsgAiABNgIYIAIgAjYCDCACIAI2AggMAQsgASgCCCIAIAI2AgwgASACNgIIIAJBADYCGCACIAE2AgwgAiAANgIICyAEQQhqIQAMAQsCQCAJRQ0AAkAgAigCHCIAQQJ0QdggaiIBKAIAIAJGBEAgASAENgIAIAQNAUGsHiALQX4gAHdxNgIADAILIAlBEEEUIAkoAhAgAkYbaiAENgIAIARFDQELIAQgCTYCGCACKAIQIgAEQCAEIAA2AhAgACAENgIYCyACKAIUIgBFDQAgBCAANgIUIAAgBDYCGAsCQCADQQ9NBEAgAiADIAVqIgBBA3I2AgQgACACaiIAIAAoAgRBAXI2AgQMAQsgAiAFQQNyNgIEIAIgBWoiBCADQQFyNgIEIAMgBGogAzYCACAHBEAgB0F4cUHQHmohAEG8HigCACEBAn9BASAHQQN2dCIFIAZxRQRAQageIAUgBnI2AgAgAAwBCyAAKAIICyEGIAAgATYCCCAGIAE2AgwgASAANgIMIAEgBjYCCAtBvB4gBDYCAEGwHiADNgIACyACQQhqIQALIApBEGokACAAC9URAw1/HH0BfiAAIAQoAgQiBiAEKAIAIglsQQN0aiEHAkAgBkEBRwRAIARBCGohCCACIAlsIQsgAiADbEEDdCEKIAAhBANAIAQgASALIAMgCCAFEAggASAKaiEBIAQgBkEDdGoiBCAHRw0ACwwBCyACIANsQQN0IQMgACEEA0AgBCABKQIANwIAIAEgA2ohASAEQQhqIgQgB0cNAAsLAkACQAJAAkACQAJAIAlBAmsOBAABAgMECyAFQYgCaiEEIAAgBkEDdGohAQNAIAEgACoCACABKgIAIhMgBCoCACIVlCAEKgIEIhQgASoCBCIWlJMiF5M4AgAgASAAKgIEIBMgFJQgFSAWlJIiE5M4AgQgACAXIAAqAgCSOAIAIAAgEyAAKgIEkjgCBCAAQQhqIQAgAUEIaiEBIAQgAkEDdGohBCAGQQFrIgYNAAsMBAsgBUGIAmoiBCACIAZsQQN0aioCBCETIAZBBHQhCSACQQR0IQggBCEHIAYhAwNAIAAgBkEDdGoiASAAKgIAuyABKgIAIhUgByoCACIUlCAHKgIEIhYgASoCBCIXlJMiGCAAIAlqIgUqAgAiGSAEKgIAIh6UIAQqAgQiHCAFKgIEIh2UkyIakiIbu0QAAAAAAADgP6KhtjgCACABIAAqAgS7IBUgFpQgFCAXlJIiFSAZIByUIB4gHZSSIhSSIha7RAAAAAAAAOA/oqG2OAIEIAAgGyAAKgIAkjgCACAAIBYgACoCBJI4AgQgBSATIBUgFJOUIhUgASoCAJI4AgAgBSABKgIEIBMgGCAak5QiFJM4AgQgASABKgIAIBWTOAIAIAEgFCABKgIEkjgCBCAAQQhqIQAgBCAIaiEEIAcgAkEDdGohByADQQFrIgMNAAsMAwsgBSgCBCELIAZBBHQhCiAGQRhsIQwgAkEYbCENIAJBBHQhDiAFQYgCaiIBIQQgBiEDIAEhBwNAIAAgBkEDdGoiBSoCACETIAUqAgQhFSAAIAxqIgkqAgAhFCAJKgIEIRYgByoCBCEXIAcqAgAhGCABKgIEIRkgASoCACEeIAAgACAKaiIIKgIAIhwgBCoCBCIdlCAEKgIAIhogCCoCBCIblJIiISAAKgIEIiCSIh84AgQgACAcIBqUIB0gG5STIhwgACoCACIdkiIaOAIAIAggHyATIBeUIBggFZSSIhsgFCAZlCAeIBaUkiIfkiIikzgCBCAIIBogEyAYlCAXIBWUkyITIBQgHpQgGSAWlJMiFJIiFZM4AgAgACAVIAAqAgCSOAIAIAAgIiAAKgIEkjgCBCAbIB+TIRUgEyAUkyETICAgIZMhFCAdIByTIRYgASANaiEBIAQgDmohBCAHIAJBA3RqIQcgBQJ9IAsEQCAUIBOTIRcgFiAVkiEYIBQgE5IhEyAWIBWTDAELIBQgE5IhFyAWIBWTIRggFCATkyETIBYgFZILOAIAIAUgEzgCBCAJIBg4AgAgCSAXOAIEIABBCGohACADQQFrIgMNAAsMAgsgBkEATA0BIAVBiAJqIgMgAiAGbCIBQQR0aiIEKgIEIRMgBCoCACEVIAMgAUEDdGoiASoCBCEUIAEqAgAhFiACQQNsIQsgACAGQQN0aiEBIAAgBkEEdGohBCAAIAZBGGxqIQcgACAGQQV0aiEFQQAhCQNAIAAqAgAhFyAAIAAqAgQiGCAEKgIAIhwgAyACIAlsIghBBHRqIgoqAgQiHZQgCioCACIaIAQqAgQiG5SSIiEgByoCACIgIAMgCSALbEEDdGoiCioCBCIflCAKKgIAIiIgByoCBCIjlJIiJJIiGSABKgIAIiUgAyAIQQN0aiIKKgIEIiaUIAoqAgAiJyABKgIEIiiUkiIpIAUqAgAiKiADIAhBBXRqIggqAgQiK5QgCCoCACIsIAUqAgQiLZSSIi6SIh6SkjgCBCAAIBcgHCAalCAdIBuUkyIaICAgIpQgHyAjlJMiG5IiHCAlICeUICYgKJSTIiAgKiAslCArIC2UkyIfkiIdkpI4AgAgASAZIBWUIBggHiAWlJKSIiIgICAfkyIgjCAUlCATIBogG5MiGpSTIhuTOAIEIAEgHCAVlCAXIB0gFpSSkiIfICkgLpMiIyAUlCATICEgJJMiIZSSIiSTOAIAIAUgIiAbkjgCBCAFICQgH5I4AgAgBCAZIBaUIBggHiAVlJKSIhggICATlCAUIBqUkyIZkjgCBCAEIBQgIZQgIyATlJMiHiAcIBaUIBcgHSAVlJKSIheSOAIAIAcgGCAZkzgCBCAHIBcgHpM4AgAgBUEIaiEFIAdBCGohByAEQQhqIQQgAUEIaiEBIABBCGohACAJQQFqIgkgBkcNAAsMAQsgBSgCACELIAlBA3QQByEIAkAgCUECSA0AIAZBAEwNACAFQYgCaiENIAlBfHEhDiAJQQNxIQogCUEBa0EDSSEPQQAhBwNAIAchAUEAIQRBACEDIA9FBEADQCAIIARBA3QiBWogACABQQN0aikCADcCACAIIAVBCHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBEHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBGHJqIAAgASAGaiIBQQN0aikCADcCACAEQQRqIQQgASAGaiEBIANBBGoiAyAORw0ACwtBACEFIAoEQANAIAggBEEDdGogACABQQN0aikCADcCACAEQQFqIQQgASAGaiEBIAVBAWoiBSAKRw0ACwsgCCkCACIvp74hFUEAIQwgByEDA0AgACADQQN0aiIFIC83AgAgAiADbCEQIAUqAgQhFEEBIQEgFSETQQAhBANAIAUgEyAIIAFBA3RqIhEqAgAiFiANIAQgEGoiBCALQQAgBCALThtrIgRBA3RqIhIqAgAiF5QgEioCBCIYIBEqAgQiGZSTkiITOAIAIAUgFCAWIBiUIBcgGZSSkiIUOAIEIAFBAWoiASAJRw0ACyADIAZqIQMgDEEBaiIMIAlHDQALIAdBAWoiByAGRw0ACwsgCBAGCwsDAAELwQEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABAEDAELIAAgAKEgAkGAgMD/B08NABoCQAJAAkACQCAAIAEQC0EDcQ4DAAECAwsgASsDACABKwMIEAQMAwsgASsDACABKwMIQQEQA5oMAgsgASsDACABKwMIEASaDAELIAErAwAgASsDCEEBEAMLIQAgAUEQaiQAIAALuBgDFH8EfAF+IwBBMGsiCCQAAkACQAJAIAC9IhpCIIinIgNB/////wdxIgZB+tS9gARNBEAgA0H//z9xQfvDJEYNASAGQfyyi4AETQRAIBpCAFkEQCABIABEAABAVPsh+b+gIgBEMWNiGmG00L2gIhY5AwAgASAAIBahRDFjYhphtNC9oDkDCEEB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IAIgC0chCiACQQFqIQIgCg0ACwsgBUGgAWogBkEDdGogADkDACAEQQBKIQIgBEEBayEEIAINAAsLRAAAAAAAAAAAIQAgA0EATgRAIAMhAgNAIAIiBEEBayECIAAgBUGgAWogBEEDdGorAwCgIQAgBA0ACwsgCCAAmiAAIAwbOQMAIAUrA6ABIAChIQBBASECIANBAEoEQANAIAAgBUGgAWogAkEDdGorAwCgIQAgAiADRyEEIAJBAWohAiAEDQALCyAIIACaIAAgDBs5AwggBUGwBGokACAHQQdxIQMgCCsDACEAIBpCAFMEQCABIACaOQMAIAEgCCsDCJo5AwhBACADayEDDAELIAEgADkDACABIAgrAwg5AwgLIAhBMGokACADC8UBAQJ/IwBBEGsiASQAAkAgAL1CIIinQf////8HcSICQfvDpP8DTQRAIAJBgIDA8gNJDQEgAEQAAAAAAAAAAEEAEAMhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCwJAAkACQAJAIAAgARALQQNxDgMAAQIDCyABKwMAIAErAwhBARADIQAMAwsgASsDACABKwMIEAQhAAwCCyABKwMAIAErAwhBARADmiEADAELIAErAwAgASsDCBAEmiEACyABQRBqJAAgAAuhBAEDfyABIAJGBEAgACgCAEEDdBAHIgQgAUEBQQEgAEEIaiAAEAggBCECAkAgACgCAEEDdCIDQYAETwRAIAEgAiADEAEMAQsgASADaiEAAkAgASACc0EDcUUEQAJAIAFBA3FFDQAgA0UNAANAIAEgAi0AADoAACACQQFqIQIgAUEBaiIBQQNxRQ0BIAAgAUsNAAsLAkAgAEF8cSIDQcAASQ0AIAEgA0FAaiIFSw0AA0AgASACKAIANgIAIAEgAigCBDYCBCABIAIoAgg2AgggASACKAIMNgIMIAEgAigCEDYCECABIAIoAhQ2AhQgASACKAIYNgIYIAEgAigCHDYCHCABIAIoAiA2AiAgASACKAIkNgIkIAEgAigCKDYCKCABIAIoAiw2AiwgASACKAIwNgIwIAEgAigCNDYCNCABIAIoAjg2AjggASACKAI8NgI8IAJBQGshAiABQUBrIgEgBU0NAAsLIAEgA08NAQNAIAEgAigCADYCACACQQRqIQIgAUEEaiIBIANJDQALDAELIABBBEkNACAB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";
				AA(J) || (J = e(J));
				function gA(g) {
					if (g == J && s) return new Uint8Array(s);
					var a = aA(g);
					if (a) return a;
					if (c) return c(g);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function S(g, a) {
					var n, G = gA(g);
					return n = new WebAssembly.Module(G), [new WebAssembly.Instance(n, a), n];
				}
				function V() {
					var g = { a: u };
					function a(n, G) {
						var k = n.exports;
						return D = k, h = D.c, l(), D.j, W(D.d), _("wasm-instantiate"), k;
					}
					if (z("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(g, a);
					} catch (n) {
						w("Module.instantiateWasm callback failed with error: " + n), C(n);
					}
					return a(S(J, g)[0]);
				}
				var p = (g) => {
					for (; g.length > 0;) g.shift()(A);
				}, CA = (g, a, n) => F.copyWithin(g, a, a + n), QA = (g) => {
					x("OOM");
				}, IA = (g) => {
					F.length, g >>>= 0, QA(g);
				};
				function BA(g) {
					return A["_" + g];
				}
				var EA = (g, a) => {
					N.set(g, a);
				}, eA = (g) => {
					for (var a = 0, n = 0; n < g.length; ++n) {
						var G = g.charCodeAt(n);
						G <= 127 ? a++ : G <= 2047 ? a += 2 : G >= 55296 && G <= 57343 ? (a += 4, ++n) : a += 3;
					}
					return a;
				}, tA = (g, a, n, G) => {
					if (!(G > 0)) return 0;
					for (var k = n, M = n + G - 1, R = 0; R < g.length; ++R) {
						var U = g.charCodeAt(R);
						if (U >= 55296 && U <= 57343) {
							var P = g.charCodeAt(++R);
							U = 65536 + ((U & 1023) << 10) | P & 1023;
						}
						if (U <= 127) {
							if (n >= M) break;
							a[n++] = U;
						} else if (U <= 2047) {
							if (n + 1 >= M) break;
							a[n++] = 192 | U >> 6, a[n++] = 128 | U & 63;
						} else if (U <= 65535) {
							if (n + 2 >= M) break;
							a[n++] = 224 | U >> 12, a[n++] = 128 | U >> 6 & 63, a[n++] = 128 | U & 63;
						} else {
							if (n + 3 >= M) break;
							a[n++] = 240 | U >> 18, a[n++] = 128 | U >> 12 & 63, a[n++] = 128 | U >> 6 & 63, a[n++] = 128 | U & 63;
						}
					}
					return a[n] = 0, n - k;
				}, oA = (g, a, n) => tA(g, F, a, n), sA = (g) => {
					var a = eA(g) + 1, n = UA(a);
					return oA(g, n, a), n;
				}, fA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, FA = (g, a, n) => {
					for (var G = a + n, k = a; g[k] && !(k >= G);) ++k;
					if (k - a > 16 && g.buffer && fA) return fA.decode(g.subarray(a, k));
					for (var M = ""; a < k;) {
						var R = g[a++];
						if (!(R & 128)) {
							M += String.fromCharCode(R);
							continue;
						}
						var U = g[a++] & 63;
						if ((R & 224) == 192) {
							M += String.fromCharCode((R & 31) << 6 | U);
							continue;
						}
						var P = g[a++] & 63;
						if ((R & 240) == 224 ? R = (R & 15) << 12 | U << 6 | P : R = (R & 7) << 18 | U << 12 | P << 6 | g[a++] & 63, R < 65536) M += String.fromCharCode(R);
						else {
							var j = R - 65536;
							M += String.fromCharCode(55296 | j >> 10, 56320 | j & 1023);
						}
					}
					return M;
				}, nA = (g, a) => g ? FA(F, g, a) : "", lA = function(g, a, n, G, k) {
					var M = {
						string: (X) => {
							var OA = 0;
							return X != null && X !== 0 && (OA = sA(X)), OA;
						},
						array: (X) => {
							var OA = UA(X.length);
							return EA(X, OA), OA;
						}
					};
					function R(X) {
						return a === "string" ? nA(X) : a === "boolean" ? !!X : X;
					}
					var U = BA(g), P = [], j = 0;
					if (G) for (var DA = 0; DA < G.length; DA++) {
						var RA = M[n[DA]];
						RA ? (j === 0 && (j = HA()), P[DA] = RA(G[DA])) : P[DA] = G[DA];
					}
					var mA = U.apply(null, P);
					function m(X) {
						return j !== 0 && GA(j), R(X);
					}
					return mA = m(mA), mA;
				}, NA = function(g, a, n, G) {
					var k = !n || n.every((M) => M === "number" || M === "boolean");
					return a !== "string" && k && !G ? BA(g) : function() {
						return lA(g, a, n, arguments, G);
					};
				}, u = {
					b: CA,
					a: IA
				}, rA = V();
				rA.d, A._kiss_fft_free = rA.e, A._free = rA.f, A._kiss_fft_alloc = rA.g, A._malloc = rA.h, A._kiss_fft = rA.i, rA.__errno_location;
				var HA = rA.k, GA = rA.l, UA = rA.m;
				function vA(g) {
					try {
						for (var a = atob(g), n = new Uint8Array(a.length), G = 0; G < a.length; ++G) n[G] = a.charCodeAt(G);
						return n;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function aA(g) {
					if (AA(g)) return vA(g.slice($.length));
				}
				A.ccall = lA, A.cwrap = NA;
				var hA;
				H = function g() {
					hA || B(), hA || (H = g);
				};
				function B() {
					if (d > 0 || (b(), d > 0)) return;
					function g() {
						hA || (hA = !0, A.calledRun = !0, !f && (K(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), g();
					}, 1)) : g();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return B(), I;
			});
		})();
	})), kA, rI, RI, tI, NI, Qg = iA((() => {
		Cg(), kA = lI({}), rI = kA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), RI = kA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), tI = kA.cwrap("kiss_fft_free", "void", ["number"]), NI = class {
			constructor(E) {
				this.size = E, this.fcfg = rI(this.size, !1), this.icfg = rI(this.size, !0), this.inptr = kA._malloc(this.size * 8), this.cin = new Float32Array(kA.HEAPU8.buffer, this.inptr, this.size * 2);
			}
			fft = function(E) {
				const I = kA._malloc(this.size * 8), A = new Float32Array(kA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(E), RI(this.fcfg, this.inptr, I);
				let i = new Float32Array(this.size * 2);
				return i.set(A), kA._free(I), i;
			};
			dispose() {
				tI(this.fcfg), tI(this.icfg), kA._free(this.inptr);
			}
		};
	}));
	function cA(E) {
		if (this.size = E | 0, this.size <= 1 || (this.size & this.size - 1) !== 0) throw new Error("FFT size must be a power of two and bigger than 1");
		this._csize = E << 1;
		for (var I = new Array(this.size * 2), A = 0; A < I.length; A += 2) {
			const t = Math.PI * A / this.size;
			I[A] = Math.cos(t), I[A + 1] = -Math.sin(t);
		}
		this.table = I;
		for (var i = 0, C = 1; this.size > C; C <<= 1) i++;
		this._width = i % 2 === 0 ? i - 1 : i, this._bitrev = new Array(1 << this._width);
		for (var Q = 0; Q < this._bitrev.length; Q++) {
			this._bitrev[Q] = 0;
			for (var r = 0; r < this._width; r += 2) {
				var o = this._width - r - 2;
				this._bitrev[Q] |= (Q >>> r & 3) << o;
			}
		}
		this._out = null, this._data = null, this._inv = 0;
	}
	var Eg = iA((() => {
		cA.prototype.fromComplexArray = function(I, A) {
			for (var i = A || new Array(I.length >>> 1), C = 0; C < I.length; C += 2) i[C >>> 1] = I[C];
			return i;
		}, cA.prototype.createComplexArray = function() {
			const I = new Array(this._csize);
			for (var A = 0; A < I.length; A++) I[A] = 0;
			return I;
		}, cA.prototype.toComplexArray = function(I, A) {
			for (var i = A || this.createComplexArray(), C = 0; C < i.length; C += 2) i[C] = I[C >>> 1], i[C + 1] = 0;
			return i;
		}, cA.prototype.completeSpectrum = function(I) {
			for (var A = this._csize, i = A >>> 1, C = 2; C < i; C += 2) I[A - C] = I[C], I[A - C + 1] = -I[C + 1];
		}, cA.prototype.transform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._transform4(), this._out = null, this._data = null;
		}, cA.prototype.realTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._realTransform4(), this._out = null, this._data = null;
		}, cA.prototype.inverseTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 1, this._transform4();
			for (var i = 0; i < I.length; i++) I[i] /= this.size;
			this._out = null, this._data = null;
		}, cA.prototype._transform4 = function() {
			var I = this._out, A = this._csize, i = 1 << this._width, C = A / i << 1, Q, r, o = this._bitrev;
			if (C === 4) for (Q = 0, r = 0; Q < A; Q += C, r++) {
				const D = o[r];
				this._singleTransform2(Q, D, i);
			}
			else for (Q = 0, r = 0; Q < A; Q += C, r++) {
				const D = o[r];
				this._singleTransform4(Q, D, i);
			}
			var t = this._inv ? -1 : 1, e = this.table;
			for (i >>= 2; i >= 2; i >>= 2) {
				C = A / i << 1;
				var c = C >>> 2;
				for (Q = 0; Q < A; Q += C) for (var w = Q + c, s = Q, h = 0; s < w; s += 2, h += i) {
					const D = s, f = D + c, N = f + c, F = N + c, l = I[D], y = I[D + 1], Y = I[f], v = I[f + 1], b = I[N], K = I[N + 1], T = I[F], Z = I[F + 1], W = l, O = y, d = e[h], L = t * e[h + 1], H = Y * d - v * L, z = Y * L + v * d, _ = e[2 * h], x = t * e[2 * h + 1], $ = b * _ - K * x, AA = b * x + K * _, J = e[3 * h], gA = t * e[3 * h + 1], S = T * J - Z * gA, V = T * gA + Z * J, p = W + $, CA = O + AA, QA = W - $, IA = O - AA, BA = H + S, EA = z + V, eA = t * (H - S), tA = t * (z - V), oA = p + BA, sA = CA + EA, fA = p - BA, FA = CA - EA, nA = QA + tA, lA = IA - eA, NA = QA - tA, u = IA + eA;
					I[D] = oA, I[D + 1] = sA, I[f] = nA, I[f + 1] = lA, I[N] = fA, I[N + 1] = FA, I[F] = NA, I[F + 1] = u;
				}
			}
		}, cA.prototype._singleTransform2 = function(I, A, i) {
			const C = this._out, Q = this._data, r = Q[A], o = Q[A + 1], t = Q[A + i], e = Q[A + i + 1], c = r + t, w = o + e, s = r - t, h = o - e;
			C[I] = c, C[I + 1] = w, C[I + 2] = s, C[I + 3] = h;
		}, cA.prototype._singleTransform4 = function(I, A, i) {
			const C = this._out, Q = this._data, r = this._inv ? -1 : 1, o = i * 2, t = i * 3, e = Q[A], c = Q[A + 1], w = Q[A + i], s = Q[A + i + 1], h = Q[A + o], D = Q[A + o + 1], f = Q[A + t], N = Q[A + t + 1], F = e + h, l = c + D, y = e - h, Y = c - D, v = w + f, b = s + N, K = r * (w - f), T = r * (s - N), Z = F + v, W = l + b, O = y + T, d = Y - K, L = F - v, H = l - b, z = y - T, _ = Y + K;
			C[I] = Z, C[I + 1] = W, C[I + 2] = O, C[I + 3] = d, C[I + 4] = L, C[I + 5] = H, C[I + 6] = z, C[I + 7] = _;
		}, cA.prototype._realTransform4 = function() {
			var I = this._out, A = this._csize, i = 1 << this._width, C = A / i << 1, Q, r, o = this._bitrev;
			if (C === 4) for (Q = 0, r = 0; Q < A; Q += C, r++) {
				const M = o[r];
				this._singleRealTransform2(Q, M >>> 1, i >>> 1);
			}
			else for (Q = 0, r = 0; Q < A; Q += C, r++) {
				const M = o[r];
				this._singleRealTransform4(Q, M >>> 1, i >>> 1);
			}
			var t = this._inv ? -1 : 1, e = this.table;
			for (i >>= 2; i >= 2; i >>= 2) {
				C = A / i << 1;
				var c = C >>> 1, w = c >>> 1, s = w >>> 1;
				for (Q = 0; Q < A; Q += C) for (var h = 0, D = 0; h <= s; h += 2, D += i) {
					var f = Q + h, N = f + w, F = N + w, l = F + w, y = I[f], Y = I[f + 1], v = I[N], b = I[N + 1], K = I[F], T = I[F + 1], Z = I[l], W = I[l + 1], O = y, d = Y, L = e[D], H = t * e[D + 1], z = v * L - b * H, _ = v * H + b * L, x = e[2 * D], $ = t * e[2 * D + 1], AA = K * x - T * $, J = K * $ + T * x, gA = e[3 * D], S = t * e[3 * D + 1], V = Z * gA - W * S, p = Z * S + W * gA, CA = O + AA, QA = d + J, IA = O - AA, BA = d - J, EA = z + V, eA = _ + p, tA = t * (z - V), oA = t * (_ - p), sA = CA + EA, fA = QA + eA, FA = IA + oA, nA = BA - tA;
					if (I[f] = sA, I[f + 1] = fA, I[N] = FA, I[N + 1] = nA, h === 0) {
						var lA = CA - EA, NA = QA - eA;
						I[F] = lA, I[F + 1] = NA;
						continue;
					}
					if (h !== s) {
						var u = IA, rA = -BA, HA = CA, GA = -QA, UA = -t * oA, vA = -t * tA, aA = -t * eA, hA = -t * EA, B = u + UA, g = rA + vA, a = HA + hA, n = GA - aA, G = Q + w - h, k = Q + c - h;
						I[G] = B, I[G + 1] = g, I[k] = a, I[k + 1] = n;
					}
				}
			}
		}, cA.prototype._singleRealTransform2 = function(I, A, i) {
			const C = this._out, Q = this._data, r = Q[A], o = Q[A + i], t = r + o, e = r - o;
			C[I] = t, C[I + 1] = 0, C[I + 2] = e, C[I + 3] = 0;
		}, cA.prototype._singleRealTransform4 = function(I, A, i) {
			const C = this._out, Q = this._data, r = this._inv ? -1 : 1, o = i * 2, t = i * 3, e = Q[A], c = Q[A + i], w = Q[A + o], s = Q[A + t], h = e + w, D = e - w, f = c + s, N = r * (c - s), F = h + f, l = D, y = -N, Y = h - f, v = D, b = N;
			C[I] = F, C[I + 1] = 0, C[I + 2] = l, C[I + 3] = y, C[I + 4] = Y, C[I + 5] = 0, C[I + 6] = v, C[I + 7] = b;
		};
	})), aI, ig = iA((() => {
		Eg(), aI = class {
			constructor(E) {
				this.size = E, this.indutnyFft = new cA(E);
			}
			fft(E) {
				const I = new Float32Array(2 * this.size);
				return this.indutnyFft.transform(I, E), I;
			}
		};
	})), yI, rg = iA((() => {
		yI = (() => {
			var E = self.location.href;
			return (function(I = {}) {
				var A = I, i, C;
				A.ready = new Promise((B, g) => {
					i = B, C = g;
				});
				var Q = Object.assign({}, A), r = !0, o = !1, t = "";
				function e(B) {
					return A.locateFile ? A.locateFile(B, t) : t + B;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), E && (t = E), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (B) => {
					var g = new XMLHttpRequest();
					return g.open("GET", B, !1), g.responseType = "arraybuffer", g.send(null), new Uint8Array(g.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, Q), Q = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && x("no native wasm support detected");
				var h, D, f = !1, N, F;
				function l() {
					var B = h.buffer;
					A.HEAP8 = N = new Int8Array(B), A.HEAP16 = new Int16Array(B), A.HEAP32 = new Int32Array(B), A.HEAPU8 = F = new Uint8Array(B), A.HEAPU16 = new Uint16Array(B), A.HEAPU32 = new Uint32Array(B), A.HEAPF32 = new Float32Array(B), A.HEAPF64 = new Float64Array(B);
				}
				var y = [], Y = [], v = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) Z(A.preRun.shift());
					p(y);
				}
				function K() {
					p(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) O(A.postRun.shift());
					p(v);
				}
				function Z(B) {
					y.unshift(B);
				}
				function W(B) {
					Y.unshift(B);
				}
				function O(B) {
					v.unshift(B);
				}
				var d = 0, L = null, H = null;
				function z(B) {
					d++, A.monitorRunDependencies && A.monitorRunDependencies(d);
				}
				function _(B) {
					if (d--, A.monitorRunDependencies && A.monitorRunDependencies(d), d == 0 && (L !== null && (clearInterval(L), L = null), H)) {
						var g = H;
						H = null, g();
					}
				}
				function x(B) {
					A.onAbort && A.onAbort(B), B = "Aborted(" + B + ")", w(B), f = !0, B += ". Build with -sASSERTIONS for more info.";
					var g = new WebAssembly.RuntimeError(B);
					throw C(g), g;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(B) {
					return B.startsWith($);
				}
				var J = "data:application/octet-stream;base64,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ACACSwRAQbgeIAI2AgALIAIgBmohAUHoISEAAkACQAJAA0AgASAAKAIARwRAIAAoAggiAA0BDAILCyAALQAMQQhxRQ0BC0HoISEAA0AgAyAAKAIAIgFPBEAgASAAKAIEaiIEIANLDQMLIAAoAgghAAwACwALIAAgAjYCACAAIAAoAgQgBmo2AgQgAkF4IAJrQQdxaiIHIAVBA3I2AgQgAUF4IAFrQQdxaiIGIAUgB2oiBWshACADIAZGBEBBwB4gBTYCAEG0HkG0HigCACAAaiIANgIAIAUgAEEBcjYCBAwIC0G8HigCACAGRgRAQbweIAU2AgBBsB5BsB4oAgAgAGoiADYCACAFIABBAXI2AgQgACAFaiAANgIADAgLIAYoAgQiA0EDcUEBRw0GIANBeHEhCSADQf8BTQRAIAYoAgwiASAGKAIIIgJGBEBBqB5BqB4oAgBBfiADQQN2d3E2AgAMBwsgAiABNgIMIAEgAjYCCAwGCyAGKAIYIQggBiAGKAIMIgJHBEAgBigCCCIBIAI2AgwgAiABNgIIDAULIAZBFGoiASgCACIDRQRAIAYoAhAiA0UNBCAGQRBqIQELA0AgASEEIAMiAkEUaiIBKAIAIgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHY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";
				AA(J) || (J = e(J));
				function gA(B) {
					if (B == J && s) return new Uint8Array(s);
					var g = vA(B);
					if (g) return g;
					if (c) return c(B);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function S(B, g) {
					var a, n = gA(B);
					return a = new WebAssembly.Module(n), [new WebAssembly.Instance(a, g), a];
				}
				function V() {
					var B = { a: NA };
					function g(a, n) {
						var G = a.exports;
						return D = G, h = D.b, l(), D.e, W(D.c), _("wasm-instantiate"), G;
					}
					if (z("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(B, g);
					} catch (a) {
						w("Module.instantiateWasm callback failed with error: " + a), C(a);
					}
					return g(S(J, B)[0]);
				}
				var p = (B) => {
					for (; B.length > 0;) B.shift()(A);
				}, CA = (B) => {
					x("OOM");
				}, QA = (B) => {
					F.length, B >>>= 0, CA(B);
				};
				function IA(B) {
					return A["_" + B];
				}
				var BA = (B, g) => {
					N.set(B, g);
				}, EA = (B) => {
					for (var g = 0, a = 0; a < B.length; ++a) {
						var n = B.charCodeAt(a);
						n <= 127 ? g++ : n <= 2047 ? g += 2 : n >= 55296 && n <= 57343 ? (g += 4, ++a) : g += 3;
					}
					return g;
				}, eA = (B, g, a, n) => {
					if (!(n > 0)) return 0;
					for (var G = a, k = a + n - 1, M = 0; M < B.length; ++M) {
						var R = B.charCodeAt(M);
						if (R >= 55296 && R <= 57343) {
							var U = B.charCodeAt(++M);
							R = 65536 + ((R & 1023) << 10) | U & 1023;
						}
						if (R <= 127) {
							if (a >= k) break;
							g[a++] = R;
						} else if (R <= 2047) {
							if (a + 1 >= k) break;
							g[a++] = 192 | R >> 6, g[a++] = 128 | R & 63;
						} else if (R <= 65535) {
							if (a + 2 >= k) break;
							g[a++] = 224 | R >> 12, g[a++] = 128 | R >> 6 & 63, g[a++] = 128 | R & 63;
						} else {
							if (a + 3 >= k) break;
							g[a++] = 240 | R >> 18, g[a++] = 128 | R >> 12 & 63, g[a++] = 128 | R >> 6 & 63, g[a++] = 128 | R & 63;
						}
					}
					return g[a] = 0, a - G;
				}, tA = (B, g, a) => eA(B, F, g, a), oA = (B) => {
					var g = EA(B) + 1, a = GA(g);
					return tA(B, a, g), a;
				}, sA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, fA = (B, g, a) => {
					for (var n = g + a, G = g; B[G] && !(G >= n);) ++G;
					if (G - g > 16 && B.buffer && sA) return sA.decode(B.subarray(g, G));
					for (var k = ""; g < G;) {
						var M = B[g++];
						if (!(M & 128)) {
							k += String.fromCharCode(M);
							continue;
						}
						var R = B[g++] & 63;
						if ((M & 224) == 192) {
							k += String.fromCharCode((M & 31) << 6 | R);
							continue;
						}
						var U = B[g++] & 63;
						if ((M & 240) == 224 ? M = (M & 15) << 12 | R << 6 | U : M = (M & 7) << 18 | R << 12 | U << 6 | B[g++] & 63, M < 65536) k += String.fromCharCode(M);
						else {
							var P = M - 65536;
							k += String.fromCharCode(55296 | P >> 10, 56320 | P & 1023);
						}
					}
					return k;
				}, FA = (B, g) => B ? fA(F, B, g) : "", nA = function(B, g, a, n, G) {
					var k = {
						string: (m) => {
							var X = 0;
							return m != null && m !== 0 && (X = oA(m)), X;
						},
						array: (m) => {
							var X = GA(m.length);
							return BA(m, X), X;
						}
					};
					function M(m) {
						return g === "string" ? FA(m) : g === "boolean" ? !!m : m;
					}
					var R = IA(B), U = [], P = 0;
					if (n) for (var j = 0; j < n.length; j++) {
						var DA = k[a[j]];
						DA ? (P === 0 && (P = rA()), U[j] = DA(n[j])) : U[j] = n[j];
					}
					var RA = R.apply(null, U);
					function mA(m) {
						return P !== 0 && HA(P), M(m);
					}
					return RA = mA(RA), RA;
				}, lA = function(B, g, a, n) {
					var G = !a || a.every((k) => k === "number" || k === "boolean");
					return g !== "string" && G && !n ? IA(B) : function() {
						return nA(B, g, a, arguments, n);
					};
				}, NA = { a: QA }, u = V();
				u.c, A._fftCross = u.d, u.__errno_location, A._malloc = u.f, A._free = u.g;
				var rA = u.h, HA = u.i, GA = u.j;
				function UA(B) {
					try {
						for (var g = atob(B), a = new Uint8Array(g.length), n = 0; n < g.length; ++n) a[n] = g.charCodeAt(n);
						return a;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function vA(B) {
					if (AA(B)) return UA(B.slice($.length));
				}
				A.ccall = nA, A.cwrap = lA;
				var aA;
				H = function B() {
					aA || hA(), aA || (H = B);
				};
				function hA() {
					if (d > 0 || (b(), d > 0)) return;
					function B() {
						aA || (aA = !0, A.calledRun = !0, !f && (K(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), B();
					}, 1)) : B();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return hA(), I;
			});
		})();
	}));
	function tg(E) {
		this.size = E, this.n = E * 8, this.ptr = uA._malloc(this.n * 4), this.ri = new Uint8Array(uA.HEAPU8.buffer, this.ptr, this.n), this.ii = new Uint8Array(uA.HEAPU8.buffer, this.ptr + this.n, this.n), this.transform = function(I, A, i) {
			var C = this.ptr, Q = this.n;
			return this.ri.set(new Uint8Array(I.buffer)), this.ii.set(new Uint8Array(A.buffer)), MI(this.size, i, C, C + Q, C + Q * 2, C + Q * 3), {
				real: new Float64Array(uA.HEAPU8.buffer, C + Q * 2, this.size),
				imag: new Float64Array(uA.HEAPU8.buffer, C + Q * 3, this.size)
			};
		}, this.dispose = function() {
			uA._free(this.ptr);
		};
	}
	var uA, MI, ag = iA((() => {
		rg(), uA = yI({}), MI = uA.cwrap("fftCross", "void", [
			"number",
			"number",
			"number",
			"number",
			"number",
			"number"
		]);
	})), GI, eg = iA((() => {
		ag(), GI = class {
			constructor(E) {
				this.size = E, this.fftcross = new tg(E), this.real = new Float64Array(this.size), this.imag = new Float64Array(this.size);
			}
			fft(E) {
				for (var I = 0; I < this.size; I++) this.real[I] = E[2 * I], this.imag[I] = E[2 * I + 1];
				const A = this.fftcross.transform(this.real, this.imag, !1), i = new Float32Array(2 * this.size);
				for (var I = 0; I < this.size; I++) i[2 * I] = A.real[I], i[2 * I + 1] = A.imag[I];
				return i;
			}
		};
	}));
	function og(E) {
		this.n = E, this.levels = -1;
		for (var I = 0; I < 32; I++) 1 << I == E && (this.levels = I);
		if (this.levels == -1) throw "Length is not a power of 2";
		this.cosTable = new Array(E / 2), this.sinTable = new Array(E / 2);
		for (var I = 0; I < E / 2; I++) this.cosTable[I] = Math.cos(2 * Math.PI * I / E), this.sinTable[I] = Math.sin(2 * Math.PI * I / E);
		this.forward = function(A, i) {
			for (var C = this.n, Q = 0; Q < C; Q++) {
				var r = D(Q, this.levels);
				if (r > Q) {
					var o = A[Q];
					A[Q] = A[r], A[r] = o, o = i[Q], i[Q] = i[r], i[r] = o;
				}
			}
			for (var t = 2; t <= C; t *= 2) for (var e = t / 2, c = C / t, Q = 0; Q < C; Q += t) for (var r = Q, w = 0; r < Q + e; r++, w += c) {
				var s = A[r + e] * this.cosTable[w] + i[r + e] * this.sinTable[w], h = -A[r + e] * this.sinTable[w] + i[r + e] * this.cosTable[w];
				A[r + e] = A[r] - s, i[r + e] = i[r] - h, A[r] += s, i[r] += h;
			}
			function D(f, N) {
				for (var F = 0, l = 0; l < N; l++) F = F << 1 | f & 1, f >>>= 1;
				return F;
			}
		}, this.inverse = function(A, i) {
			forward(i, A);
		};
	}
	var ng = iA((() => {})), YI, sg = iA((() => {
		ng(), YI = class {
			constructor(E) {
				this.size = E, this.fftNayuki = new og(E);
			}
			fft(E) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), i = new Float32Array(this.size * 2);
				for (var C = 0; C < this.size; ++C) I[C] = E[C * 2], A[C] = E[C * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var C = 0; C < this.size; ++C) i[C * 2] = I[C], i[C * 2 + 1] = A[C];
				return i;
			}
		};
	})), kI, Dg = iA((() => {
		kI = (() => {
			var E = self.location.href;
			return (function(I = {}) {
				var A = I, i, C;
				A.ready = new Promise((B, g) => {
					i = B, C = g;
				});
				var Q = Object.assign({}, A), r = !0, o = !1, t = "";
				function e(B) {
					return A.locateFile ? A.locateFile(B, t) : t + B;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), E && (t = E), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (B) => {
					var g = new XMLHttpRequest();
					return g.open("GET", B, !1), g.responseType = "arraybuffer", g.send(null), new Uint8Array(g.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, Q), Q = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && x("no native wasm support detected");
				var h, D, f = !1, N, F;
				function l() {
					var B = h.buffer;
					A.HEAP8 = N = new Int8Array(B), A.HEAP16 = new Int16Array(B), A.HEAP32 = new Int32Array(B), A.HEAPU8 = F = new Uint8Array(B), A.HEAPU16 = new Uint16Array(B), A.HEAPU32 = new Uint32Array(B), A.HEAPF32 = new Float32Array(B), A.HEAPF64 = new Float64Array(B);
				}
				var y = [], Y = [], v = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) Z(A.preRun.shift());
					p(y);
				}
				function K() {
					p(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) O(A.postRun.shift());
					p(v);
				}
				function Z(B) {
					y.unshift(B);
				}
				function W(B) {
					Y.unshift(B);
				}
				function O(B) {
					v.unshift(B);
				}
				var d = 0, L = null, H = null;
				function z(B) {
					d++, A.monitorRunDependencies && A.monitorRunDependencies(d);
				}
				function _(B) {
					if (d--, A.monitorRunDependencies && A.monitorRunDependencies(d), d == 0 && (L !== null && (clearInterval(L), L = null), H)) {
						var g = H;
						H = null, g();
					}
				}
				function x(B) {
					A.onAbort && A.onAbort(B), B = "Aborted(" + B + ")", w(B), f = !0, B += ". Build with -sASSERTIONS for more info.";
					var g = new WebAssembly.RuntimeError(B);
					throw C(g), g;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(B) {
					return B.startsWith($);
				}
				var J = "data:application/octet-stream;base64,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IgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHYIGohAQJAAkBBrB4oAgAiBEEBIAB0IgZxRQRAQaweIAQgBnI2AgAgASADNgIADAELIAJBGSAAQQF2a0EAIABBH0cbdCEAIAEoAgAhBANAIAQiASgCBEF4cSACRg0CIABBHXYhBCAAQQF0IQAgASAEQQRxaiIGKAIQIgQNAAsgBiADNgIQCyADIAE2AhggAyADNgIMIAMgAzYCCAwBCyABKAIIIgAgAzYCDCABIAM2AgggA0EANgIYIAMgATYCDCADIAA2AggLQbQeKAIAIgAgBU0NAEG0HiAAIAVrIgE2AgBBwB5BwB4oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADAgLQaQeQTA2AgBBACEADAcLQQAhAgsgCEUNAAJAIAYoAhwiAUECdEHYIGoiBCgCACAGRgRAIAQgAjYCACACDQFBrB5BrB4oAgBBfiABd3E2AgAMAgsgCEEQQRQgCCgCECAGRhtqIAI2AgAgAkUNAQsgAiAINgIYIAYoAhAiAQRAIAIgATYCECABIAI2AhgLIAYoAhQiAUUNACACIAE2AhQgASACNgIYCyAAIAlqIQAgBiAJaiIGKAIEIQMLIAYgA0F+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";
				AA(J) || (J = e(J));
				function gA(B) {
					if (B == J && s) return new Uint8Array(s);
					var g = vA(B);
					if (g) return g;
					if (c) return c(B);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function S(B, g) {
					var a, n = gA(B);
					return a = new WebAssembly.Module(n), [new WebAssembly.Instance(a, g), a];
				}
				function V() {
					var B = { a: NA };
					function g(a, n) {
						var G = a.exports;
						return D = G, h = D.b, l(), D.l, W(D.c), _("wasm-instantiate"), G;
					}
					if (z("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(B, g);
					} catch (a) {
						w("Module.instantiateWasm callback failed with error: " + a), C(a);
					}
					return g(S(J, B)[0]);
				}
				var p = (B) => {
					for (; B.length > 0;) B.shift()(A);
				}, CA = (B) => {
					x("OOM");
				}, QA = (B) => {
					F.length, B >>>= 0, CA(B);
				};
				function IA(B) {
					return A["_" + B];
				}
				var BA = (B, g) => {
					N.set(B, g);
				}, EA = (B) => {
					for (var g = 0, a = 0; a < B.length; ++a) {
						var n = B.charCodeAt(a);
						n <= 127 ? g++ : n <= 2047 ? g += 2 : n >= 55296 && n <= 57343 ? (g += 4, ++a) : g += 3;
					}
					return g;
				}, eA = (B, g, a, n) => {
					if (!(n > 0)) return 0;
					for (var G = a, k = a + n - 1, M = 0; M < B.length; ++M) {
						var R = B.charCodeAt(M);
						if (R >= 55296 && R <= 57343) {
							var U = B.charCodeAt(++M);
							R = 65536 + ((R & 1023) << 10) | U & 1023;
						}
						if (R <= 127) {
							if (a >= k) break;
							g[a++] = R;
						} else if (R <= 2047) {
							if (a + 1 >= k) break;
							g[a++] = 192 | R >> 6, g[a++] = 128 | R & 63;
						} else if (R <= 65535) {
							if (a + 2 >= k) break;
							g[a++] = 224 | R >> 12, g[a++] = 128 | R >> 6 & 63, g[a++] = 128 | R & 63;
						} else {
							if (a + 3 >= k) break;
							g[a++] = 240 | R >> 18, g[a++] = 128 | R >> 12 & 63, g[a++] = 128 | R >> 6 & 63, g[a++] = 128 | R & 63;
						}
					}
					return g[a] = 0, a - G;
				}, tA = (B, g, a) => eA(B, F, g, a), oA = (B) => {
					var g = EA(B) + 1, a = GA(g);
					return tA(B, a, g), a;
				}, sA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, fA = (B, g, a) => {
					for (var n = g + a, G = g; B[G] && !(G >= n);) ++G;
					if (G - g > 16 && B.buffer && sA) return sA.decode(B.subarray(g, G));
					for (var k = ""; g < G;) {
						var M = B[g++];
						if (!(M & 128)) {
							k += String.fromCharCode(M);
							continue;
						}
						var R = B[g++] & 63;
						if ((M & 224) == 192) {
							k += String.fromCharCode((M & 31) << 6 | R);
							continue;
						}
						var U = B[g++] & 63;
						if ((M & 240) == 224 ? M = (M & 15) << 12 | R << 6 | U : M = (M & 7) << 18 | R << 12 | U << 6 | B[g++] & 63, M < 65536) k += String.fromCharCode(M);
						else {
							var P = M - 65536;
							k += String.fromCharCode(55296 | P >> 10, 56320 | P & 1023);
						}
					}
					return k;
				}, FA = (B, g) => B ? fA(F, B, g) : "", nA = function(B, g, a, n, G) {
					var k = {
						string: (m) => {
							var X = 0;
							return m != null && m !== 0 && (X = oA(m)), X;
						},
						array: (m) => {
							var X = GA(m.length);
							return BA(m, X), X;
						}
					};
					function M(m) {
						return g === "string" ? FA(m) : g === "boolean" ? !!m : m;
					}
					var R = IA(B), U = [], P = 0;
					if (n) for (var j = 0; j < n.length; j++) {
						var DA = k[a[j]];
						DA ? (P === 0 && (P = rA()), U[j] = DA(n[j])) : U[j] = n[j];
					}
					var RA = R.apply(null, U);
					function mA(m) {
						return P !== 0 && HA(P), M(m);
					}
					return RA = mA(RA), RA;
				}, lA = function(B, g, a, n) {
					var G = !a || a.every((k) => k === "number" || k === "boolean");
					return g !== "string" && G && !n ? IA(B) : function() {
						return nA(B, g, a, arguments, n);
					};
				}, NA = { a: QA }, u = V();
				u.c, A._malloc = u.d, A._free = u.e, A._precalc = u.f, A._precalc_f = u.g, A._dispose = u.h, A._dispose_f = u.i, A._transform_radix2_precalc = u.j, A._transform_radix2_precalc_f = u.k, u.__errno_location;
				var rA = u.m, HA = u.n, GA = u.o;
				function UA(B) {
					try {
						for (var g = atob(B), a = new Uint8Array(g.length), n = 0; n < g.length; ++n) a[n] = g.charCodeAt(n);
						return a;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function vA(B) {
					if (AA(B)) return UA(B.slice($.length));
				}
				A.ccall = nA, A.cwrap = lA;
				var aA;
				H = function B() {
					aA || hA(), aA || (H = B);
				};
				function hA() {
					if (d > 0 || (b(), d > 0)) return;
					function B() {
						aA || (aA = !0, A.calledRun = !0, !f && (K(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), B();
					}, 1)) : B();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return hA(), I;
			});
		})();
	}));
	function hg(E) {
		this.n = E, this.rptr = YA._malloc(E * 4 + E * 4), this.iptr = this.rptr + E * 4, this.rarr = new Float32Array(YA.HEAPU8.buffer, this.rptr, E), this.iarr = new Float32Array(YA.HEAPU8.buffer, this.iptr, E), this.tables = dI(E), this.forward = function(I, A) {
			this.rarr.set(I), this.iarr.set(A), SI(this.rptr, this.iptr, this.n, this.tables), I.set(this.rarr), A.set(this.iarr);
		}, this.dispose = function() {
			YA._free(this.rptr), UI(this.tables);
		};
	}
	var YA, dI, UI, SI, cg = iA((() => {
		Dg(), YA = kI({}), YA.cwrap("precalc", "number", ["number"]), YA.cwrap("dispose", "void", ["number"]), YA.cwrap("transform_radix2_precalc", "void", [
			"number",
			"number",
			"number",
			"number"
		]), dI = YA.cwrap("precalc_f", "number", ["number"]), UI = YA.cwrap("dispose_f", "void", ["number"]), SI = YA.cwrap("transform_radix2_precalc_f", "void", [
			"number",
			"number",
			"number",
			"number"
		]);
	})), HI, wg = iA((() => {
		cg(), HI = class {
			constructor(E) {
				this.size = E, this.fftNayuki = new hg(E);
			}
			fft(E) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), i = new Float32Array(this.size * 2);
				for (var C = 0; C < this.size; ++C) I[C] = E[C * 2], A[C] = E[C * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var C = 0; C < this.size; ++C) i[C * 2] = I[C], i[C * 2 + 1] = A[C];
				return i;
			}
		};
	})), zA, fg = iA((() => {
		zA || (zA = {}), (function(E) {
			"use strict";
			function I(o, t, e, c, w, s) {
				for (var h = w.twiddle, D = 0; D < s; D++) {
					var f = o[2 * (t + e * D)], N = o[2 * (t + e * D) + 1], F = o[2 * (t + e * (D + s))], l = o[2 * (t + e * (D + s)) + 1], y = h[2 * (0 + c * D)], Y = h[2 * (0 + c * D) + 1], v = F * y - l * Y, b = F * Y + l * y, K = f + v, T = N + b, Z = f - v, W = N - b;
					o[2 * (t + e * D)] = K, o[2 * (t + e * D) + 1] = T, o[2 * (t + e * (D + s))] = Z, o[2 * (t + e * (D + s)) + 1] = W;
				}
			}
			function A(o, t, e, c, w, s) {
				for (var h = w.twiddle, D = s, f = 2 * s, N = c, F = 2 * c, l = h[2 * (0 + c * s) + 1], y = 0; y < s; y++) {
					var Y = o[2 * (t + e * y)], v = o[2 * (t + e * y) + 1], b = o[2 * (t + e * (y + D))], K = o[2 * (t + e * (y + D)) + 1], T = h[2 * (0 + N * y)], Z = h[2 * (0 + N * y) + 1], W = b * T - K * Z, O = b * Z + K * T, d = o[2 * (t + e * (y + f))], L = o[2 * (t + e * (y + f)) + 1], H = h[2 * (0 + F * y)], z = h[2 * (0 + F * y) + 1], _ = d * H - L * z, x = d * z + L * H, $ = W + _, AA = O + x, J = Y + $, gA = v + AA;
					o[2 * (t + e * y)] = J, o[2 * (t + e * y) + 1] = gA;
					var S = Y - $ * .5, V = v - AA * .5, p = (W - _) * l, CA = (O - x) * l, QA = S - CA, IA = V + p;
					o[2 * (t + e * (y + D))] = QA, o[2 * (t + e * (y + D)) + 1] = IA;
					var BA = S + CA, EA = V - p;
					o[2 * (t + e * (y + f))] = BA, o[2 * (t + e * (y + f)) + 1] = EA;
				}
			}
			function i(o, t, e, c, w, s) {
				for (var h = w.twiddle, D = s, f = 2 * s, N = 3 * s, F = c, l = 2 * c, y = 3 * c, Y = 0; Y < s; Y++) {
					var v = o[2 * (t + e * Y)], b = o[2 * (t + e * Y) + 1], K = o[2 * (t + e * (Y + D))], T = o[2 * (t + e * (Y + D)) + 1], Z = h[2 * (0 + F * Y)], W = h[2 * (0 + F * Y) + 1], O = K * Z - T * W, d = K * W + T * Z, L = o[2 * (t + e * (Y + f))], H = o[2 * (t + e * (Y + f)) + 1], z = h[2 * (0 + l * Y)], _ = h[2 * (0 + l * Y) + 1], x = L * z - H * _, $ = L * _ + H * z, AA = o[2 * (t + e * (Y + N))], J = o[2 * (t + e * (Y + N)) + 1], gA = h[2 * (0 + y * Y)], S = h[2 * (0 + y * Y) + 1], V = AA * gA - J * S, p = AA * S + J * gA, CA = v + x, QA = b + $, IA = v - x, BA = b - $, EA = O + V, eA = d + p, tA = O - V, oA = d - p, sA = CA + EA, fA = QA + eA;
					if (w.inverse) var FA = IA - oA, nA = BA + tA;
					else var FA = IA + oA, nA = BA - tA;
					var lA = CA - EA, NA = QA - eA;
					if (w.inverse) var u = IA + oA, rA = BA - tA;
					else var u = IA - oA, rA = BA + tA;
					o[2 * (t + e * Y)] = sA, o[2 * (t + e * Y) + 1] = fA, o[2 * (t + e * (Y + D))] = FA, o[2 * (t + e * (Y + D)) + 1] = nA, o[2 * (t + e * (Y + f))] = lA, o[2 * (t + e * (Y + f)) + 1] = NA, o[2 * (t + e * (Y + N))] = u, o[2 * (t + e * (Y + N)) + 1] = rA;
				}
			}
			function C(o, t, e, c, w, s, h) {
				for (var D = w.twiddle, f = w.n, N = new Float64Array(2 * h), F = 0; F < s; F++) {
					for (var l = 0, y = F; l < h; l++, y += s) {
						var Y = o[2 * (t + e * y)], v = o[2 * (t + e * y) + 1];
						N[2 * l] = Y, N[2 * l + 1] = v;
					}
					for (var l = 0, y = F; l < h; l++, y += s) {
						var b = 0, Y = N[0], v = N[1];
						o[2 * (t + e * y)] = Y, o[2 * (t + e * y) + 1] = v;
						for (var K = 1; K < h; K++) {
							b = (b + c * y) % f;
							var T = o[2 * (t + e * y)], Z = o[2 * (t + e * y) + 1], W = N[2 * K], O = N[2 * K + 1], d = D[2 * b], L = D[2 * b + 1], H = W * d - O * L, z = W * L + O * d, _ = T + H, x = Z + z;
							o[2 * (t + e * y)] = _, o[2 * (t + e * y) + 1] = x;
						}
					}
				}
			}
			function Q(o, t, e, c, w, s, h, D, f) {
				var N = D.shift(), F = D.shift();
				if (F == 1) for (var l = 0; l < N * F; l++) {
					var y = c[2 * (w + s * h * l)], Y = c[2 * (w + s * h * l) + 1];
					o[2 * (t + e * l)] = y, o[2 * (t + e * l) + 1] = Y;
				}
				else for (var l = 0; l < N; l++) Q(o, t + e * l * F, e, c, w + l * s * h, s * N, h, D.slice(), f);
				switch (N) {
					case 2:
						I(o, t, e, s, f, F);
						break;
					case 3:
						A(o, t, e, s, f, F);
						break;
					case 4:
						i(o, t, e, s, f, F);
						break;
					default:
						C(o, t, e, s, f, F, N);
						break;
				}
			}
			var r = function(e, c) {
				if (arguments.length < 2) throw new RangeError("You didn't pass enough arguments, passed `" + arguments.length + "'");
				var e = ~~e, c = !!c;
				if (e < 1) throw new RangeError("n is outside range, should be positive integer, was `" + e + "'");
				for (var w = {
					n: e,
					inverse: c,
					factors: [],
					twiddle: new Float64Array(2 * e),
					scratch: new Float64Array(2 * e)
				}, s = w.twiddle, h = 2 * Math.PI / e, D = 0; D < e; D++) {
					if (c) var f = h * D;
					else var f = -h * D;
					s[2 * D] = Math.cos(f), s[2 * D + 1] = Math.sin(f);
				}
				for (var N = 4, F = Math.floor(Math.sqrt(e)); e > 1;) {
					for (; e % N;) {
						switch (N) {
							case 4:
								N = 2;
								break;
							case 2:
								N = 3;
								break;
							default:
								N += 2;
								break;
						}
						N > F && (N = e);
					}
					e /= N, w.factors.push(N), w.factors.push(e);
				}
				this.state = w;
			};
			r.prototype.simple = function(o, t, e) {
				this.process(o, 0, 1, t, 0, 1, e);
			}, r.prototype.process = function(o, t, D, c, w, f, h) {
				var D = ~~D, f = ~~f, N = h == "real" ? h : "complex";
				if (D < 1) throw new RangeError("outputStride is outside range, should be positive integer, was `" + D + "'");
				if (f < 1) throw new RangeError("inputStride is outside range, should be positive integer, was `" + f + "'");
				if (N == "real") {
					for (var F = 0; F < this.state.n; F++) {
						var l = c[w + f * F], y = 0;
						this.state.scratch[2 * F] = l, this.state.scratch[2 * F + 1] = y;
					}
					Q(o, t, D, this.state.scratch, 0, 1, 1, this.state.factors.slice(), this.state);
				} else if (c == o) {
					Q(this.state.scratch, 0, 1, c, w, 1, f, this.state.factors.slice(), this.state);
					for (var F = 0; F < this.state.n; F++) {
						var l = this.state.scratch[2 * F], y = this.state.scratch[2 * F + 1];
						o[2 * (t + D * F)] = l, o[2 * (t + D * F) + 1] = y;
					}
				} else Q(o, t, D, c, w, 1, f, this.state.factors.slice(), this.state);
			}, E.complex = r;
		})(zA);
	})), vI, Fg = iA((() => {
		fg(), vI = class {
			constructor(E) {
				this.size = E, this.nockertfft = new zA.complex(E, !1);
			}
			fft(E) {
				const I = new Float32Array(2 * this.size);
				return this.nockertfft.simple(I, E, "complex"), I;
			}
		};
	}));
	function lg(E) {
		if (E !== 0 && (E & E - 1) === 0) q = E, Mg(), Gg(), Yg();
		else throw new Error("init: radix-2 required");
	}
	function _A(E, I) {
		eI(E, I, 1);
	}
	function $A(E, I) {
		let A = 1 / q;
		eI(E, I, -1);
		for (let i = 0; i < q; i++) E[i] *= A, I[i] *= A;
	}
	function Rg(E, I) {
		eI(E, I, -1);
	}
	function Ng(E, I) {
		let A = [], i = [], C = 0;
		for (let Q = 0; Q < q; Q++) {
			C = Q * q;
			for (let r = 0; r < q; r++) A[r] = E[r + C], i[r] = I[r + C];
			_A(A, i);
			for (let r = 0; r < q; r++) E[r + C] = A[r], I[r + C] = i[r];
		}
		for (let Q = 0; Q < q; Q++) {
			for (let r = 0; r < q; r++) C = Q + r * q, A[r] = E[C], i[r] = I[C];
			_A(A, i);
			for (let r = 0; r < q; r++) C = Q + r * q, E[C] = A[r], I[C] = i[r];
		}
	}
	function yg(E, I) {
		let A = [], i = [], C = 0;
		for (let Q = 0; Q < q; Q++) {
			C = Q * q;
			for (let r = 0; r < q; r++) A[r] = E[r + C], i[r] = I[r + C];
			$A(A, i);
			for (let r = 0; r < q; r++) E[r + C] = A[r], I[r + C] = i[r];
		}
		for (let Q = 0; Q < q; Q++) {
			for (let r = 0; r < q; r++) C = Q + r * q, A[r] = E[C], i[r] = I[C];
			$A(A, i);
			for (let r = 0; r < q; r++) C = Q + r * q, E[C] = A[r], I[C] = i[r];
		}
	}
	function eI(E, I, A) {
		let i, C, Q, r, o, t, e, c, w, s = q >> 2;
		for (let h = 0; h < q; h++) r = JA[h], h < r && (o = E[h], E[h] = E[r], E[r] = o, o = I[h], I[h] = I[r], I[r] = o);
		for (let h = 1; h < q; h <<= 1) {
			C = 0, i = q / (h << 1);
			for (let D = 0; D < h; D++) {
				t = wA[C + s], e = A * wA[C];
				for (let f = D; f < q; f += h << 1) Q = f + h, c = t * E[Q] + e * I[Q], w = t * I[Q] - e * E[Q], E[Q] = E[f] - c, E[f] += c, I[Q] = I[f] - w, I[f] += w;
				C += i;
			}
		}
	}
	function Mg() {
		typeof Uint32Array < "u" ? JA = new Uint32Array(q) : JA = [], typeof Float64Array < "u" ? wA = new Float64Array(q * 1.25) : wA = [];
	}
	function Gg() {
		let E = 0, I = 0, A = 0;
		for (JA[0] = 0; ++E < q;) {
			for (A = q >> 1; A <= I;) I -= A, A >>= 1;
			I += A, JA[E] = I;
		}
	}
	function Yg() {
		let E = q >> 1, I = q >> 2, A = q >> 3, i = E + I, C = Math.sin(Math.PI / q), Q = 2 * C * C, r = Math.sqrt(Q * (2 - Q)), o = wA[I] = 1, t = wA[0] = 0;
		C = 2 * Q;
		for (let e = 1; e < A; e++) o -= Q, Q += C * o, t += r, r -= C * t, wA[e] = t, wA[I - e] = o;
		A !== 0 && (wA[A] = Math.sqrt(.5));
		for (let e = 0; e < I; e++) wA[E - e] = wA[e];
		for (let e = 0; e < i; e++) wA[e + E] = -wA[e];
	}
	var q, JA, wA, mI, kg = iA((() => {
		q = 0, JA = null, wA = null, mI = {
			init: lg,
			fft1d: _A,
			ifft1d: $A,
			fft2d: Ng,
			ifft2d: yg,
			fft: _A,
			ifft: $A,
			bt: Rg
		};
	})), uI, dg = iA((() => {
		kg(), uI = class {
			constructor(E) {
				this.size = E, this.FFT_mljs = mI, this.FFT_mljs.init(E);
			}
			fft(E) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), i = new Float32Array(2 * this.size);
				for (var C = 0; C < this.size; ++C) I[C] = E[C * 2], A[C] = E[C * 2 + 1];
				this.FFT_mljs.fft(I, A);
				for (var C = 0; C < this.size; ++C) i[C * 2] = I[C], i[C * 2 + 1] = A[C];
				return i;
			}
		};
	}));
	async function Ug() {
		return await WebAssembly.validate(new Uint8Array([
			0,
			97,
			115,
			109,
			1,
			0,
			0,
			0,
			1,
			5,
			1,
			96,
			0,
			1,
			123,
			3,
			2,
			1,
			0,
			10,
			15,
			1,
			13,
			0,
			65,
			1,
			253,
			15,
			65,
			2,
			253,
			15,
			253,
			128,
			2,
			11
		]));
	}
	async function Sg() {
		return await WebAssembly.validate(new Uint8Array([
			0,
			97,
			115,
			109,
			1,
			0,
			0,
			0,
			1,
			5,
			1,
			96,
			0,
			1,
			123,
			3,
			2,
			1,
			0,
			10,
			10,
			1,
			8,
			0,
			65,
			0,
			253,
			15,
			253,
			98,
			11
		]));
	}
	async function Hg() {
		let E = "Other", I = "Unknown", A = "Other", i = "Unknown", C = navigator.userAgentData, Q = navigator.userAgent;
		try {
			if (C) {
				const r = await C.getHighEntropyValues([
					"architecture",
					"model",
					"platform",
					"platformVersion",
					"uaFullVersion"
				]), o = C.brands.find((t) => [
					"Microsoft Edge",
					"Google Chrome",
					"Opera"
				].includes(t.brand));
				E = o ? o.brand : "Other", I = o ? `v${o.version}` : "Unknown", A = r.platform ? r.platform : "Other", i = r.platformVersion ? `v${r.platformVersion}` : "Unknown";
			}
			if (E === "Other" || A === "Other") {
				const r = Q.split(" "), o = r[r.length - 1], t = /Firefox/.test(o), e = /Safari/.test(o) && !/CriOS/.test(o) && !/Chrome/.test(o), c = /CriOS/.test(o) || /Chrome/.test(o), w = /Edg/.test(o), s = /OPR/.test(o), h = [
					{
						name: "Mozilla Firefox",
						regex: /Firefox\/(\d+\.\d+)/,
						flag: t
					},
					{
						name: "Safari",
						regex: /Version\/(\d+\.\d+)/,
						flag: e
					},
					{
						name: "Google Chrome",
						regex: /CriOS|Chrome\/(\d+\.\d+)/,
						flag: c
					},
					{
						name: "Microsoft Edge",
						regex: /Edg\/(\d+\.\d+)/,
						flag: w
					},
					{
						name: "Opera",
						regex: /OPR\/(\d+\.\d+)/,
						flag: s
					}
				];
				for (const l of h) if (l.flag) {
					E = l.name;
					const y = o.match(l.regex);
					I = y ? y[1] : "Unknown";
					break;
				}
				const D = Q.match(/\(([^)]+)\)/), f = D ? D[1].split("; ") : [];
				console.log(D), console.log(f);
				const N = {
					"10.0": "10",
					"6.3": "8.1",
					"6.2": "8",
					"6.1": "7",
					"6.0": "Vista",
					"5.2": "XP 64-bit",
					"5.1": "XP",
					"5.0": "2000"
				}, F = [
					{
						name: "Windows",
						regex: /Windows NT/,
						transform: (l) => N[l.split(" ")[2]],
						index: 0
					},
					{
						name: "Mac OS X",
						regex: /Mac OS X/,
						transform: (l) => l.replace("_", ".").split(" ")[3],
						index: 0
					},
					{
						name: "Linux",
						regex: /Linux/,
						transform: () => "Unknown",
						index: 0
					},
					{
						name: "Android",
						regex: /Android/,
						transform: (l) => l.split(" ")[1],
						index: 0
					},
					{
						name: "iOS",
						regex: /iPhone/,
						transform: (l) => l.split(" ")[1].replace("_", "."),
						index: 0
					}
				];
				for (const l of F) if (l.regex.test(f[0])) {
					A = l.name, console.log(`osDetails: ${f}`), i = l.transform ? l.transform(f[1]) : l.versionMap[f[1].split(" ")[l.index]];
					break;
				}
			}
		} catch (r) {
			console.error("Could not retrieve user agent data", r);
		}
		return {
			browserName: E,
			browserVersion: I,
			osName: A,
			osVersion: i,
			wasm: typeof WebAssembly == "object",
			relaxedSimd: await Ug(),
			simd: await Sg()
		};
	}
	var vg = iA((() => {})), bI, mg = iA((() => {
		bI = (() => {
			var E = self.location.href;
			return (function(I = {}) {
				var A = I, i, C;
				A.ready = new Promise((B, g) => {
					i = B, C = g;
				});
				var Q = Object.assign({}, A), r = !0, o = !1, t = "";
				function e(B) {
					return A.locateFile ? A.locateFile(B, t) : t + B;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), E && (t = E), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (B) => {
					var g = new XMLHttpRequest();
					return g.open("GET", B, !1), g.responseType = "arraybuffer", g.send(null), new Uint8Array(g.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, Q), Q = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && x("no native wasm support detected");
				var h, D, f = !1, N, F;
				function l() {
					var B = h.buffer;
					A.HEAP8 = N = new Int8Array(B), A.HEAP16 = new Int16Array(B), A.HEAP32 = new Int32Array(B), A.HEAPU8 = F = new Uint8Array(B), A.HEAPU16 = new Uint16Array(B), A.HEAPU32 = new Uint32Array(B), A.HEAPF32 = new Float32Array(B), A.HEAPF64 = new Float64Array(B);
				}
				var y = [], Y = [], v = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) Z(A.preRun.shift());
					p(y);
				}
				function K() {
					p(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) O(A.postRun.shift());
					p(v);
				}
				function Z(B) {
					y.unshift(B);
				}
				function W(B) {
					Y.unshift(B);
				}
				function O(B) {
					v.unshift(B);
				}
				var d = 0, L = null, H = null;
				function z(B) {
					d++, A.monitorRunDependencies && A.monitorRunDependencies(d);
				}
				function _(B) {
					if (d--, A.monitorRunDependencies && A.monitorRunDependencies(d), d == 0 && (L !== null && (clearInterval(L), L = null), H)) {
						var g = H;
						H = null, g();
					}
				}
				function x(B) {
					A.onAbort && A.onAbort(B), B = "Aborted(" + B + ")", w(B), f = !0, B += ". Build with -sASSERTIONS for more info.";
					var g = new WebAssembly.RuntimeError(B);
					throw C(g), g;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(B) {
					return B.startsWith($);
				}
				var J = "data:application/octet-stream;base64,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";
				AA(J) || (J = e(J));
				function gA(B) {
					if (B == J && s) return new Uint8Array(s);
					var g = vA(B);
					if (g) return g;
					if (c) return c(B);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function S(B, g) {
					var a, n = gA(B);
					return a = new WebAssembly.Module(n), [new WebAssembly.Instance(a, g), a];
				}
				function V() {
					var B = { a: NA };
					function g(a, n) {
						var G = a.exports;
						return D = G, h = D.b, l(), D.i, W(D.c), _("wasm-instantiate"), G;
					}
					if (z("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(B, g);
					} catch (a) {
						w("Module.instantiateWasm callback failed with error: " + a), C(a);
					}
					return g(S(J, B)[0]);
				}
				var p = (B) => {
					for (; B.length > 0;) B.shift()(A);
				}, CA = (B) => {
					x("OOM");
				}, QA = (B) => {
					F.length, B >>>= 0, CA(B);
				};
				function IA(B) {
					return A["_" + B];
				}
				var BA = (B, g) => {
					N.set(B, g);
				}, EA = (B) => {
					for (var g = 0, a = 0; a < B.length; ++a) {
						var n = B.charCodeAt(a);
						n <= 127 ? g++ : n <= 2047 ? g += 2 : n >= 55296 && n <= 57343 ? (g += 4, ++a) : g += 3;
					}
					return g;
				}, eA = (B, g, a, n) => {
					if (!(n > 0)) return 0;
					for (var G = a, k = a + n - 1, M = 0; M < B.length; ++M) {
						var R = B.charCodeAt(M);
						if (R >= 55296 && R <= 57343) {
							var U = B.charCodeAt(++M);
							R = 65536 + ((R & 1023) << 10) | U & 1023;
						}
						if (R <= 127) {
							if (a >= k) break;
							g[a++] = R;
						} else if (R <= 2047) {
							if (a + 1 >= k) break;
							g[a++] = 192 | R >> 6, g[a++] = 128 | R & 63;
						} else if (R <= 65535) {
							if (a + 2 >= k) break;
							g[a++] = 224 | R >> 12, g[a++] = 128 | R >> 6 & 63, g[a++] = 128 | R & 63;
						} else {
							if (a + 3 >= k) break;
							g[a++] = 240 | R >> 18, g[a++] = 128 | R >> 12 & 63, g[a++] = 128 | R >> 6 & 63, g[a++] = 128 | R & 63;
						}
					}
					return g[a] = 0, a - G;
				}, tA = (B, g, a) => eA(B, F, g, a), oA = (B) => {
					var g = EA(B) + 1, a = GA(g);
					return tA(B, a, g), a;
				}, sA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, fA = (B, g, a) => {
					for (var n = g + a, G = g; B[G] && !(G >= n);) ++G;
					if (G - g > 16 && B.buffer && sA) return sA.decode(B.subarray(g, G));
					for (var k = ""; g < G;) {
						var M = B[g++];
						if (!(M & 128)) {
							k += String.fromCharCode(M);
							continue;
						}
						var R = B[g++] & 63;
						if ((M & 224) == 192) {
							k += String.fromCharCode((M & 31) << 6 | R);
							continue;
						}
						var U = B[g++] & 63;
						if ((M & 240) == 224 ? M = (M & 15) << 12 | R << 6 | U : M = (M & 7) << 18 | R << 12 | U << 6 | B[g++] & 63, M < 65536) k += String.fromCharCode(M);
						else {
							var P = M - 65536;
							k += String.fromCharCode(55296 | P >> 10, 56320 | P & 1023);
						}
					}
					return k;
				}, FA = (B, g) => B ? fA(F, B, g) : "", nA = function(B, g, a, n, G) {
					var k = {
						string: (m) => {
							var X = 0;
							return m != null && m !== 0 && (X = oA(m)), X;
						},
						array: (m) => {
							var X = GA(m.length);
							return BA(m, X), X;
						}
					};
					function M(m) {
						return g === "string" ? FA(m) : g === "boolean" ? !!m : m;
					}
					var R = IA(B), U = [], P = 0;
					if (n) for (var j = 0; j < n.length; j++) {
						var DA = k[a[j]];
						DA ? (P === 0 && (P = rA()), U[j] = DA(n[j])) : U[j] = n[j];
					}
					var RA = R.apply(null, U);
					function mA(m) {
						return P !== 0 && HA(P), M(m);
					}
					return RA = mA(RA), RA;
				}, lA = function(B, g, a, n) {
					var G = !a || a.every((k) => k === "number" || k === "boolean");
					return g !== "string" && G && !n ? IA(B) : function() {
						return nA(B, g, a, arguments, n);
					};
				}, NA = { a: QA }, u = V();
				u.c, A._kiss_fft_free = u.d, A._free = u.e, A._kiss_fft_alloc = u.f, A._malloc = u.g, A._kiss_fft = u.h, u.__errno_location;
				var rA = u.j, HA = u.k, GA = u.l;
				function UA(B) {
					try {
						for (var g = atob(B), a = new Uint8Array(g.length), n = 0; n < g.length; ++n) a[n] = g.charCodeAt(n);
						return a;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function vA(B) {
					if (AA(B)) return UA(B.slice($.length));
				}
				A.ccall = nA, A.cwrap = lA;
				var aA;
				H = function B() {
					aA || hA(), aA || (H = B);
				};
				function hA() {
					if (d > 0 || (b(), d > 0)) return;
					function B() {
						aA || (aA = !0, A.calledRun = !0, !f && (K(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), B();
					}, 1)) : B();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return hA(), I;
			});
		})();
	})), dA, oI, JI, nI, LI, ug = iA((() => {
		mg(), dA = bI({}), oI = dA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), JI = dA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), nI = dA.cwrap("kiss_fft_free", "void", ["number"]), LI = class {
			constructor(E) {
				this.size = E, this.fcfg = oI(E, !1), this.icfg = oI(E, !0), this.inptr = dA._malloc(E * 8 + E * 8), this.cin = new Float32Array(dA.HEAPU8.buffer, this.inptr, E * 2);
			}
			fft = function(E) {
				const I = dA._malloc(this.size * 8), A = new Float32Array(dA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(E), JI(this.fcfg, this.inptr, I);
				let i = new Float32Array(this.size * 2);
				return i.set(A), dA._free(I), i;
			};
			dispose() {
				nI(this.fcfg), nI(this.icfg), dA._free(this.inptr);
			}
		};
	}));
	function AI(E) {
		this.size = E, this._csize = E << 1;
		for (var I = new Array(this.size * 2), A = 0; A < I.length; A += 2) {
			const t = Math.PI * A / this.size;
			I[A] = Math.cos(t), I[A + 1] = -Math.sin(t);
		}
		this.table = I;
		for (var i = 0, C = 1; this.size > C; C <<= 1) i++;
		this._width = i % 2 === 0 ? i - 1 : i, this._bitrev = new Array(1 << this._width);
		for (var Q = 0; Q < this._bitrev.length; Q++) {
			this._bitrev[Q] = 0;
			for (var r = 0; r < this._width; r += 2) {
				var o = this._width - r - 2;
				this._bitrev[Q] |= (Q >>> r & 3) << o;
			}
		}
		this._data = null;
	}
	var bg = iA((() => {
		AI.prototype.fft = function(I) {
			this._data = I, this._out = new Float32Array(2 * this.size);
			var A = this._csize, i = 1 << this._width, C = A / i << 1, Q, r, o = this._bitrev;
			if (C === 4) for (Q = 0, r = 0; Q < A; Q += C, r++) {
				const s = o[r];
				this._singleTransform2(Q, s, i);
			}
			else for (Q = 0, r = 0; Q < A; Q += C, r++) {
				const s = o[r];
				this._singleTransform4(Q, s, i);
			}
			for (i >>= 2; i >= 2; i >>= 2) {
				C = A / i << 1;
				var t = C >>> 2;
				for (Q = 0; Q < A; Q += C) for (var e = Q + t, c = Q, w = 0; c < e; c += 2, w += i) {
					const s = c, h = s + t, D = h + t, f = D + t, N = this._out[s], F = this._out[s + 1], l = this._out[h], y = this._out[h + 1], Y = this._out[D], v = this._out[D + 1], b = this._out[f], K = this._out[f + 1], T = N, Z = F, W = this.table[w], O = this.table[w + 1], d = l * W - y * O, L = l * O + y * W, H = this.table[2 * w], z = this.table[2 * w + 1], _ = Y * H - v * z, x = Y * z + v * H, $ = this.table[3 * w], AA = this.table[3 * w + 1], J = b * $ - K * AA, gA = b * AA + K * $, S = T + _, V = Z + x, p = T - _, CA = Z - x, QA = d + J, IA = L + gA, BA = d - J, EA = L - gA;
					this._out[s] = S + QA, this._out[s + 1] = V + IA, this._out[h] = p + EA, this._out[h + 1] = CA - BA, this._out[D] = S - QA, this._out[D + 1] = V - IA, this._out[f] = p - EA, this._out[f + 1] = CA + BA;
				}
			}
			return this._out;
		}, AI.prototype._singleTransform2 = function(I, A, i) {
			const C = this._data[A], Q = this._data[A + 1], r = this._data[A + i], o = this._data[A + i + 1];
			this._out[I] = C + r, this._out[I + 1] = Q + o, this._out[I + 2] = C - r, this._out[I + 3] = Q - o;
		}, AI.prototype._singleTransform4 = function(I, A, i) {
			const C = i * 2, Q = i * 3, r = this._data[A], o = this._data[A + 1], t = this._data[A + i], e = this._data[A + i + 1], c = this._data[A + C], w = this._data[A + C + 1], s = this._data[A + Q], h = this._data[A + Q + 1], D = r + c, f = o + w, N = r - c, F = o - w, l = t + s, y = e + h, Y = t - s, v = e - h;
			this._out[I] = D + l, this._out[I + 1] = f + y, this._out[I + 2] = N + v, this._out[I + 3] = F - Y, this._out[I + 4] = D - l, this._out[I + 5] = f - y, this._out[I + 6] = N - v, this._out[I + 7] = F + Y;
		};
	})), Jg = VI({ default: () => KI }), sI, KI, Lg = iA((() => {
		Qg(), ig(), eg(), sg(), wg(), Fg(), dg(), vg(), ug(), bg(), sI = [
			4,
			8,
			16,
			32,
			64,
			128,
			256,
			512,
			1024,
			2048,
			4096,
			8192,
			16384,
			32768,
			16384,
			32768,
			65536,
			131072
		], KI = class {
			constructor(E = 128, I = "indutnyJavascript", A = !0) {
				if (!sI.includes(E)) throw new Error("Size must be a power of 2 between 4 and 131072");
				this.size = E, this.outputArr = new Float32Array(2 * E), this.subLibrary = I, this.fftLibrary = void 0;
				const i = this.getCurrentProfile();
				i && A ? this.setSubLibrary(i.fastestSubLibrary) : this.setSubLibrary(I);
			}
			availableSubLibraries() {
				return [
					"kissWasm",
					"indutnyModifiedJavascript",
					"indutnyJavascript",
					"crossWasm",
					"mljsJavascript",
					"nockertJavascript",
					"nayuki3Wasm",
					"nayukiJavascript",
					"kissfftmodifiedWasm"
				];
			}
			availableSubLibrariesQuick() {
				return ["kissWasm", "indutnyModifiedJavascript"];
			}
			getCurrentProfile() {
				if (!(typeof localStorage > "u") && localStorage.getItem("webfftProfile")) return JSON.parse(localStorage.getItem("webfftProfile"));
			}
			setSubLibrary(E) {
				switch (E) {
					case "nayukiJavascript":
						this.fftLibrary = new YI(this.size);
						break;
					case "nayuki3Wasm":
						this.fftLibrary = new HI(this.size);
						break;
					case "kissWasm":
						this.fftLibrary = new NI(this.size);
						break;
					case "crossWasm":
						this.fftLibrary = new GI(this.size), this.size > 16384 && (this.fftLibrary = new aI(this.size));
						break;
					case "nockertJavascript":
						this.fftLibrary = new vI(this.size);
						break;
					case "indutnyJavascript":
						this.fftLibrary = new aI(this.size);
						break;
					case "mljsJavascript":
						this.fftLibrary = new uI(this.size);
						break;
					case "kissfftmodifiedWasm":
						this.fftLibrary = new LI(this.size);
						break;
					case "indutnyModifiedJavascript":
						this.fftLibrary = new AI(this.size);
						break;
					default: throw new Error("Invalid sublibrary");
				}
			}
			fft(E) {
				if (E.length !== 2 * this.size) throw new Error("Input array length must be == 2 * size");
				return this.outputArr = this.fftLibrary.fft(E), this.outputArr;
			}
			fftr(E) {
				var { outputArr: I, fftLibrary: A, size: i } = this;
				if (E.length !== i) throw new Error("Input array length must be == size");
				const C = new Float32Array(2 * i);
				C.fill(0);
				for (let Q = 0; Q < i; Q++) C[2 * Q] = E[Q];
				return I = A.fft(C), I.slice(i, i * 2);
			}
			fft2d(E) {
				const I = E[0].length / 2, A = E.length;
				if (I !== this.size) throw new Error("Inner array length must be == 2 * size");
				if (!sI.includes(A)) throw new Error("Outter array length must be a power of 2 between 4 and 131072");
				let i = [];
				for (let r = 0; r < A; r++) this.outputArr = this.fft(E[r]), i.push(this.outputArr);
				this.dispose(), this.size = A, this.setSubLibrary(this.subLibrary);
				let C = [];
				for (let r = 0; r < I; r++) {
					const o = new Float32Array(2 * A);
					o.fill(0);
					for (let e = 0; e < A; e++) o[2 * e] = i[e][2 * r], o[2 * e + 1] = i[e][2 * r + 1];
					let t = new Float32Array(2 * A);
					t = this.fft(o), C.push(t);
				}
				let Q = [];
				for (let r = 0; r < A; r++) {
					let o = new Float32Array(2 * I);
					for (let t = 0; t < I; t++) o[2 * t] = C[t][2 * r], o[2 * t + 1] = C[t][2 * r + 1];
					Q.push(o);
				}
				return this.dispose(), this.size = I, this.setSubLibrary(this.subLibrary), Q;
			}
			profile(E = 1, I = !0, A = !1) {
				if (!I && this.getCurrentProfile()) return this.getCurrentProfile();
				const i = performance.now();
				let C;
				A ? C = this.availableSubLibrariesQuick() : C = this.availableSubLibraries();
				let Q = [];
				const r = E / C.length / 2;
				for (let c = 0; c < C.length; c++) {
					this.setSubLibrary(C[c]);
					const w = new Float32Array(2 * this.size);
					for (let D = 0; D < this.size; D++) w[2 * D] = Math.random() - .5, w[2 * D + 1] = Math.random() - .5;
					let s = performance.now();
					for (; (performance.now() - s) / 1e3 < r;) this.fft(w);
					s = performance.now();
					let h = 0;
					for (; (performance.now() - s) / 1e3 < r;) this.fft(w), h++;
					Q.push(1e3 * h / (performance.now() - s)), this.dispose();
				}
				const o = (performance.now() - i) / 1e3;
				let t = Q.indexOf(Math.max(...Q));
				const e = {
					fftsPerSecond: Q,
					subLibraries: C,
					totalElapsed: o,
					fastestSubLibrary: C[t]
				};
				return console.log("Setting sublibrary to", e.fastestSubLibrary), this.setSubLibrary(e.fastestSubLibrary), typeof localStorage < "u" && localStorage.setItem("webfftProfile", JSON.stringify(e)), e;
			}
			async checkBrowserCapabilities() {
				return await Hg();
			}
			dispose() {
				this.fftLibrary && this.fftLibrary.dispose !== void 0 && this.fftLibrary.dispose();
			}
		};
	}));
	let DI = null, qI = 0;
	async function Kg(E) {
		try {
			const { default: I } = await Promise.resolve().then(() => (Lg(), Jg));
			DI = new I(E), await DI.profile(), qI = E;
		} catch (I) {
			console.warn("[dspWorker] WebFFT not available, using Radix-2 fallback:", I), DI = null;
		}
	}
	let LA, KA, qA, pA, yA, MA, pI, TI, WI, PI, TA, PA, II, gI, bA, BI, hI, CI, xA, VA, QI, EI, jA, XA, ZA = .1, SA = 0, iI = 0, WA = null;
	const xI = new Bg();
	function qg(E, I, A, i, C) {
		for (let Q = 0; Q < C; Q++) {
			const r = E[Q] * E[Q] + I[Q] * I[Q], o = A[Q] * A[Q] + i[Q] * i[Q], t = A[Q] * E[Q] + i[Q] * I[Q], e = i[Q] * E[Q] - A[Q] * I[Q];
			QI[Q] += (r - QI[Q]) * ZA, EI[Q] += (o - EI[Q]) * ZA, jA[Q] += (t - jA[Q]) * ZA, XA[Q] += (e - XA[Q]) * ZA;
		}
	}
	function pg(E, I) {
		for (let A = 0; A < I; A++) {
			const i = jA[A] * jA[A] + XA[A] * XA[A], C = QI[A] * EI[A] + 1e-12;
			E[A] = Math.min(1, Math.max(0, i / C));
		}
	}
	function Tg(E, I) {
		const A = E.length, i = (I % A + A) % A;
		if (i === 0) return;
		const C = new Float32Array(i);
		C.set(E.subarray(0, i)), E.copyWithin(0, i), E.set(C, A - i);
	}
	self.onmessage = (E) => {
		if (E.data && E.data.type === "run-dsp") {
			const { measTimeDomain: I, refTimeDomain: A, BINS: i, FFT_SIZE: C, metrics: Q, windowType: r, weightingType: o, averagingType: t, averagingDepth: e, averagingAlpha: c, enableSourceWindow: w, sourceWindowWidthMs: s, sourceWindowOffsetMs: h, sampleRate: D, compensationDelaySamples: f, autoDelayCompensation: N } = E.data, F = D || 48e3;
			if (!I || !A) return;
			C && C !== qI && Kg(C), (i !== SA || C !== iI) && (SA = i, iI = C, LA = new Float32Array(i), KA = new Float32Array(i), qA = new Float32Array(i), pA = new Float32Array(i), yA = new Float32Array(i), MA = new Float32Array(i), pI = new Float32Array(C), TI = new Float32Array(C), WI = new Float32Array(C), PI = new Float32Array(C), TA = new Float32Array(i), PA = new Float32Array(i), II = new Float32Array(i), gI = new Float32Array(i), bA = new Float32Array(C), BI = new Float32Array(C), hI = new Float32Array(i), CI = new Float32Array(i), xA = new Float32Array(i), VA = new Float32Array(i), QI = new Float32Array(i), EI = new Float32Array(i), jA = new Float32Array(i), XA = new Float32Array(i), WA = new Ag(i, e || 16)), WA && WA.setDepth(e || 16), ZA = c || .1;
			const l = new Set(Q), y = new Float32Array(I), Y = new Float32Array(A), v = FI(Y), b = FI(y);
			f && f > 0 && Tg(Y, f);
			const K = r || "Hann";
			K !== "Rectangular" && (xI.apply(y, K), xI.apply(Y, K)), fI(Y, qA, pA), fI(y, LA, KA);
			const T = l.has("Magnitude") || l.has("Impulse") || l.has("Step"), Z = l.has("Phase") || l.has("Group Delay"), W = l.has("Impulse") || l.has("Step");
			if (T && OI(LA, KA, qA, pA, TA, yA, MA), WA && t !== "None" && T) {
				if (t === "FIFO") {
					WA.processFIFO(yA, MA, xA, VA), yA.set(xA), MA.set(VA);
					for (let S = 0; S < i; S++) {
						const V = Math.sqrt(yA[S] * yA[S] + MA[S] * MA[S]);
						TA[S] = 20 * Math.log10(V + 1e-8);
					}
				} else if (t === "LPF") {
					WA.processLPF(yA, MA, xA, VA, c || .1), yA.set(xA), MA.set(VA);
					for (let S = 0; S < i; S++) {
						const V = Math.sqrt(yA[S] * yA[S] + MA[S] * MA[S]);
						TA[S] = 20 * Math.log10(V + 1e-8);
					}
				}
			}
			if (Z && zI(LA, KA, qA, pA, PA), qg(qA, pA, LA, KA, i), pg(II, i), W && (Ig(LA, KA, qA, pA, bA, pI, TI, WI, PI), w && gg(bA, s, h, F)), l.has("Step") && _I(bA, BI, F), l.has("Group Delay")) {
				for (let S = 0; S < i; S++) hI[S] = PA[S] * Math.PI / 180;
				$I(hI, F / 2 / i, gI);
			}
			const O = b.peakDb - b.rmsDb;
			CI.fill(Math.max(0, Math.min(30, O)));
			let d = 0;
			if (N && W) {
				let S = 0;
				for (let V = 0; V < bA.length; V++) {
					const p = Math.abs(bA[V]);
					p > S && (S = p, d = V);
				}
			}
			const L = TA.buffer, H = PA.buffer, z = II.buffer, _ = gI.buffer, x = bA.buffer, $ = BI.buffer, AA = CI.buffer, J = yA.buffer, gA = MA.buffer;
			self.postMessage({
				type: "dsp-results",
				outputMagnitude: L,
				outputPhase: H,
				outputCoherence: z,
				outputGroupDelay: _,
				outputImpulse: x,
				outputStep: $,
				outputCrestFactor: AA,
				hReal: J,
				hImag: gA,
				refPeakDb: v.peakDb,
				refRmsDb: v.rmsDb,
				measPeakDb: b.peakDb,
				measRmsDb: b.rmsDb,
				detectedDelaySamples: d
			}, [
				L,
				H,
				z,
				_,
				x,
				$,
				AA,
				J,
				gA
			]), TA = new Float32Array(SA), PA = new Float32Array(SA), II = new Float32Array(SA), gI = new Float32Array(SA), bA = new Float32Array(iI), BI = new Float32Array(iI), CI = new Float32Array(SA), yA = new Float32Array(SA), MA = new Float32Array(SA);
		}
	};
})();
