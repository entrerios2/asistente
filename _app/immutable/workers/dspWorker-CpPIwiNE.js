(function() {
	var JI = Object.defineProperty, iA = (g, I) => () => (g && (I = g(g = 0)), I), wg = (g, I) => {
		let A = {};
		for (var C in g) JI(A, C, {
			get: g[C],
			enumerable: !0
		});
		return I || JI(A, Symbol.toStringTag, { value: "Module" }), A;
	};
	typeof window < "u" && import("webfft").then((g) => {
		g && g.default && new g.default(8192);
	}).catch(() => {});
	function fg(g, I) {
		let A = 0;
		for (let C = 0; C < I; C++) A = A << 1 | g & 1, g >>= 1;
		return A;
	}
	function LI(g, I, A) {
		const C = g.length, B = Math.log2(C);
		for (let E = 0; E < C; E++) {
			const r = fg(E, B);
			if (r > E) {
				const o = g[E], t = I[E];
				g[E] = g[r], I[E] = I[r], g[r] = o, I[r] = t;
			}
		}
		for (let E = 2; E <= C; E <<= 1) {
			const r = E >> 1, o = (A ? 2 : -2) * Math.PI / E, t = Math.cos(o), a = Math.sin(o);
			for (let c = 0; c < C; c += E) {
				let w = 1, n = 0;
				for (let h = 0; h < r; h++) {
					const D = g[c + h], l = I[c + h], N = c + h + r, F = w * g[N] - n * I[N], y = w * I[N] + n * g[N];
					g[c + h] = D + F, I[c + h] = l + y, g[N] = D - F, I[N] = l - y;
					const M = w * t - n * a;
					n = w * a + n * t, w = M;
				}
			}
		}
		if (A) for (let E = 0; E < C; E++) g[E] /= C, I[E] /= C;
	}
	function KI(g, I, A) {
		const C = g.length, B = I || new Float32Array(C), E = A || new Float32Array(C);
		return B.set(g), E.fill(0), LI(B, E, !1), {
			real: B,
			imag: E
		};
	}
	function Fg(g, I, A, C) {
		const B = g.length, E = A || new Float32Array(B), r = C || new Float32Array(B);
		return E.set(g), r.set(I), LI(E, r, !0), E;
	}
	function Rg(g, I, A, C, B, E, r) {
		const o = B.length;
		for (let t = 0; t < o; t++) {
			const a = A[t] * A[t] + C[t] * C[t] + 1e-12, c = (g[t] * A[t] + I[t] * C[t]) / a, w = (I[t] * A[t] - g[t] * C[t]) / a;
			E && (E[t] = c), r && (r[t] = w);
			const n = Math.sqrt(c * c + w * w);
			B[t] = 20 * Math.log10(n + 1e-8);
		}
	}
	function Ng(g, I, A, C, B) {
		const E = B.length;
		for (let r = 0; r < E; r++) {
			const o = A[r] * A[r] + C[r] * C[r] + 1e-12, t = (g[r] * A[r] + I[r] * C[r]) / o, a = (I[r] * A[r] - g[r] * C[r]) / o;
			B[r] = Math.atan2(a, t) * (180 / Math.PI);
		}
	}
	function yg(g, I, A = 48e3) {
		let C = 0;
		const B = g.length;
		for (let E = 0; E < B; E++) C += g[E], I[E] = C;
	}
	function Mg(g, I, A) {
		const C = A.length;
		A[0] = 0;
		const B = 2 * Math.PI * I;
		for (let E = 1; E < C; E++) {
			let r = g[E] - g[E - 1];
			for (; r > Math.PI;) r -= 2 * Math.PI;
			for (; r < -Math.PI;) r += 2 * Math.PI;
			A[E] = -r / B * 1e3;
		}
	}
	function qI(g) {
		let I = 0, A = 0;
		const C = g.length;
		for (let B = 0; B < C; B++) {
			const E = Math.abs(g[B]);
			E > I && (I = E), A += g[B] * g[B];
		}
		return {
			peakDb: 20 * Math.log10(I + 1e-9),
			rmsDb: 20 * Math.log10(Math.sqrt(A / Math.max(1, C)) + 1e-9)
		};
	}
	var Gg = class {
		depth;
		bins;
		bufferReal;
		bufferImag;
		writeIdx = 0;
		count = 0;
		lpfReal;
		lpfImag;
		lastValidReal;
		lastValidImag;
		constructor(g, I = 16) {
			this.bins = g, this.depth = I, this.bufferReal = Array.from({ length: I }, () => new Float32Array(g)), this.bufferImag = Array.from({ length: I }, () => new Float32Array(g)), this.lpfReal = new Float32Array(g), this.lpfImag = new Float32Array(g), this.lastValidReal = new Float32Array(g), this.lastValidImag = new Float32Array(g);
		}
		processFIFO(g, I, A, C, B) {
			if (B !== void 0 && B > -120) for (let E = 0; E < this.bins; E++) {
				const r = Math.sqrt(g[E] * g[E] + I[E] * I[E]);
				20 * Math.log10(r + 1e-12) < B ? (g[E] = this.lastValidReal[E], I[E] = this.lastValidImag[E]) : (this.lastValidReal[E] = g[E], this.lastValidImag[E] = I[E]);
			}
			this.bufferReal[this.writeIdx].set(g), this.bufferImag[this.writeIdx].set(I), this.writeIdx = (this.writeIdx + 1) % this.depth, this.count < this.depth && this.count++, A.fill(0), C.fill(0);
			for (let E = 0; E < this.count; E++) for (let r = 0; r < this.bins; r++) A[r] += this.bufferReal[E][r], C[r] += this.bufferImag[E][r];
			for (let E = 0; E < this.bins; E++) A[E] /= this.count, C[E] /= this.count;
		}
		processLPF(g, I, A, C, B) {
			for (let E = 0; E < this.bins; E++) this.lpfReal[E] += (g[E] - this.lpfReal[E]) * B, this.lpfImag[E] += (I[E] - this.lpfImag[E]) * B, A[E] = this.lpfReal[E], C[E] = this.lpfImag[E];
		}
		setDepth(g) {
			g !== this.depth && (this.depth = Math.max(1, Math.min(64, g)), this.bufferReal = Array.from({ length: this.depth }, () => new Float32Array(this.bins)), this.bufferImag = Array.from({ length: this.depth }, () => new Float32Array(this.bins)), this.lastValidReal = new Float32Array(this.bins), this.lastValidImag = new Float32Array(this.bins), this.writeIdx = 0, this.count = 0);
		}
		reset() {
			this.writeIdx = 0, this.count = 0, this.lpfReal.fill(0), this.lpfImag.fill(0), this.lastValidReal.fill(0), this.lastValidImag.fill(0);
		}
	};
	function kg(g, I, A, C, B, E, r, o, t) {
		const a = g.length, c = a * 2, w = 1e-10;
		for (let n = 0; n < a; n++) {
			const h = A[n] * A[n] + C[n] * C[n] + w, D = (g[n] * A[n] + I[n] * C[n]) / h, l = (I[n] * A[n] - g[n] * C[n]) / h;
			E[n] = D, r[n] = l;
		}
		for (let n = 1; n < a; n++) E[c - n] = E[n], r[c - n] = -r[n];
		Fg(E, r, o, t), B.set(o);
	}
	function Yg(g, I, A, C = 48e3) {
		const B = g.length, E = Math.round(A / 1e3 * C), r = Math.round(I / 2 / 1e3 * C), o = Math.max(0, E - r), t = Math.min(B - 1, E + r), a = Math.round(r * .2);
		for (let c = 0; c < B; c++) if (c < o || c > t) g[c] = 0;
		else if (c < o + a) {
			const w = (c - o) / a, n = .5 * (1 - Math.cos(w * Math.PI));
			g[c] *= n;
		} else if (c > t - a) {
			const w = (t - c) / a, n = .5 * (1 - Math.cos(w * Math.PI));
			g[c] *= n;
		}
	}
	var dg = class {
		cache = {};
		getWindow(g, I) {
			const A = `${g}_${I}`;
			if (!this.cache[A]) {
				const C = new Float32Array(g);
				let B = 0, E = 0;
				for (let o = 0; o < g; o++) {
					let t = 1;
					const a = 2 * Math.PI * o / (g - 1);
					if (I === "Hann") t = .5 * (1 - Math.cos(a));
					else if (I === "Hamming") t = .54 - .46 * Math.cos(a);
					else if (I === "FlatTop") t = 1 - 1.93 * Math.cos(a) + 1.29 * Math.cos(2 * a) - .388 * Math.cos(3 * a) + .0322 * Math.cos(4 * a);
					else if (I === "BlackmanHarris") t = .35875 - .48829 * Math.cos(a) + .14128 * Math.cos(2 * a) - .01168 * Math.cos(3 * a);
					else if (I === "HFT223D") t = 1 - 1.98298997309 * Math.cos(a) + 1.75556083063 * Math.cos(2 * a) - 1.19037717712 * Math.cos(3 * a) + .56155440797 * Math.cos(4 * a) - .17296769663 * Math.cos(5 * a) + .03233247087 * Math.cos(6 * a) - .00324954578 * Math.cos(7 * a) + .0001380104 * Math.cos(8 * a) - 132725e-11 * Math.cos(9 * a);
					else if (I === "Exponential") {
						const c = g / 5;
						t = Math.exp(-o / c);
					}
					C[o] = t, B += t, E += t * t;
				}
				const r = B / g;
				for (let o = 0; o < g; o++) C[o] /= r;
				this.cache[A] = C;
			}
			return this.cache[A];
		}
		apply(g, I) {
			if (I === "Rectangular") return;
			const A = g.length, C = this.getWindow(A, I);
			for (let B = 0; B < A; B++) g[B] *= C[B];
		}
	}, aI = class {
		b0;
		b1;
		b2;
		a1;
		a2;
		z1 = 0;
		z2 = 0;
		constructor(g, I, A, C, B, E) {
			this.b0 = g / C, this.b1 = I / C, this.b2 = A / C, this.a1 = B / C, this.a2 = E / C;
		}
		process(g) {
			for (let I = 0; I < g.length; I++) {
				const A = g[I], C = this.b0 * A + this.z1;
				this.z1 = this.b1 * A - this.a1 * C + this.z2, this.z2 = this.b2 * A - this.a2 * C, g[I] = C;
			}
		}
		reset() {
			this.z1 = 0, this.z2 = 0;
		}
	};
	function Sg(g, I, A) {
		const C = 2 * Math.PI * g / A, B = Math.sin(C) / (2 * I);
		return new aI(1, -2 * Math.cos(C), 1, 1 + B, -2 * Math.cos(C), 1 - B);
	}
	function Ug(g, I, A) {
		const C = 2 * Math.PI * g / A, B = Math.sin(C) / (2 * I);
		return new aI(B, 0, -B, 1 + B, -2 * Math.cos(C), 1 - B);
	}
	function Hg(g, I, A) {
		const C = 2 * Math.PI * g / A, B = Math.sin(C) / (2 * I), E = Math.cos(C);
		return new aI((1 - E) / 2, 1 - E, (1 - E) / 2, 1 + B, -2 * E, 1 - B);
	}
	function pI(g, I) {
		switch (g) {
			case "Notch1k": return Sg(1e3, 10, I);
			case "BP100": return Ug(100, 1, I);
			case "LP200": return Hg(200, .7071, I);
			default: return null;
		}
	}
	const vg = {
		Slow: {
			gain: 132731.3202,
			k: [
				.4600089841,
				-2.6653917847,
				6.200654795,
				-7.2408808951,
				4.2453678122
			]
		},
		Medium: {
			gain: 5908.173436,
			k: [
				.2116396822,
				-1.3993115731,
				3.752522757,
				-5.1097576527,
				3.5394905611
			]
		},
		Fast: {
			gain: 350.8023803,
			k: [
				.0448577871,
				-.3690099172,
				1.271946008,
				-2.321921842,
				2.2829085146
			]
		}
	};
	var zA = class {
		gain;
		k;
		x = [
			0,
			0,
			0,
			0,
			0,
			0
		];
		y = [
			0,
			0,
			0,
			0,
			0,
			0
		];
		p = 3;
		constructor(g) {
			const I = vg[g];
			this.gain = I.gain, this.k = I.k;
		}
		ptr(g) {
			let I = this.p + g;
			return I > 5 && (I -= 6), I;
		}
		process(g) {
			if (g !== g) return this.y[this.ptr(5)];
			this.p = this.ptr(1);
			const I = this.ptr(5);
			return this.x[I] = g / this.gain, this.y[I] = this.x[this.ptr(0)] * 1 + this.x[this.ptr(1)] * 5 + this.x[this.ptr(2)] * 10 + this.x[this.ptr(3)] * 10 + this.x[this.ptr(4)] * 5 + this.x[I] * 1 + this.y[this.ptr(0)] * this.k[0] + this.y[this.ptr(1)] * this.k[1] + this.y[this.ptr(2)] * this.k[2] + this.y[this.ptr(3)] * this.k[3] + this.y[this.ptr(4)] * this.k[4], this.y[I];
		}
		reset() {
			this.x.fill(0), this.y.fill(0);
		}
	}, mg = class {
		filtersReal;
		filtersImag;
		bins;
		currentFreq;
		constructor(g, I = "Medium") {
			this.bins = g, this.currentFreq = I, this.filtersReal = Array.from({ length: g }, () => new zA(I)), this.filtersImag = Array.from({ length: g }, () => new zA(I));
		}
		setFrequency(g) {
			g !== this.currentFreq && (this.currentFreq = g, this.filtersReal = Array.from({ length: this.bins }, () => new zA(g)), this.filtersImag = Array.from({ length: this.bins }, () => new zA(g)));
		}
		process(g, I, A, C) {
			for (let B = 0; B < this.bins; B++) A[B] = this.filtersReal[B].process(g[B]), C[B] = this.filtersImag[B].process(I[B]);
		}
		reset() {
			for (let g = 0; g < this.bins; g++) this.filtersReal[g].reset(), this.filtersImag[g].reset();
		}
	};
	let _A = null, $A = null, AI = 0;
	function ug(g) {
		return (!_A || AI !== g) && (_A = new Float32Array(g), $A = new Float32Array(g), AI = g), _A;
	}
	function bg(g) {
		return (!$A || AI !== g) && (_A = new Float32Array(g), $A = new Float32Array(g), AI = g), $A;
	}
	function oI(g, I, A, C) {
		if (C <= 0 || I <= 0) return;
		const B = A / 2 / I, E = Math.pow(2, 1 / (2 * C)), r = ug(I);
		for (let o = 1; o < I; o++) {
			const t = o * B, a = t / E, c = t * E, w = Math.max(1, Math.floor(a / B)), n = Math.min(I - 1, Math.ceil(c / B));
			let h = 0;
			const D = n - w + 1;
			for (let l = w; l <= n; l++) h += g[l];
			r[o] = h / D;
		}
		r[0] = g[0], g.set(r);
	}
	function Jg(g, I, A, C) {
		if (C <= 0 || I <= 0) return;
		const B = A / 2 / I, E = Math.pow(2, 1 / (2 * C)), r = Math.PI / 180, o = 180 / Math.PI, t = bg(I);
		for (let a = 1; a < I; a++) {
			const c = a * B, w = c / E, n = c * E, h = Math.max(1, Math.floor(w / B)), D = Math.min(I - 1, Math.ceil(n / B));
			let l = 0, N = 0;
			for (let F = h; F <= D; F++) {
				const y = g[F] * r;
				l += Math.sin(y), N += Math.cos(y);
			}
			t[a] = Math.atan2(l, N) * o;
		}
		t[0] = g[0], g.set(t);
	}
	var TI, Lg = iA((() => {
		TI = (() => {
			var g = self.location.href;
			return (function(I = {}) {
				var A = I, C, B;
				A.ready = new Promise((Q, e) => {
					C = Q, B = e;
				});
				var E = Object.assign({}, A), r = !0, o = !1, t = "";
				function a(Q) {
					return A.locateFile ? A.locateFile(Q, t) : t + Q;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), g && (t = g), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (Q) => {
					var e = new XMLHttpRequest();
					return e.open("GET", Q, !1), e.responseType = "arraybuffer", e.send(null), new Uint8Array(e.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, E), E = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var n;
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && j("no native wasm support detected");
				var h, D, l = !1, N, F;
				function y() {
					var Q = h.buffer;
					A.HEAP8 = N = new Int8Array(Q), A.HEAP16 = new Int16Array(Q), A.HEAP32 = new Int32Array(Q), A.HEAPU8 = F = new Uint8Array(Q), A.HEAPU16 = new Uint16Array(Q), A.HEAPU32 = new Uint32Array(Q), A.HEAPF32 = new Float32Array(Q), A.HEAPF64 = new Float64Array(Q);
				}
				var M = [], Y = [], u = [];
				function L() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) _(A.preRun.shift());
					V(M);
				}
				function W() {
					V(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					V(u);
				}
				function _(Q) {
					M.unshift(Q);
				}
				function q(Q) {
					Y.unshift(Q);
				}
				function p(Q) {
					u.unshift(Q);
				}
				var S = 0, v = null, m = null;
				function IA(Q) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function O(Q) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), m)) {
						var e = m;
						m = null, e();
					}
				}
				function j(Q) {
					A.onAbort && A.onAbort(Q), Q = "Aborted(" + Q + ")", w(Q), l = !0, Q += ". Build with -sASSERTIONS for more info.";
					var e = new WebAssembly.RuntimeError(Q);
					throw B(e), e;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(Q) {
					return Q.startsWith($);
				}
				var b = "data:application/octet-stream;base64,AGFzbQEAAAABRgxgAX8Bf2ABfwBgA39/fwBgAXwBfGADfHx/AXxgAnx8AXxgAnx/AXxgBn9/f39/fwBgAABgAnx/AX9gBH9/f38Bf2AAAX8CDQIBYQFhAAABYQFiAAIDEhEABAUGAQAHCAMJAwIKAAELAQQFAXABAQEFBgEBgAKAAgYIAX8BQaCiBAsHLQsBYwIAAWQACQFlABIBZgAGAWcADgFoAAcBaQANAWoBAAFrABEBbAAQAW0ADwqUbBFPAQJ/QaAeKAIAIgEgAEEHakF4cSICaiEAAkAgAkEAIAAgAU0bDQAgAD8AQRB0SwRAIAAQAEUNAQtBoB4gADYCACABDwtBpB5BMDYCAEF/C5kBAQN8IAAgAKIiAyADIAOioiADRHzVz1o62eU9okTrnCuK5uVavqCiIAMgA0R9/rFX4x3HPqJE1WHBGaABKr+gokSm+BARERGBP6CgIQUgAyAAoiEEIAJFBEAgBCADIAWiRElVVVVVVcW/oKIgAKAPCyAAIAMgAUQAAAAAAADgP6IgBSAEoqGiIAGhIARESVVVVVVVxT+ioKELkgEBA3xEAAAAAAAA8D8gACAAoiICRAAAAAAAAOA/oiIDoSIERAAAAAAAAPA/IAShIAOhIAIgAiACIAJEkBXLGaAB+j6iRHdRwRZswVa/oKJETFVVVVVVpT+goiACIAKiIgMgA6IgAiACRNQ4iL7p+qi9okTEsbS9nu4hPqCiRK1SnIBPfpK+oKKgoiAAIAGioaCgC6gBAAJAIAFBgAhOBEAgAEQAAAAAAADgf6IhACABQf8PSQRAIAFB/wdrIQEMAgsgAEQAAAAAAADgf6IhAEH9FyABIAFB/RdOG0H+D2shAQwBCyABQYF4Sg0AIABEAAAAAAAAYAOiIQAgAUG4cEsEQCABQckHaiEBDAELIABEAAAAAAAAYAOiIQBB8GggASABQfBoTBtBkg9qIQELIAAgAUH/B2qtQjSGv6IL0gsBB38CQCAARQ0AIABBCGsiAiAAQQRrKAIAIgFBeHEiAGohBQJAIAFBAXENACABQQNxRQ0BIAIgAigCACIBayICQbgeKAIASQ0BIAAgAWohAAJAAkBBvB4oAgAgAkcEQCABQf8BTQRAIAFBA3YhBCACKAIMIgEgAigCCCIDRgRAQageQageKAIAQX4gBHdxNgIADAULIAMgATYCDCABIAM2AggMBAsgAigCGCEGIAIgAigCDCIBRwRAIAIoAggiAyABNgIMIAEgAzYCCAwDCyACQRRqIgQoAgAiA0UEQCACKAIQIgNFDQIgAkEQaiEECwNAIAQhByADIgFBFGoiBCgCACIDDQAgAUEQaiEEIAEoAhAiAw0ACyAHQQA2AgAMAgsgBSgCBCIBQQNxQQNHDQJBsB4gADYCACAFIAFBfnE2AgQgAiAAQQFyNgIEIAUgADYCAA8LQQAhAQsgBkUNAAJAIAIoAhwiA0ECdEHYIGoiBCgCACACRgRAIAQgATYCACABDQFBrB5BrB4oAgBBfiADd3E2AgAMAgsgBkEQQRQgBigCECACRhtqIAE2AgAgAUUNAQsgASAGNgIYIAIoAhAiAwRAIAEgAzYCECADIAE2AhgLIAIoAhQiA0UNACABIAM2AhQgAyABNgIYCyACIAVPDQAgBSgCBCIBQQFxRQ0AAkACQAJAAkAgAUECcUUEQEHAHigCACAFRgRAQcAeIAI2AgBBtB5BtB4oAgAgAGoiADYCACACIABBAXI2AgQgAkG8HigCAEcNBkGwHkEANgIAQbweQQA2AgAPC0G8HigCACAFRgRAQbweIAI2AgBBsB5BsB4oAgAgAGoiADYCACACIABBAXI2AgQgACACaiAANgIADwsgAUF4cSAAaiEAIAFB/wFNBEAgAUEDdiEEIAUoAgwiASAFKAIIIgNGBEBBqB5BqB4oAgBBfiAEd3E2AgAMBQsgAyABNgIMIAEgAzYCCAwECyAFKAIYIQYgBSAFKAIMIgFHBEBBuB4oAgAaIAUoAggiAyABNgIMIAEgAzYCCAwDCyAFQRRqIgQoAgAiA0UEQCAFKAIQIgNFDQIgBUEQaiEECwNAIAQhByADIgFBFGoiBCgCACIDDQAgAUEQaiEEIAEoAhAiAw0ACyAHQQA2AgAMAgsgBSABQX5xNgIEIAIgAEEBcjYCBCAAIAJqIAA2AgAMAwtBACEBCyAGRQ0AAkAgBSgCHCIDQQJ0QdggaiIEKAIAIAVGBEAgBCABNgIAIAENAUGsHkGsHigCAEF+IAN3cTYCAAwCCyAGQRBBFCAGKAIQIAVGG2ogATYCACABRQ0BCyABIAY2AhggBSgCECIDBEAgASADNgIQIAMgATYCGAsgBSgCFCIDRQ0AIAEgAzYCFCADIAE2AhgLIAIgAEEBcjYCBCAAIAJqIAA2AgAgAkG8HigCAEcNAEGwHiAANgIADwsgAEH/AU0EQCAAQXhxQdAeaiEBAn9BqB4oAgAiA0EBIABBA3Z0IgBxRQRAQageIAAgA3I2AgAgAQwBCyABKAIICyEAIAEgAjYCCCAAIAI2AgwgAiABNgIMIAIgADYCCA8LQR8hAyAAQf///wdNBEAgAEEmIABBCHZnIgFrdkEBcSABQQF0a0E+aiEDCyACIAM2AhwgAkIANwIQIANBAnRB2CBqIQECQAJAAkBBrB4oAgAiBEEBIAN0IgdxRQRAQaweIAQgB3I2AgAgASACNgIAIAIgATYCGAwBCyAAQRkgA0EBdmtBACADQR9HG3QhAyABKAIAIQEDQCABIgQoAgRBeHEgAEYNAiADQR12IQEgA0EBdCEDIAQgAUEEcWoiB0EQaigCACIBDQALIAcgAjYCECACIAQ2AhgLIAIgAjYCDCACIAI2AggMAQsgBCgCCCIAIAI2AgwgBCACNgIIIAJBADYCGCACIAQ2AgwgAiAANgIIC0HIHkHIHigCAEEBayIAQX8gABs2AgALC8YnAQt/IwBBEGsiCiQAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAAQfQBTQRAQageKAIAIgZBECAAQQtqQXhxIABBC0kbIgVBA3YiAHYiAUEDcQRAAkAgAUF/c0EBcSAAaiICQQN0IgFB0B5qIgAgAUHYHmooAgAiASgCCCIERgRAQageIAZBfiACd3E2AgAMAQsgBCAANgIMIAAgBDYCCAsgAUEIaiEAIAEgAkEDdCICQQNyNgIEIAEgAmoiASABKAIEQQFyNgIEDA8LIAVBsB4oAgAiB00NASABBEACQEECIAB0IgJBACACa3IgASAAdHFoIgFBA3QiAEHQHmoiAiAAQdgeaigCACIAKAIIIgRGBEBBqB4gBkF+IAF3cSIGNgIADAELIAQgAjYCDCACIAQ2AggLIAAgBUEDcjYCBCAAIAVqIgggAUEDdCIBIAVrIgRBAXI2AgQgACABaiAENgIAIAcEQCAHQXhxQdAeaiEBQbweKAIAIQICfyAGQQEgB0EDdnQiA3FFBEBBqB4gAyAGcjYCACABDAELIAEoAggLIQMgASACNgIIIAMgAjYCDCACIAE2AgwgAiADNgIICyAAQQhqIQBBvB4gCDYCAEGwHiAENgIADA8LQaweKAIAIgtFDQEgC2hBAnRB2CBqKAIAIgIoAgRBeHEgBWshAyACIQEDQAJAIAEoAhAiAEUEQCABKAIUIgBFDQELIAAoAgRBeHEgBWsiASADIAEgA0kiARshAyAAIAIgARshAiAAIQEMAQsLIAIoAhghCSACIAIoAgwiBEcEQEG4HigCABogAigCCCIAIAQ2AgwgBCAANgIIDA4LIAJBFGoiASgCACIARQRAIAIoAhAiAEUNAyACQRBqIQELA0AgASEIIAAiBEEUaiIBKAIAIgANACAEQRBqIQEgBCgCECIADQALIAhBADYCAAwNC0F/IQUgAEG/f0sNACAAQQtqIgBBeHEhBUGsHigCACIIRQ0AQQAgBWshAwJAAkACQAJ/QQAgBUGAAkkNABpBHyAFQf///wdLDQAaIAVBJiAAQQh2ZyIAa3ZBAXEgAEEBdGtBPmoLIgdBAnRB2CBqKAIAIgFFBEBBACEADAELQQAhACAFQRkgB0EBdmtBACAHQR9HG3QhAgNAAkAgASgCBEF4cSAFayIGIANPDQAgASEEIAYiAw0AQQAhAyABIQAMAwsgACABKAIUIgYgBiABIAJBHXZBBHFqKAIQIgFGGyAAIAYbIQAgAkEBdCECIAENAAsLIAAgBHJFBEBBACEEQQIgB3QiAEEAIABrciAIcSIARQ0DIABoQQJ0QdggaigCACEACyAARQ0BCwNAIAAoAgRBeHEgBWsiAiADSSEBIAIgAyABGyEDIAAgBCABGyEEIAAoAhAiAQR/IAEFIAAoAhQLIgANAAsLIARFDQAgA0GwHigCACAFa08NACAEKAIYIQcgBCAEKAIMIgJHBEBBuB4oAgAaIAQoAggiACACNgIMIAIgADYCCAwMCyAEQRRqIgEoAgAiAEUEQCAEKAIQIgBFDQMgBEEQaiEBCwNAIAEhBiAAIgJBFGoiASgCACIADQAgAkEQaiEBIAIoAhAiAA0ACyAGQQA2AgAMCwsgBUGwHigCACIETQRAQbweKAIAIQACQCAEIAVrIgFBEE8EQCAAIAVqIgIgAUEBcjYCBCAAIARqIAE2AgAgACAFQQNyNgIEDAELIAAgBEEDcjYCBCAAIARqIgEgASgCBEEBcjYCBEEAIQJBACEBC0GwHiABNgIAQbweIAI2AgAgAEEIaiEADA0LIAVBtB4oAgAiAkkEQEG0HiACIAVrIgE2AgBBwB5BwB4oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADA0LQQAhACAFQS9qIgMCf0GAIigCAARAQYgiKAIADAELQYwiQn83AgBBhCJCgKCAgICABDcCAEGAIiAKQQxqQXBxQdiq1aoFczYCAEGUIkEANgIAQeQhQQA2AgBBgCALIgFqIgZBACABayIIcSIBIAVNDQxB4CEoAgAiBARAQdghKAIAIgcgAWoiCSAHTQ0NIAQgCUkNDQsCQEHkIS0AAEEEcUUEQAJAAkACQAJAQcAeKAIAIgQEQEHoISEAA0AgBCAAKAIAIgdPBEAgByAAKAIEaiAESw0DCyAAKAIIIgANAAsLQQAQAiICQX9GDQMgASEGQYQiKAIAIgBBAWsiBCACcQRAIAEgAmsgAiAEakEAIABrcWohBgsgBSAGTw0DQeAhKAIAIgAEQEHYISgCACIEIAZqIgggBE0NBCAAIAhJDQQLIAYQAiIAIAJHDQEMBQsgBiACayAIcSIGEAIiAiAAKAIAIAAoAgRqRg0BIAIhAAsgAEF/Rg0BIAVBMGogBk0EQCAAIQIMBAtBiCIoAgAiAiADIAZrakEAIAJrcSICEAJBf0YNASACIAZqIQYgACECDAMLIAJBf0cNAgtB5CFB5CEoAgBBBHI2AgALIAEQAiECQQAQAiEAIAJBf0YNBSAAQX9GDQUgACACTQ0FIAAgAmsiBiAFQShqTQ0FC0HYIUHYISgCACAGaiIANgIAQdwhKAIAIABJBEBB3CEgADYCAAsCQEHAHigCACIDBEBB6CEhAANAIAIgACgCACIBIAAoAgQiBGpGDQIgACgCCCIADQALDAQLQbgeKAIAIgBBACAAIAJNG0UEQEG4HiACNgIAC0EAIQBB7CEgBjYCAEHoISACNgIAQcgeQX82AgBBzB5BgCIoAgA2AgBB9CFBADYCAANAIABBA3QiAUHYHmogAUHQHmoiBDYCACABQdweaiAENgIAIABBAWoiAEEgRw0AC0G0HiAGQShrIgBBeCACa0EHcSIBayIENgIAQcAeIAEgAmoiATYCACABIARBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIADAQLIAIgA00NAiABIANLDQIgACgCDEEIcQ0CIAAgBCAGajYCBEHAHiADQXggA2tBB3EiAGoiATYCAEG0HkG0HigCACAGaiICIABrIgA2AgAgASAAQQFyNgIEIAIgA2pBKDYCBEHEHkGQIigCADYCAAwDC0EAIQQMCgtBACECDAgLQbgeKAIAIAJLBEBBuB4gAjYCAAsgAiAGaiEBQeghIQACQAJAAkADQCABIAAoAgBHBEAgACgCCCIADQEMAgsLIAAtAAxBCHFFDQELQeghIQADQCADIAAoAgAiAU8EQCABIAAoAgRqIgQgA0sNAwsgACgCCCEADAALAAsgACACNgIAIAAgACgCBCAGajYCBCACQXggAmtBB3FqIgcgBUEDcjYCBCABQXggAWtBB3FqIgYgBSAHaiIFayEAIAMgBkYEQEHAHiAFNgIAQbQeQbQeKAIAIABqIgA2AgAgBSAAQQFyNgIEDAgLQbweKAIAIAZGBEBBvB4gBTYCAEGwHkGwHigCACAAaiIANgIAIAUgAEEBcjYCBCAAIAVqIAA2AgAMCAsgBigCBCIDQQNxQQFHDQYgA0F4cSEJIANB/wFNBEAgBigCDCIBIAYoAggiAkYEQEGoHkGoHigCAEF+IANBA3Z3cTYCAAwHCyACIAE2AgwgASACNgIIDAYLIAYoAhghCCAGIAYoAgwiAkcEQCAGKAIIIgEgAjYCDCACIAE2AggMBQsgBkEUaiIBKAIAIgNFBEAgBigCECIDRQ0EIAZBEGohAQsDQCABIQQgAyICQRRqIgEoAgAiAw0AIAJBEGohASACKAIQIgMNAAsgBEEANgIADAQLQbQeIAZBKGsiAEF4IAJrQQdxIgFrIgg2AgBBwB4gASACaiIBNgIAIAEgCEEBcjYCBCAAIAJqQSg2AgRBxB5BkCIoAgA2AgAgAyAEQScgBGtBB3FqQS9rIgAgACADQRBqSRsiAUEbNgIEIAFB8CEpAgA3AhAgAUHoISkCADcCCEHwISABQQhqNgIAQewhIAY2AgBB6CEgAjYCAEH0IUEANgIAIAFBGGohAANAIABBBzYCBCAAQQhqIQIgAEEEaiEAIAIgBEkNAAsgASADRg0AIAEgASgCBEF+cTYCBCADIAEgA2siAkEBcjYCBCABIAI2AgAgAkH/AU0EQCACQXhxQdAeaiEAAn9BqB4oAgAiAUEBIAJBA3Z0IgJxRQRAQageIAEgAnI2AgAgAAwBCyAAKAIICyEBIAAgAzYCCCABIAM2AgwgAyAANgIMIAMgATYCCAwBC0EfIQAgAkH///8HTQRAIAJBJiACQQh2ZyIAa3ZBAXEgAEEBdGtBPmohAAsgAyAANgIcIANCADcCECAAQQJ0QdggaiEBAkACQEGsHigCACIEQQEgAHQiBnFFBEBBrB4gBCAGcjYCACABIAM2AgAMAQsgAkEZIABBAXZrQQAgAEEfRxt0IQAgASgCACEEA0AgBCIBKAIEQXhxIAJGDQIgAEEddiEEIABBAXQhACABIARBBHFqIgYoAhAiBA0ACyAGIAM2AhALIAMgATYCGCADIAM2AgwgAyADNgIIDAELIAEoAggiACADNgIMIAEgAzYCCCADQQA2AhggAyABNgIMIAMgADYCCAtBtB4oAgAiACAFTQ0AQbQeIAAgBWsiATYCAEHAHkHAHigCACIAIAVqIgI2AgAgAiABQQFyNgIEIAAgBUEDcjYCBCAAQQhqIQAMCAtBpB5BMDYCAEEAIQAMBwtBACECCyAIRQ0AAkAgBigCHCIBQQJ0QdggaiIEKAIAIAZGBEAgBCACNgIAIAINAUGsHkGsHigCAEF+IAF3cTYCAAwCCyAIQRBBFCAIKAIQIAZGG2ogAjYCACACRQ0BCyACIAg2AhggBigCECIBBEAgAiABNgIQIAEgAjYCGAsgBigCFCIBRQ0AIAIgATYCFCABIAI2AhgLIAAgCWohACAGIAlqIgYoAgQhAwsgBiADQX5xNgIEIAUgAEEBcjYCBCAAIAVqIAA2AgAgAEH/AU0EQCAAQXhxQdAeaiEBAn9BqB4oAgAiAkEBIABBA3Z0IgBxRQRAQageIAAgAnI2AgAgAQwBCyABKAIICyEAIAEgBTYCCCAAIAU2AgwgBSABNgIMIAUgADYCCAwBC0EfIQMgAEH///8HTQRAIABBJiAAQQh2ZyIBa3ZBAXEgAUEBdGtBPmohAwsgBSADNgIcIAVCADcCECADQQJ0QdggaiEBAkACQEGsHigCACICQQEgA3QiBHFFBEBBrB4gAiAEcjYCACABIAU2AgAMAQsgAEEZIANBAXZrQQAgA0EfRxt0IQMgASgCACECA0AgAiIBKAIEQXhxIABGDQIgA0EddiECIANBAXQhAyABIAJBBHFqIgQoAhAiAg0ACyAEIAU2AhALIAUgATYCGCAFIAU2AgwgBSAFNgIIDAELIAEoAggiACAFNgIMIAEgBTYCCCAFQQA2AhggBSABNgIMIAUgADYCCAsgB0EIaiEADAILAkAgB0UNAAJAIAQoAhwiAEECdEHYIGoiASgCACAERgRAIAEgAjYCACACDQFBrB4gCEF+IAB3cSIINgIADAILIAdBEEEUIAcoAhAgBEYbaiACNgIAIAJFDQELIAIgBzYCGCAEKAIQIgAEQCACIAA2AhAgACACNgIYCyAEKAIUIgBFDQAgAiAANgIUIAAgAjYCGAsCQCADQQ9NBEAgBCADIAVqIgBBA3I2AgQgACAEaiIAIAAoAgRBAXI2AgQMAQsgBCAFQQNyNgIEIAQgBWoiAiADQQFyNgIEIAIgA2ogAzYCACADQf8BTQRAIANBeHFB0B5qIQACf0GoHigCACIBQQEgA0EDdnQiA3FFBEBBqB4gASADcjYCACAADAELIAAoAggLIQEgACACNgIIIAEgAjYCDCACIAA2AgwgAiABNgIIDAELQR8hACADQf///wdNBEAgA0EmIANBCHZnIgBrdkEBcSAAQQF0a0E+aiEACyACIAA2AhwgAkIANwIQIABBAnRB2CBqIQECQAJAIAhBASAAdCIGcUUEQEGsHiAGIAhyNgIAIAEgAjYCAAwBCyADQRkgAEEBdmtBACAAQR9HG3QhACABKAIAIQUDQCAFIgEoAgRBeHEgA0YNAiAAQR12IQYgAEEBdCEAIAEgBkEEcWoiBigCECIFDQALIAYgAjYCEAsgAiABNgIYIAIgAjYCDCACIAI2AggMAQsgASgCCCIAIAI2AgwgASACNgIIIAJBADYCGCACIAE2AgwgAiAANgIICyAEQQhqIQAMAQsCQCAJRQ0AAkAgAigCHCIAQQJ0QdggaiIBKAIAIAJGBEAgASAENgIAIAQNAUGsHiALQX4gAHdxNgIADAILIAlBEEEUIAkoAhAgAkYbaiAENgIAIARFDQELIAQgCTYCGCACKAIQIgAEQCAEIAA2AhAgACAENgIYCyACKAIUIgBFDQAgBCAANgIUIAAgBDYCGAsCQCADQQ9NBEAgAiADIAVqIgBBA3I2AgQgACACaiIAIAAoAgRBAXI2AgQMAQsgAiAFQQNyNgIEIAIgBWoiBCADQQFyNgIEIAMgBGogAzYCACAHBEAgB0F4cUHQHmohAEG8HigCACEBAn9BASAHQQN2dCIFIAZxRQRAQageIAUgBnI2AgAgAAwBCyAAKAIICyEGIAAgATYCCCAGIAE2AgwgASAANgIMIAEgBjYCCAtBvB4gBDYCAEGwHiADNgIACyACQQhqIQALIApBEGokACAAC9URAw1/HH0BfiAAIAQoAgQiBiAEKAIAIglsQQN0aiEHAkAgBkEBRwRAIARBCGohCCACIAlsIQsgAiADbEEDdCEKIAAhBANAIAQgASALIAMgCCAFEAggASAKaiEBIAQgBkEDdGoiBCAHRw0ACwwBCyACIANsQQN0IQMgACEEA0AgBCABKQIANwIAIAEgA2ohASAEQQhqIgQgB0cNAAsLAkACQAJAAkACQAJAIAlBAmsOBAABAgMECyAFQYgCaiEEIAAgBkEDdGohAQNAIAEgACoCACABKgIAIhMgBCoCACIVlCAEKgIEIhQgASoCBCIWlJMiF5M4AgAgASAAKgIEIBMgFJQgFSAWlJIiE5M4AgQgACAXIAAqAgCSOAIAIAAgEyAAKgIEkjgCBCAAQQhqIQAgAUEIaiEBIAQgAkEDdGohBCAGQQFrIgYNAAsMBAsgBUGIAmoiBCACIAZsQQN0aioCBCETIAZBBHQhCSACQQR0IQggBCEHIAYhAwNAIAAgBkEDdGoiASAAKgIAuyABKgIAIhUgByoCACIUlCAHKgIEIhYgASoCBCIXlJMiGCAAIAlqIgUqAgAiGSAEKgIAIh6UIAQqAgQiHCAFKgIEIh2UkyIakiIbu0QAAAAAAADgP6KhtjgCACABIAAqAgS7IBUgFpQgFCAXlJIiFSAZIByUIB4gHZSSIhSSIha7RAAAAAAAAOA/oqG2OAIEIAAgGyAAKgIAkjgCACAAIBYgACoCBJI4AgQgBSATIBUgFJOUIhUgASoCAJI4AgAgBSABKgIEIBMgGCAak5QiFJM4AgQgASABKgIAIBWTOAIAIAEgFCABKgIEkjgCBCAAQQhqIQAgBCAIaiEEIAcgAkEDdGohByADQQFrIgMNAAsMAwsgBSgCBCELIAZBBHQhCiAGQRhsIQwgAkEYbCENIAJBBHQhDiAFQYgCaiIBIQQgBiEDIAEhBwNAIAAgBkEDdGoiBSoCACETIAUqAgQhFSAAIAxqIgkqAgAhFCAJKgIEIRYgByoCBCEXIAcqAgAhGCABKgIEIRkgASoCACEeIAAgACAKaiIIKgIAIhwgBCoCBCIdlCAEKgIAIhogCCoCBCIblJIiISAAKgIEIiCSIh84AgQgACAcIBqUIB0gG5STIhwgACoCACIdkiIaOAIAIAggHyATIBeUIBggFZSSIhsgFCAZlCAeIBaUkiIfkiIikzgCBCAIIBogEyAYlCAXIBWUkyITIBQgHpQgGSAWlJMiFJIiFZM4AgAgACAVIAAqAgCSOAIAIAAgIiAAKgIEkjgCBCAbIB+TIRUgEyAUkyETICAgIZMhFCAdIByTIRYgASANaiEBIAQgDmohBCAHIAJBA3RqIQcgBQJ9IAsEQCAUIBOTIRcgFiAVkiEYIBQgE5IhEyAWIBWTDAELIBQgE5IhFyAWIBWTIRggFCATkyETIBYgFZILOAIAIAUgEzgCBCAJIBg4AgAgCSAXOAIEIABBCGohACADQQFrIgMNAAsMAgsgBkEATA0BIAVBiAJqIgMgAiAGbCIBQQR0aiIEKgIEIRMgBCoCACEVIAMgAUEDdGoiASoCBCEUIAEqAgAhFiACQQNsIQsgACAGQQN0aiEBIAAgBkEEdGohBCAAIAZBGGxqIQcgACAGQQV0aiEFQQAhCQNAIAAqAgAhFyAAIAAqAgQiGCAEKgIAIhwgAyACIAlsIghBBHRqIgoqAgQiHZQgCioCACIaIAQqAgQiG5SSIiEgByoCACIgIAMgCSALbEEDdGoiCioCBCIflCAKKgIAIiIgByoCBCIjlJIiJJIiGSABKgIAIiUgAyAIQQN0aiIKKgIEIiaUIAoqAgAiJyABKgIEIiiUkiIpIAUqAgAiKiADIAhBBXRqIggqAgQiK5QgCCoCACIsIAUqAgQiLZSSIi6SIh6SkjgCBCAAIBcgHCAalCAdIBuUkyIaICAgIpQgHyAjlJMiG5IiHCAlICeUICYgKJSTIiAgKiAslCArIC2UkyIfkiIdkpI4AgAgASAZIBWUIBggHiAWlJKSIiIgICAfkyIgjCAUlCATIBogG5MiGpSTIhuTOAIEIAEgHCAVlCAXIB0gFpSSkiIfICkgLpMiIyAUlCATICEgJJMiIZSSIiSTOAIAIAUgIiAbkjgCBCAFICQgH5I4AgAgBCAZIBaUIBggHiAVlJKSIhggICATlCAUIBqUkyIZkjgCBCAEIBQgIZQgIyATlJMiHiAcIBaUIBcgHSAVlJKSIheSOAIAIAcgGCAZkzgCBCAHIBcgHpM4AgAgBUEIaiEFIAdBCGohByAEQQhqIQQgAUEIaiEBIABBCGohACAJQQFqIgkgBkcNAAsMAQsgBSgCACELIAlBA3QQByEIAkAgCUECSA0AIAZBAEwNACAFQYgCaiENIAlBfHEhDiAJQQNxIQogCUEBa0EDSSEPQQAhBwNAIAchAUEAIQRBACEDIA9FBEADQCAIIARBA3QiBWogACABQQN0aikCADcCACAIIAVBCHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBEHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBGHJqIAAgASAGaiIBQQN0aikCADcCACAEQQRqIQQgASAGaiEBIANBBGoiAyAORw0ACwtBACEFIAoEQANAIAggBEEDdGogACABQQN0aikCADcCACAEQQFqIQQgASAGaiEBIAVBAWoiBSAKRw0ACwsgCCkCACIvp74hFUEAIQwgByEDA0AgACADQQN0aiIFIC83AgAgAiADbCEQIAUqAgQhFEEBIQEgFSETQQAhBANAIAUgEyAIIAFBA3RqIhEqAgAiFiANIAQgEGoiBCALQQAgBCALThtrIgRBA3RqIhIqAgAiF5QgEioCBCIYIBEqAgQiGZSTkiITOAIAIAUgFCAWIBiUIBcgGZSSkiIUOAIEIAFBAWoiASAJRw0ACyADIAZqIQMgDEEBaiIMIAlHDQALIAdBAWoiByAGRw0ACwsgCBAGCwsDAAELwQEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABAEDAELIAAgAKEgAkGAgMD/B08NABoCQAJAAkACQCAAIAEQC0EDcQ4DAAECAwsgASsDACABKwMIEAQMAwsgASsDACABKwMIQQEQA5oMAgsgASsDACABKwMIEASaDAELIAErAwAgASsDCEEBEAMLIQAgAUEQaiQAIAALuBgDFH8EfAF+IwBBMGsiCCQAAkACQAJAIAC9IhpCIIinIgNB/////wdxIgZB+tS9gARNBEAgA0H//z9xQfvDJEYNASAGQfyyi4AETQRAIBpCAFkEQCABIABEAABAVPsh+b+gIgBEMWNiGmG00L2gIhY5AwAgASAAIBahRDFjYhphtNC9oDkDCEEB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IAIgC0chCiACQQFqIQIgCg0ACwsgBUGgAWogBkEDdGogADkDACAEQQBKIQIgBEEBayEEIAINAAsLRAAAAAAAAAAAIQAgA0EATgRAIAMhAgNAIAIiBEEBayECIAAgBUGgAWogBEEDdGorAwCgIQAgBA0ACwsgCCAAmiAAIAwbOQMAIAUrA6ABIAChIQBBASECIANBAEoEQANAIAAgBUGgAWogAkEDdGorAwCgIQAgAiADRyEEIAJBAWohAiAEDQALCyAIIACaIAAgDBs5AwggBUGwBGokACAHQQdxIQMgCCsDACEAIBpCAFMEQCABIACaOQMAIAEgCCsDCJo5AwhBACADayEDDAELIAEgADkDACABIAgrAwg5AwgLIAhBMGokACADC8UBAQJ/IwBBEGsiASQAAkAgAL1CIIinQf////8HcSICQfvDpP8DTQRAIAJBgIDA8gNJDQEgAEQAAAAAAAAAAEEAEAMhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCwJAAkACQAJAIAAgARALQQNxDgMAAQIDCyABKwMAIAErAwhBARADIQAMAwsgASsDACABKwMIEAQhAAwCCyABKwMAIAErAwhBARADmiEADAELIAErAwAgASsDCBAEmiEACyABQRBqJAAgAAuhBAEDfyABIAJGBEAgACgCAEEDdBAHIgQgAUEBQQEgAEEIaiAAEAggBCECAkAgACgCAEEDdCIDQYAETwRAIAEgAiADEAEMAQsgASADaiEAAkAgASACc0EDcUUEQAJAIAFBA3FFDQAgA0UNAANAIAEgAi0AADoAACACQQFqIQIgAUEBaiIBQQNxRQ0BIAAgAUsNAAsLAkAgAEF8cSIDQcAASQ0AIAEgA0FAaiIFSw0AA0AgASACKAIANgIAIAEgAigCBDYCBCABIAIoAgg2AgggASACKAIMNgIMIAEgAigCEDYCECABIAIoAhQ2AhQgASACKAIYNgIYIAEgAigCHDYCHCABIAIoAiA2AiAgASACKAIkNgIkIAEgAigCKDYCKCABIAIoAiw2AiwgASACKAIwNgIwIAEgAigCNDYCNCABIAIoAjg2AjggASACKAI8NgI8IAJBQGshAiABQUBrIgEgBU0NAAsLIAEgA08NAQNAIAEgAigCADYCACACQQRqIQIgAUEEaiIBIANJDQALDAELIABBBEkNACAB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";
				AA(b) || (b = a(b));
				function QA(Q) {
					if (Q == b && n) return new Uint8Array(n);
					var e = eA(Q);
					if (e) return e;
					if (c) return c(Q);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(Q, e) {
					var s, k = QA(Q);
					return s = new WebAssembly.Module(k), [new WebAssembly.Instance(s, e), s];
				}
				function EA() {
					var Q = { a: K };
					function e(s, k) {
						var d = s.exports;
						return D = d, h = D.c, y(), D.j, q(D.d), O("wasm-instantiate"), d;
					}
					if (IA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(Q, e);
					} catch (s) {
						w("Module.instantiateWasm callback failed with error: " + s), B(s);
					}
					return e(CA(b, Q)[0]);
				}
				var V = (Q) => {
					for (; Q.length > 0;) Q.shift()(A);
				}, f = (Q, e, s) => F.copyWithin(Q, e, e + s), U = (Q) => {
					j("OOM");
				}, x = (Q) => {
					F.length, Q >>>= 0, U(Q);
				};
				function gA(Q) {
					return A["_" + Q];
				}
				var BA = (Q, e) => {
					N.set(Q, e);
				}, aA = (Q) => {
					for (var e = 0, s = 0; s < Q.length; ++s) {
						var k = Q.charCodeAt(s);
						k <= 127 ? e++ : k <= 2047 ? e += 2 : k >= 55296 && k <= 57343 ? (e += 4, ++s) : e += 3;
					}
					return e;
				}, tA = (Q, e, s, k) => {
					if (!(k > 0)) return 0;
					for (var d = s, G = s + k - 1, R = 0; R < Q.length; ++R) {
						var H = Q.charCodeAt(R);
						if (H >= 55296 && H <= 57343) {
							var X = Q.charCodeAt(++R);
							H = 65536 + ((H & 1023) << 10) | X & 1023;
						}
						if (H <= 127) {
							if (s >= G) break;
							e[s++] = H;
						} else if (H <= 2047) {
							if (s + 1 >= G) break;
							e[s++] = 192 | H >> 6, e[s++] = 128 | H & 63;
						} else if (H <= 65535) {
							if (s + 2 >= G) break;
							e[s++] = 224 | H >> 12, e[s++] = 128 | H >> 6 & 63, e[s++] = 128 | H & 63;
						} else {
							if (s + 3 >= G) break;
							e[s++] = 240 | H >> 18, e[s++] = 128 | H >> 12 & 63, e[s++] = 128 | H >> 6 & 63, e[s++] = 128 | H & 63;
						}
					}
					return e[s] = 0, s - d;
				}, oA = (Q, e, s) => tA(Q, F, e, s), sA = (Q) => {
					var e = aA(Q) + 1, s = SA(e);
					return oA(Q, s, e), s;
				}, FA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, RA = (Q, e, s) => {
					for (var k = e + s, d = e; Q[d] && !(d >= k);) ++d;
					if (d - e > 16 && Q.buffer && FA) return FA.decode(Q.subarray(e, d));
					for (var G = ""; e < d;) {
						var R = Q[e++];
						if (!(R & 128)) {
							G += String.fromCharCode(R);
							continue;
						}
						var H = Q[e++] & 63;
						if ((R & 224) == 192) {
							G += String.fromCharCode((R & 31) << 6 | H);
							continue;
						}
						var X = Q[e++] & 63;
						if ((R & 240) == 224 ? R = (R & 15) << 12 | H << 6 | X : R = (R & 7) << 18 | H << 12 | X << 6 | Q[e++] & 63, R < 65536) G += String.fromCharCode(R);
						else {
							var Z = R - 65536;
							G += String.fromCharCode(55296 | Z >> 10, 56320 | Z & 1023);
						}
					}
					return G;
				}, nA = (Q, e) => Q ? RA(F, Q, e) : "", NA = function(Q, e, s, k, d) {
					var G = {
						string: (z) => {
							var ZA = 0;
							return z != null && z !== 0 && (ZA = sA(z)), ZA;
						},
						array: (z) => {
							var ZA = SA(z.length);
							return BA(z, ZA), ZA;
						}
					};
					function R(z) {
						return e === "string" ? nA(z) : e === "boolean" ? !!z : z;
					}
					var H = gA(Q), X = [], Z = 0;
					if (k) for (var DA = 0; DA < k.length; DA++) {
						var yA = G[s[DA]];
						yA ? (Z === 0 && (Z = vA()), X[DA] = yA(k[DA])) : X[DA] = k[DA];
					}
					var uA = H.apply(null, X);
					function J(z) {
						return Z !== 0 && GA(Z), R(z);
					}
					return uA = J(uA), uA;
				}, MA = function(Q, e, s, k) {
					var d = !s || s.every((G) => G === "number" || G === "boolean");
					return e !== "string" && d && !k ? gA(Q) : function() {
						return NA(Q, e, s, arguments, k);
					};
				}, K = {
					b: f,
					a: x
				}, rA = EA();
				rA.d, A._kiss_fft_free = rA.e, A._free = rA.f, A._kiss_fft_alloc = rA.g, A._malloc = rA.h, A._kiss_fft = rA.i, rA.__errno_location;
				var vA = rA.k, GA = rA.l, SA = rA.m;
				function mA(Q) {
					try {
						for (var e = atob(Q), s = new Uint8Array(e.length), k = 0; k < e.length; ++k) s[k] = e.charCodeAt(k);
						return s;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function eA(Q) {
					if (AA(Q)) return mA(Q.slice($.length));
				}
				A.ccall = NA, A.cwrap = MA;
				var wA;
				m = function Q() {
					wA || i(), wA || (m = Q);
				};
				function i() {
					if (S > 0 || (L(), S > 0)) return;
					function Q() {
						wA || (wA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), Q();
					}, 1)) : Q();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return i(), I;
			});
		})();
	})), YA, nI, PI, sI, WI, Kg = iA((() => {
		Lg(), YA = TI({}), nI = YA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), PI = YA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), sI = YA.cwrap("kiss_fft_free", "void", ["number"]), WI = class {
			constructor(g) {
				this.size = g, this.fcfg = nI(this.size, !1), this.icfg = nI(this.size, !0), this.inptr = YA._malloc(this.size * 8), this.cin = new Float32Array(YA.HEAPU8.buffer, this.inptr, this.size * 2);
			}
			fft = function(g) {
				const I = YA._malloc(this.size * 8), A = new Float32Array(YA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(g), PI(this.fcfg, this.inptr, I);
				let C = new Float32Array(this.size * 2);
				return C.set(A), YA._free(I), C;
			};
			dispose() {
				sI(this.fcfg), sI(this.icfg), YA._free(this.inptr);
			}
		};
	}));
	function lA(g) {
		if (this.size = g | 0, this.size <= 1 || (this.size & this.size - 1) !== 0) throw new Error("FFT size must be a power of two and bigger than 1");
		this._csize = g << 1;
		for (var I = new Array(this.size * 2), A = 0; A < I.length; A += 2) {
			const t = Math.PI * A / this.size;
			I[A] = Math.cos(t), I[A + 1] = -Math.sin(t);
		}
		this.table = I;
		for (var C = 0, B = 1; this.size > B; B <<= 1) C++;
		this._width = C % 2 === 0 ? C - 1 : C, this._bitrev = new Array(1 << this._width);
		for (var E = 0; E < this._bitrev.length; E++) {
			this._bitrev[E] = 0;
			for (var r = 0; r < this._width; r += 2) {
				var o = this._width - r - 2;
				this._bitrev[E] |= (E >>> r & 3) << o;
			}
		}
		this._out = null, this._data = null, this._inv = 0;
	}
	var qg = iA((() => {
		lA.prototype.fromComplexArray = function(I, A) {
			for (var C = A || new Array(I.length >>> 1), B = 0; B < I.length; B += 2) C[B >>> 1] = I[B];
			return C;
		}, lA.prototype.createComplexArray = function() {
			const I = new Array(this._csize);
			for (var A = 0; A < I.length; A++) I[A] = 0;
			return I;
		}, lA.prototype.toComplexArray = function(I, A) {
			for (var C = A || this.createComplexArray(), B = 0; B < C.length; B += 2) C[B] = I[B >>> 1], C[B + 1] = 0;
			return C;
		}, lA.prototype.completeSpectrum = function(I) {
			for (var A = this._csize, C = A >>> 1, B = 2; B < C; B += 2) I[A - B] = I[B], I[A - B + 1] = -I[B + 1];
		}, lA.prototype.transform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._transform4(), this._out = null, this._data = null;
		}, lA.prototype.realTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._realTransform4(), this._out = null, this._data = null;
		}, lA.prototype.inverseTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 1, this._transform4();
			for (var C = 0; C < I.length; C++) I[C] /= this.size;
			this._out = null, this._data = null;
		}, lA.prototype._transform4 = function() {
			var I = this._out, A = this._csize, C = 1 << this._width, B = A / C << 1, E, r, o = this._bitrev;
			if (B === 4) for (E = 0, r = 0; E < A; E += B, r++) {
				const D = o[r];
				this._singleTransform2(E, D, C);
			}
			else for (E = 0, r = 0; E < A; E += B, r++) {
				const D = o[r];
				this._singleTransform4(E, D, C);
			}
			var t = this._inv ? -1 : 1, a = this.table;
			for (C >>= 2; C >= 2; C >>= 2) {
				B = A / C << 1;
				var c = B >>> 2;
				for (E = 0; E < A; E += B) for (var w = E + c, n = E, h = 0; n < w; n += 2, h += C) {
					const D = n, l = D + c, N = l + c, F = N + c, y = I[D], M = I[D + 1], Y = I[l], u = I[l + 1], L = I[N], W = I[N + 1], T = I[F], _ = I[F + 1], q = y, p = M, S = a[h], v = t * a[h + 1], m = Y * S - u * v, IA = Y * v + u * S, O = a[2 * h], j = t * a[2 * h + 1], $ = L * O - W * j, AA = L * j + W * O, b = a[3 * h], QA = t * a[3 * h + 1], CA = T * b - _ * QA, EA = T * QA + _ * b, V = q + $, f = p + AA, U = q - $, x = p - AA, gA = m + CA, BA = IA + EA, aA = t * (m - CA), tA = t * (IA - EA), oA = V + gA, sA = f + BA, FA = V - gA, RA = f - BA, nA = U + tA, NA = x - aA, MA = U - tA, K = x + aA;
					I[D] = oA, I[D + 1] = sA, I[l] = nA, I[l + 1] = NA, I[N] = FA, I[N + 1] = RA, I[F] = MA, I[F + 1] = K;
				}
			}
		}, lA.prototype._singleTransform2 = function(I, A, C) {
			const B = this._out, E = this._data, r = E[A], o = E[A + 1], t = E[A + C], a = E[A + C + 1], c = r + t, w = o + a, n = r - t, h = o - a;
			B[I] = c, B[I + 1] = w, B[I + 2] = n, B[I + 3] = h;
		}, lA.prototype._singleTransform4 = function(I, A, C) {
			const B = this._out, E = this._data, r = this._inv ? -1 : 1, o = C * 2, t = C * 3, a = E[A], c = E[A + 1], w = E[A + C], n = E[A + C + 1], h = E[A + o], D = E[A + o + 1], l = E[A + t], N = E[A + t + 1], F = a + h, y = c + D, M = a - h, Y = c - D, u = w + l, L = n + N, W = r * (w - l), T = r * (n - N), _ = F + u, q = y + L, p = M + T, S = Y - W, v = F - u, m = y - L, IA = M - T, O = Y + W;
			B[I] = _, B[I + 1] = q, B[I + 2] = p, B[I + 3] = S, B[I + 4] = v, B[I + 5] = m, B[I + 6] = IA, B[I + 7] = O;
		}, lA.prototype._realTransform4 = function() {
			var I = this._out, A = this._csize, C = 1 << this._width, B = A / C << 1, E, r, o = this._bitrev;
			if (B === 4) for (E = 0, r = 0; E < A; E += B, r++) {
				const G = o[r];
				this._singleRealTransform2(E, G >>> 1, C >>> 1);
			}
			else for (E = 0, r = 0; E < A; E += B, r++) {
				const G = o[r];
				this._singleRealTransform4(E, G >>> 1, C >>> 1);
			}
			var t = this._inv ? -1 : 1, a = this.table;
			for (C >>= 2; C >= 2; C >>= 2) {
				B = A / C << 1;
				var c = B >>> 1, w = c >>> 1, n = w >>> 1;
				for (E = 0; E < A; E += B) for (var h = 0, D = 0; h <= n; h += 2, D += C) {
					var l = E + h, N = l + w, F = N + w, y = F + w, M = I[l], Y = I[l + 1], u = I[N], L = I[N + 1], W = I[F], T = I[F + 1], _ = I[y], q = I[y + 1], p = M, S = Y, v = a[D], m = t * a[D + 1], IA = u * v - L * m, O = u * m + L * v, j = a[2 * D], $ = t * a[2 * D + 1], AA = W * j - T * $, b = W * $ + T * j, QA = a[3 * D], CA = t * a[3 * D + 1], EA = _ * QA - q * CA, V = _ * CA + q * QA, f = p + AA, U = S + b, x = p - AA, gA = S - b, BA = IA + EA, aA = O + V, tA = t * (IA - EA), oA = t * (O - V), sA = f + BA, FA = U + aA, RA = x + oA, nA = gA - tA;
					if (I[l] = sA, I[l + 1] = FA, I[N] = RA, I[N + 1] = nA, h === 0) {
						var NA = f - BA, MA = U - aA;
						I[F] = NA, I[F + 1] = MA;
						continue;
					}
					if (h !== n) {
						var K = x, rA = -gA, vA = f, GA = -U, SA = -t * oA, mA = -t * tA, eA = -t * aA, wA = -t * BA, i = K + SA, Q = rA + mA, e = vA + wA, s = GA - eA, k = E + w - h, d = E + c - h;
						I[k] = i, I[k + 1] = Q, I[d] = e, I[d + 1] = s;
					}
				}
			}
		}, lA.prototype._singleRealTransform2 = function(I, A, C) {
			const B = this._out, E = this._data, r = E[A], o = E[A + C], t = r + o, a = r - o;
			B[I] = t, B[I + 1] = 0, B[I + 2] = a, B[I + 3] = 0;
		}, lA.prototype._singleRealTransform4 = function(I, A, C) {
			const B = this._out, E = this._data, r = this._inv ? -1 : 1, o = C * 2, t = C * 3, a = E[A], c = E[A + C], w = E[A + o], n = E[A + t], h = a + w, D = a - w, l = c + n, N = r * (c - n), F = h + l, y = D, M = -N, Y = h - l, u = D, L = N;
			B[I] = F, B[I + 1] = 0, B[I + 2] = y, B[I + 3] = M, B[I + 4] = Y, B[I + 5] = 0, B[I + 6] = u, B[I + 7] = L;
		};
	})), DI, pg = iA((() => {
		qg(), DI = class {
			constructor(g) {
				this.size = g, this.indutnyFft = new lA(g);
			}
			fft(g) {
				const I = new Float32Array(2 * this.size);
				return this.indutnyFft.transform(I, g), I;
			}
		};
	})), xI, Tg = iA((() => {
		xI = (() => {
			var g = self.location.href;
			return (function(I = {}) {
				var A = I, C, B;
				A.ready = new Promise((i, Q) => {
					C = i, B = Q;
				});
				var E = Object.assign({}, A), r = !0, o = !1, t = "";
				function a(i) {
					return A.locateFile ? A.locateFile(i, t) : t + i;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), g && (t = g), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (i) => {
					var Q = new XMLHttpRequest();
					return Q.open("GET", i, !1), Q.responseType = "arraybuffer", Q.send(null), new Uint8Array(Q.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, E), E = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var n;
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && j("no native wasm support detected");
				var h, D, l = !1, N, F;
				function y() {
					var i = h.buffer;
					A.HEAP8 = N = new Int8Array(i), A.HEAP16 = new Int16Array(i), A.HEAP32 = new Int32Array(i), A.HEAPU8 = F = new Uint8Array(i), A.HEAPU16 = new Uint16Array(i), A.HEAPU32 = new Uint32Array(i), A.HEAPF32 = new Float32Array(i), A.HEAPF64 = new Float64Array(i);
				}
				var M = [], Y = [], u = [];
				function L() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) _(A.preRun.shift());
					V(M);
				}
				function W() {
					V(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					V(u);
				}
				function _(i) {
					M.unshift(i);
				}
				function q(i) {
					Y.unshift(i);
				}
				function p(i) {
					u.unshift(i);
				}
				var S = 0, v = null, m = null;
				function IA(i) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function O(i) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), m)) {
						var Q = m;
						m = null, Q();
					}
				}
				function j(i) {
					A.onAbort && A.onAbort(i), i = "Aborted(" + i + ")", w(i), l = !0, i += ". Build with -sASSERTIONS for more info.";
					var Q = new WebAssembly.RuntimeError(i);
					throw B(Q), Q;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(i) {
					return i.startsWith($);
				}
				var b = "data:application/octet-stream;base64,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ACACSwRAQbgeIAI2AgALIAIgBmohAUHoISEAAkACQAJAA0AgASAAKAIARwRAIAAoAggiAA0BDAILCyAALQAMQQhxRQ0BC0HoISEAA0AgAyAAKAIAIgFPBEAgASAAKAIEaiIEIANLDQMLIAAoAgghAAwACwALIAAgAjYCACAAIAAoAgQgBmo2AgQgAkF4IAJrQQdxaiIHIAVBA3I2AgQgAUF4IAFrQQdxaiIGIAUgB2oiBWshACADIAZGBEBBwB4gBTYCAEG0HkG0HigCACAAaiIANgIAIAUgAEEBcjYCBAwIC0G8HigCACAGRgRAQbweIAU2AgBBsB5BsB4oAgAgAGoiADYCACAFIABBAXI2AgQgACAFaiAANgIADAgLIAYoAgQiA0EDcUEBRw0GIANBeHEhCSADQf8BTQRAIAYoAgwiASAGKAIIIgJGBEBBqB5BqB4oAgBBfiADQQN2d3E2AgAMBwsgAiABNgIMIAEgAjYCCAwGCyAGKAIYIQggBiAGKAIMIgJHBEAgBigCCCIBIAI2AgwgAiABNgIIDAULIAZBFGoiASgCACIDRQRAIAYoAhAiA0UNBCAGQRBqIQELA0AgASEEIAMiAkEUaiIBKAIAIgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHY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";
				AA(b) || (b = a(b));
				function QA(i) {
					if (i == b && n) return new Uint8Array(n);
					var Q = mA(i);
					if (Q) return Q;
					if (c) return c(i);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(i, Q) {
					var e, s = QA(i);
					return e = new WebAssembly.Module(s), [new WebAssembly.Instance(e, Q), e];
				}
				function EA() {
					var i = { a: MA };
					function Q(e, s) {
						var k = e.exports;
						return D = k, h = D.b, y(), D.e, q(D.c), O("wasm-instantiate"), k;
					}
					if (IA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(i, Q);
					} catch (e) {
						w("Module.instantiateWasm callback failed with error: " + e), B(e);
					}
					return Q(CA(b, i)[0]);
				}
				var V = (i) => {
					for (; i.length > 0;) i.shift()(A);
				}, f = (i) => {
					j("OOM");
				}, U = (i) => {
					F.length, i >>>= 0, f(i);
				};
				function x(i) {
					return A["_" + i];
				}
				var gA = (i, Q) => {
					N.set(i, Q);
				}, BA = (i) => {
					for (var Q = 0, e = 0; e < i.length; ++e) {
						var s = i.charCodeAt(e);
						s <= 127 ? Q++ : s <= 2047 ? Q += 2 : s >= 55296 && s <= 57343 ? (Q += 4, ++e) : Q += 3;
					}
					return Q;
				}, aA = (i, Q, e, s) => {
					if (!(s > 0)) return 0;
					for (var k = e, d = e + s - 1, G = 0; G < i.length; ++G) {
						var R = i.charCodeAt(G);
						if (R >= 55296 && R <= 57343) {
							var H = i.charCodeAt(++G);
							R = 65536 + ((R & 1023) << 10) | H & 1023;
						}
						if (R <= 127) {
							if (e >= d) break;
							Q[e++] = R;
						} else if (R <= 2047) {
							if (e + 1 >= d) break;
							Q[e++] = 192 | R >> 6, Q[e++] = 128 | R & 63;
						} else if (R <= 65535) {
							if (e + 2 >= d) break;
							Q[e++] = 224 | R >> 12, Q[e++] = 128 | R >> 6 & 63, Q[e++] = 128 | R & 63;
						} else {
							if (e + 3 >= d) break;
							Q[e++] = 240 | R >> 18, Q[e++] = 128 | R >> 12 & 63, Q[e++] = 128 | R >> 6 & 63, Q[e++] = 128 | R & 63;
						}
					}
					return Q[e] = 0, e - k;
				}, tA = (i, Q, e) => aA(i, F, Q, e), oA = (i) => {
					var Q = BA(i) + 1, e = GA(Q);
					return tA(i, e, Q), e;
				}, sA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, FA = (i, Q, e) => {
					for (var s = Q + e, k = Q; i[k] && !(k >= s);) ++k;
					if (k - Q > 16 && i.buffer && sA) return sA.decode(i.subarray(Q, k));
					for (var d = ""; Q < k;) {
						var G = i[Q++];
						if (!(G & 128)) {
							d += String.fromCharCode(G);
							continue;
						}
						var R = i[Q++] & 63;
						if ((G & 224) == 192) {
							d += String.fromCharCode((G & 31) << 6 | R);
							continue;
						}
						var H = i[Q++] & 63;
						if ((G & 240) == 224 ? G = (G & 15) << 12 | R << 6 | H : G = (G & 7) << 18 | R << 12 | H << 6 | i[Q++] & 63, G < 65536) d += String.fromCharCode(G);
						else {
							var X = G - 65536;
							d += String.fromCharCode(55296 | X >> 10, 56320 | X & 1023);
						}
					}
					return d;
				}, RA = (i, Q) => i ? FA(F, i, Q) : "", nA = function(i, Q, e, s, k) {
					var d = {
						string: (J) => {
							var z = 0;
							return J != null && J !== 0 && (z = oA(J)), z;
						},
						array: (J) => {
							var z = GA(J.length);
							return gA(J, z), z;
						}
					};
					function G(J) {
						return Q === "string" ? RA(J) : Q === "boolean" ? !!J : J;
					}
					var R = x(i), H = [], X = 0;
					if (s) for (var Z = 0; Z < s.length; Z++) {
						var DA = d[e[Z]];
						DA ? (X === 0 && (X = rA()), H[Z] = DA(s[Z])) : H[Z] = s[Z];
					}
					var yA = R.apply(null, H);
					function uA(J) {
						return X !== 0 && vA(X), G(J);
					}
					return yA = uA(yA), yA;
				}, NA = function(i, Q, e, s) {
					var k = !e || e.every((d) => d === "number" || d === "boolean");
					return Q !== "string" && k && !s ? x(i) : function() {
						return nA(i, Q, e, arguments, s);
					};
				}, MA = { a: U }, K = EA();
				K.c, A._fftCross = K.d, K.__errno_location, A._malloc = K.f, A._free = K.g;
				var rA = K.h, vA = K.i, GA = K.j;
				function SA(i) {
					try {
						for (var Q = atob(i), e = new Uint8Array(Q.length), s = 0; s < Q.length; ++s) e[s] = Q.charCodeAt(s);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function mA(i) {
					if (AA(i)) return SA(i.slice($.length));
				}
				A.ccall = nA, A.cwrap = NA;
				var eA;
				m = function i() {
					eA || wA(), eA || (m = i);
				};
				function wA() {
					if (S > 0 || (L(), S > 0)) return;
					function i() {
						eA || (eA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), i();
					}, 1)) : i();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return wA(), I;
			});
		})();
	}));
	function Pg(g) {
		this.size = g, this.n = g * 8, this.ptr = bA._malloc(this.n * 4), this.ri = new Uint8Array(bA.HEAPU8.buffer, this.ptr, this.n), this.ii = new Uint8Array(bA.HEAPU8.buffer, this.ptr + this.n, this.n), this.transform = function(I, A, C) {
			var B = this.ptr, E = this.n;
			return this.ri.set(new Uint8Array(I.buffer)), this.ii.set(new Uint8Array(A.buffer)), VI(this.size, C, B, B + E, B + E * 2, B + E * 3), {
				real: new Float64Array(bA.HEAPU8.buffer, B + E * 2, this.size),
				imag: new Float64Array(bA.HEAPU8.buffer, B + E * 3, this.size)
			};
		}, this.dispose = function() {
			bA._free(this.ptr);
		};
	}
	var bA, VI, Wg = iA((() => {
		Tg(), bA = xI({}), VI = bA.cwrap("fftCross", "void", [
			"number",
			"number",
			"number",
			"number",
			"number",
			"number"
		]);
	})), jI, xg = iA((() => {
		Wg(), jI = class {
			constructor(g) {
				this.size = g, this.fftcross = new Pg(g), this.real = new Float64Array(this.size), this.imag = new Float64Array(this.size);
			}
			fft(g) {
				for (var I = 0; I < this.size; I++) this.real[I] = g[2 * I], this.imag[I] = g[2 * I + 1];
				const A = this.fftcross.transform(this.real, this.imag, !1), C = new Float32Array(2 * this.size);
				for (var I = 0; I < this.size; I++) C[2 * I] = A.real[I], C[2 * I + 1] = A.imag[I];
				return C;
			}
		};
	}));
	function Vg(g) {
		this.n = g, this.levels = -1;
		for (var I = 0; I < 32; I++) 1 << I == g && (this.levels = I);
		if (this.levels == -1) throw "Length is not a power of 2";
		this.cosTable = new Array(g / 2), this.sinTable = new Array(g / 2);
		for (var I = 0; I < g / 2; I++) this.cosTable[I] = Math.cos(2 * Math.PI * I / g), this.sinTable[I] = Math.sin(2 * Math.PI * I / g);
		this.forward = function(A, C) {
			for (var B = this.n, E = 0; E < B; E++) {
				var r = D(E, this.levels);
				if (r > E) {
					var o = A[E];
					A[E] = A[r], A[r] = o, o = C[E], C[E] = C[r], C[r] = o;
				}
			}
			for (var t = 2; t <= B; t *= 2) for (var a = t / 2, c = B / t, E = 0; E < B; E += t) for (var r = E, w = 0; r < E + a; r++, w += c) {
				var n = A[r + a] * this.cosTable[w] + C[r + a] * this.sinTable[w], h = -A[r + a] * this.sinTable[w] + C[r + a] * this.cosTable[w];
				A[r + a] = A[r] - n, C[r + a] = C[r] - h, A[r] += n, C[r] += h;
			}
			function D(l, N) {
				for (var F = 0, y = 0; y < N; y++) F = F << 1 | l & 1, l >>>= 1;
				return F;
			}
		}, this.inverse = function(A, C) {
			forward(C, A);
		};
	}
	var jg = iA((() => {})), XI, Xg = iA((() => {
		jg(), XI = class {
			constructor(g) {
				this.size = g, this.fftNayuki = new Vg(g);
			}
			fft(g) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), C = new Float32Array(this.size * 2);
				for (var B = 0; B < this.size; ++B) I[B] = g[B * 2], A[B] = g[B * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var B = 0; B < this.size; ++B) C[B * 2] = I[B], C[B * 2 + 1] = A[B];
				return C;
			}
		};
	})), OI, Og = iA((() => {
		OI = (() => {
			var g = self.location.href;
			return (function(I = {}) {
				var A = I, C, B;
				A.ready = new Promise((i, Q) => {
					C = i, B = Q;
				});
				var E = Object.assign({}, A), r = !0, o = !1, t = "";
				function a(i) {
					return A.locateFile ? A.locateFile(i, t) : t + i;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), g && (t = g), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (i) => {
					var Q = new XMLHttpRequest();
					return Q.open("GET", i, !1), Q.responseType = "arraybuffer", Q.send(null), new Uint8Array(Q.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, E), E = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var n;
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && j("no native wasm support detected");
				var h, D, l = !1, N, F;
				function y() {
					var i = h.buffer;
					A.HEAP8 = N = new Int8Array(i), A.HEAP16 = new Int16Array(i), A.HEAP32 = new Int32Array(i), A.HEAPU8 = F = new Uint8Array(i), A.HEAPU16 = new Uint16Array(i), A.HEAPU32 = new Uint32Array(i), A.HEAPF32 = new Float32Array(i), A.HEAPF64 = new Float64Array(i);
				}
				var M = [], Y = [], u = [];
				function L() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) _(A.preRun.shift());
					V(M);
				}
				function W() {
					V(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					V(u);
				}
				function _(i) {
					M.unshift(i);
				}
				function q(i) {
					Y.unshift(i);
				}
				function p(i) {
					u.unshift(i);
				}
				var S = 0, v = null, m = null;
				function IA(i) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function O(i) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), m)) {
						var Q = m;
						m = null, Q();
					}
				}
				function j(i) {
					A.onAbort && A.onAbort(i), i = "Aborted(" + i + ")", w(i), l = !0, i += ". Build with -sASSERTIONS for more info.";
					var Q = new WebAssembly.RuntimeError(i);
					throw B(Q), Q;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(i) {
					return i.startsWith($);
				}
				var b = "data:application/octet-stream;base64,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IgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHYIGohAQJAAkBBrB4oAgAiBEEBIAB0IgZxRQRAQaweIAQgBnI2AgAgASADNgIADAELIAJBGSAAQQF2a0EAIABBH0cbdCEAIAEoAgAhBANAIAQiASgCBEF4cSACRg0CIABBHXYhBCAAQQF0IQAgASAEQQRxaiIGKAIQIgQNAAsgBiADNgIQCyADIAE2AhggAyADNgIMIAMgAzYCCAwBCyABKAIIIgAgAzYCDCABIAM2AgggA0EANgIYIAMgATYCDCADIAA2AggLQbQeKAIAIgAgBU0NAEG0HiAAIAVrIgE2AgBBwB5BwB4oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADAgLQaQeQTA2AgBBACEADAcLQQAhAgsgCEUNAAJAIAYoAhwiAUECdEHYIGoiBCgCACAGRgRAIAQgAjYCACACDQFBrB5BrB4oAgBBfiABd3E2AgAMAgsgCEEQQRQgCCgCECAGRhtqIAI2AgAgAkUNAQsgAiAINgIYIAYoAhAiAQRAIAIgATYCECABIAI2AhgLIAYoAhQiAUUNACACIAE2AhQgASACNgIYCyAAIAlqIQAgBiAJaiIGKAIEIQMLIAYgA0F+cTYCBCAFIABBAXI2AgQgACAFaiAANgIAIABB/wFNBEAgAEF4cUHQHmohAQJ/QageKAIAIgJBASAAQQN2dCIAcUUEQEGoHiAAIAJyNgIAIAEMAQsgASgCCAshACABIAU2AgggACAFNgIMIAUgATYCDCAFIAA2AggMAQtBHyEDIABB////B00EQCAAQSYgAEEIdmciAWt2QQFxIAFBAXRrQT5qIQMLIAUgAzYCHCAFQgA3AhAgA0ECdEHYIGohAQJAAkBBrB4oAgAiAkEBIAN0IgRxRQRAQaweIAIgBHI2AgAgASAFNgIADAELIABBGSADQQF2a0EAIANBH0cbdCEDIAEoAgAhAgNAIAIiASgCBEF4cSAARg0CIANBHXYhAiADQQF0IQMgASACQQRxaiIEKAIQIgINAAsgBCAFNgIQCyAFIAE2AhggBSAFNgIMIAUgBTYCCAwBCyABKAIIIgAgBTYCDCABIAU2AgggBUEANgIYIAUgATYCDCAFIAA2AggLIAdBCGohAAwCCwJAIAdFDQACQCAEKAIcIgBBAnRB2CBqIgEoAgAgBEYEQCABIAI2AgAgAg0BQaweIAhBfiAAd3EiCDYCAAwCCyAHQRBBFCAHKAIQIARGG2ogAjYCACACRQ0BCyACIAc2AhggBCgCECIABEAgAiAANgIQIAAgAjYCGAsgBCgCFCIARQ0AIAIgADYCFCAAIAI2AhgLAkAgA0EPTQRAIAQgAyAFaiIAQQNyNgIEIAAgBGoiACAAKAIEQQFyNgIEDAELIAQgBUEDcjYCBCAEIAVqIgIgA0EBcjYCBCACIANqIAM2AgAgA0H/AU0EQCADQXhxQdAeaiEAAn9BqB4oAgAiAUEBIANBA3Z0IgNxRQRAQageIAEgA3I2AgAgAAwBCyAAKAIICyEBIAAgAjYCCCABIAI2AgwgAiAANgIMIAIgATYCCAwBC0EfIQAgA0H///8HTQRAIANBJiADQQh2ZyIAa3ZBAXEgAEEBdGtBPmohAAsgAiAANgIcIAJCADcCECAAQQJ0QdggaiEBAkACQCAIQQEgAHQiBnFFBEBBrB4gBiAIcjYCACABIAI2AgAMAQsgA0EZIABBAXZrQQAgAEEfRxt0IQAgASgCACEFA0AgBSIBKAIEQXhxIANGDQIgAEEddiEGIABBAXQhACABIAZBBHFqIgYoAhAiBQ0ACyAGIAI2AhALIAIgATYCGCACIAI2AgwgAiACNgIIDAELIAEoAggiACACNgIMIAEgAjYCCCACQQA2AhggAiABNgIMIAIgADYCCAsgBEEIaiEADAELAkAgCUUNAAJAIAIoAhwiAEECdEHYIGoiASgCACACRgRAIAEgBDYCACAEDQFBrB4gC0F+IAB3cTYCAAwCCyAJQRBBFCAJKAIQIAJGG2ogBDYCACAERQ0BCyAEIAk2AhggAigCECIABEAgBCAANgIQIAAgBDYCGAsgAigCFCIARQ0AIAQgADYCFCAAIAQ2AhgLAkAgA0EPTQRAIAIgAyAFaiIAQQNyNgIEIAAgAmoiACAAKAIEQQFyNgIEDAELIAIgBUEDcjYCBCACIAVqIgQgA0EBcjYCBCADIARqIAM2AgAgBwRAIAdBeHFB0B5qIQBBvB4oAgAhAQJ/QQEgB0EDdnQiBSAGcUUEQEGoHiAFIAZyNgIAIAAMAQsgACgCCAshBiAAIAE2AgggBiABNgIMIAEgADYCDCABIAY2AggLQbweIAQ2AgBBsB4gAzYCAAsgAkEIaiEACyAKQRBqJAAgAAtPAQJ/QaAeKAIAIgEgAEEHakF4cSICaiEAAkAgAkEAIAAgAU0bDQAgAD8AQRB0SwRAIAAQAEUNAQtBoB4gADYCACABDwtBpB5BMDYCAEF/C5kBAQN8IAAgAKIiAyADIAOioiADRHzVz1o62eU9okTrnCuK5uVavqCiIAMgA0R9/rFX4x3HPqJE1WHBGaABKr+gokSm+BARERGBP6CgIQUgAyAAoiEEIAJFBEAgBCADIAWiRElVVVVVVcW/oKIgAKAPCyAAIAMgAUQAAAAAAADgP6IgBSAEoqGiIAGhIARESVVVVVVVxT+ioKELkgEBA3xEAAAAAAAA8D8gACAAoiICRAAAAAAAAOA/oiIDoSIERAAAAAAAAPA/IAShIAOhIAIgAiACIAJEkBXLGaAB+j6iRHdRwRZswVa/oKJETFVVVVVVpT+goiACIAKiIgMgA6IgAiACRNQ4iL7p+qi9okTEsbS9nu4hPqCiRK1SnIBPfpK+oKKgoiAAIAGioaCgC6gBAAJAIAFBgAhOBEAgAEQAAAAAAADgf6IhACABQf8PSQRAIAFB/wdrIQEMAgsgAEQAAAAAAADgf6IhAEH9FyABIAFB/RdOG0H+D2shAQwBCyABQYF4Sg0AIABEAAAAAAAAYAOiIQAgAUG4cEsEQCABQckHaiEBDAELIABEAAAAAAAAYAOiIQBB8GggASABQfBoTBtBkg9qIQELIAAgAUH/B2qtQjSGv6ILxQEBAn8jAEEQayIBJAACQCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEAgAkGAgMDyA0kNASAARAAAAAAAAAAAQQAQBCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELAkACQAJAAkAgACABEAlBA3EOAwABAgMLIAErAwAgASsDCEEBEAQhAAwDCyABKwMAIAErAwgQBSEADAILIAErAwAgASsDCEEBEASaIQAMAQsgASsDACABKwMIEAWaIQALIAFBEGokACAACwMAAQu4GAMUfwR8AX4jAEEwayIIJAACQAJAAkAgAL0iGkIgiKciA0H/////B3EiBkH61L2ABE0EQCADQf//P3FB+8MkRg0BIAZB/LKLgARNBEAgGkIAWQRAIAEgAEQAAEBU+yH5v6AiAEQxY2IaYbTQvaAiFjkDACABIAAgFqFEMWNiGmG00L2gOQMIQQEhAwwFCyABIABEAABAVPsh+T+gIgBEMWNiGmG00D2gIhY5AwAgASAAIBahRDFjYhphtNA9oDkDCEF/IQMMBAsgGkIAWQRAIAEgAEQAAEBU+yEJwKAiAEQxY2IaYbTgvaAiFjkDACABIAAgFqFEMWNiGmG04L2gOQMIQQIhAwwECyABIABEAABAVPshCUCgIgBEMWNiGmG04D2gIhY5AwAgASAAIBahRDFjYhphtOA9oDkDCEF+IQMMAwsgBkG7jPGABE0EQCAGQbz714AETQRAIAZB/LLLgARGDQIgGkIAWQRAIAEgAEQAADB/fNkSwKAiAETKlJOnkQ7pvaAiFjkDACABIAAgFqFEypSTp5EO6b2gOQMIQQMhAwwFCyABIABEAAAwf3zZEkCgIgBEypSTp5EO6T2gIhY5AwAgASAAIBahRMqUk6eRDuk9oDkDCEF9IQMMBAsgBkH7w+SABEYNASAaQgBZBEAgASAARAAAQFT7IRnAoCIARDFjYhphtPC9oCIWOQMAIAEgACAWoUQxY2IaYbTwvaA5AwhBBCEDDAQLIAEgAEQAAEBU+yEZQKAiAEQxY2IaYbTwPaAiFjkDACABIAAgFqFEMWNiGmG08D2gOQMIQXwhAwwDCyAGQfrD5IkESw0BCyAAIABEg8jJbTBf5D+iRAAAAAAAADhDoEQAAAAAAAA4w6AiF0QAAEBU+yH5v6KgIhYgF0QxY2IaYbTQPaIiGKEiGUQYLURU+yHpv2MhAgJ/IBeZRAAAAAAAAOBBYwRAIBeqDAELQYCAgIB4CyEDAkAgAgRAIANBAWshAyAXRAAAAAAAAPC/oCIXRDFjYhphtNA9oiEYIAAgF0QAAEBU+yH5v6KgIRYMAQsgGUQYLURU+yHpP2RFDQAgA0EBaiEDIBdEAAAAAAAA8D+gIhdEMWNiGmG00D2iIRggACAXRAAAQFT7Ifm/oqAhFgsgASAWIBihIgA5AwACQCAGQRR2IgIgAL1CNIinQf8PcWtBEUgNACABIBYgF0QAAGAaYbTQPaIiAKEiGSAXRHNwAy6KGaM7oiAWIBmhIAChoSIYoSIAOQMAIAIgAL1CNIinQf8PcWtBMkgEQCAZIRYMAQsgASAZIBdEAAAALooZozuiIgChIhYgF0TBSSAlmoN7OaIgGSAWoSAAoaEiGKEiADkDAAsgASAWIAChIBihOQMIDAELIAZBgIDA/wdPBEAgASAAIAChIgA5AwAgASAAOQMIQQAhAwwBCyAaQv////////8Hg0KAgICAgICAsMEAhL8hAEEAIQNBASECA0AgCEEQaiADQQN0agJ/IACZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4C7ciFjkDACAAIBahRAAAAAAAAHBBoiEAQQEhAyACIQRBACECIAQNAAsgCCAAOQMgQQIhAwNAIAMiAkEBayEDIAhBEGogAkEDdGorAwBEAAAAAAAAAABhDQALIAhBEGohD0EAIQQjAEGwBGsiBSQAIAZBFHZBlghrIgNBA2tBGG0iBkEAIAZBAEobIhBBaGwgA2ohBkGECCgCACIJIAJBAWoiCkEBayIHakEATgRAIAkgCmohAyAQIAdrIQIDQCAFQcACaiAEQQN0aiACQQBIBHxEAAAAAAAAAAAFIAJBAnRBkAhqKAIAtws5AwAgAkEBaiECIARBAWoiBCADRw0ACwsgBkEYayELQQAhAyAJQQAgCUEAShshBCAKQQBMIQwDQAJAIAwEQEQAAAAAAAAAACEADAELIAMgB2ohDkEAIQJEAAAAAAAAAAAhAANAIA8gAkEDdGorAwAgBUHAAmogDiACa0EDdGorAwCiIACgIQAgAkEBaiICIApHDQALCyAFIANBA3RqIAA5AwAgAyAERiECIANBAWohAyACRQ0AC0EvIAZrIRJBMCAGayEOIAZBGWshEyAJIQMCQANAIAUgA0EDdGorAwAhAEEAIQIgAyEEIANBAEwiDUUEQANAIAVB4ANqIAJBAnRqAn8CfyAARAAAAAAAAHA+oiIWmUQAAAAAAADgQWMEQCAWqgwBC0GAgICAeAu3IhZEAAAAAAAAcMGiIACgIgCZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4CzYCACAFIARBAWsiBEEDdGorAwAgFqAhACACQQFqIgIgA0cNAAsLAn8gACALEAYiACAARAAAAAAAAMA/opxEAAAAAAAAIMCioCIAmUQAAAAAAADgQWMEQCAAqgwBC0GAgICAeAshByAAIAe3oSEAAkACQAJAAn8gC0EATCIURQRAIANBAnQgBWoiAiACKALcAyICIAIgDnUiAiAOdGsiBDYC3AMgAiAHaiEHIAQgEnUMAQsgCw0BIANBAnQgBWooAtwDQRd1CyIMQQBMDQIMAQtBAiEMIABEAAAAAAAA4D9mDQBBACEMDAELQQAhAkEAIQQgDUUEQANAIAVB4ANqIAJBAnRqIhUoAgAhDUH///8HIRECfwJAIAQNAEGAgIAIIREgDQ0AQQAMAQsgFSARIA1rNgIAQQELIQQgAkEBaiICIANHDQALCwJAIBQNAEH///8DIQICQAJAIBMOAgEAAgtB////ASECCyADQQJ0IAVqIg0gDSgC3AMgAnE2AtwDCyAHQQFqIQcgDEECRw0ARAAAAAAAAPA/IAChIQBBAiEMIARFDQAgAEQAAAAAAADwPyALEAahIQALIABEAAAAAAAAAABhBEBBACEEIAMhAgJAIAMgCUwNAANAIAVB4ANqIAJBAWsiAkECdGooAgAgBHIhBCACIAlKDQALIARFDQAgCyEGA0AgBkEYayEGIAVB4ANqIANBAWsiA0ECdGooAgBFDQALDAMLQQEhAgNAIAIiBEEBaiECIAVB4ANqIAkgBGtBAnRqKAIARQ0ACyADIARqIQQDQCAFQcACaiADIApqIgdBA3RqIANBAWoiAyAQakECdEGQCGooAgC3OQMAQQAhAkQAAAAAAAAAACEAIApBAEoEQANAIA8gAkEDdGorAwAgBUHAAmogByACa0EDdGorAwCiIACgIQAgAkEBaiICIApHDQALCyAFIANBA3RqIAA5AwAgAyAESA0ACyAEIQMMAQsLAkAgAEEYIAZrEAYiAEQAAAAAAABwQWYEQCAFQeADaiADQQJ0agJ/An8gAEQAAAAAAABwPqIiFplEAAAAAAAA4EFjBEAgFqoMAQtBgICAgHgLIgK3RAAAAAAAAHDBoiAAoCIAmUQAAAAAAADgQWMEQCAAqgwBC0GAgICAeAs2AgAgA0EBaiEDDAELAn8gAJlEAAAAAAAA4EFjBEAgAKoMAQtBgICAgHgLIQIgCyEGCyAFQeADaiADQQJ0aiACNgIAC0QAAAAAAADwPyAGEAYhAAJAIANBAEgNACADIQIDQCAFIAIiBEEDdGogACAFQeADaiACQQJ0aigCALeiOQMAIAJBAWshAiAARAAAAAAAAHA+oiEAIAQNAAsgA0EASA0AIAMhBANARAAAAAAAAAAAIQBBACECIAkgAyAEayIGIAYgCUobIgtBAE4EQANAIAJBA3RB4B1qKwMAIAUgAiAEakEDdGorAwCiIACgIQAgAiALRyEKIAJBAWohAiAKDQALCyAFQaABaiAGQQN0aiAAOQMAIARBAEohAiAEQQFrIQQgAg0ACwtEAAAAAAAAAAAhACADQQBOBEAgAyECA0AgAiIEQQFrIQIgACAFQaABaiAEQQN0aisDAKAhACAEDQALCyAIIACaIAAgDBs5AwAgBSsDoAEgAKEhAEEBIQIgA0EASgRAA0AgACAFQaABaiACQQN0aisDAKAhACACIANHIQQgAkEBaiECIAQNAAsLIAggAJogACAMGzkDCCAFQbAEaiQAIAdBB3EhAyAIKwMAIQAgGkIAUwRAIAEgAJo5AwAgASAIKwMImjkDCEEAIANrIQMMAQsgASAAOQMAIAEgCCsDCDkDCAsgCEEwaiQAIAMLGQAgAARAIAAoAgAQASAAKAIEEAEgABABCwuSBAIMfwV9AkAgAkEATA0AIAMoAgQhCyADKAIAIQwgAygCCCIDBEAgA0F8cSEJIANBA3EhCCADQQRJIQcDQEEAIQUgBiEDQQAhBCAHRQRAA0AgA0EDdkEBcSADQQJ2QQFxIANBAnEgA0ECdEEEcSAFQQN0cnJyQQF0ciEFIANBBHYhAyAEQQRqIgQgCUcNAAsLQQAhBCAIBEADQCADQQFxIAVBAXRyIQUgA0EBdiEDIARBAWoiBCAIRw0ACwsgBSAGSgRAIAAgBkECdCIDaiIEKgIAIRAgBCAAIAVBAnQiBWoiBCoCADgCACAEIBA4AgAgASADaiIDKgIAIRAgAyABIAVqIgMqAgA4AgAgAyAQOAIACyAGQQFqIgYgAkcNAAsLQQIhBCACQQJIDQADQCACIARtIQ0gBEEBdiEIQQAhBgNAIAYgCGohDkEAIQUgBiEDA0AgACADIAhqQQJ0IgdqIgogACADQQJ0Ig9qIgkqAgAgCioCACIQIAwgBUECdCIKaioCACIRlCABIAdqIgcqAgAiEiAKIAtqKgIAIhOUkiIUkzgCACAHIAEgD2oiByoCACARIBKUIBAgE5STIhCTOAIAIAkgFCAJKgIAkjgCACAHIBAgByoCAJI4AgAgBSANaiEFIANBAWoiAyAOSA0ACyAEIAZqIgYgAkgNAAsgAiAERg0BIARBAXQiBCACTA0ACwsLkgQCDH8FfAJAIAJBAEwNACADKAIEIQsgAygCACEMIAMoAggiAwRAIANBfHEhCSADQQNxIQggA0EESSEHA0BBACEFIAYhA0EAIQQgB0UEQANAIANBA3ZBAXEgA0ECdkEBcSADQQJxIANBAnRBBHEgBUEDdHJyckEBdHIhBSADQQR2IQMgBEEEaiIEIAlHDQALC0EAIQQgCARAA0AgA0EBcSAFQQF0ciEFIANBAXYhAyAEQQFqIgQgCEcNAAsLIAUgBkoEQCAAIAZBA3QiA2oiBCsDACEQIAQgACAFQQN0IgVqIgQrAwA5AwAgBCAQOQMAIAEgA2oiAysDACEQIAMgASAFaiIDKwMAOQMAIAMgEDkDAAsgBkEBaiIGIAJHDQALC0ECIQQgAkECSA0AA0AgAiAEbSENIARBAXYhCEEAIQYDQCAGIAhqIQ5BACEFIAYhAwNAIAAgAyAIakEDdCIHaiIKIAAgA0EDdCIPaiIJKwMAIAorAwAiECAMIAVBA3QiCmorAwAiEaIgASAHaiIHKwMAIhIgCiALaisDACIToqAiFKE5AwAgByABIA9qIgcrAwAgESASoiAQIBOioSIQoTkDACAJIBQgCSsDAKA5AwAgByAQIAcrAwCgOQMAIAUgDWohBSADQQFqIgMgDkgNAAsgBCAGaiIGIAJIDQALIAIgBEYNASAEQQF0IgQgAkwNAAsLC6ADAgd/A3wgAEECTwRAIAAhAQNAIANBAWohAyABQQNLIQIgAUEBdiEBIAINAAsLAkBBASADdCAARw0AIABBAEgNAEEMEAIiAkUNACACIAM2AgggAiAAQQF2IgFBAnQiBBACIgM2AgAgAwRAIAIgBBACIgQ2AgQgBARAIABBAkkEQCACDwtBASABIAFBAU0bIQYgALghCUEAIQEDQCMAQRBrIgAkAAJ8IAG3RBgtRFT7IRlAoiAJoyIIvUIgiKdB/////wdxIgVB+8Ok/wNNBEBEAAAAAAAA8D8gBUGewZryA0kNARogCEQAAAAAAAAAABAFDAELIAggCKEgBUGAgMD/B08NABoCQAJAAkACQCAIIAAQCUEDcQ4DAAECAwsgACsDACAAKwMIEAUMAwsgACsDACAAKwMIQQEQBJoMAgsgACsDACAAKwMIEAWaDAELIAArAwAgACsDCEEBEAQLIQogAEEQaiQAIAMgAUECdCIHaiAKtjgCACAEIAdqIAgQB7Y4AgAgAUEBaiIBIAZHDQALIAIPCyADEAELIAIQAQtBAAsQACMAIABrQXBxIgAkACAACwYAIAAkAAsEACMAC6kCAgZ/AXwgAEECTwRAIAAhAQNAIAJBAWohAiABQQNLIQQgAUEBdiEBIAQNAAsLAkACQEEBIAJ0IABHDQAgAEH/////A0sNAEEEEAIiAkUNACACIABBAXYiAUEDdBACIgM2AgQgA0UNAQJAIABBAkkNAEEBIAEgAUEBTRsiBEEBcSEFIAC4IQdBACEBIABBBE8EQCAEQf7///8HcSEEQQAhAANAIAMgAUEDdGogAbdEGC1EVPshGUCiIAejEAc5AwAgAyABQQFyIgZBA3RqIAa3RBgtRFT7IRlAoiAHoxAHOQMAIAFBAmohASAAQQJqIgAgBEcNAAsLIAVFDQAgAyABQQN0aiABt0QYLURU+yEZQKIgB6MQBzkDAAsgAiEDCyADDwsgAhABQQALC6sWAwBBgAgL1xUDAAAABAAAAAQAAAAGAAAAg/miAERObgD8KRUA0VcnAN009QBi28AAPJmVAEGQQwBjUf4Au96rALdhxQA6biQA0k1CAEkG4AAJ6i4AHJLRAOsd/gApsRwA6D6nAPU1ggBEuy4AnOmEALQmcABBfl8A1pE5AFODOQCc9DkAi1+EACj5vQD4HzsA3v+XAA+YBQARL+8AClqLAG0fbQDPfjYACcsnAEZPtwCeZj8ALepfALondQDl68cAPXvxAPc5BwCSUooA+2vqAB+xXwAIXY0AMANWAHv8RgDwq2sAILzPADb0mgDjqR0AXmGRAAgb5gCFmWUAoBRfAI1AaACA2P8AJ3NNAAYGMQDKVhUAyahzAHviYABrjMAAGcRHAM1nwwAJ6NwAWYMqAIt2xACmHJYARK/dABlX0QClPgUABQf/ADN+PwDCMugAmE/eALt9MgAmPcMAHmvvAJ/4XgA1HzoAf/LKAPGHHQB8kCEAaiR8ANVu+gAwLXcAFTtDALUUxgDDGZ0ArcTCACxNQQAMAF0Ahn1GAONxLQCbxpoAM2IAALTSfAC0p5cAN1XVANc+9gCjEBgATXb8AGSdKgBw16sAY3z4AHqwVwAXFecAwElWADvW2QCnhDgAJCPLANaKdwBaVCMAAB+5APEKGwAZzt8AnzH/AGYeagCZV2EArPtHAH5/2AAiZbcAMuiJAOa/YADvxM0AbDYJAF0/1AAW3tcAWDveAN6bkgDSIigAKIboAOJYTQDGyjIACOMWAOB9ywAXwFAA8x2nABjgWwAuEzQAgxJiAINIAQD1jlsArbB/AB7p8gBISkMAEGfTAKrd2ACuX0IAamHOAAoopADTmbQABqbyAFx3fwCjwoMAYTyIAIpzeACvjFoAb9e9AC2mYwD0v8sAjYHvACbBZwBVykUAytk2ACio0gDCYY0AEsl3AAQmFAASRpsAxFnEAMjFRABNspEAABfzANRDrQApSeUA/dUQAAC+/AAelMwAcM7uABM+9QDs8YAAs+fDAMf4KACTBZQAwXE+AC4JswALRfMAiBKcAKsgewAutZ8AR5LCAHsyLwAMVW0AcqeQAGvnHwAxy5YAeRZKAEF54gD034kA6JSXAOLmhACZMZcAiO1rAF9fNgC7/Q4ASJq0AGekbABxckIAjV0yAJ8VuAC85QkAjTElAPd0OQAwBRwADQwBAEsIaAAs7lgAR6qQAHTnAgC91iQA932mAG5IcgCfFu8AjpSmALSR9gDRU1EAzwryACCYMwD1S34AsmNoAN0+XwBAXQMAhYl/AFVSKQA3ZMAAbdgQADJIMgBbTHUATnHUAEVUbgALCcEAKvVpABRm1QAnB50AXQRQALQ72wDqdsUAh/kXAElrfQAdJ7oAlmkpAMbMrACtFFQAkOJqAIjZiQAsclAABKS+AHcHlADzMHAAAPwnAOpxqABmwkkAZOA9AJfdgwCjP5cAQ5T9AA2GjAAxQd4AkjmdAN1wjAAXt+cACN87ABU3KwBcgKAAWoCTABARkgAP6NgAbICvANv/SwA4kA8AWRh2AGKlFQBhy7sAx4m5ABBAvQDS8gQASXUnAOu29gDbIrsAChSqAIkmLwBkg3YACTszAA6UGgBROqoAHaPCAK/trgBcJhIAbcJNAC16nADAVpcAAz+DAAnw9gArQIwAbTGZADm0BwAMIBUA2MNbAPWSxADGrUsATsqlAKc3zQDmqTYAq5KUAN1CaAAZY94AdozvAGiLUgD82zcArqGrAN8VMQAArqEADPvaAGRNZgDtBbcAKWUwAFdWvwBH/zoAavm5AHW+8wAok98Aq4AwAGaM9gAEyxUA+iIGANnkHQA9s6QAVxuPADbNCQBOQukAE76kADMjtQDwqhoAT2WoANLBpQALPw8AW3jNACP5dgB7iwQAiRdyAMamUwBvbuIA7+sAAJtKWADE2rcAqma6AHbPzwDRAh0AsfEtAIyZwQDDrXcAhkjaAPddoADGgPQArPAvAN3smgA/XLwA0N5tAJDHHwAq27YAoyU6AACvmgCtU5MAtlcEACkttABLgH4A2genAHaqDgB7WaEAFhIqANy3LQD65f0Aidv+AIm+/QDkdmwABqn8AD6AcACFbhUA/Yf/ACg+BwBhZzMAKhiGAE296gCz568Aj21uAJVnOQAxv1sAhNdIADDfFgDHLUMAJWE1AMlwzgAwy7gAv2z9AKQAogAFbOQAWt2gACFvRwBiEtIAuVyEAHBhSQBrVuAAmVIBAFBVNwAe1bcAM/HEABNuXwBdMOQAhS6pAB2ywwChMjYACLekAOqx1AAW9yEAj2nkACf/dwAMA4AAjUAtAE/NoAAgpZkAs6LTAC9dCgC0+UIAEdrLAH2+0ACb28EAqxe9AMqigQAIalwALlUXACcAVQB/FPAA4QeGABQLZACWQY0Ah77eANr9KgBrJbYAe4k0AAXz/gC5v54AaGpPAEoqqABPxFoALfi8ANdamAD0x5UADU2NACA6pgCkV18AFD+xAIA4lQDMIAEAcd2GAMnetgC/YPUATWURAAEHawCMsKwAssDQAFFVSAAe+w4AlXLDAKMGOwDAQDUABtx7AOBFzABOKfoA1srIAOjzQQB8ZN4Am2TYANm+MQCkl8MAd1jUAGnjxQDw2hMAujo8AEYYRgBVdV8A0r31AG6SxgCsLl0ADkTtABw+QgBhxIcAKf3pAOfW8wAifMoAb5E1AAjgxQD/140AbmriALD9xgCTCMEAfF10AGutsgDNbp0APnJ7AMYRagD3z6kAKXPfALXJugC3AFEA4rINAHS6JADlfWAAdNiKAA0VLACBGAwAfmaUAAEpFgCfenYA/f2+AFZF7wDZfjYA7NkTAIu6uQDEl/wAMagnAPFuwwCUxTYA2KhWALSotQDPzA4AEoktAG9XNAAsVokAmc7jANYguQBrXqoAPiqcABFfzAD9C0oA4fT7AI47bQDihiwA6dSEAPy0qQDv7tEALjXJAC85YQA4IUQAG9nIAIH8CgD7SmoALxzYAFO0hABOmYwAVCLMACpV3ADAxtYACxmWABpwuABplWQAJlpgAD9S7gB/EQ8A9LURAPzL9QA0vC0ANLzuAOhdzADdXmAAZ46bAJIz7wDJF7gAYVibAOFXvABRg8YA2D4QAN1xSAAtHN0ArxihACEsRgBZ89cA2XqYAJ5UwABPhvoAVgb8AOV5rgCJIjYAOK0iAGeT3ABV6KoAgiY4AMrnmwBRDaQAmTOxAKnXDgBpBUgAZbLwAH+IpwCITJcA+dE2ACGSswB7gkoAmM8hAECf3ADcR1UA4XQ6AGfrQgD+nd8AXtRfAHtnpAC6rHoAVfaiACuIIwBBulUAWW4IACEqhgA5R4MAiePmAOWe1ABJ+0AA/1bpABwPygDFWYoAlPorANPBxQAPxc8A21quAEfFhgCFQ2IAIYY7ACx5lAAQYYcAKkx7AIAsGgBDvxIAiCaQAHg8iQCoxOQA5dt7AMQ6wgAm9OoA92eKAA2SvwBloysAPZOxAL18CwCkUdwAJ91jAGnh3QCalBkAqCmVAGjOKAAJ7bQARJ8gAE6YygBwgmMAfnwjAA+5MgCn9Y4AFFbnACHxCAC1nSoAb35NAKUZUQC1+asAgt/WAJbdYQAWNgIAxDqfAIOioQBy7W0AOY16AIK4qQBrMlwARidbAAA07QDSAHcA/PRVAAFZTQDgcYAAQeMdCz1A+yH5PwAAAAAtRHQ+AAAAgJhG+DwAAABgUcx4OwAAAICDG/A5AAAAQCAlejgAAACAIoLjNgAAAAAd82k1AEGgHgsDIBEB";
				AA(b) || (b = a(b));
				function QA(i) {
					if (i == b && n) return new Uint8Array(n);
					var Q = mA(i);
					if (Q) return Q;
					if (c) return c(i);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(i, Q) {
					var e, s = QA(i);
					return e = new WebAssembly.Module(s), [new WebAssembly.Instance(e, Q), e];
				}
				function EA() {
					var i = { a: MA };
					function Q(e, s) {
						var k = e.exports;
						return D = k, h = D.b, y(), D.l, q(D.c), O("wasm-instantiate"), k;
					}
					if (IA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(i, Q);
					} catch (e) {
						w("Module.instantiateWasm callback failed with error: " + e), B(e);
					}
					return Q(CA(b, i)[0]);
				}
				var V = (i) => {
					for (; i.length > 0;) i.shift()(A);
				}, f = (i) => {
					j("OOM");
				}, U = (i) => {
					F.length, i >>>= 0, f(i);
				};
				function x(i) {
					return A["_" + i];
				}
				var gA = (i, Q) => {
					N.set(i, Q);
				}, BA = (i) => {
					for (var Q = 0, e = 0; e < i.length; ++e) {
						var s = i.charCodeAt(e);
						s <= 127 ? Q++ : s <= 2047 ? Q += 2 : s >= 55296 && s <= 57343 ? (Q += 4, ++e) : Q += 3;
					}
					return Q;
				}, aA = (i, Q, e, s) => {
					if (!(s > 0)) return 0;
					for (var k = e, d = e + s - 1, G = 0; G < i.length; ++G) {
						var R = i.charCodeAt(G);
						if (R >= 55296 && R <= 57343) {
							var H = i.charCodeAt(++G);
							R = 65536 + ((R & 1023) << 10) | H & 1023;
						}
						if (R <= 127) {
							if (e >= d) break;
							Q[e++] = R;
						} else if (R <= 2047) {
							if (e + 1 >= d) break;
							Q[e++] = 192 | R >> 6, Q[e++] = 128 | R & 63;
						} else if (R <= 65535) {
							if (e + 2 >= d) break;
							Q[e++] = 224 | R >> 12, Q[e++] = 128 | R >> 6 & 63, Q[e++] = 128 | R & 63;
						} else {
							if (e + 3 >= d) break;
							Q[e++] = 240 | R >> 18, Q[e++] = 128 | R >> 12 & 63, Q[e++] = 128 | R >> 6 & 63, Q[e++] = 128 | R & 63;
						}
					}
					return Q[e] = 0, e - k;
				}, tA = (i, Q, e) => aA(i, F, Q, e), oA = (i) => {
					var Q = BA(i) + 1, e = GA(Q);
					return tA(i, e, Q), e;
				}, sA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, FA = (i, Q, e) => {
					for (var s = Q + e, k = Q; i[k] && !(k >= s);) ++k;
					if (k - Q > 16 && i.buffer && sA) return sA.decode(i.subarray(Q, k));
					for (var d = ""; Q < k;) {
						var G = i[Q++];
						if (!(G & 128)) {
							d += String.fromCharCode(G);
							continue;
						}
						var R = i[Q++] & 63;
						if ((G & 224) == 192) {
							d += String.fromCharCode((G & 31) << 6 | R);
							continue;
						}
						var H = i[Q++] & 63;
						if ((G & 240) == 224 ? G = (G & 15) << 12 | R << 6 | H : G = (G & 7) << 18 | R << 12 | H << 6 | i[Q++] & 63, G < 65536) d += String.fromCharCode(G);
						else {
							var X = G - 65536;
							d += String.fromCharCode(55296 | X >> 10, 56320 | X & 1023);
						}
					}
					return d;
				}, RA = (i, Q) => i ? FA(F, i, Q) : "", nA = function(i, Q, e, s, k) {
					var d = {
						string: (J) => {
							var z = 0;
							return J != null && J !== 0 && (z = oA(J)), z;
						},
						array: (J) => {
							var z = GA(J.length);
							return gA(J, z), z;
						}
					};
					function G(J) {
						return Q === "string" ? RA(J) : Q === "boolean" ? !!J : J;
					}
					var R = x(i), H = [], X = 0;
					if (s) for (var Z = 0; Z < s.length; Z++) {
						var DA = d[e[Z]];
						DA ? (X === 0 && (X = rA()), H[Z] = DA(s[Z])) : H[Z] = s[Z];
					}
					var yA = R.apply(null, H);
					function uA(J) {
						return X !== 0 && vA(X), G(J);
					}
					return yA = uA(yA), yA;
				}, NA = function(i, Q, e, s) {
					var k = !e || e.every((d) => d === "number" || d === "boolean");
					return Q !== "string" && k && !s ? x(i) : function() {
						return nA(i, Q, e, arguments, s);
					};
				}, MA = { a: U }, K = EA();
				K.c, A._malloc = K.d, A._free = K.e, A._precalc = K.f, A._precalc_f = K.g, A._dispose = K.h, A._dispose_f = K.i, A._transform_radix2_precalc = K.j, A._transform_radix2_precalc_f = K.k, K.__errno_location;
				var rA = K.m, vA = K.n, GA = K.o;
				function SA(i) {
					try {
						for (var Q = atob(i), e = new Uint8Array(Q.length), s = 0; s < Q.length; ++s) e[s] = Q.charCodeAt(s);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function mA(i) {
					if (AA(i)) return SA(i.slice($.length));
				}
				A.ccall = nA, A.cwrap = NA;
				var eA;
				m = function i() {
					eA || wA(), eA || (m = i);
				};
				function wA() {
					if (S > 0 || (L(), S > 0)) return;
					function i() {
						eA || (eA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), i();
					}, 1)) : i();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return wA(), I;
			});
		})();
	}));
	function Zg(g) {
		this.n = g, this.rptr = kA._malloc(g * 4 + g * 4), this.iptr = this.rptr + g * 4, this.rarr = new Float32Array(kA.HEAPU8.buffer, this.rptr, g), this.iarr = new Float32Array(kA.HEAPU8.buffer, this.iptr, g), this.tables = ZI(g), this.forward = function(I, A) {
			this.rarr.set(I), this.iarr.set(A), _I(this.rptr, this.iptr, this.n, this.tables), I.set(this.rarr), A.set(this.iarr);
		}, this.dispose = function() {
			kA._free(this.rptr), zI(this.tables);
		};
	}
	var kA, ZI, zI, _I, zg = iA((() => {
		Og(), kA = OI({}), kA.cwrap("precalc", "number", ["number"]), kA.cwrap("dispose", "void", ["number"]), kA.cwrap("transform_radix2_precalc", "void", [
			"number",
			"number",
			"number",
			"number"
		]), ZI = kA.cwrap("precalc_f", "number", ["number"]), zI = kA.cwrap("dispose_f", "void", ["number"]), _I = kA.cwrap("transform_radix2_precalc_f", "void", [
			"number",
			"number",
			"number",
			"number"
		]);
	})), $I, _g = iA((() => {
		zg(), $I = class {
			constructor(g) {
				this.size = g, this.fftNayuki = new Zg(g);
			}
			fft(g) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), C = new Float32Array(this.size * 2);
				for (var B = 0; B < this.size; ++B) I[B] = g[B * 2], A[B] = g[B * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var B = 0; B < this.size; ++B) C[B * 2] = I[B], C[B * 2 + 1] = A[B];
				return C;
			}
		};
	})), II, $g = iA((() => {
		II || (II = {}), (function(g) {
			"use strict";
			function I(o, t, a, c, w, n) {
				for (var h = w.twiddle, D = 0; D < n; D++) {
					var l = o[2 * (t + a * D)], N = o[2 * (t + a * D) + 1], F = o[2 * (t + a * (D + n))], y = o[2 * (t + a * (D + n)) + 1], M = h[2 * (0 + c * D)], Y = h[2 * (0 + c * D) + 1], u = F * M - y * Y, L = F * Y + y * M, W = l + u, T = N + L, _ = l - u, q = N - L;
					o[2 * (t + a * D)] = W, o[2 * (t + a * D) + 1] = T, o[2 * (t + a * (D + n))] = _, o[2 * (t + a * (D + n)) + 1] = q;
				}
			}
			function A(o, t, a, c, w, n) {
				for (var h = w.twiddle, D = n, l = 2 * n, N = c, F = 2 * c, y = h[2 * (0 + c * n) + 1], M = 0; M < n; M++) {
					var Y = o[2 * (t + a * M)], u = o[2 * (t + a * M) + 1], L = o[2 * (t + a * (M + D))], W = o[2 * (t + a * (M + D)) + 1], T = h[2 * (0 + N * M)], _ = h[2 * (0 + N * M) + 1], q = L * T - W * _, p = L * _ + W * T, S = o[2 * (t + a * (M + l))], v = o[2 * (t + a * (M + l)) + 1], m = h[2 * (0 + F * M)], IA = h[2 * (0 + F * M) + 1], O = S * m - v * IA, j = S * IA + v * m, $ = q + O, AA = p + j, b = Y + $, QA = u + AA;
					o[2 * (t + a * M)] = b, o[2 * (t + a * M) + 1] = QA;
					var CA = Y - $ * .5, EA = u - AA * .5, V = (q - O) * y, f = (p - j) * y, U = CA - f, x = EA + V;
					o[2 * (t + a * (M + D))] = U, o[2 * (t + a * (M + D)) + 1] = x;
					var gA = CA + f, BA = EA - V;
					o[2 * (t + a * (M + l))] = gA, o[2 * (t + a * (M + l)) + 1] = BA;
				}
			}
			function C(o, t, a, c, w, n) {
				for (var h = w.twiddle, D = n, l = 2 * n, N = 3 * n, F = c, y = 2 * c, M = 3 * c, Y = 0; Y < n; Y++) {
					var u = o[2 * (t + a * Y)], L = o[2 * (t + a * Y) + 1], W = o[2 * (t + a * (Y + D))], T = o[2 * (t + a * (Y + D)) + 1], _ = h[2 * (0 + F * Y)], q = h[2 * (0 + F * Y) + 1], p = W * _ - T * q, S = W * q + T * _, v = o[2 * (t + a * (Y + l))], m = o[2 * (t + a * (Y + l)) + 1], IA = h[2 * (0 + y * Y)], O = h[2 * (0 + y * Y) + 1], j = v * IA - m * O, $ = v * O + m * IA, AA = o[2 * (t + a * (Y + N))], b = o[2 * (t + a * (Y + N)) + 1], QA = h[2 * (0 + M * Y)], CA = h[2 * (0 + M * Y) + 1], EA = AA * QA - b * CA, V = AA * CA + b * QA, f = u + j, U = L + $, x = u - j, gA = L - $, BA = p + EA, aA = S + V, tA = p - EA, oA = S - V, sA = f + BA, FA = U + aA;
					if (w.inverse) var RA = x - oA, nA = gA + tA;
					else var RA = x + oA, nA = gA - tA;
					var NA = f - BA, MA = U - aA;
					if (w.inverse) var K = x + oA, rA = gA - tA;
					else var K = x - oA, rA = gA + tA;
					o[2 * (t + a * Y)] = sA, o[2 * (t + a * Y) + 1] = FA, o[2 * (t + a * (Y + D))] = RA, o[2 * (t + a * (Y + D)) + 1] = nA, o[2 * (t + a * (Y + l))] = NA, o[2 * (t + a * (Y + l)) + 1] = MA, o[2 * (t + a * (Y + N))] = K, o[2 * (t + a * (Y + N)) + 1] = rA;
				}
			}
			function B(o, t, a, c, w, n, h) {
				for (var D = w.twiddle, l = w.n, N = new Float64Array(2 * h), F = 0; F < n; F++) {
					for (var y = 0, M = F; y < h; y++, M += n) {
						var Y = o[2 * (t + a * M)], u = o[2 * (t + a * M) + 1];
						N[2 * y] = Y, N[2 * y + 1] = u;
					}
					for (var y = 0, M = F; y < h; y++, M += n) {
						var L = 0, Y = N[0], u = N[1];
						o[2 * (t + a * M)] = Y, o[2 * (t + a * M) + 1] = u;
						for (var W = 1; W < h; W++) {
							L = (L + c * M) % l;
							var T = o[2 * (t + a * M)], _ = o[2 * (t + a * M) + 1], q = N[2 * W], p = N[2 * W + 1], S = D[2 * L], v = D[2 * L + 1], m = q * S - p * v, IA = q * v + p * S, O = T + m, j = _ + IA;
							o[2 * (t + a * M)] = O, o[2 * (t + a * M) + 1] = j;
						}
					}
				}
			}
			function E(o, t, a, c, w, n, h, D, l) {
				var N = D.shift(), F = D.shift();
				if (F == 1) for (var y = 0; y < N * F; y++) {
					var M = c[2 * (w + n * h * y)], Y = c[2 * (w + n * h * y) + 1];
					o[2 * (t + a * y)] = M, o[2 * (t + a * y) + 1] = Y;
				}
				else for (var y = 0; y < N; y++) E(o, t + a * y * F, a, c, w + y * n * h, n * N, h, D.slice(), l);
				switch (N) {
					case 2:
						I(o, t, a, n, l, F);
						break;
					case 3:
						A(o, t, a, n, l, F);
						break;
					case 4:
						C(o, t, a, n, l, F);
						break;
					default:
						B(o, t, a, n, l, F, N);
						break;
				}
			}
			var r = function(a, c) {
				if (arguments.length < 2) throw new RangeError("You didn't pass enough arguments, passed `" + arguments.length + "'");
				var a = ~~a, c = !!c;
				if (a < 1) throw new RangeError("n is outside range, should be positive integer, was `" + a + "'");
				for (var w = {
					n: a,
					inverse: c,
					factors: [],
					twiddle: new Float64Array(2 * a),
					scratch: new Float64Array(2 * a)
				}, n = w.twiddle, h = 2 * Math.PI / a, D = 0; D < a; D++) {
					if (c) var l = h * D;
					else var l = -h * D;
					n[2 * D] = Math.cos(l), n[2 * D + 1] = Math.sin(l);
				}
				for (var N = 4, F = Math.floor(Math.sqrt(a)); a > 1;) {
					for (; a % N;) {
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
						N > F && (N = a);
					}
					a /= N, w.factors.push(N), w.factors.push(a);
				}
				this.state = w;
			};
			r.prototype.simple = function(o, t, a) {
				this.process(o, 0, 1, t, 0, 1, a);
			}, r.prototype.process = function(o, t, D, c, w, l, h) {
				var D = ~~D, l = ~~l, N = h == "real" ? h : "complex";
				if (D < 1) throw new RangeError("outputStride is outside range, should be positive integer, was `" + D + "'");
				if (l < 1) throw new RangeError("inputStride is outside range, should be positive integer, was `" + l + "'");
				if (N == "real") {
					for (var F = 0; F < this.state.n; F++) {
						var y = c[w + l * F], M = 0;
						this.state.scratch[2 * F] = y, this.state.scratch[2 * F + 1] = M;
					}
					E(o, t, D, this.state.scratch, 0, 1, 1, this.state.factors.slice(), this.state);
				} else if (c == o) {
					E(this.state.scratch, 0, 1, c, w, 1, l, this.state.factors.slice(), this.state);
					for (var F = 0; F < this.state.n; F++) {
						var y = this.state.scratch[2 * F], M = this.state.scratch[2 * F + 1];
						o[2 * (t + D * F)] = y, o[2 * (t + D * F) + 1] = M;
					}
				} else E(o, t, D, c, w, 1, l, this.state.factors.slice(), this.state);
			}, g.complex = r;
		})(II);
	})), Ag, AB = iA((() => {
		$g(), Ag = class {
			constructor(g) {
				this.size = g, this.nockertfft = new II.complex(g, !1);
			}
			fft(g) {
				const I = new Float32Array(2 * this.size);
				return this.nockertfft.simple(I, g, "complex"), I;
			}
		};
	}));
	function IB(g) {
		if (g !== 0 && (g & g - 1) === 0) P = g, QB(), EB(), iB();
		else throw new Error("init: radix-2 required");
	}
	function gI(g, I) {
		hI(g, I, 1);
	}
	function BI(g, I) {
		let A = 1 / P;
		hI(g, I, -1);
		for (let C = 0; C < P; C++) g[C] *= A, I[C] *= A;
	}
	function gB(g, I) {
		hI(g, I, -1);
	}
	function BB(g, I) {
		let A = [], C = [], B = 0;
		for (let E = 0; E < P; E++) {
			B = E * P;
			for (let r = 0; r < P; r++) A[r] = g[r + B], C[r] = I[r + B];
			gI(A, C);
			for (let r = 0; r < P; r++) g[r + B] = A[r], I[r + B] = C[r];
		}
		for (let E = 0; E < P; E++) {
			for (let r = 0; r < P; r++) B = E + r * P, A[r] = g[B], C[r] = I[B];
			gI(A, C);
			for (let r = 0; r < P; r++) B = E + r * P, g[B] = A[r], I[B] = C[r];
		}
	}
	function CB(g, I) {
		let A = [], C = [], B = 0;
		for (let E = 0; E < P; E++) {
			B = E * P;
			for (let r = 0; r < P; r++) A[r] = g[r + B], C[r] = I[r + B];
			BI(A, C);
			for (let r = 0; r < P; r++) g[r + B] = A[r], I[r + B] = C[r];
		}
		for (let E = 0; E < P; E++) {
			for (let r = 0; r < P; r++) B = E + r * P, A[r] = g[B], C[r] = I[B];
			BI(A, C);
			for (let r = 0; r < P; r++) B = E + r * P, g[B] = A[r], I[B] = C[r];
		}
	}
	function hI(g, I, A) {
		let C, B, E, r, o, t, a, c, w, n = P >> 2;
		for (let h = 0; h < P; h++) r = PA[h], h < r && (o = g[h], g[h] = g[r], g[r] = o, o = I[h], I[h] = I[r], I[r] = o);
		for (let h = 1; h < P; h <<= 1) {
			B = 0, C = P / (h << 1);
			for (let D = 0; D < h; D++) {
				t = fA[B + n], a = A * fA[B];
				for (let l = D; l < P; l += h << 1) E = l + h, c = t * g[E] + a * I[E], w = t * I[E] - a * g[E], g[E] = g[l] - c, g[l] += c, I[E] = I[l] - w, I[l] += w;
				B += C;
			}
		}
	}
	function QB() {
		typeof Uint32Array < "u" ? PA = new Uint32Array(P) : PA = [], typeof Float64Array < "u" ? fA = new Float64Array(P * 1.25) : fA = [];
	}
	function EB() {
		let g = 0, I = 0, A = 0;
		for (PA[0] = 0; ++g < P;) {
			for (A = P >> 1; A <= I;) I -= A, A >>= 1;
			I += A, PA[g] = I;
		}
	}
	function iB() {
		let g = P >> 1, I = P >> 2, A = P >> 3, C = g + I, B = Math.sin(Math.PI / P), E = 2 * B * B, r = Math.sqrt(E * (2 - E)), o = fA[I] = 1, t = fA[0] = 0;
		B = 2 * E;
		for (let a = 1; a < A; a++) o -= E, E += B * o, t += r, r -= B * t, fA[a] = t, fA[I - a] = o;
		A !== 0 && (fA[A] = Math.sqrt(.5));
		for (let a = 0; a < I; a++) fA[g - a] = fA[a];
		for (let a = 0; a < C; a++) fA[a + g] = -fA[a];
	}
	var P, PA, fA, Ig, rB = iA((() => {
		P = 0, PA = null, fA = null, Ig = {
			init: IB,
			fft1d: gI,
			ifft1d: BI,
			fft2d: BB,
			ifft2d: CB,
			fft: gI,
			ifft: BI,
			bt: gB
		};
	})), gg, tB = iA((() => {
		rB(), gg = class {
			constructor(g) {
				this.size = g, this.FFT_mljs = Ig, this.FFT_mljs.init(g);
			}
			fft(g) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), C = new Float32Array(2 * this.size);
				for (var B = 0; B < this.size; ++B) I[B] = g[B * 2], A[B] = g[B * 2 + 1];
				this.FFT_mljs.fft(I, A);
				for (var B = 0; B < this.size; ++B) C[B * 2] = I[B], C[B * 2 + 1] = A[B];
				return C;
			}
		};
	}));
	async function eB() {
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
	async function aB() {
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
	async function oB() {
		let g = "Other", I = "Unknown", A = "Other", C = "Unknown", B = navigator.userAgentData, E = navigator.userAgent;
		try {
			if (B) {
				const r = await B.getHighEntropyValues([
					"architecture",
					"model",
					"platform",
					"platformVersion",
					"uaFullVersion"
				]), o = B.brands.find((t) => [
					"Microsoft Edge",
					"Google Chrome",
					"Opera"
				].includes(t.brand));
				g = o ? o.brand : "Other", I = o ? `v${o.version}` : "Unknown", A = r.platform ? r.platform : "Other", C = r.platformVersion ? `v${r.platformVersion}` : "Unknown";
			}
			if (g === "Other" || A === "Other") {
				const r = E.split(" "), o = r[r.length - 1], t = /Firefox/.test(o), a = /Safari/.test(o) && !/CriOS/.test(o) && !/Chrome/.test(o), c = /CriOS/.test(o) || /Chrome/.test(o), w = /Edg/.test(o), n = /OPR/.test(o), h = [
					{
						name: "Mozilla Firefox",
						regex: /Firefox\/(\d+\.\d+)/,
						flag: t
					},
					{
						name: "Safari",
						regex: /Version\/(\d+\.\d+)/,
						flag: a
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
						flag: n
					}
				];
				for (const y of h) if (y.flag) {
					g = y.name;
					const M = o.match(y.regex);
					I = M ? M[1] : "Unknown";
					break;
				}
				const D = E.match(/\(([^)]+)\)/), l = D ? D[1].split("; ") : [];
				console.log(D), console.log(l);
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
						transform: (y) => N[y.split(" ")[2]],
						index: 0
					},
					{
						name: "Mac OS X",
						regex: /Mac OS X/,
						transform: (y) => y.replace("_", ".").split(" ")[3],
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
						transform: (y) => y.split(" ")[1],
						index: 0
					},
					{
						name: "iOS",
						regex: /iPhone/,
						transform: (y) => y.split(" ")[1].replace("_", "."),
						index: 0
					}
				];
				for (const y of F) if (y.regex.test(l[0])) {
					A = y.name, console.log(`osDetails: ${l}`), C = y.transform ? y.transform(l[1]) : y.versionMap[l[1].split(" ")[y.index]];
					break;
				}
			}
		} catch (r) {
			console.error("Could not retrieve user agent data", r);
		}
		return {
			browserName: g,
			browserVersion: I,
			osName: A,
			osVersion: C,
			wasm: typeof WebAssembly == "object",
			relaxedSimd: await eB(),
			simd: await aB()
		};
	}
	var nB = iA((() => {})), Bg, sB = iA((() => {
		Bg = (() => {
			var g = self.location.href;
			return (function(I = {}) {
				var A = I, C, B;
				A.ready = new Promise((i, Q) => {
					C = i, B = Q;
				});
				var E = Object.assign({}, A), r = !0, o = !1, t = "";
				function a(i) {
					return A.locateFile ? A.locateFile(i, t) : t + i;
				}
				var c;
				(r || o) && (o ? t = self.location.href : typeof document < "u" && document.currentScript && (t = document.currentScript.src), g && (t = g), t.indexOf("blob:") !== 0 ? t = t.substr(0, t.replace(/[?#].*/, "").lastIndexOf("/") + 1) : t = "", o && (c = (i) => {
					var Q = new XMLHttpRequest();
					return Q.open("GET", i, !1), Q.responseType = "arraybuffer", Q.send(null), new Uint8Array(Q.response);
				})), A.print || console.log.bind(console);
				var w = A.printErr || console.error.bind(console);
				Object.assign(A, E), E = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var n;
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && j("no native wasm support detected");
				var h, D, l = !1, N, F;
				function y() {
					var i = h.buffer;
					A.HEAP8 = N = new Int8Array(i), A.HEAP16 = new Int16Array(i), A.HEAP32 = new Int32Array(i), A.HEAPU8 = F = new Uint8Array(i), A.HEAPU16 = new Uint16Array(i), A.HEAPU32 = new Uint32Array(i), A.HEAPF32 = new Float32Array(i), A.HEAPF64 = new Float64Array(i);
				}
				var M = [], Y = [], u = [];
				function L() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) _(A.preRun.shift());
					V(M);
				}
				function W() {
					V(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					V(u);
				}
				function _(i) {
					M.unshift(i);
				}
				function q(i) {
					Y.unshift(i);
				}
				function p(i) {
					u.unshift(i);
				}
				var S = 0, v = null, m = null;
				function IA(i) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function O(i) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), m)) {
						var Q = m;
						m = null, Q();
					}
				}
				function j(i) {
					A.onAbort && A.onAbort(i), i = "Aborted(" + i + ")", w(i), l = !0, i += ". Build with -sASSERTIONS for more info.";
					var Q = new WebAssembly.RuntimeError(i);
					throw B(Q), Q;
				}
				var $ = "data:application/octet-stream;base64,";
				function AA(i) {
					return i.startsWith($);
				}
				var b = "data:application/octet-stream;base64,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";
				AA(b) || (b = a(b));
				function QA(i) {
					if (i == b && n) return new Uint8Array(n);
					var Q = mA(i);
					if (Q) return Q;
					if (c) return c(i);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(i, Q) {
					var e, s = QA(i);
					return e = new WebAssembly.Module(s), [new WebAssembly.Instance(e, Q), e];
				}
				function EA() {
					var i = { a: MA };
					function Q(e, s) {
						var k = e.exports;
						return D = k, h = D.b, y(), D.i, q(D.c), O("wasm-instantiate"), k;
					}
					if (IA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(i, Q);
					} catch (e) {
						w("Module.instantiateWasm callback failed with error: " + e), B(e);
					}
					return Q(CA(b, i)[0]);
				}
				var V = (i) => {
					for (; i.length > 0;) i.shift()(A);
				}, f = (i) => {
					j("OOM");
				}, U = (i) => {
					F.length, i >>>= 0, f(i);
				};
				function x(i) {
					return A["_" + i];
				}
				var gA = (i, Q) => {
					N.set(i, Q);
				}, BA = (i) => {
					for (var Q = 0, e = 0; e < i.length; ++e) {
						var s = i.charCodeAt(e);
						s <= 127 ? Q++ : s <= 2047 ? Q += 2 : s >= 55296 && s <= 57343 ? (Q += 4, ++e) : Q += 3;
					}
					return Q;
				}, aA = (i, Q, e, s) => {
					if (!(s > 0)) return 0;
					for (var k = e, d = e + s - 1, G = 0; G < i.length; ++G) {
						var R = i.charCodeAt(G);
						if (R >= 55296 && R <= 57343) {
							var H = i.charCodeAt(++G);
							R = 65536 + ((R & 1023) << 10) | H & 1023;
						}
						if (R <= 127) {
							if (e >= d) break;
							Q[e++] = R;
						} else if (R <= 2047) {
							if (e + 1 >= d) break;
							Q[e++] = 192 | R >> 6, Q[e++] = 128 | R & 63;
						} else if (R <= 65535) {
							if (e + 2 >= d) break;
							Q[e++] = 224 | R >> 12, Q[e++] = 128 | R >> 6 & 63, Q[e++] = 128 | R & 63;
						} else {
							if (e + 3 >= d) break;
							Q[e++] = 240 | R >> 18, Q[e++] = 128 | R >> 12 & 63, Q[e++] = 128 | R >> 6 & 63, Q[e++] = 128 | R & 63;
						}
					}
					return Q[e] = 0, e - k;
				}, tA = (i, Q, e) => aA(i, F, Q, e), oA = (i) => {
					var Q = BA(i) + 1, e = GA(Q);
					return tA(i, e, Q), e;
				}, sA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, FA = (i, Q, e) => {
					for (var s = Q + e, k = Q; i[k] && !(k >= s);) ++k;
					if (k - Q > 16 && i.buffer && sA) return sA.decode(i.subarray(Q, k));
					for (var d = ""; Q < k;) {
						var G = i[Q++];
						if (!(G & 128)) {
							d += String.fromCharCode(G);
							continue;
						}
						var R = i[Q++] & 63;
						if ((G & 224) == 192) {
							d += String.fromCharCode((G & 31) << 6 | R);
							continue;
						}
						var H = i[Q++] & 63;
						if ((G & 240) == 224 ? G = (G & 15) << 12 | R << 6 | H : G = (G & 7) << 18 | R << 12 | H << 6 | i[Q++] & 63, G < 65536) d += String.fromCharCode(G);
						else {
							var X = G - 65536;
							d += String.fromCharCode(55296 | X >> 10, 56320 | X & 1023);
						}
					}
					return d;
				}, RA = (i, Q) => i ? FA(F, i, Q) : "", nA = function(i, Q, e, s, k) {
					var d = {
						string: (J) => {
							var z = 0;
							return J != null && J !== 0 && (z = oA(J)), z;
						},
						array: (J) => {
							var z = GA(J.length);
							return gA(J, z), z;
						}
					};
					function G(J) {
						return Q === "string" ? RA(J) : Q === "boolean" ? !!J : J;
					}
					var R = x(i), H = [], X = 0;
					if (s) for (var Z = 0; Z < s.length; Z++) {
						var DA = d[e[Z]];
						DA ? (X === 0 && (X = rA()), H[Z] = DA(s[Z])) : H[Z] = s[Z];
					}
					var yA = R.apply(null, H);
					function uA(J) {
						return X !== 0 && vA(X), G(J);
					}
					return yA = uA(yA), yA;
				}, NA = function(i, Q, e, s) {
					var k = !e || e.every((d) => d === "number" || d === "boolean");
					return Q !== "string" && k && !s ? x(i) : function() {
						return nA(i, Q, e, arguments, s);
					};
				}, MA = { a: U }, K = EA();
				K.c, A._kiss_fft_free = K.d, A._free = K.e, A._kiss_fft_alloc = K.f, A._malloc = K.g, A._kiss_fft = K.h, K.__errno_location;
				var rA = K.j, vA = K.k, GA = K.l;
				function SA(i) {
					try {
						for (var Q = atob(i), e = new Uint8Array(Q.length), s = 0; s < Q.length; ++s) e[s] = Q.charCodeAt(s);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function mA(i) {
					if (AA(i)) return SA(i.slice($.length));
				}
				A.ccall = nA, A.cwrap = NA;
				var eA;
				m = function i() {
					eA || wA(), eA || (m = i);
				};
				function wA() {
					if (S > 0 || (L(), S > 0)) return;
					function i() {
						eA || (eA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), i();
					}, 1)) : i();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return wA(), I;
			});
		})();
	})), dA, cI, Cg, wI, Qg, DB = iA((() => {
		sB(), dA = Bg({}), cI = dA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), Cg = dA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), wI = dA.cwrap("kiss_fft_free", "void", ["number"]), Qg = class {
			constructor(g) {
				this.size = g, this.fcfg = cI(g, !1), this.icfg = cI(g, !0), this.inptr = dA._malloc(g * 8 + g * 8), this.cin = new Float32Array(dA.HEAPU8.buffer, this.inptr, g * 2);
			}
			fft = function(g) {
				const I = dA._malloc(this.size * 8), A = new Float32Array(dA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(g), Cg(this.fcfg, this.inptr, I);
				let C = new Float32Array(this.size * 2);
				return C.set(A), dA._free(I), C;
			};
			dispose() {
				wI(this.fcfg), wI(this.icfg), dA._free(this.inptr);
			}
		};
	}));
	function CI(g) {
		this.size = g, this._csize = g << 1;
		for (var I = new Array(this.size * 2), A = 0; A < I.length; A += 2) {
			const t = Math.PI * A / this.size;
			I[A] = Math.cos(t), I[A + 1] = -Math.sin(t);
		}
		this.table = I;
		for (var C = 0, B = 1; this.size > B; B <<= 1) C++;
		this._width = C % 2 === 0 ? C - 1 : C, this._bitrev = new Array(1 << this._width);
		for (var E = 0; E < this._bitrev.length; E++) {
			this._bitrev[E] = 0;
			for (var r = 0; r < this._width; r += 2) {
				var o = this._width - r - 2;
				this._bitrev[E] |= (E >>> r & 3) << o;
			}
		}
		this._data = null;
	}
	var hB = iA((() => {
		CI.prototype.fft = function(I) {
			this._data = I, this._out = new Float32Array(2 * this.size);
			var A = this._csize, C = 1 << this._width, B = A / C << 1, E, r, o = this._bitrev;
			if (B === 4) for (E = 0, r = 0; E < A; E += B, r++) {
				const n = o[r];
				this._singleTransform2(E, n, C);
			}
			else for (E = 0, r = 0; E < A; E += B, r++) {
				const n = o[r];
				this._singleTransform4(E, n, C);
			}
			for (C >>= 2; C >= 2; C >>= 2) {
				B = A / C << 1;
				var t = B >>> 2;
				for (E = 0; E < A; E += B) for (var a = E + t, c = E, w = 0; c < a; c += 2, w += C) {
					const n = c, h = n + t, D = h + t, l = D + t, N = this._out[n], F = this._out[n + 1], y = this._out[h], M = this._out[h + 1], Y = this._out[D], u = this._out[D + 1], L = this._out[l], W = this._out[l + 1], T = N, _ = F, q = this.table[w], p = this.table[w + 1], S = y * q - M * p, v = y * p + M * q, m = this.table[2 * w], IA = this.table[2 * w + 1], O = Y * m - u * IA, j = Y * IA + u * m, $ = this.table[3 * w], AA = this.table[3 * w + 1], b = L * $ - W * AA, QA = L * AA + W * $, CA = T + O, EA = _ + j, V = T - O, f = _ - j, U = S + b, x = v + QA, gA = S - b, BA = v - QA;
					this._out[n] = CA + U, this._out[n + 1] = EA + x, this._out[h] = V + BA, this._out[h + 1] = f - gA, this._out[D] = CA - U, this._out[D + 1] = EA - x, this._out[l] = V - BA, this._out[l + 1] = f + gA;
				}
			}
			return this._out;
		}, CI.prototype._singleTransform2 = function(I, A, C) {
			const B = this._data[A], E = this._data[A + 1], r = this._data[A + C], o = this._data[A + C + 1];
			this._out[I] = B + r, this._out[I + 1] = E + o, this._out[I + 2] = B - r, this._out[I + 3] = E - o;
		}, CI.prototype._singleTransform4 = function(I, A, C) {
			const B = C * 2, E = C * 3, r = this._data[A], o = this._data[A + 1], t = this._data[A + C], a = this._data[A + C + 1], c = this._data[A + B], w = this._data[A + B + 1], n = this._data[A + E], h = this._data[A + E + 1], D = r + c, l = o + w, N = r - c, F = o - w, y = t + n, M = a + h, Y = t - n, u = a - h;
			this._out[I] = D + y, this._out[I + 1] = l + M, this._out[I + 2] = N + u, this._out[I + 3] = F - Y, this._out[I + 4] = D - y, this._out[I + 5] = l - M, this._out[I + 6] = N - u, this._out[I + 7] = F + Y;
		};
	})), cB = wg({ default: () => Eg }), lI, Eg, wB = iA((() => {
		Kg(), pg(), xg(), Xg(), _g(), AB(), tB(), nB(), DB(), hB(), lI = [
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
		], Eg = class {
			constructor(g = 128, I = "indutnyJavascript", A = !0) {
				if (!lI.includes(g)) throw new Error("Size must be a power of 2 between 4 and 131072");
				this.size = g, this.outputArr = new Float32Array(2 * g), this.subLibrary = I, this.fftLibrary = void 0;
				const C = this.getCurrentProfile();
				C && A ? this.setSubLibrary(C.fastestSubLibrary) : this.setSubLibrary(I);
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
			setSubLibrary(g) {
				switch (g) {
					case "nayukiJavascript":
						this.fftLibrary = new XI(this.size);
						break;
					case "nayuki3Wasm":
						this.fftLibrary = new $I(this.size);
						break;
					case "kissWasm":
						this.fftLibrary = new WI(this.size);
						break;
					case "crossWasm":
						this.fftLibrary = new jI(this.size), this.size > 16384 && (this.fftLibrary = new DI(this.size));
						break;
					case "nockertJavascript":
						this.fftLibrary = new Ag(this.size);
						break;
					case "indutnyJavascript":
						this.fftLibrary = new DI(this.size);
						break;
					case "mljsJavascript":
						this.fftLibrary = new gg(this.size);
						break;
					case "kissfftmodifiedWasm":
						this.fftLibrary = new Qg(this.size);
						break;
					case "indutnyModifiedJavascript":
						this.fftLibrary = new CI(this.size);
						break;
					default: throw new Error("Invalid sublibrary");
				}
			}
			fft(g) {
				if (g.length !== 2 * this.size) throw new Error("Input array length must be == 2 * size");
				return this.outputArr = this.fftLibrary.fft(g), this.outputArr;
			}
			fftr(g) {
				var { outputArr: I, fftLibrary: A, size: C } = this;
				if (g.length !== C) throw new Error("Input array length must be == size");
				const B = new Float32Array(2 * C);
				B.fill(0);
				for (let E = 0; E < C; E++) B[2 * E] = g[E];
				return I = A.fft(B), I.slice(C, C * 2);
			}
			fft2d(g) {
				const I = g[0].length / 2, A = g.length;
				if (I !== this.size) throw new Error("Inner array length must be == 2 * size");
				if (!lI.includes(A)) throw new Error("Outter array length must be a power of 2 between 4 and 131072");
				let C = [];
				for (let r = 0; r < A; r++) this.outputArr = this.fft(g[r]), C.push(this.outputArr);
				this.dispose(), this.size = A, this.setSubLibrary(this.subLibrary);
				let B = [];
				for (let r = 0; r < I; r++) {
					const o = new Float32Array(2 * A);
					o.fill(0);
					for (let a = 0; a < A; a++) o[2 * a] = C[a][2 * r], o[2 * a + 1] = C[a][2 * r + 1];
					let t = new Float32Array(2 * A);
					t = this.fft(o), B.push(t);
				}
				let E = [];
				for (let r = 0; r < A; r++) {
					let o = new Float32Array(2 * I);
					for (let t = 0; t < I; t++) o[2 * t] = B[t][2 * r], o[2 * t + 1] = B[t][2 * r + 1];
					E.push(o);
				}
				return this.dispose(), this.size = I, this.setSubLibrary(this.subLibrary), E;
			}
			profile(g = 1, I = !0, A = !1) {
				if (!I && this.getCurrentProfile()) return this.getCurrentProfile();
				const C = performance.now();
				let B;
				A ? B = this.availableSubLibrariesQuick() : B = this.availableSubLibraries();
				let E = [];
				const r = g / B.length / 2;
				for (let c = 0; c < B.length; c++) {
					this.setSubLibrary(B[c]);
					const w = new Float32Array(2 * this.size);
					for (let D = 0; D < this.size; D++) w[2 * D] = Math.random() - .5, w[2 * D + 1] = Math.random() - .5;
					let n = performance.now();
					for (; (performance.now() - n) / 1e3 < r;) this.fft(w);
					n = performance.now();
					let h = 0;
					for (; (performance.now() - n) / 1e3 < r;) this.fft(w), h++;
					E.push(1e3 * h / (performance.now() - n)), this.dispose();
				}
				const o = (performance.now() - C) / 1e3;
				let t = E.indexOf(Math.max(...E));
				const a = {
					fftsPerSecond: E,
					subLibraries: B,
					totalElapsed: o,
					fastestSubLibrary: B[t]
				};
				return console.log("Setting sublibrary to", a.fastestSubLibrary), this.setSubLibrary(a.fastestSubLibrary), typeof localStorage < "u" && localStorage.setItem("webfftProfile", JSON.stringify(a)), a;
			}
			async checkBrowserCapabilities() {
				return await oB();
			}
			dispose() {
				this.fftLibrary && this.fftLibrary.dispose !== void 0 && this.fftLibrary.dispose();
			}
		};
	}));
	let fI = null, ig = 0;
	async function lB(g) {
		try {
			const { default: I } = await Promise.resolve().then(() => (wB(), cB));
			fI = new I(g), await fI.profile(), ig = g;
		} catch (I) {
			console.warn("[dspWorker] WebFFT not available, using Radix-2 fallback:", I), fI = null;
		}
	}
	let JA, LA, WA, xA, hA, cA, rg, tg, eg, ag, UA, OA, QI, FI, KA, RI, NI, yI, VA, qA, pA;
	const MI = 21;
	let GI = MI, kI = 0, YI = [], dI = [], SI = [], UI = [], HI, vI, EI, iI;
	function mI(g, I) {
		GI = I, kI = 0, YI = Array.from({ length: I }, () => new Float32Array(g)), dI = Array.from({ length: I }, () => new Float32Array(g)), SI = Array.from({ length: I }, () => new Float32Array(g)), UI = Array.from({ length: I }, () => new Float32Array(g)), HI = new Float32Array(g), vI = new Float32Array(g), EI = new Float32Array(g), iI = new Float32Array(g);
	}
	function fB(g, I, A, C, B) {
		const E = kI;
		for (let r = 0; r < B; r++) {
			const o = g[r] * g[r] + I[r] * I[r], t = A[r] * A[r] + C[r] * C[r], a = g[r] * A[r] + I[r] * C[r], c = g[r] * C[r] - I[r] * A[r];
			HI[r] += o - YI[E][r], vI[r] += t - dI[E][r], EI[r] += a - SI[E][r], iI[r] += c - UI[E][r], YI[E][r] = o, dI[E][r] = t, SI[E][r] = a, UI[E][r] = c;
		}
		kI = (E + 1) % GI;
	}
	function FB(g, I) {
		for (let A = 0; A < I; A++) {
			const C = EI[A] * EI[A] + iI[A] * iI[A], B = HI[A] * vI[A] + 1e-12;
			g[A] = Math.min(1, Math.max(0, Math.sqrt(C) / Math.sqrt(B)));
		}
	}
	let jA = 0, og = 0, HA = null;
	const ng = new dg();
	let XA = null, rI = null, uI = "None", sg = 0, TA = null, tI = null, bI = null, Dg = null, hg = null, cg = 0, eI = null;
	function RB(g, I) {
		const A = g.length, C = (I % A + A) % A;
		if (C === 0) return;
		(!eI || eI.length < C) && (eI = new Float32Array(C));
		const B = eI;
		for (let E = 0; E < C; E++) B[E] = g[E];
		g.copyWithin(0, C), g.set(B.subarray(0, C), A - C);
	}
	self.onmessage = (g) => {
		if (g.data && g.data.type === "run-dsp") try {
			const { measTimeDomain: I, refTimeDomain: A, BINS: C, FFT_SIZE: B, metrics: E, windowType: r, weightingType: o, averagingType: t, averagingDepth: a, averagingAlpha: c, averagingThresholdDb: w, enableSourceWindow: n, sourceWindowWidthMs: h, sourceWindowOffsetMs: D, sampleRate: l, compensationDelaySamples: N, autoDelayCompensation: F, inputGain: y, displayOffset: M, polarity: Y, calibrationGain: u, inputFilter: L, besselSpeed: W, ppoSmoothing: T, fftOverlap: _ } = g.data, q = l || 48e3;
			if (!I || !A) return;
			B && B !== ig && lB(B), (C !== jA || B !== og) && (jA = C, og = B, JA = new Float32Array(B), LA = new Float32Array(B), WA = new Float32Array(B), xA = new Float32Array(B), hA = new Float32Array(C), cA = new Float32Array(C), rg = new Float32Array(B), tg = new Float32Array(B), eg = new Float32Array(B), ag = new Float32Array(B), UA = new Float32Array(C), OA = new Float32Array(C), QI = new Float32Array(C), FI = new Float32Array(C), KA = new Float32Array(B), RI = new Float32Array(B), NI = new Float32Array(C), yI = new Float32Array(C), VA = new Float32Array(C), qA = new Float32Array(C), pA = new Float32Array(C), mI(C, a || MI), HA = new Gg(C, a || 16), TA = null), HA && HA.setDepth(a || 16), a && a !== GI && jA > 0 && mI(jA, a);
			const p = new Set(E);
			let S = new Float32Array(I), v = new Float32Array(A);
			const m = _ || 0;
			if (m > 0 && B > 0) {
				(!tI || cg !== B) && (tI = new Float32Array(B), bI = new Float32Array(B), Dg = new Float32Array(B), hg = new Float32Array(B), cg = B);
				const f = m / 100, U = Math.round(B * f), x = B - U, gA = Dg, BA = hg;
				gA.set(tI.subarray(x), 0), BA.set(bI.subarray(x), 0), gA.set(S.subarray(0, x), U), BA.set(v.subarray(0, x), U), tI.set(S), bI.set(v), S = gA, v = BA;
			}
			const IA = qI(v), O = qI(S);
			if (N && N > 0 && RB(v, N), y && y !== 0) {
				const f = Math.pow(10, y / 20);
				for (let U = 0; U < B; U++) S[U] *= f;
			}
			if (Y) for (let f = 0; f < B; f++) S[f] = -S[f];
			L && L !== "None" ? ((!XA || uI !== L || sg !== q) && (uI = L, sg = q, XA = pI(L, q), rI = pI(L, q)), XA && XA.process(S), rI && rI.process(v)) : XA && (XA = null, rI = null, uI = "None");
			const j = r || "Hann";
			j !== "Rectangular" && (ng.apply(S, j), ng.apply(v, j));
			let $ = 0, AA = 0;
			for (let f = 0; f < B; f++) $ += S[f], AA += v[f];
			$ /= B, AA /= B;
			for (let f = 0; f < B; f++) S[f] -= $, v[f] -= AA;
			if (KI(v, WA, xA), KI(S, JA, LA), p.has("Spectrum")) {
				for (let f = 0; f < C; f++) {
					const U = Math.sqrt(JA[f] * JA[f] + LA[f] * LA[f]);
					VA[f] = 20 * Math.log10(U / B * Math.SQRT2 + 1e-12);
				}
				if (M && M !== 0) for (let f = 0; f < C; f++) VA[f] += M;
			}
			const b = p.has("Magnitude") || p.has("Impulse") || p.has("Step"), QA = p.has("Phase") || p.has("Group Delay"), CA = p.has("Impulse") || p.has("Step");
			if (b && Rg(JA, LA, WA, xA, UA, hA, cA), t !== "None" && b) {
				if (t === "FIFO" && HA) {
					HA.processFIFO(hA, cA, qA, pA, w), hA.set(qA), cA.set(pA);
					for (let f = 0; f < C; f++) {
						const U = Math.sqrt(hA[f] * hA[f] + cA[f] * cA[f]);
						UA[f] = 20 * Math.log10(U + 1e-8);
					}
				} else if (t === "EMA" && HA) {
					HA.processLPF(hA, cA, qA, pA, c || .1), hA.set(qA), cA.set(pA);
					for (let f = 0; f < C; f++) {
						const U = Math.sqrt(hA[f] * hA[f] + cA[f] * cA[f]);
						UA[f] = 20 * Math.log10(U + 1e-8);
					}
				} else if (t === "LPF") try {
					TA || (TA = new mg(C, W || "Medium")), TA.setFrequency(W || "Medium"), TA.process(hA, cA, qA, pA), hA.set(qA), cA.set(pA);
					for (let f = 0; f < C; f++) {
						const U = Math.sqrt(hA[f] * hA[f] + cA[f] * cA[f]);
						UA[f] = 20 * Math.log10(U + 1e-8);
					}
				} catch {}
			}
			if (M && M !== 0 && b) for (let f = 0; f < C; f++) UA[f] += M;
			if (u) {
				const f = new Float32Array(u);
				if (b) for (let U = 0; U < C; U++) UA[U] += f[U];
				if (p.has("Spectrum")) for (let U = 0; U < C; U++) VA[U] += f[U];
			}
			if (QA && Ng(JA, LA, WA, xA, OA), fB(WA, xA, JA, LA, C), FB(QI, C), CA && (kg(JA, LA, WA, xA, KA, rg, tg, eg, ag), n && Yg(KA, h, D, q)), p.has("Step") && yg(KA, RI, q), p.has("Group Delay")) {
				for (let f = 0; f < C; f++) NI[f] = OA[f] * Math.PI / 180;
				Mg(NI, q / 2 / C, FI);
			}
			const EA = O.peakDb - O.rmsDb;
			yI.fill(Math.max(0, Math.min(30, EA)));
			let V = 0;
			if (F && CA) {
				let f = 0;
				for (let U = 0; U < KA.length; U++) {
					const x = Math.abs(KA[U]);
					x > f && (f = x, V = U);
				}
			}
			T && T > 0 && (b && oI(UA, C, q, T), QA && Jg(OA, C, q, T), oI(QI, C, q, T), p.has("Spectrum") && oI(VA, C, q, T)), self.postMessage({
				type: "dsp-results",
				outputMagnitude: UA.buffer.slice(0),
				outputPhase: OA.buffer.slice(0),
				outputCoherence: QI.buffer.slice(0),
				outputGroupDelay: FI.buffer.slice(0),
				outputImpulse: KA.buffer.slice(0),
				outputStep: RI.buffer.slice(0),
				outputCrestFactor: yI.buffer.slice(0),
				outputSpectrum: VA.buffer.slice(0),
				hReal: hA.buffer.slice(0),
				hImag: cA.buffer.slice(0),
				refPeakDb: IA.peakDb,
				refRmsDb: IA.rmsDb,
				measPeakDb: O.peakDb,
				measRmsDb: O.rmsDb,
				detectedDelaySamples: V
			});
		} catch (I) {
			console.error("[dspWorker] Error in run-dsp:", I);
		}
		g.data && g.data.type === "reset-averaging" && (jA > 0 && mI(jA, MI), HA && HA.reset(), TA && TA.reset());
	};
})();
