(function() {
	var HI = Object.defineProperty, eA = (g, I) => () => (g && (I = g(g = 0)), I), og = (g, I) => {
		let A = {};
		for (var C in g) HI(A, C, {
			get: g[C],
			enumerable: !0
		});
		return I || HI(A, Symbol.toStringTag, { value: "Module" }), A;
	};
	typeof window < "u" && import("webfft").then((g) => {
		g && g.default && new g.default(8192);
	}).catch(() => {});
	function sg(g, I) {
		let A = 0;
		for (let C = 0; C < I; C++) A = A << 1 | g & 1, g >>= 1;
		return A;
	}
	function vI(g, I, A) {
		const C = g.length, B = Math.log2(C);
		for (let E = 0; E < C; E++) {
			const r = sg(E, B);
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
					const D = g[c + h], l = I[c + h], R = c + h + r, f = w * g[R] - n * I[R], N = w * I[R] + n * g[R];
					g[c + h] = D + f, I[c + h] = l + N, g[R] = D - f, I[R] = l - N;
					const M = w * t - n * a;
					n = w * a + n * t, w = M;
				}
			}
		}
		if (A) for (let E = 0; E < C; E++) g[E] /= C, I[E] /= C;
	}
	function mI(g, I, A) {
		const C = g.length, B = I || new Float32Array(C), E = A || new Float32Array(C);
		return B.set(g), E.fill(0), vI(B, E, !1), {
			real: B,
			imag: E
		};
	}
	function Dg(g, I, A, C) {
		const B = g.length, E = A || new Float32Array(B), r = C || new Float32Array(B);
		return E.set(g), r.set(I), vI(E, r, !0), E;
	}
	function hg(g, I, A, C, B, E, r) {
		const o = B.length;
		for (let t = 0; t < o; t++) {
			const a = A[t] * A[t] + C[t] * C[t] + 1e-12, c = (g[t] * A[t] + I[t] * C[t]) / a, w = (I[t] * A[t] - g[t] * C[t]) / a;
			E && (E[t] = c), r && (r[t] = w);
			const n = Math.sqrt(c * c + w * w);
			B[t] = 20 * Math.log10(n + 1e-8);
		}
	}
	function cg(g, I, A, C, B) {
		const E = B.length;
		for (let r = 0; r < E; r++) {
			const o = A[r] * A[r] + C[r] * C[r] + 1e-12, t = (g[r] * A[r] + I[r] * C[r]) / o, a = (I[r] * A[r] - g[r] * C[r]) / o;
			B[r] = Math.atan2(a, t) * (180 / Math.PI);
		}
	}
	function wg(g, I, A = 48e3) {
		let C = 0;
		const B = g.length;
		for (let E = 0; E < B; E++) C += g[E], I[E] = C;
	}
	function lg(g, I, A) {
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
	function uI(g) {
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
	var fg = class {
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
	function Fg(g, I, A, C, B, E, r, o, t) {
		const a = g.length, c = a * 2, w = 1e-10;
		for (let n = 0; n < a; n++) {
			const h = A[n] * A[n] + C[n] * C[n] + w, D = (g[n] * A[n] + I[n] * C[n]) / h, l = (I[n] * A[n] - g[n] * C[n]) / h;
			E[n] = D, r[n] = l;
		}
		for (let n = 1; n < a; n++) E[c - n] = E[n], r[c - n] = -r[n];
		Dg(E, r, o, t), B.set(o);
	}
	function Rg(g, I, A, C = 48e3) {
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
	var Ng = class {
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
	function yg(g, I, A) {
		const C = 2 * Math.PI * g / A, B = Math.sin(C) / (2 * I);
		return new aI(1, -2 * Math.cos(C), 1, 1 + B, -2 * Math.cos(C), 1 - B);
	}
	function Mg(g, I, A) {
		const C = 2 * Math.PI * g / A, B = Math.sin(C) / (2 * I);
		return new aI(B, 0, -B, 1 + B, -2 * Math.cos(C), 1 - B);
	}
	function Gg(g, I, A) {
		const C = 2 * Math.PI * g / A, B = Math.sin(C) / (2 * I), E = Math.cos(C);
		return new aI((1 - E) / 2, 1 - E, (1 - E) / 2, 1 + B, -2 * E, 1 - B);
	}
	function bI(g, I) {
		switch (g) {
			case "Notch1k": return yg(1e3, 10, I);
			case "BP100": return Mg(100, 1, I);
			case "LP200": return Gg(200, .7071, I);
			default: return null;
		}
	}
	const kg = {
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
	var _A = class {
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
			const I = kg[g];
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
	}, Yg = class {
		filtersReal;
		filtersImag;
		bins;
		currentFreq;
		constructor(g, I = "Medium") {
			this.bins = g, this.currentFreq = I, this.filtersReal = Array.from({ length: g }, () => new _A(I)), this.filtersImag = Array.from({ length: g }, () => new _A(I));
		}
		setFrequency(g) {
			g !== this.currentFreq && (this.currentFreq = g, this.filtersReal = Array.from({ length: this.bins }, () => new _A(g)), this.filtersImag = Array.from({ length: this.bins }, () => new _A(g)));
		}
		process(g, I, A, C) {
			for (let B = 0; B < this.bins; B++) A[B] = this.filtersReal[B].process(g[B]), C[B] = this.filtersImag[B].process(I[B]);
		}
		reset() {
			for (let g = 0; g < this.bins; g++) this.filtersReal[g].reset(), this.filtersImag[g].reset();
		}
	};
	function oI(g, I, A, C) {
		if (C <= 0 || I <= 0) return;
		const B = A / 2 / I, E = Math.pow(2, 1 / (2 * C)), r = new Float32Array(I);
		for (let o = 1; o < I; o++) {
			const t = o * B, a = t / E, c = t * E, w = Math.max(1, Math.floor(a / B)), n = Math.min(I - 1, Math.ceil(c / B));
			let h = 0;
			const D = n - w + 1;
			for (let l = w; l <= n; l++) h += g[l];
			r[o] = h / D;
		}
		r[0] = g[0], g.set(r);
	}
	function dg(g, I, A, C) {
		if (C <= 0 || I <= 0) return;
		const B = A / 2 / I, E = Math.pow(2, 1 / (2 * C)), r = Math.PI / 180, o = 180 / Math.PI, t = new Float32Array(I);
		for (let a = 1; a < I; a++) {
			const c = a * B, w = c / E, n = c * E, h = Math.max(1, Math.floor(w / B)), D = Math.min(I - 1, Math.ceil(n / B));
			let l = 0, R = 0;
			for (let f = h; f <= D; f++) {
				const N = g[f] * r;
				l += Math.sin(N), R += Math.cos(N);
			}
			t[a] = Math.atan2(l, R) * o;
		}
		t[0] = g[0], g.set(t);
	}
	var JI, Sg = eA((() => {
		JI = (() => {
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
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && V("no native wasm support detected");
				var h, D, l = !1, R, f;
				function N() {
					var Q = h.buffer;
					A.HEAP8 = R = new Int8Array(Q), A.HEAP16 = new Int16Array(Q), A.HEAP32 = new Int32Array(Q), A.HEAPU8 = f = new Uint8Array(Q), A.HEAPU16 = new Uint16Array(Q), A.HEAPU32 = new Uint32Array(Q), A.HEAPF32 = new Float32Array(Q), A.HEAPF64 = new Float64Array(Q);
				}
				var M = [], Y = [], b = [];
				function K() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) z(A.preRun.shift());
					x(M);
				}
				function W() {
					x(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					x(b);
				}
				function z(Q) {
					M.unshift(Q);
				}
				function q(Q) {
					Y.unshift(Q);
				}
				function p(Q) {
					b.unshift(Q);
				}
				var S = 0, v = null, u = null;
				function AA(Q) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function X(Q) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), u)) {
						var e = u;
						u = null, e();
					}
				}
				function V(Q) {
					A.onAbort && A.onAbort(Q), Q = "Aborted(" + Q + ")", w(Q), l = !0, Q += ". Build with -sASSERTIONS for more info.";
					var e = new WebAssembly.RuntimeError(Q);
					throw B(e), e;
				}
				var _ = "data:application/octet-stream;base64,";
				function $(Q) {
					return Q.startsWith(_);
				}
				var J = "data:application/octet-stream;base64,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GCAZkzgCBCAHIBcgHpM4AgAgBUEIaiEFIAdBCGohByAEQQhqIQQgAUEIaiEBIABBCGohACAJQQFqIgkgBkcNAAsMAQsgBSgCACELIAlBA3QQByEIAkAgCUECSA0AIAZBAEwNACAFQYgCaiENIAlBfHEhDiAJQQNxIQogCUEBa0EDSSEPQQAhBwNAIAchAUEAIQRBACEDIA9FBEADQCAIIARBA3QiBWogACABQQN0aikCADcCACAIIAVBCHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBEHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBGHJqIAAgASAGaiIBQQN0aikCADcCACAEQQRqIQQgASAGaiEBIANBBGoiAyAORw0ACwtBACEFIAoEQANAIAggBEEDdGogACABQQN0aikCADcCACAEQQFqIQQgASAGaiEBIAVBAWoiBSAKRw0ACwsgCCkCACIvp74hFUEAIQwgByEDA0AgACADQQN0aiIFIC83AgAgAiADbCEQIAUqAgQhFEEBIQEgFSETQQAhBANAIAUgEyAIIAFBA3RqIhEqAgAiFiANIAQgEGoiBCALQQAgBCALThtrIgRBA3RqIhIqAgAiF5QgEioCBCIYIBEqAgQiGZSTkiITOAIAIAUgFCAWIBiUIBcgGZSSkiIUOAIEIAFBAWoiASAJRw0ACyADIAZqIQMgDEEBaiIMIAlHDQALIAdBAWoiByAGRw0ACwsgCBAGCwsDAAELwQEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABAEDAELIAAgAKEgAkGAgMD/B08NABoCQAJAAkACQCAAIAEQC0EDcQ4DAAECAwsgASsDACABKwMIEAQMAwsgASsDACABKwMIQQEQA5oMAgsgASsDACABKwMIEASaDAELIAErAwAgASsDCEEBEAMLIQAgAUEQaiQAIAALuBgDFH8EfAF+IwBBMGsiCCQAAkACQAJAIAC9IhpCIIinIgNB/////wdxIgZB+tS9gARNBEAgA0H//z9xQfvDJEYNASAGQfyyi4AETQRAIBpCAFkEQCABIABEAABAVPsh+b+gIgBEMWNiGmG00L2gIhY5AwAgASAAIBahRDFjYhphtNC9oDkDCEEBIQMMBQsgASAARAAAQFT7Ifk/oCIARDFjYhphtNA9oCIWOQMAIAEgACAWoUQxY2IaYbTQPaA5AwhBfyEDDAQLIBpCAFkEQCABIABEAABAVPshCcCgIgBEMWNiGmG04L2gIhY5AwAgASAAIBahRDFjYhphtOC9oDkDCEECIQMMBAsgASAARAAAQFT7IQlAoCIARDFjYhphtOA9oCIWOQMAIAEgACAWoUQxY2IaYbTgPaA5AwhBfiEDDAMLIAZBu4zxgARNBEAgBkG8+9eABE0EQCAGQfyyy4AERg0CIBpCAFkEQCABIABEAAAwf3zZEsCgIgBEypSTp5EO6b2gIhY5AwAgASAAIBahRMqUk6eRDum9oDkDCEEDIQMMBQsgASAARAAAMH982RJAoCIARMqUk6eRDuk9oCIWOQMAIAEgACAWoUTKlJOnkQ7pPaA5AwhBfSEDDAQLIAZB+8PkgARGDQEgGkIAWQRAIAEgAEQAAEBU+yEZwKAiAEQxY2IaYbTwvaAiFjkDACABIAAgFqFEMWNiGmG08L2gOQMIQQQhAwwECyABIABEAABAVPshGUCgIgBEMWNiGmG08D2gIhY5AwAgASAAIBahRDFjYhphtPA9oDkDCEF8IQMMAwsgBkH6w+SJBEsNAQsgACAARIPIyW0wX+Q/okQAAAAAAAA4Q6BEAAAAAAAAOMOgIhdEAABAVPsh+b+ioCIWIBdEMWNiGmG00D2iIhihIhlEGC1EVPsh6b9jIQICfyAXmUQAAAAAAADgQWMEQCAXqgwBC0GAgICAeAshAwJAIAIEQCADQQFrIQMgF0QAAAAAAADwv6AiF0QxY2IaYbTQPaIhGCAAIBdEAABAVPsh+b+ioCEWDAELIBlEGC1EVPsh6T9kRQ0AIANBAWohAyAXRAAAAAAAAPA/oCIXRDFjYhphtNA9oiEYIAAgF0QAAEBU+yH5v6KgIRYLIAEgFiAYoSIAOQMAAkAgBkEUdiICIAC9QjSIp0H/D3FrQRFIDQAgASAWIBdEAABgGmG00D2iIgChIhkgF0RzcAMuihmjO6IgFiAZoSAAoaEiGKEiADkDACACIAC9QjSIp0H/D3FrQTJIBEAgGSEWDAELIAEgGSAXRAAAAC6KGaM7oiIAoSIWIBdEwUkgJZqDezmiIBkgFqEgAKGhIhihIgA5AwALIAEgFiAAoSAYoTkDCAwBCyAGQYCAwP8HTwRAIAEgACAAoSIAOQMAIAEgADkDCEEAIQMMAQsgGkL/////////B4NCgICAgICAgLDBAIS/IQBBACEDQQEhAgNAIAhBEGogA0EDdGoCfyAAmUQAAAAAAADgQWMEQCAAqgwBC0GAgICAeAu3IhY5AwAgACAWoUQAAAAAAABwQaIhAEEBIQMgAiEEQQAhAiAEDQALIAggADkDIEECIQMDQCADIgJBAWshAyAIQRBqIAJBA3RqKwMARAAAAAAAAAAAYQ0ACyAIQRBqIQ9BACEEIwBBsARrIgUkACAGQRR2QZYIayIDQQNrQRhtIgZBACAGQQBKGyIQQWhsIANqIQZBhAgoAgAiCSACQQFqIgpBAWsiB2pBAE4EQCAJIApqIQMgECAHayECA0AgBUHAAmogBEEDdGogAkEASAR8RAAAAAAAAAAABSACQQJ0QZAIaigCALcLOQMAIAJBAWohAiAEQQFqIgQgA0cNAAsLIAZBGGshC0EAIQMgCUEAIAlBAEobIQQgCkEATCEMA0ACQCAMBEBEAAAAAAAAAAAhAAwBCyADIAdqIQ5BACECRAAAAAAAAAAAIQADQCAPIAJBA3RqKwMAIAVBwAJqIA4gAmtBA3RqKwMAoiAAoCEAIAJBAWoiAiAKRw0ACwsgBSADQQN0aiAAOQMAIAMgBEYhAiADQQFqIQMgAkUNAAtBLyAGayESQTAgBmshDiAGQRlrIRMgCSEDAkADQCAFIANBA3RqKwMAIQBBACECIAMhBCADQQBMIg1FBEADQCAFQeADaiACQQJ0agJ/An8gAEQAAAAAAABwPqIiFplEAAAAAAAA4EFjBEAgFqoMAQtBgICAgHgLtyIWRAAAAAAAAHDBoiAAoCIAmUQAAAAAAADgQWMEQCAAqgwBC0GAgICAeAs2AgAgBSAEQQFrIgRBA3RqKwMAIBagIQAgAkEBaiICIANHDQALCwJ/IAAgCxAFIgAgAEQAAAAAAADAP6KcRAAAAAAAACDAoqAiAJlEAAAAAAAA4EFjBEAgAKoMAQtBgICAgHgLIQcgACAHt6EhAAJAAkACQAJ/IAtBAEwiFEUEQCADQQJ0IAVqIgIgAigC3AMiAiACIA51IgIgDnRrIgQ2AtwDIAIgB2ohByAEIBJ1DAELIAsNASADQQJ0IAVqKALcA0EXdQsiDEEATA0CDAELQQIhDCAARAAAAAAAAOA/Zg0AQQAhDAwBC0EAIQJBACEEIA1FBEADQCAFQeADaiACQQJ0aiIVKAIAIQ1B////ByERAn8CQCAEDQBBgICACCERIA0NAEEADAELIBUgESANazYCAEEBCyEEIAJBAWoiAiADRw0ACwsCQCAUDQBB////AyECAkACQCATDgIBAAILQf///wEhAgsgA0ECdCAFaiINIA0oAtwDIAJxNgLcAwsgB0EBaiEHIAxBAkcNAEQAAAAAAADwPyAAoSEAQQIhDCAERQ0AIABEAAAAAAAA8D8gCxAFoSEACyAARAAAAAAAAAAAYQRAQQAhBCADIQICQCADIAlMDQADQCAFQeADaiACQQFrIgJBAnRqKAIAIARyIQQgAiAJSg0ACyAERQ0AIAshBgNAIAZBGGshBiAFQeADaiADQQFrIgNBAnRqKAIARQ0ACwwDC0EBIQIDQCACIgRBAWohAiAFQeADaiAJIARrQQJ0aigCAEUNAAsgAyAEaiEEA0AgBUHAAmogAyAKaiIHQQN0aiADQQFqIgMgEGpBAnRBkAhqKAIAtzkDAEEAIQJEAAAAAAAAAAAhACAKQQBKBEADQCAPIAJBA3RqKwMAIAVBwAJqIAcgAmtBA3RqKwMAoiAAoCEAIAJBAWoiAiAKRw0ACwsgBSADQQN0aiAAOQMAIAMgBEgNAAsgBCEDDAELCwJAIABBGCAGaxAFIgBEAAAAAAAAcEFmBEAgBUHgA2ogA0ECdGoCfwJ/IABEAAAAAAAAcD6iIhaZRAAAAAAAAOBBYwRAIBaqDAELQYCAgIB4CyICt0QAAAAAAABwwaIgAKAiAJlEAAAAAAAA4EFjBEAgAKoMAQtBgICAgHgLNgIAIANBAWohAwwBCwJ/IACZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4CyECIAshBgsgBUHgA2ogA0ECdGogAjYCAAtEAAAAAAAA8D8gBhAFIQACQCADQQBIDQAgAyECA0AgBSACIgRBA3RqIAAgBUHgA2ogAkECdGooAgC3ojkDACACQQFrIQIgAEQAAAAAAABwPqIhACAEDQALIANBAEgNACADIQQDQEQAAAAAAAAAACEAQQAhAiAJIAMgBGsiBiAGIAlKGyILQQBOBEADQCACQQN0QeAdaisDACAFIAIgBGpBA3RqKwMAoiAAoCEAIAIgC0chCiACQQFqIQIgCg0ACwsgBUGgAWogBkEDdGogADkDACAEQQBKIQIgBEEBayEEIAINAAsLRAAAAAAAAAAAIQAgA0EATgRAIAMhAgNAIAIiBEEBayECIAAgBUGgAWogBEEDdGorAwCgIQAgBA0ACwsgCCAAmiAAIAwbOQMAIAUrA6ABIAChIQBBASECIANBAEoEQANAIAAgBUGgAWogAkEDdGorAwCgIQAgAiADRyEEIAJBAWohAiAEDQALCyAIIACaIAAgDBs5AwggBUGwBGokACAHQQdxIQMgCCsDACEAIBpCAFMEQCABIACaOQMAIAEgCCsDCJo5AwhBACADayEDDAELIAEgADkDACABIAgrAwg5AwgLIAhBMGokACADC8UBAQJ/IwBBEGsiASQAAkAgAL1CIIinQf////8HcSICQfvDpP8DTQRAIAJBgIDA8gNJDQEgAEQAAAAAAAAAAEEAEAMhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCwJAAkACQAJAIAAgARALQQNxDgMAAQIDCyABKwMAIAErAwhBARADIQAMAwsgASsDACABKwMIEAQhAAwCCyABKwMAIAErAwhBARADmiEADAELIAErAwAgASsDCBAEmiEACyABQRBqJAAgAAuhBAEDfyABIAJGBEAgACgCAEEDdBAHIgQgAUEBQQEgAEEIaiAAEAggBCECAkAgACgCAEEDdCIDQYAETwRAIAEgAiADEAEMAQsgASADaiEAAkAgASACc0EDcUUEQAJAIAFBA3FFDQAgA0UNAANAIAEgAi0AADoAACACQQFqIQIgAUEBaiIBQQNxRQ0BIAAgAUsNAAsLAkAgAEF8cSIDQcAASQ0AIAEgA0FAaiIFSw0AA0AgASACKAIANgIAIAEgAigCBDYCBCABIAIoAgg2AgggASACKAIMNgIMIAEgAigCEDYCECABIAIoAhQ2AhQgASACKAIYNgIYIAEgAigCHDYCHCABIAIoAiA2AiAgASACKAIkNgIkIAEgAigCKDYCKCABIAIoAiw2AiwgASACKAIwNgIwIAEgAigCNDYCNCABIAIoAjg2AjggASACKAI8NgI8IAJBQGshAiABQUBrIgEgBU0NAAsLIAEgA08NAQNAIAEgAigCADYCACACQQRqIQIgAUEEaiIBIANJDQALDAELIABBBEkNACAB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";
				$(J) || (J = a(J));
				function iA(Q) {
					if (Q == J && n) return new Uint8Array(n);
					var e = hA(Q);
					if (e) return e;
					if (c) return c(Q);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(Q, e) {
					var s, k = iA(Q);
					return s = new WebAssembly.Module(k), [new WebAssembly.Instance(s, e), s];
				}
				function rA() {
					var Q = { a: m };
					function e(s, k) {
						var d = s.exports;
						return D = d, h = D.c, N(), D.j, q(D.d), X("wasm-instantiate"), d;
					}
					if (AA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(Q, e);
					} catch (s) {
						w("Module.instantiateWasm callback failed with error: " + s), B(s);
					}
					return e(CA(J, Q)[0]);
				}
				var x = (Q) => {
					for (; Q.length > 0;) Q.shift()(A);
				}, BA = (Q, e, s) => f.copyWithin(Q, e, e + s), QA = (Q) => {
					V("OOM");
				}, IA = (Q) => {
					f.length, Q >>>= 0, QA(Q);
				};
				function gA(Q) {
					return A["_" + Q];
				}
				var EA = (Q, e) => {
					R.set(Q, e);
				}, nA = (Q) => {
					for (var e = 0, s = 0; s < Q.length; ++s) {
						var k = Q.charCodeAt(s);
						k <= 127 ? e++ : k <= 2047 ? e += 2 : k >= 55296 && k <= 57343 ? (e += 4, ++s) : e += 3;
					}
					return e;
				}, aA = (Q, e, s, k) => {
					if (!(k > 0)) return 0;
					for (var d = s, G = s + k - 1, F = 0; F < Q.length; ++F) {
						var U = Q.charCodeAt(F);
						if (U >= 55296 && U <= 57343) {
							var j = Q.charCodeAt(++F);
							U = 65536 + ((U & 1023) << 10) | j & 1023;
						}
						if (U <= 127) {
							if (s >= G) break;
							e[s++] = U;
						} else if (U <= 2047) {
							if (s + 1 >= G) break;
							e[s++] = 192 | U >> 6, e[s++] = 128 | U & 63;
						} else if (U <= 65535) {
							if (s + 2 >= G) break;
							e[s++] = 224 | U >> 12, e[s++] = 128 | U >> 6 & 63, e[s++] = 128 | U & 63;
						} else {
							if (s + 3 >= G) break;
							e[s++] = 240 | U >> 18, e[s++] = 128 | U >> 12 & 63, e[s++] = 128 | U >> 6 & 63, e[s++] = 128 | U & 63;
						}
					}
					return e[s] = 0, s - d;
				}, sA = (Q, e, s) => aA(Q, f, e, s), DA = (Q) => {
					var e = nA(Q) + 1, s = HA(e);
					return sA(Q, s, e), s;
				}, cA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, y = (Q, e, s) => {
					for (var k = e + s, d = e; Q[d] && !(d >= k);) ++d;
					if (d - e > 16 && Q.buffer && cA) return cA.decode(Q.subarray(e, d));
					for (var G = ""; e < d;) {
						var F = Q[e++];
						if (!(F & 128)) {
							G += String.fromCharCode(F);
							continue;
						}
						var U = Q[e++] & 63;
						if ((F & 224) == 192) {
							G += String.fromCharCode((F & 31) << 6 | U);
							continue;
						}
						var j = Q[e++] & 63;
						if ((F & 240) == 224 ? F = (F & 15) << 12 | U << 6 | j : F = (F & 7) << 18 | U << 12 | j << 6 | Q[e++] & 63, F < 65536) G += String.fromCharCode(F);
						else {
							var O = F - 65536;
							G += String.fromCharCode(55296 | O >> 10, 56320 | O & 1023);
						}
					}
					return G;
				}, H = (Q, e) => Q ? y(f, Q, e) : "", tA = function(Q, e, s, k, d) {
					var G = {
						string: (Z) => {
							var zA = 0;
							return Z != null && Z !== 0 && (zA = DA(Z)), zA;
						},
						array: (Z) => {
							var zA = HA(Z.length);
							return EA(Z, zA), zA;
						}
					};
					function F(Z) {
						return e === "string" ? H(Z) : e === "boolean" ? !!Z : Z;
					}
					var U = gA(Q), j = [], O = 0;
					if (k) for (var FA = 0; FA < k.length; FA++) {
						var MA = G[s[FA]];
						MA ? (O === 0 && (O = mA()), j[FA] = MA(k[FA])) : j[FA] = k[FA];
					}
					var bA = U.apply(null, j);
					function L(Z) {
						return O !== 0 && kA(O), F(Z);
					}
					return bA = L(bA), bA;
				}, wA = function(Q, e, s, k) {
					var d = !s || s.every((G) => G === "number" || G === "boolean");
					return e !== "string" && d && !k ? gA(Q) : function() {
						return tA(Q, e, s, arguments, k);
					};
				}, m = {
					b: BA,
					a: IA
				}, oA = rA();
				oA.d, A._kiss_fft_free = oA.e, A._free = oA.f, A._kiss_fft_alloc = oA.g, A._malloc = oA.h, A._kiss_fft = oA.i, oA.__errno_location;
				var mA = oA.k, kA = oA.l, HA = oA.m;
				function uA(Q) {
					try {
						for (var e = atob(Q), s = new Uint8Array(e.length), k = 0; k < e.length; ++k) s[k] = e.charCodeAt(k);
						return s;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function hA(Q) {
					if ($(Q)) return uA(Q.slice(_.length));
				}
				A.ccall = tA, A.cwrap = wA;
				var RA;
				u = function Q() {
					RA || i(), RA || (u = Q);
				};
				function i() {
					if (S > 0 || (K(), S > 0)) return;
					function Q() {
						RA || (RA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
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
	})), dA, nI, LI, sI, KI, Ug = eA((() => {
		Sg(), dA = JI({}), nI = dA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), LI = dA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), sI = dA.cwrap("kiss_fft_free", "void", ["number"]), KI = class {
			constructor(g) {
				this.size = g, this.fcfg = nI(this.size, !1), this.icfg = nI(this.size, !0), this.inptr = dA._malloc(this.size * 8), this.cin = new Float32Array(dA.HEAPU8.buffer, this.inptr, this.size * 2);
			}
			fft = function(g) {
				const I = dA._malloc(this.size * 8), A = new Float32Array(dA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(g), LI(this.fcfg, this.inptr, I);
				let C = new Float32Array(this.size * 2);
				return C.set(A), dA._free(I), C;
			};
			dispose() {
				sI(this.fcfg), sI(this.icfg), dA._free(this.inptr);
			}
		};
	}));
	function NA(g) {
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
	var Hg = eA((() => {
		NA.prototype.fromComplexArray = function(I, A) {
			for (var C = A || new Array(I.length >>> 1), B = 0; B < I.length; B += 2) C[B >>> 1] = I[B];
			return C;
		}, NA.prototype.createComplexArray = function() {
			const I = new Array(this._csize);
			for (var A = 0; A < I.length; A++) I[A] = 0;
			return I;
		}, NA.prototype.toComplexArray = function(I, A) {
			for (var C = A || this.createComplexArray(), B = 0; B < C.length; B += 2) C[B] = I[B >>> 1], C[B + 1] = 0;
			return C;
		}, NA.prototype.completeSpectrum = function(I) {
			for (var A = this._csize, C = A >>> 1, B = 2; B < C; B += 2) I[A - B] = I[B], I[A - B + 1] = -I[B + 1];
		}, NA.prototype.transform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._transform4(), this._out = null, this._data = null;
		}, NA.prototype.realTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._realTransform4(), this._out = null, this._data = null;
		}, NA.prototype.inverseTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 1, this._transform4();
			for (var C = 0; C < I.length; C++) I[C] /= this.size;
			this._out = null, this._data = null;
		}, NA.prototype._transform4 = function() {
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
					const D = n, l = D + c, R = l + c, f = R + c, N = I[D], M = I[D + 1], Y = I[l], b = I[l + 1], K = I[R], W = I[R + 1], T = I[f], z = I[f + 1], q = N, p = M, S = a[h], v = t * a[h + 1], u = Y * S - b * v, AA = Y * v + b * S, X = a[2 * h], V = t * a[2 * h + 1], _ = K * X - W * V, $ = K * V + W * X, J = a[3 * h], iA = t * a[3 * h + 1], CA = T * J - z * iA, rA = T * iA + z * J, x = q + _, BA = p + $, QA = q - _, IA = p - $, gA = u + CA, EA = AA + rA, nA = t * (u - CA), aA = t * (AA - rA), sA = x + gA, DA = BA + EA, cA = x - gA, y = BA - EA, H = QA + aA, tA = IA - nA, wA = QA - aA, m = IA + nA;
					I[D] = sA, I[D + 1] = DA, I[l] = H, I[l + 1] = tA, I[R] = cA, I[R + 1] = y, I[f] = wA, I[f + 1] = m;
				}
			}
		}, NA.prototype._singleTransform2 = function(I, A, C) {
			const B = this._out, E = this._data, r = E[A], o = E[A + 1], t = E[A + C], a = E[A + C + 1], c = r + t, w = o + a, n = r - t, h = o - a;
			B[I] = c, B[I + 1] = w, B[I + 2] = n, B[I + 3] = h;
		}, NA.prototype._singleTransform4 = function(I, A, C) {
			const B = this._out, E = this._data, r = this._inv ? -1 : 1, o = C * 2, t = C * 3, a = E[A], c = E[A + 1], w = E[A + C], n = E[A + C + 1], h = E[A + o], D = E[A + o + 1], l = E[A + t], R = E[A + t + 1], f = a + h, N = c + D, M = a - h, Y = c - D, b = w + l, K = n + R, W = r * (w - l), T = r * (n - R), z = f + b, q = N + K, p = M + T, S = Y - W, v = f - b, u = N - K, AA = M - T, X = Y + W;
			B[I] = z, B[I + 1] = q, B[I + 2] = p, B[I + 3] = S, B[I + 4] = v, B[I + 5] = u, B[I + 6] = AA, B[I + 7] = X;
		}, NA.prototype._realTransform4 = function() {
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
					var l = E + h, R = l + w, f = R + w, N = f + w, M = I[l], Y = I[l + 1], b = I[R], K = I[R + 1], W = I[f], T = I[f + 1], z = I[N], q = I[N + 1], p = M, S = Y, v = a[D], u = t * a[D + 1], AA = b * v - K * u, X = b * u + K * v, V = a[2 * D], _ = t * a[2 * D + 1], $ = W * V - T * _, J = W * _ + T * V, iA = a[3 * D], CA = t * a[3 * D + 1], rA = z * iA - q * CA, x = z * CA + q * iA, BA = p + $, QA = S + J, IA = p - $, gA = S - J, EA = AA + rA, nA = X + x, aA = t * (AA - rA), sA = t * (X - x), DA = BA + EA, cA = QA + nA, y = IA + sA, H = gA - aA;
					if (I[l] = DA, I[l + 1] = cA, I[R] = y, I[R + 1] = H, h === 0) {
						var tA = BA - EA, wA = QA - nA;
						I[f] = tA, I[f + 1] = wA;
						continue;
					}
					if (h !== n) {
						var m = IA, oA = -gA, mA = BA, kA = -QA, HA = -t * sA, uA = -t * aA, hA = -t * nA, RA = -t * EA, i = m + HA, Q = oA + uA, e = mA + RA, s = kA - hA, k = E + w - h, d = E + c - h;
						I[k] = i, I[k + 1] = Q, I[d] = e, I[d + 1] = s;
					}
				}
			}
		}, NA.prototype._singleRealTransform2 = function(I, A, C) {
			const B = this._out, E = this._data, r = E[A], o = E[A + C], t = r + o, a = r - o;
			B[I] = t, B[I + 1] = 0, B[I + 2] = a, B[I + 3] = 0;
		}, NA.prototype._singleRealTransform4 = function(I, A, C) {
			const B = this._out, E = this._data, r = this._inv ? -1 : 1, o = C * 2, t = C * 3, a = E[A], c = E[A + C], w = E[A + o], n = E[A + t], h = a + w, D = a - w, l = c + n, R = r * (c - n), f = h + l, N = D, M = -R, Y = h - l, b = D, K = R;
			B[I] = f, B[I + 1] = 0, B[I + 2] = N, B[I + 3] = M, B[I + 4] = Y, B[I + 5] = 0, B[I + 6] = b, B[I + 7] = K;
		};
	})), DI, vg = eA((() => {
		Hg(), DI = class {
			constructor(g) {
				this.size = g, this.indutnyFft = new NA(g);
			}
			fft(g) {
				const I = new Float32Array(2 * this.size);
				return this.indutnyFft.transform(I, g), I;
			}
		};
	})), qI, mg = eA((() => {
		qI = (() => {
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
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && V("no native wasm support detected");
				var h, D, l = !1, R, f;
				function N() {
					var i = h.buffer;
					A.HEAP8 = R = new Int8Array(i), A.HEAP16 = new Int16Array(i), A.HEAP32 = new Int32Array(i), A.HEAPU8 = f = new Uint8Array(i), A.HEAPU16 = new Uint16Array(i), A.HEAPU32 = new Uint32Array(i), A.HEAPF32 = new Float32Array(i), A.HEAPF64 = new Float64Array(i);
				}
				var M = [], Y = [], b = [];
				function K() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) z(A.preRun.shift());
					x(M);
				}
				function W() {
					x(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					x(b);
				}
				function z(i) {
					M.unshift(i);
				}
				function q(i) {
					Y.unshift(i);
				}
				function p(i) {
					b.unshift(i);
				}
				var S = 0, v = null, u = null;
				function AA(i) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function X(i) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), u)) {
						var Q = u;
						u = null, Q();
					}
				}
				function V(i) {
					A.onAbort && A.onAbort(i), i = "Aborted(" + i + ")", w(i), l = !0, i += ". Build with -sASSERTIONS for more info.";
					var Q = new WebAssembly.RuntimeError(i);
					throw B(Q), Q;
				}
				var _ = "data:application/octet-stream;base64,";
				function $(i) {
					return i.startsWith(_);
				}
				var J = "data:application/octet-stream;base64,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ACACSwRAQbgeIAI2AgALIAIgBmohAUHoISEAAkACQAJAA0AgASAAKAIARwRAIAAoAggiAA0BDAILCyAALQAMQQhxRQ0BC0HoISEAA0AgAyAAKAIAIgFPBEAgASAAKAIEaiIEIANLDQMLIAAoAgghAAwACwALIAAgAjYCACAAIAAoAgQgBmo2AgQgAkF4IAJrQQdxaiIHIAVBA3I2AgQgAUF4IAFrQQdxaiIGIAUgB2oiBWshACADIAZGBEBBwB4gBTYCAEG0HkG0HigCACAAaiIANgIAIAUgAEEBcjYCBAwIC0G8HigCACAGRgRAQbweIAU2AgBBsB5BsB4oAgAgAGoiADYCACAFIABBAXI2AgQgACAFaiAANgIADAgLIAYoAgQiA0EDcUEBRw0GIANBeHEhCSADQf8BTQRAIAYoAgwiASAGKAIIIgJGBEBBqB5BqB4oAgBBfiADQQN2d3E2AgAMBwsgAiABNgIMIAEgAjYCCAwGCyAGKAIYIQggBiAGKAIMIgJHBEAgBigCCCIBIAI2AgwgAiABNgIIDAULIAZBFGoiASgCACIDRQRAIAYoAhAiA0UNBCAGQRBqIQELA0AgASEEIAMiAkEUaiIBKAIAIgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHY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";
				$(J) || (J = a(J));
				function iA(i) {
					if (i == J && n) return new Uint8Array(n);
					var Q = uA(i);
					if (Q) return Q;
					if (c) return c(i);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(i, Q) {
					var e, s = iA(i);
					return e = new WebAssembly.Module(s), [new WebAssembly.Instance(e, Q), e];
				}
				function rA() {
					var i = { a: wA };
					function Q(e, s) {
						var k = e.exports;
						return D = k, h = D.b, N(), D.e, q(D.c), X("wasm-instantiate"), k;
					}
					if (AA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(i, Q);
					} catch (e) {
						w("Module.instantiateWasm callback failed with error: " + e), B(e);
					}
					return Q(CA(J, i)[0]);
				}
				var x = (i) => {
					for (; i.length > 0;) i.shift()(A);
				}, BA = (i) => {
					V("OOM");
				}, QA = (i) => {
					f.length, i >>>= 0, BA(i);
				};
				function IA(i) {
					return A["_" + i];
				}
				var gA = (i, Q) => {
					R.set(i, Q);
				}, EA = (i) => {
					for (var Q = 0, e = 0; e < i.length; ++e) {
						var s = i.charCodeAt(e);
						s <= 127 ? Q++ : s <= 2047 ? Q += 2 : s >= 55296 && s <= 57343 ? (Q += 4, ++e) : Q += 3;
					}
					return Q;
				}, nA = (i, Q, e, s) => {
					if (!(s > 0)) return 0;
					for (var k = e, d = e + s - 1, G = 0; G < i.length; ++G) {
						var F = i.charCodeAt(G);
						if (F >= 55296 && F <= 57343) {
							var U = i.charCodeAt(++G);
							F = 65536 + ((F & 1023) << 10) | U & 1023;
						}
						if (F <= 127) {
							if (e >= d) break;
							Q[e++] = F;
						} else if (F <= 2047) {
							if (e + 1 >= d) break;
							Q[e++] = 192 | F >> 6, Q[e++] = 128 | F & 63;
						} else if (F <= 65535) {
							if (e + 2 >= d) break;
							Q[e++] = 224 | F >> 12, Q[e++] = 128 | F >> 6 & 63, Q[e++] = 128 | F & 63;
						} else {
							if (e + 3 >= d) break;
							Q[e++] = 240 | F >> 18, Q[e++] = 128 | F >> 12 & 63, Q[e++] = 128 | F >> 6 & 63, Q[e++] = 128 | F & 63;
						}
					}
					return Q[e] = 0, e - k;
				}, aA = (i, Q, e) => nA(i, f, Q, e), sA = (i) => {
					var Q = EA(i) + 1, e = kA(Q);
					return aA(i, e, Q), e;
				}, DA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, cA = (i, Q, e) => {
					for (var s = Q + e, k = Q; i[k] && !(k >= s);) ++k;
					if (k - Q > 16 && i.buffer && DA) return DA.decode(i.subarray(Q, k));
					for (var d = ""; Q < k;) {
						var G = i[Q++];
						if (!(G & 128)) {
							d += String.fromCharCode(G);
							continue;
						}
						var F = i[Q++] & 63;
						if ((G & 224) == 192) {
							d += String.fromCharCode((G & 31) << 6 | F);
							continue;
						}
						var U = i[Q++] & 63;
						if ((G & 240) == 224 ? G = (G & 15) << 12 | F << 6 | U : G = (G & 7) << 18 | F << 12 | U << 6 | i[Q++] & 63, G < 65536) d += String.fromCharCode(G);
						else {
							var j = G - 65536;
							d += String.fromCharCode(55296 | j >> 10, 56320 | j & 1023);
						}
					}
					return d;
				}, y = (i, Q) => i ? cA(f, i, Q) : "", H = function(i, Q, e, s, k) {
					var d = {
						string: (L) => {
							var Z = 0;
							return L != null && L !== 0 && (Z = sA(L)), Z;
						},
						array: (L) => {
							var Z = kA(L.length);
							return gA(L, Z), Z;
						}
					};
					function G(L) {
						return Q === "string" ? y(L) : Q === "boolean" ? !!L : L;
					}
					var F = IA(i), U = [], j = 0;
					if (s) for (var O = 0; O < s.length; O++) {
						var FA = d[e[O]];
						FA ? (j === 0 && (j = oA()), U[O] = FA(s[O])) : U[O] = s[O];
					}
					var MA = F.apply(null, U);
					function bA(L) {
						return j !== 0 && mA(j), G(L);
					}
					return MA = bA(MA), MA;
				}, tA = function(i, Q, e, s) {
					var k = !e || e.every((d) => d === "number" || d === "boolean");
					return Q !== "string" && k && !s ? IA(i) : function() {
						return H(i, Q, e, arguments, s);
					};
				}, wA = { a: QA }, m = rA();
				m.c, A._fftCross = m.d, m.__errno_location, A._malloc = m.f, A._free = m.g;
				var oA = m.h, mA = m.i, kA = m.j;
				function HA(i) {
					try {
						for (var Q = atob(i), e = new Uint8Array(Q.length), s = 0; s < Q.length; ++s) e[s] = Q.charCodeAt(s);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function uA(i) {
					if ($(i)) return HA(i.slice(_.length));
				}
				A.ccall = H, A.cwrap = tA;
				var hA;
				u = function i() {
					hA || RA(), hA || (u = i);
				};
				function RA() {
					if (S > 0 || (K(), S > 0)) return;
					function i() {
						hA || (hA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), i();
					}, 1)) : i();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return RA(), I;
			});
		})();
	}));
	function ug(g) {
		this.size = g, this.n = g * 8, this.ptr = JA._malloc(this.n * 4), this.ri = new Uint8Array(JA.HEAPU8.buffer, this.ptr, this.n), this.ii = new Uint8Array(JA.HEAPU8.buffer, this.ptr + this.n, this.n), this.transform = function(I, A, C) {
			var B = this.ptr, E = this.n;
			return this.ri.set(new Uint8Array(I.buffer)), this.ii.set(new Uint8Array(A.buffer)), pI(this.size, C, B, B + E, B + E * 2, B + E * 3), {
				real: new Float64Array(JA.HEAPU8.buffer, B + E * 2, this.size),
				imag: new Float64Array(JA.HEAPU8.buffer, B + E * 3, this.size)
			};
		}, this.dispose = function() {
			JA._free(this.ptr);
		};
	}
	var JA, pI, bg = eA((() => {
		mg(), JA = qI({}), pI = JA.cwrap("fftCross", "void", [
			"number",
			"number",
			"number",
			"number",
			"number",
			"number"
		]);
	})), TI, Jg = eA((() => {
		bg(), TI = class {
			constructor(g) {
				this.size = g, this.fftcross = new ug(g), this.real = new Float64Array(this.size), this.imag = new Float64Array(this.size);
			}
			fft(g) {
				for (var I = 0; I < this.size; I++) this.real[I] = g[2 * I], this.imag[I] = g[2 * I + 1];
				const A = this.fftcross.transform(this.real, this.imag, !1), C = new Float32Array(2 * this.size);
				for (var I = 0; I < this.size; I++) C[2 * I] = A.real[I], C[2 * I + 1] = A.imag[I];
				return C;
			}
		};
	}));
	function Lg(g) {
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
			function D(l, R) {
				for (var f = 0, N = 0; N < R; N++) f = f << 1 | l & 1, l >>>= 1;
				return f;
			}
		}, this.inverse = function(A, C) {
			forward(C, A);
		};
	}
	var Kg = eA((() => {})), PI, qg = eA((() => {
		Kg(), PI = class {
			constructor(g) {
				this.size = g, this.fftNayuki = new Lg(g);
			}
			fft(g) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), C = new Float32Array(this.size * 2);
				for (var B = 0; B < this.size; ++B) I[B] = g[B * 2], A[B] = g[B * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var B = 0; B < this.size; ++B) C[B * 2] = I[B], C[B * 2 + 1] = A[B];
				return C;
			}
		};
	})), WI, pg = eA((() => {
		WI = (() => {
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
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && V("no native wasm support detected");
				var h, D, l = !1, R, f;
				function N() {
					var i = h.buffer;
					A.HEAP8 = R = new Int8Array(i), A.HEAP16 = new Int16Array(i), A.HEAP32 = new Int32Array(i), A.HEAPU8 = f = new Uint8Array(i), A.HEAPU16 = new Uint16Array(i), A.HEAPU32 = new Uint32Array(i), A.HEAPF32 = new Float32Array(i), A.HEAPF64 = new Float64Array(i);
				}
				var M = [], Y = [], b = [];
				function K() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) z(A.preRun.shift());
					x(M);
				}
				function W() {
					x(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					x(b);
				}
				function z(i) {
					M.unshift(i);
				}
				function q(i) {
					Y.unshift(i);
				}
				function p(i) {
					b.unshift(i);
				}
				var S = 0, v = null, u = null;
				function AA(i) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function X(i) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), u)) {
						var Q = u;
						u = null, Q();
					}
				}
				function V(i) {
					A.onAbort && A.onAbort(i), i = "Aborted(" + i + ")", w(i), l = !0, i += ". Build with -sASSERTIONS for more info.";
					var Q = new WebAssembly.RuntimeError(i);
					throw B(Q), Q;
				}
				var _ = "data:application/octet-stream;base64,";
				function $(i) {
					return i.startsWith(_);
				}
				var J = "data:application/octet-stream;base64,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IgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHYIGohAQJAAkBBrB4oAgAiBEEBIAB0IgZxRQRAQaweIAQgBnI2AgAgASADNgIADAELIAJBGSAAQQF2a0EAIABBH0cbdCEAIAEoAgAhBANAIAQiASgCBEF4cSACRg0CIABBHXYhBCAAQQF0IQAgASAEQQRxaiIGKAIQIgQNAAsgBiADNgIQCyADIAE2AhggAyADNgIMIAMgAzYCCAwBCyABKAIIIgAgAzYCDCABIAM2AgggA0EANgIYIAMgATYCDCADIAA2AggLQbQeKAIAIgAgBU0NAEG0HiAAIAVrIgE2AgBBwB5BwB4oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADAgLQaQeQTA2AgBBACEADAcLQQAhAgsgCEUNAAJAIAYoAhwiAUECdEHYIGoiBCgCACAGRgRAIAQgAjYCACACDQFBrB5BrB4oAgBBfiABd3E2AgAMAgsgCEEQQRQgCCgCECAGRhtqIAI2AgAgAkUNAQsgAiAINgIYIAYoAhAiAQRAIAIgATYCECABIAI2AhgLIAYoAhQiAUUNACACIAE2AhQgASACNgIYCyAAIAlqIQAgBiAJaiIGKAIEIQMLIAYgA0F+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";
				$(J) || (J = a(J));
				function iA(i) {
					if (i == J && n) return new Uint8Array(n);
					var Q = uA(i);
					if (Q) return Q;
					if (c) return c(i);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(i, Q) {
					var e, s = iA(i);
					return e = new WebAssembly.Module(s), [new WebAssembly.Instance(e, Q), e];
				}
				function rA() {
					var i = { a: wA };
					function Q(e, s) {
						var k = e.exports;
						return D = k, h = D.b, N(), D.l, q(D.c), X("wasm-instantiate"), k;
					}
					if (AA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(i, Q);
					} catch (e) {
						w("Module.instantiateWasm callback failed with error: " + e), B(e);
					}
					return Q(CA(J, i)[0]);
				}
				var x = (i) => {
					for (; i.length > 0;) i.shift()(A);
				}, BA = (i) => {
					V("OOM");
				}, QA = (i) => {
					f.length, i >>>= 0, BA(i);
				};
				function IA(i) {
					return A["_" + i];
				}
				var gA = (i, Q) => {
					R.set(i, Q);
				}, EA = (i) => {
					for (var Q = 0, e = 0; e < i.length; ++e) {
						var s = i.charCodeAt(e);
						s <= 127 ? Q++ : s <= 2047 ? Q += 2 : s >= 55296 && s <= 57343 ? (Q += 4, ++e) : Q += 3;
					}
					return Q;
				}, nA = (i, Q, e, s) => {
					if (!(s > 0)) return 0;
					for (var k = e, d = e + s - 1, G = 0; G < i.length; ++G) {
						var F = i.charCodeAt(G);
						if (F >= 55296 && F <= 57343) {
							var U = i.charCodeAt(++G);
							F = 65536 + ((F & 1023) << 10) | U & 1023;
						}
						if (F <= 127) {
							if (e >= d) break;
							Q[e++] = F;
						} else if (F <= 2047) {
							if (e + 1 >= d) break;
							Q[e++] = 192 | F >> 6, Q[e++] = 128 | F & 63;
						} else if (F <= 65535) {
							if (e + 2 >= d) break;
							Q[e++] = 224 | F >> 12, Q[e++] = 128 | F >> 6 & 63, Q[e++] = 128 | F & 63;
						} else {
							if (e + 3 >= d) break;
							Q[e++] = 240 | F >> 18, Q[e++] = 128 | F >> 12 & 63, Q[e++] = 128 | F >> 6 & 63, Q[e++] = 128 | F & 63;
						}
					}
					return Q[e] = 0, e - k;
				}, aA = (i, Q, e) => nA(i, f, Q, e), sA = (i) => {
					var Q = EA(i) + 1, e = kA(Q);
					return aA(i, e, Q), e;
				}, DA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, cA = (i, Q, e) => {
					for (var s = Q + e, k = Q; i[k] && !(k >= s);) ++k;
					if (k - Q > 16 && i.buffer && DA) return DA.decode(i.subarray(Q, k));
					for (var d = ""; Q < k;) {
						var G = i[Q++];
						if (!(G & 128)) {
							d += String.fromCharCode(G);
							continue;
						}
						var F = i[Q++] & 63;
						if ((G & 224) == 192) {
							d += String.fromCharCode((G & 31) << 6 | F);
							continue;
						}
						var U = i[Q++] & 63;
						if ((G & 240) == 224 ? G = (G & 15) << 12 | F << 6 | U : G = (G & 7) << 18 | F << 12 | U << 6 | i[Q++] & 63, G < 65536) d += String.fromCharCode(G);
						else {
							var j = G - 65536;
							d += String.fromCharCode(55296 | j >> 10, 56320 | j & 1023);
						}
					}
					return d;
				}, y = (i, Q) => i ? cA(f, i, Q) : "", H = function(i, Q, e, s, k) {
					var d = {
						string: (L) => {
							var Z = 0;
							return L != null && L !== 0 && (Z = sA(L)), Z;
						},
						array: (L) => {
							var Z = kA(L.length);
							return gA(L, Z), Z;
						}
					};
					function G(L) {
						return Q === "string" ? y(L) : Q === "boolean" ? !!L : L;
					}
					var F = IA(i), U = [], j = 0;
					if (s) for (var O = 0; O < s.length; O++) {
						var FA = d[e[O]];
						FA ? (j === 0 && (j = oA()), U[O] = FA(s[O])) : U[O] = s[O];
					}
					var MA = F.apply(null, U);
					function bA(L) {
						return j !== 0 && mA(j), G(L);
					}
					return MA = bA(MA), MA;
				}, tA = function(i, Q, e, s) {
					var k = !e || e.every((d) => d === "number" || d === "boolean");
					return Q !== "string" && k && !s ? IA(i) : function() {
						return H(i, Q, e, arguments, s);
					};
				}, wA = { a: QA }, m = rA();
				m.c, A._malloc = m.d, A._free = m.e, A._precalc = m.f, A._precalc_f = m.g, A._dispose = m.h, A._dispose_f = m.i, A._transform_radix2_precalc = m.j, A._transform_radix2_precalc_f = m.k, m.__errno_location;
				var oA = m.m, mA = m.n, kA = m.o;
				function HA(i) {
					try {
						for (var Q = atob(i), e = new Uint8Array(Q.length), s = 0; s < Q.length; ++s) e[s] = Q.charCodeAt(s);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function uA(i) {
					if ($(i)) return HA(i.slice(_.length));
				}
				A.ccall = H, A.cwrap = tA;
				var hA;
				u = function i() {
					hA || RA(), hA || (u = i);
				};
				function RA() {
					if (S > 0 || (K(), S > 0)) return;
					function i() {
						hA || (hA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), i();
					}, 1)) : i();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return RA(), I;
			});
		})();
	}));
	function Tg(g) {
		this.n = g, this.rptr = YA._malloc(g * 4 + g * 4), this.iptr = this.rptr + g * 4, this.rarr = new Float32Array(YA.HEAPU8.buffer, this.rptr, g), this.iarr = new Float32Array(YA.HEAPU8.buffer, this.iptr, g), this.tables = xI(g), this.forward = function(I, A) {
			this.rarr.set(I), this.iarr.set(A), jI(this.rptr, this.iptr, this.n, this.tables), I.set(this.rarr), A.set(this.iarr);
		}, this.dispose = function() {
			YA._free(this.rptr), VI(this.tables);
		};
	}
	var YA, xI, VI, jI, Pg = eA((() => {
		pg(), YA = WI({}), YA.cwrap("precalc", "number", ["number"]), YA.cwrap("dispose", "void", ["number"]), YA.cwrap("transform_radix2_precalc", "void", [
			"number",
			"number",
			"number",
			"number"
		]), xI = YA.cwrap("precalc_f", "number", ["number"]), VI = YA.cwrap("dispose_f", "void", ["number"]), jI = YA.cwrap("transform_radix2_precalc_f", "void", [
			"number",
			"number",
			"number",
			"number"
		]);
	})), XI, Wg = eA((() => {
		Pg(), XI = class {
			constructor(g) {
				this.size = g, this.fftNayuki = new Tg(g);
			}
			fft(g) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), C = new Float32Array(this.size * 2);
				for (var B = 0; B < this.size; ++B) I[B] = g[B * 2], A[B] = g[B * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var B = 0; B < this.size; ++B) C[B * 2] = I[B], C[B * 2 + 1] = A[B];
				return C;
			}
		};
	})), $A, xg = eA((() => {
		$A || ($A = {}), (function(g) {
			"use strict";
			function I(o, t, a, c, w, n) {
				for (var h = w.twiddle, D = 0; D < n; D++) {
					var l = o[2 * (t + a * D)], R = o[2 * (t + a * D) + 1], f = o[2 * (t + a * (D + n))], N = o[2 * (t + a * (D + n)) + 1], M = h[2 * (0 + c * D)], Y = h[2 * (0 + c * D) + 1], b = f * M - N * Y, K = f * Y + N * M, W = l + b, T = R + K, z = l - b, q = R - K;
					o[2 * (t + a * D)] = W, o[2 * (t + a * D) + 1] = T, o[2 * (t + a * (D + n))] = z, o[2 * (t + a * (D + n)) + 1] = q;
				}
			}
			function A(o, t, a, c, w, n) {
				for (var h = w.twiddle, D = n, l = 2 * n, R = c, f = 2 * c, N = h[2 * (0 + c * n) + 1], M = 0; M < n; M++) {
					var Y = o[2 * (t + a * M)], b = o[2 * (t + a * M) + 1], K = o[2 * (t + a * (M + D))], W = o[2 * (t + a * (M + D)) + 1], T = h[2 * (0 + R * M)], z = h[2 * (0 + R * M) + 1], q = K * T - W * z, p = K * z + W * T, S = o[2 * (t + a * (M + l))], v = o[2 * (t + a * (M + l)) + 1], u = h[2 * (0 + f * M)], AA = h[2 * (0 + f * M) + 1], X = S * u - v * AA, V = S * AA + v * u, _ = q + X, $ = p + V, J = Y + _, iA = b + $;
					o[2 * (t + a * M)] = J, o[2 * (t + a * M) + 1] = iA;
					var CA = Y - _ * .5, rA = b - $ * .5, x = (q - X) * N, BA = (p - V) * N, QA = CA - BA, IA = rA + x;
					o[2 * (t + a * (M + D))] = QA, o[2 * (t + a * (M + D)) + 1] = IA;
					var gA = CA + BA, EA = rA - x;
					o[2 * (t + a * (M + l))] = gA, o[2 * (t + a * (M + l)) + 1] = EA;
				}
			}
			function C(o, t, a, c, w, n) {
				for (var h = w.twiddle, D = n, l = 2 * n, R = 3 * n, f = c, N = 2 * c, M = 3 * c, Y = 0; Y < n; Y++) {
					var b = o[2 * (t + a * Y)], K = o[2 * (t + a * Y) + 1], W = o[2 * (t + a * (Y + D))], T = o[2 * (t + a * (Y + D)) + 1], z = h[2 * (0 + f * Y)], q = h[2 * (0 + f * Y) + 1], p = W * z - T * q, S = W * q + T * z, v = o[2 * (t + a * (Y + l))], u = o[2 * (t + a * (Y + l)) + 1], AA = h[2 * (0 + N * Y)], X = h[2 * (0 + N * Y) + 1], V = v * AA - u * X, _ = v * X + u * AA, $ = o[2 * (t + a * (Y + R))], J = o[2 * (t + a * (Y + R)) + 1], iA = h[2 * (0 + M * Y)], CA = h[2 * (0 + M * Y) + 1], rA = $ * iA - J * CA, x = $ * CA + J * iA, BA = b + V, QA = K + _, IA = b - V, gA = K - _, EA = p + rA, nA = S + x, aA = p - rA, sA = S - x, DA = BA + EA, cA = QA + nA;
					if (w.inverse) var y = IA - sA, H = gA + aA;
					else var y = IA + sA, H = gA - aA;
					var tA = BA - EA, wA = QA - nA;
					if (w.inverse) var m = IA + sA, oA = gA - aA;
					else var m = IA - sA, oA = gA + aA;
					o[2 * (t + a * Y)] = DA, o[2 * (t + a * Y) + 1] = cA, o[2 * (t + a * (Y + D))] = y, o[2 * (t + a * (Y + D)) + 1] = H, o[2 * (t + a * (Y + l))] = tA, o[2 * (t + a * (Y + l)) + 1] = wA, o[2 * (t + a * (Y + R))] = m, o[2 * (t + a * (Y + R)) + 1] = oA;
				}
			}
			function B(o, t, a, c, w, n, h) {
				for (var D = w.twiddle, l = w.n, R = new Float64Array(2 * h), f = 0; f < n; f++) {
					for (var N = 0, M = f; N < h; N++, M += n) {
						var Y = o[2 * (t + a * M)], b = o[2 * (t + a * M) + 1];
						R[2 * N] = Y, R[2 * N + 1] = b;
					}
					for (var N = 0, M = f; N < h; N++, M += n) {
						var K = 0, Y = R[0], b = R[1];
						o[2 * (t + a * M)] = Y, o[2 * (t + a * M) + 1] = b;
						for (var W = 1; W < h; W++) {
							K = (K + c * M) % l;
							var T = o[2 * (t + a * M)], z = o[2 * (t + a * M) + 1], q = R[2 * W], p = R[2 * W + 1], S = D[2 * K], v = D[2 * K + 1], u = q * S - p * v, AA = q * v + p * S, X = T + u, V = z + AA;
							o[2 * (t + a * M)] = X, o[2 * (t + a * M) + 1] = V;
						}
					}
				}
			}
			function E(o, t, a, c, w, n, h, D, l) {
				var R = D.shift(), f = D.shift();
				if (f == 1) for (var N = 0; N < R * f; N++) {
					var M = c[2 * (w + n * h * N)], Y = c[2 * (w + n * h * N) + 1];
					o[2 * (t + a * N)] = M, o[2 * (t + a * N) + 1] = Y;
				}
				else for (var N = 0; N < R; N++) E(o, t + a * N * f, a, c, w + N * n * h, n * R, h, D.slice(), l);
				switch (R) {
					case 2:
						I(o, t, a, n, l, f);
						break;
					case 3:
						A(o, t, a, n, l, f);
						break;
					case 4:
						C(o, t, a, n, l, f);
						break;
					default:
						B(o, t, a, n, l, f, R);
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
				for (var R = 4, f = Math.floor(Math.sqrt(a)); a > 1;) {
					for (; a % R;) {
						switch (R) {
							case 4:
								R = 2;
								break;
							case 2:
								R = 3;
								break;
							default:
								R += 2;
								break;
						}
						R > f && (R = a);
					}
					a /= R, w.factors.push(R), w.factors.push(a);
				}
				this.state = w;
			};
			r.prototype.simple = function(o, t, a) {
				this.process(o, 0, 1, t, 0, 1, a);
			}, r.prototype.process = function(o, t, D, c, w, l, h) {
				var D = ~~D, l = ~~l, R = h == "real" ? h : "complex";
				if (D < 1) throw new RangeError("outputStride is outside range, should be positive integer, was `" + D + "'");
				if (l < 1) throw new RangeError("inputStride is outside range, should be positive integer, was `" + l + "'");
				if (R == "real") {
					for (var f = 0; f < this.state.n; f++) {
						var N = c[w + l * f], M = 0;
						this.state.scratch[2 * f] = N, this.state.scratch[2 * f + 1] = M;
					}
					E(o, t, D, this.state.scratch, 0, 1, 1, this.state.factors.slice(), this.state);
				} else if (c == o) {
					E(this.state.scratch, 0, 1, c, w, 1, l, this.state.factors.slice(), this.state);
					for (var f = 0; f < this.state.n; f++) {
						var N = this.state.scratch[2 * f], M = this.state.scratch[2 * f + 1];
						o[2 * (t + D * f)] = N, o[2 * (t + D * f) + 1] = M;
					}
				} else E(o, t, D, c, w, 1, l, this.state.factors.slice(), this.state);
			}, g.complex = r;
		})($A);
	})), OI, Vg = eA((() => {
		xg(), OI = class {
			constructor(g) {
				this.size = g, this.nockertfft = new $A.complex(g, !1);
			}
			fft(g) {
				const I = new Float32Array(2 * this.size);
				return this.nockertfft.simple(I, g, "complex"), I;
			}
		};
	}));
	function jg(g) {
		if (g !== 0 && (g & g - 1) === 0) P = g, zg(), _g(), $g();
		else throw new Error("init: radix-2 required");
	}
	function AI(g, I) {
		hI(g, I, 1);
	}
	function II(g, I) {
		let A = 1 / P;
		hI(g, I, -1);
		for (let C = 0; C < P; C++) g[C] *= A, I[C] *= A;
	}
	function Xg(g, I) {
		hI(g, I, -1);
	}
	function Og(g, I) {
		let A = [], C = [], B = 0;
		for (let E = 0; E < P; E++) {
			B = E * P;
			for (let r = 0; r < P; r++) A[r] = g[r + B], C[r] = I[r + B];
			AI(A, C);
			for (let r = 0; r < P; r++) g[r + B] = A[r], I[r + B] = C[r];
		}
		for (let E = 0; E < P; E++) {
			for (let r = 0; r < P; r++) B = E + r * P, A[r] = g[B], C[r] = I[B];
			AI(A, C);
			for (let r = 0; r < P; r++) B = E + r * P, g[B] = A[r], I[B] = C[r];
		}
	}
	function Zg(g, I) {
		let A = [], C = [], B = 0;
		for (let E = 0; E < P; E++) {
			B = E * P;
			for (let r = 0; r < P; r++) A[r] = g[r + B], C[r] = I[r + B];
			II(A, C);
			for (let r = 0; r < P; r++) g[r + B] = A[r], I[r + B] = C[r];
		}
		for (let E = 0; E < P; E++) {
			for (let r = 0; r < P; r++) B = E + r * P, A[r] = g[B], C[r] = I[B];
			II(A, C);
			for (let r = 0; r < P; r++) B = E + r * P, g[B] = A[r], I[B] = C[r];
		}
	}
	function hI(g, I, A) {
		let C, B, E, r, o, t, a, c, w, n = P >> 2;
		for (let h = 0; h < P; h++) r = xA[h], h < r && (o = g[h], g[h] = g[r], g[r] = o, o = I[h], I[h] = I[r], I[r] = o);
		for (let h = 1; h < P; h <<= 1) {
			B = 0, C = P / (h << 1);
			for (let D = 0; D < h; D++) {
				t = yA[B + n], a = A * yA[B];
				for (let l = D; l < P; l += h << 1) E = l + h, c = t * g[E] + a * I[E], w = t * I[E] - a * g[E], g[E] = g[l] - c, g[l] += c, I[E] = I[l] - w, I[l] += w;
				B += C;
			}
		}
	}
	function zg() {
		typeof Uint32Array < "u" ? xA = new Uint32Array(P) : xA = [], typeof Float64Array < "u" ? yA = new Float64Array(P * 1.25) : yA = [];
	}
	function _g() {
		let g = 0, I = 0, A = 0;
		for (xA[0] = 0; ++g < P;) {
			for (A = P >> 1; A <= I;) I -= A, A >>= 1;
			I += A, xA[g] = I;
		}
	}
	function $g() {
		let g = P >> 1, I = P >> 2, A = P >> 3, C = g + I, B = Math.sin(Math.PI / P), E = 2 * B * B, r = Math.sqrt(E * (2 - E)), o = yA[I] = 1, t = yA[0] = 0;
		B = 2 * E;
		for (let a = 1; a < A; a++) o -= E, E += B * o, t += r, r -= B * t, yA[a] = t, yA[I - a] = o;
		A !== 0 && (yA[A] = Math.sqrt(.5));
		for (let a = 0; a < I; a++) yA[g - a] = yA[a];
		for (let a = 0; a < C; a++) yA[a + g] = -yA[a];
	}
	var P, xA, yA, ZI, AB = eA((() => {
		P = 0, xA = null, yA = null, ZI = {
			init: jg,
			fft1d: AI,
			ifft1d: II,
			fft2d: Og,
			ifft2d: Zg,
			fft: AI,
			ifft: II,
			bt: Xg
		};
	})), zI, IB = eA((() => {
		AB(), zI = class {
			constructor(g) {
				this.size = g, this.FFT_mljs = ZI, this.FFT_mljs.init(g);
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
	async function gB() {
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
	async function BB() {
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
	async function CB() {
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
				for (const N of h) if (N.flag) {
					g = N.name;
					const M = o.match(N.regex);
					I = M ? M[1] : "Unknown";
					break;
				}
				const D = E.match(/\(([^)]+)\)/), l = D ? D[1].split("; ") : [];
				console.log(D), console.log(l);
				const R = {
					"10.0": "10",
					"6.3": "8.1",
					"6.2": "8",
					"6.1": "7",
					"6.0": "Vista",
					"5.2": "XP 64-bit",
					"5.1": "XP",
					"5.0": "2000"
				}, f = [
					{
						name: "Windows",
						regex: /Windows NT/,
						transform: (N) => R[N.split(" ")[2]],
						index: 0
					},
					{
						name: "Mac OS X",
						regex: /Mac OS X/,
						transform: (N) => N.replace("_", ".").split(" ")[3],
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
						transform: (N) => N.split(" ")[1],
						index: 0
					},
					{
						name: "iOS",
						regex: /iPhone/,
						transform: (N) => N.split(" ")[1].replace("_", "."),
						index: 0
					}
				];
				for (const N of f) if (N.regex.test(l[0])) {
					A = N.name, console.log(`osDetails: ${l}`), C = N.transform ? N.transform(l[1]) : N.versionMap[l[1].split(" ")[N.index]];
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
			relaxedSimd: await gB(),
			simd: await BB()
		};
	}
	var QB = eA((() => {})), _I, EB = eA((() => {
		_I = (() => {
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
				A.wasmBinary && (n = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && V("no native wasm support detected");
				var h, D, l = !1, R, f;
				function N() {
					var i = h.buffer;
					A.HEAP8 = R = new Int8Array(i), A.HEAP16 = new Int16Array(i), A.HEAP32 = new Int32Array(i), A.HEAPU8 = f = new Uint8Array(i), A.HEAPU16 = new Uint16Array(i), A.HEAPU32 = new Uint32Array(i), A.HEAPF32 = new Float32Array(i), A.HEAPF64 = new Float64Array(i);
				}
				var M = [], Y = [], b = [];
				function K() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) z(A.preRun.shift());
					x(M);
				}
				function W() {
					x(Y);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) p(A.postRun.shift());
					x(b);
				}
				function z(i) {
					M.unshift(i);
				}
				function q(i) {
					Y.unshift(i);
				}
				function p(i) {
					b.unshift(i);
				}
				var S = 0, v = null, u = null;
				function AA(i) {
					S++, A.monitorRunDependencies && A.monitorRunDependencies(S);
				}
				function X(i) {
					if (S--, A.monitorRunDependencies && A.monitorRunDependencies(S), S == 0 && (v !== null && (clearInterval(v), v = null), u)) {
						var Q = u;
						u = null, Q();
					}
				}
				function V(i) {
					A.onAbort && A.onAbort(i), i = "Aborted(" + i + ")", w(i), l = !0, i += ". Build with -sASSERTIONS for more info.";
					var Q = new WebAssembly.RuntimeError(i);
					throw B(Q), Q;
				}
				var _ = "data:application/octet-stream;base64,";
				function $(i) {
					return i.startsWith(_);
				}
				var J = "data:application/octet-stream;base64,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";
				$(J) || (J = a(J));
				function iA(i) {
					if (i == J && n) return new Uint8Array(n);
					var Q = uA(i);
					if (Q) return Q;
					if (c) return c(i);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function CA(i, Q) {
					var e, s = iA(i);
					return e = new WebAssembly.Module(s), [new WebAssembly.Instance(e, Q), e];
				}
				function rA() {
					var i = { a: wA };
					function Q(e, s) {
						var k = e.exports;
						return D = k, h = D.b, N(), D.i, q(D.c), X("wasm-instantiate"), k;
					}
					if (AA("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(i, Q);
					} catch (e) {
						w("Module.instantiateWasm callback failed with error: " + e), B(e);
					}
					return Q(CA(J, i)[0]);
				}
				var x = (i) => {
					for (; i.length > 0;) i.shift()(A);
				}, BA = (i) => {
					V("OOM");
				}, QA = (i) => {
					f.length, i >>>= 0, BA(i);
				};
				function IA(i) {
					return A["_" + i];
				}
				var gA = (i, Q) => {
					R.set(i, Q);
				}, EA = (i) => {
					for (var Q = 0, e = 0; e < i.length; ++e) {
						var s = i.charCodeAt(e);
						s <= 127 ? Q++ : s <= 2047 ? Q += 2 : s >= 55296 && s <= 57343 ? (Q += 4, ++e) : Q += 3;
					}
					return Q;
				}, nA = (i, Q, e, s) => {
					if (!(s > 0)) return 0;
					for (var k = e, d = e + s - 1, G = 0; G < i.length; ++G) {
						var F = i.charCodeAt(G);
						if (F >= 55296 && F <= 57343) {
							var U = i.charCodeAt(++G);
							F = 65536 + ((F & 1023) << 10) | U & 1023;
						}
						if (F <= 127) {
							if (e >= d) break;
							Q[e++] = F;
						} else if (F <= 2047) {
							if (e + 1 >= d) break;
							Q[e++] = 192 | F >> 6, Q[e++] = 128 | F & 63;
						} else if (F <= 65535) {
							if (e + 2 >= d) break;
							Q[e++] = 224 | F >> 12, Q[e++] = 128 | F >> 6 & 63, Q[e++] = 128 | F & 63;
						} else {
							if (e + 3 >= d) break;
							Q[e++] = 240 | F >> 18, Q[e++] = 128 | F >> 12 & 63, Q[e++] = 128 | F >> 6 & 63, Q[e++] = 128 | F & 63;
						}
					}
					return Q[e] = 0, e - k;
				}, aA = (i, Q, e) => nA(i, f, Q, e), sA = (i) => {
					var Q = EA(i) + 1, e = kA(Q);
					return aA(i, e, Q), e;
				}, DA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, cA = (i, Q, e) => {
					for (var s = Q + e, k = Q; i[k] && !(k >= s);) ++k;
					if (k - Q > 16 && i.buffer && DA) return DA.decode(i.subarray(Q, k));
					for (var d = ""; Q < k;) {
						var G = i[Q++];
						if (!(G & 128)) {
							d += String.fromCharCode(G);
							continue;
						}
						var F = i[Q++] & 63;
						if ((G & 224) == 192) {
							d += String.fromCharCode((G & 31) << 6 | F);
							continue;
						}
						var U = i[Q++] & 63;
						if ((G & 240) == 224 ? G = (G & 15) << 12 | F << 6 | U : G = (G & 7) << 18 | F << 12 | U << 6 | i[Q++] & 63, G < 65536) d += String.fromCharCode(G);
						else {
							var j = G - 65536;
							d += String.fromCharCode(55296 | j >> 10, 56320 | j & 1023);
						}
					}
					return d;
				}, y = (i, Q) => i ? cA(f, i, Q) : "", H = function(i, Q, e, s, k) {
					var d = {
						string: (L) => {
							var Z = 0;
							return L != null && L !== 0 && (Z = sA(L)), Z;
						},
						array: (L) => {
							var Z = kA(L.length);
							return gA(L, Z), Z;
						}
					};
					function G(L) {
						return Q === "string" ? y(L) : Q === "boolean" ? !!L : L;
					}
					var F = IA(i), U = [], j = 0;
					if (s) for (var O = 0; O < s.length; O++) {
						var FA = d[e[O]];
						FA ? (j === 0 && (j = oA()), U[O] = FA(s[O])) : U[O] = s[O];
					}
					var MA = F.apply(null, U);
					function bA(L) {
						return j !== 0 && mA(j), G(L);
					}
					return MA = bA(MA), MA;
				}, tA = function(i, Q, e, s) {
					var k = !e || e.every((d) => d === "number" || d === "boolean");
					return Q !== "string" && k && !s ? IA(i) : function() {
						return H(i, Q, e, arguments, s);
					};
				}, wA = { a: QA }, m = rA();
				m.c, A._kiss_fft_free = m.d, A._free = m.e, A._kiss_fft_alloc = m.f, A._malloc = m.g, A._kiss_fft = m.h, m.__errno_location;
				var oA = m.j, mA = m.k, kA = m.l;
				function HA(i) {
					try {
						for (var Q = atob(i), e = new Uint8Array(Q.length), s = 0; s < Q.length; ++s) e[s] = Q.charCodeAt(s);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function uA(i) {
					if ($(i)) return HA(i.slice(_.length));
				}
				A.ccall = H, A.cwrap = tA;
				var hA;
				u = function i() {
					hA || RA(), hA || (u = i);
				};
				function RA() {
					if (S > 0 || (K(), S > 0)) return;
					function i() {
						hA || (hA = !0, A.calledRun = !0, !l && (W(), C(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), i();
					}, 1)) : i();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return RA(), I;
			});
		})();
	})), SA, cI, $I, wI, Ag, iB = eA((() => {
		EB(), SA = _I({}), cI = SA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), $I = SA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), wI = SA.cwrap("kiss_fft_free", "void", ["number"]), Ag = class {
			constructor(g) {
				this.size = g, this.fcfg = cI(g, !1), this.icfg = cI(g, !0), this.inptr = SA._malloc(g * 8 + g * 8), this.cin = new Float32Array(SA.HEAPU8.buffer, this.inptr, g * 2);
			}
			fft = function(g) {
				const I = SA._malloc(this.size * 8), A = new Float32Array(SA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(g), $I(this.fcfg, this.inptr, I);
				let C = new Float32Array(this.size * 2);
				return C.set(A), SA._free(I), C;
			};
			dispose() {
				wI(this.fcfg), wI(this.icfg), SA._free(this.inptr);
			}
		};
	}));
	function gI(g) {
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
	var rB = eA((() => {
		gI.prototype.fft = function(I) {
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
					const n = c, h = n + t, D = h + t, l = D + t, R = this._out[n], f = this._out[n + 1], N = this._out[h], M = this._out[h + 1], Y = this._out[D], b = this._out[D + 1], K = this._out[l], W = this._out[l + 1], T = R, z = f, q = this.table[w], p = this.table[w + 1], S = N * q - M * p, v = N * p + M * q, u = this.table[2 * w], AA = this.table[2 * w + 1], X = Y * u - b * AA, V = Y * AA + b * u, _ = this.table[3 * w], $ = this.table[3 * w + 1], J = K * _ - W * $, iA = K * $ + W * _, CA = T + X, rA = z + V, x = T - X, BA = z - V, QA = S + J, IA = v + iA, gA = S - J, EA = v - iA;
					this._out[n] = CA + QA, this._out[n + 1] = rA + IA, this._out[h] = x + EA, this._out[h + 1] = BA - gA, this._out[D] = CA - QA, this._out[D + 1] = rA - IA, this._out[l] = x - EA, this._out[l + 1] = BA + gA;
				}
			}
			return this._out;
		}, gI.prototype._singleTransform2 = function(I, A, C) {
			const B = this._data[A], E = this._data[A + 1], r = this._data[A + C], o = this._data[A + C + 1];
			this._out[I] = B + r, this._out[I + 1] = E + o, this._out[I + 2] = B - r, this._out[I + 3] = E - o;
		}, gI.prototype._singleTransform4 = function(I, A, C) {
			const B = C * 2, E = C * 3, r = this._data[A], o = this._data[A + 1], t = this._data[A + C], a = this._data[A + C + 1], c = this._data[A + B], w = this._data[A + B + 1], n = this._data[A + E], h = this._data[A + E + 1], D = r + c, l = o + w, R = r - c, f = o - w, N = t + n, M = a + h, Y = t - n, b = a - h;
			this._out[I] = D + N, this._out[I + 1] = l + M, this._out[I + 2] = R + b, this._out[I + 3] = f - Y, this._out[I + 4] = D - N, this._out[I + 5] = l - M, this._out[I + 6] = R - b, this._out[I + 7] = f + Y;
		};
	})), tB = og({ default: () => Ig }), lI, Ig, eB = eA((() => {
		Ug(), vg(), Jg(), qg(), Wg(), Vg(), IB(), QB(), iB(), rB(), lI = [
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
		], Ig = class {
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
						this.fftLibrary = new PI(this.size);
						break;
					case "nayuki3Wasm":
						this.fftLibrary = new XI(this.size);
						break;
					case "kissWasm":
						this.fftLibrary = new KI(this.size);
						break;
					case "crossWasm":
						this.fftLibrary = new TI(this.size), this.size > 16384 && (this.fftLibrary = new DI(this.size));
						break;
					case "nockertJavascript":
						this.fftLibrary = new OI(this.size);
						break;
					case "indutnyJavascript":
						this.fftLibrary = new DI(this.size);
						break;
					case "mljsJavascript":
						this.fftLibrary = new zI(this.size);
						break;
					case "kissfftmodifiedWasm":
						this.fftLibrary = new Ag(this.size);
						break;
					case "indutnyModifiedJavascript":
						this.fftLibrary = new gI(this.size);
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
				return await CB();
			}
			dispose() {
				this.fftLibrary && this.fftLibrary.dispose !== void 0 && this.fftLibrary.dispose();
			}
		};
	}));
	let fI = null, gg = 0;
	async function aB(g) {
		try {
			const { default: I } = await Promise.resolve().then(() => (eB(), tB));
			fI = new I(g), await fI.profile(), gg = g;
		} catch (I) {
			console.warn("[dspWorker] WebFFT not available, using Radix-2 fallback:", I), fI = null;
		}
	}
	let LA, KA, VA, jA, lA, fA, Bg, Cg, Qg, Eg, UA, XA, ZA, BI, qA, CI, FI, QI, pA, TA, PA;
	const RI = 21;
	let ig = RI, NI = 0, yI = [], MI = [], GI = [], kI = [], YI, dI, EI, iI;
	function rg(g, I) {
		ig = I, NI = 0, yI = Array.from({ length: I }, () => new Float32Array(g)), MI = Array.from({ length: I }, () => new Float32Array(g)), GI = Array.from({ length: I }, () => new Float32Array(g)), kI = Array.from({ length: I }, () => new Float32Array(g)), YI = new Float32Array(g), dI = new Float32Array(g), EI = new Float32Array(g), iI = new Float32Array(g);
	}
	function oB(g, I, A, C, B) {
		const E = NI;
		for (let r = 0; r < B; r++) {
			const o = g[r] * g[r] + I[r] * I[r], t = A[r] * A[r] + C[r] * C[r], a = g[r] * A[r] + I[r] * C[r], c = g[r] * C[r] - I[r] * A[r];
			YI[r] += o - yI[E][r], dI[r] += t - MI[E][r], EI[r] += a - GI[E][r], iI[r] += c - kI[E][r], yI[E][r] = o, MI[E][r] = t, GI[E][r] = a, kI[E][r] = c;
		}
		NI = (E + 1) % ig;
	}
	function nB(g, I) {
		for (let A = 0; A < I; A++) {
			const C = EI[A] * EI[A] + iI[A] * iI[A], B = YI[A] * dI[A] + 1e-12;
			g[A] = Math.min(1, Math.max(0, Math.sqrt(C) / Math.sqrt(B)));
		}
	}
	let GA = 0, rI = 0, vA = null;
	const tg = new Ng();
	let OA = null, tI = null, SI = "None", eg = 0, WA = null, eI = null, UI = null, ag = 0;
	function sB(g, I) {
		const A = g.length, C = (I % A + A) % A;
		if (C === 0) return;
		const B = new Float32Array(C);
		B.set(g.subarray(0, C)), g.copyWithin(0, C), g.set(B, A - C);
	}
	self.onmessage = (g) => {
		if (g.data && g.data.type === "run-dsp") try {
			const { measTimeDomain: I, refTimeDomain: A, BINS: C, FFT_SIZE: B, metrics: E, windowType: r, weightingType: o, averagingType: t, averagingDepth: a, averagingAlpha: c, averagingThresholdDb: w, enableSourceWindow: n, sourceWindowWidthMs: h, sourceWindowOffsetMs: D, sampleRate: l, compensationDelaySamples: R, autoDelayCompensation: f, inputGain: N, displayOffset: M, polarity: Y, calibrationGain: b, inputFilter: K, besselSpeed: W, ppoSmoothing: T, fftOverlap: z } = g.data, q = l || 48e3;
			if (!I || !A) return;
			B && B !== gg && aB(B), (C !== GA || B !== rI) && (GA = C, rI = B, LA = new Float32Array(B), KA = new Float32Array(B), VA = new Float32Array(B), jA = new Float32Array(B), lA = new Float32Array(C), fA = new Float32Array(C), Bg = new Float32Array(B), Cg = new Float32Array(B), Qg = new Float32Array(B), Eg = new Float32Array(B), UA = new Float32Array(C), XA = new Float32Array(C), ZA = new Float32Array(C), BI = new Float32Array(C), qA = new Float32Array(B), CI = new Float32Array(B), FI = new Float32Array(C), QI = new Float32Array(C), pA = new Float32Array(C), TA = new Float32Array(C), PA = new Float32Array(C), rg(C, a || RI), vA = new fg(C, a || 16), WA = null), vA && vA.setDepth(a || 16);
			const p = new Set(E);
			let S = new Float32Array(I), v = new Float32Array(A);
			const u = z || 0;
			if (u > 0 && B > 0) {
				(!eI || ag !== B) && (eI = new Float32Array(B), UI = new Float32Array(B), ag = B);
				const y = u / 100, H = Math.round(B * y), tA = B - H, wA = new Float32Array(B), m = new Float32Array(B);
				wA.set(eI.subarray(tA), 0), m.set(UI.subarray(tA), 0), wA.set(S.subarray(0, tA), H), m.set(v.subarray(0, tA), H), eI.set(S), UI.set(v), S = wA, v = m;
			}
			const AA = uI(v), X = uI(S);
			if (R && R > 0 && sB(v, R), N && N !== 0) {
				const y = Math.pow(10, N / 20);
				for (let H = 0; H < B; H++) S[H] *= y;
			}
			if (Y) for (let y = 0; y < B; y++) S[y] = -S[y];
			K && K !== "None" ? ((!OA || SI !== K || eg !== q) && (SI = K, eg = q, OA = bI(K, q), tI = bI(K, q)), OA && OA.process(S), tI && tI.process(v)) : OA && (OA = null, tI = null, SI = "None");
			const V = r || "Hann";
			V !== "Rectangular" && (tg.apply(S, V), tg.apply(v, V));
			let _ = 0, $ = 0;
			for (let y = 0; y < B; y++) _ += S[y], $ += v[y];
			_ /= B, $ /= B;
			for (let y = 0; y < B; y++) S[y] -= _, v[y] -= $;
			if (mI(v, VA, jA), mI(S, LA, KA), p.has("Spectrum")) {
				for (let y = 0; y < C; y++) {
					const H = Math.sqrt(LA[y] * LA[y] + KA[y] * KA[y]);
					pA[y] = 20 * Math.log10(H / B * Math.SQRT2 + 1e-12);
				}
				if (M && M !== 0) for (let y = 0; y < C; y++) pA[y] += M;
			}
			const J = p.has("Magnitude") || p.has("Impulse") || p.has("Step"), iA = p.has("Phase") || p.has("Group Delay"), CA = p.has("Impulse") || p.has("Step");
			if (J && hg(LA, KA, VA, jA, UA, lA, fA), t !== "None" && J) {
				if (t === "FIFO" && vA) {
					vA.processFIFO(lA, fA, TA, PA, w), lA.set(TA), fA.set(PA);
					for (let y = 0; y < C; y++) {
						const H = Math.sqrt(lA[y] * lA[y] + fA[y] * fA[y]);
						UA[y] = 20 * Math.log10(H + 1e-8);
					}
				} else if (t === "EMA" && vA) {
					vA.processLPF(lA, fA, TA, PA, c || .1), lA.set(TA), fA.set(PA);
					for (let y = 0; y < C; y++) {
						const H = Math.sqrt(lA[y] * lA[y] + fA[y] * fA[y]);
						UA[y] = 20 * Math.log10(H + 1e-8);
					}
				} else if (t === "LPF") try {
					WA || (WA = new Yg(C, W || "Medium")), WA.setFrequency(W || "Medium"), WA.process(lA, fA, TA, PA), lA.set(TA), fA.set(PA);
					for (let y = 0; y < C; y++) {
						const H = Math.sqrt(lA[y] * lA[y] + fA[y] * fA[y]);
						UA[y] = 20 * Math.log10(H + 1e-8);
					}
				} catch {}
			}
			if (M && M !== 0 && J) for (let y = 0; y < C; y++) UA[y] += M;
			if (b) {
				const y = new Float32Array(b);
				if (J) for (let H = 0; H < C; H++) UA[H] += y[H];
				if (p.has("Spectrum")) for (let H = 0; H < C; H++) pA[H] += y[H];
			}
			if (iA && cg(LA, KA, VA, jA, XA), oB(VA, jA, LA, KA, C), nB(ZA, C), CA && (Fg(LA, KA, VA, jA, qA, Bg, Cg, Qg, Eg), n && Rg(qA, h, D, q)), p.has("Step") && wg(qA, CI, q), p.has("Group Delay")) {
				for (let y = 0; y < C; y++) FI[y] = XA[y] * Math.PI / 180;
				lg(FI, q / 2 / C, BI);
			}
			const rA = X.peakDb - X.rmsDb;
			QI.fill(Math.max(0, Math.min(30, rA)));
			let x = 0;
			if (f && CA) {
				let y = 0;
				for (let H = 0; H < qA.length; H++) {
					const tA = Math.abs(qA[H]);
					tA > y && (y = tA, x = H);
				}
			}
			T && T > 0 && (J && oI(UA, C, q, T), iA && dg(XA, C, q, T), oI(ZA, C, q, T), p.has("Spectrum") && oI(pA, C, q, T));
			const BA = UA.buffer, QA = XA.buffer, IA = ZA.buffer, gA = BI.buffer, EA = qA.buffer, nA = CI.buffer, aA = QI.buffer, sA = lA.buffer, DA = fA.buffer, cA = pA.buffer;
			self.postMessage({
				type: "dsp-results",
				outputMagnitude: BA,
				outputPhase: QA,
				outputCoherence: IA,
				outputGroupDelay: gA,
				outputImpulse: EA,
				outputStep: nA,
				outputCrestFactor: aA,
				outputSpectrum: cA,
				hReal: sA,
				hImag: DA,
				refPeakDb: AA.peakDb,
				refRmsDb: AA.rmsDb,
				measPeakDb: X.peakDb,
				measRmsDb: X.rmsDb,
				detectedDelaySamples: x
			}, [
				BA,
				QA,
				IA,
				gA,
				EA,
				nA,
				aA,
				cA,
				sA,
				DA
			]), UA = new Float32Array(GA), XA = new Float32Array(GA), ZA = new Float32Array(GA), BI = new Float32Array(GA), qA = new Float32Array(rI), CI = new Float32Array(rI), QI = new Float32Array(GA), pA = new Float32Array(GA), lA = new Float32Array(GA), fA = new Float32Array(GA);
		} catch (I) {
			console.error("[dspWorker] Error in run-dsp:", I);
		}
		g.data && g.data.type === "reset-averaging" && (GA > 0 && rg(GA, RI), vA && vA.reset(), WA && WA.reset());
	};
})();
