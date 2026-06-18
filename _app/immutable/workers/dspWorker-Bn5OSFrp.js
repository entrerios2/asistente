(function() {
	var aI = Object.defineProperty, EA = (Q, I) => () => (Q && (I = Q(Q = 0)), I), KI = (Q, I) => {
		let A = {};
		for (var i in Q) aI(A, i, {
			get: Q[i],
			enumerable: !0
		});
		return I || aI(A, Symbol.toStringTag, { value: "Module" }), A;
	};
	typeof window < "u" && import("webfft").then((Q) => {
		Q && Q.default && new Q.default(8192);
	}).catch(() => {});
	function qI(Q, I) {
		let A = 0;
		for (let i = 0; i < I; i++) A = A << 1 | Q & 1, Q >>= 1;
		return A;
	}
	function pI(Q, I, A) {
		const i = Q.length, E = Math.log2(i);
		for (let C = 0; C < i; C++) {
			const r = qI(C, E);
			if (r > C) {
				const o = Q[C], a = I[C];
				Q[C] = Q[r], I[C] = I[r], Q[r] = o, I[r] = a;
			}
		}
		for (let C = 2; C <= i; C <<= 1) {
			const r = C >> 1, o = (A ? 2 : -2) * Math.PI / C, a = Math.cos(o), t = Math.sin(o);
			for (let n = 0; n < i; n += C) {
				let f = 1, s = 0;
				for (let D = 0; D < r; D++) {
					const h = Q[n + D], w = I[n + D], F = n + D + r, l = f * Q[F] - s * I[F], R = f * I[F] + s * Q[F];
					Q[n + D] = h + l, I[n + D] = w + R, Q[F] = h - l, I[F] = w - R;
					const N = f * a - s * t;
					s = f * t + s * a, f = N;
				}
			}
		}
		if (A) for (let C = 0; C < i; C++) Q[C] /= i, I[C] /= i;
	}
	function TI(Q, I, A, i) {
		const E = Q.length, C = A || new Float32Array(E), r = i || new Float32Array(E);
		return C.set(Q), r.set(I), pI(C, r, !0), C;
	}
	function WI(Q, I, A, i, E, C, r) {
		const o = E.length;
		for (let a = 0; a < o; a++) {
			const t = A[a] * A[a] + i[a] * i[a] + 1e-12, n = (Q[a] * A[a] + I[a] * i[a]) / t, f = (I[a] * A[a] - Q[a] * i[a]) / t;
			C && (C[a] = n), r && (r[a] = f);
			const s = Math.sqrt(n * n + f * f);
			E[a] = 20 * Math.log10(s + 1e-8);
		}
	}
	function PI(Q, I, A, i, E) {
		const C = E.length;
		for (let r = 0; r < C; r++) {
			const o = A[r] * A[r] + i[r] * i[r] + 1e-12, a = (Q[r] * A[r] + I[r] * i[r]) / o, t = (I[r] * A[r] - Q[r] * i[r]) / o;
			E[r] = Math.atan2(t, a) * (180 / Math.PI);
		}
	}
	function xI(Q, I) {
		let A = 0;
		const i = Q.length, E = 1 / 48e3;
		for (let C = 0; C < i; C++) A += Q[C] * E * 1e3, I[C] = A;
	}
	function VI(Q, I, A) {
		const i = A.length;
		A[0] = 0;
		const E = 2 * Math.PI * I;
		for (let C = 1; C < i; C++) {
			let r = Q[C] - Q[C - 1];
			for (; r > Math.PI;) r -= 2 * Math.PI;
			for (; r < -Math.PI;) r += 2 * Math.PI;
			A[C] = -r / E * 1e3;
		}
	}
	function eI(Q, I) {
		if (I === "Z") return 0;
		const A = Q * Q, i = A * A;
		if (I === "A") {
			const E = 0xb731adf8200 * i, C = (A + 20.6 * 20.6) * Math.sqrt((A + 107.7 * 107.7) * (A + 737.9 * 737.9)) * (A + 12194 * 12194);
			return 20 * Math.log10(E / C) + 2;
		}
		if (I === "C") {
			const E = 0xb731adf8200 * A, C = (A + 20.6 * 20.6) * (A + 12194 * 12194);
			return 20 * Math.log10(E / C) + .06;
		}
		if (I === "B") {
			const E = 0xb731adf8200 * A * Q, C = (A + 20.6 * 20.6) * Math.sqrt(A + 158.5 * 158.5) * (A + 12194 * 12194);
			return 20 * Math.log10(E / C) + .17;
		}
		return 0;
	}
	var jI = class {
		depth;
		bins;
		bufferReal;
		bufferImag;
		writeIdx = 0;
		count = 0;
		lpfReal;
		lpfImag;
		constructor(Q, I = 16) {
			this.bins = Q, this.depth = I, this.bufferReal = Array.from({ length: I }, () => new Float32Array(Q)), this.bufferImag = Array.from({ length: I }, () => new Float32Array(Q)), this.lpfReal = new Float32Array(Q), this.lpfImag = new Float32Array(Q);
		}
		processFIFO(Q, I, A, i) {
			this.bufferReal[this.writeIdx].set(Q), this.bufferImag[this.writeIdx].set(I), this.writeIdx = (this.writeIdx + 1) % this.depth, this.count < this.depth && this.count++, A.fill(0), i.fill(0);
			for (let E = 0; E < this.count; E++) for (let C = 0; C < this.bins; C++) A[C] += this.bufferReal[E][C], i[C] += this.bufferImag[E][C];
			for (let E = 0; E < this.bins; E++) A[E] /= this.count, i[E] /= this.count;
		}
		processLPF(Q, I, A, i, E) {
			for (let C = 0; C < this.bins; C++) this.lpfReal[C] += (Q[C] - this.lpfReal[C]) * E, this.lpfImag[C] += (I[C] - this.lpfImag[C]) * E, A[C] = this.lpfReal[C], i[C] = this.lpfImag[C];
		}
		setDepth(Q) {
			Q !== this.depth && (this.depth = Math.max(1, Math.min(64, Q)), this.bufferReal = Array.from({ length: this.depth }, () => new Float32Array(this.bins)), this.bufferImag = Array.from({ length: this.depth }, () => new Float32Array(this.bins)), this.writeIdx = 0, this.count = 0);
		}
		reset() {
			this.writeIdx = 0, this.count = 0, this.lpfReal.fill(0), this.lpfImag.fill(0);
		}
	};
	function XI(Q, I, A, i, E, C, r, o, a) {
		const t = Q.length, n = t * 2, f = 1e-10;
		for (let s = 0; s < t; s++) {
			const D = A[s] * A[s] + i[s] * i[s] + f, h = (Q[s] * A[s] + I[s] * i[s]) / D, w = (I[s] * A[s] - Q[s] * i[s]) / D;
			C[s] = h, r[s] = w;
		}
		for (let s = 1; s < t; s++) C[n - s] = C[s], r[n - s] = -r[s];
		TI(C, r, o, a), E.set(o);
	}
	function ZI(Q, I, A, i = 48e3) {
		const E = Q.length, C = Math.round(A / 1e3 * i), r = Math.round(I / 2 / 1e3 * i), o = Math.max(0, C - r), a = Math.min(E - 1, C + r), t = Math.round(r * .2);
		for (let n = 0; n < E; n++) if (n < o || n > a) Q[n] = 0;
		else if (n < o + t) {
			const f = (n - o) / t, s = .5 * (1 - Math.cos(f * Math.PI));
			Q[n] *= s;
		} else if (n > a - t) {
			const f = (a - n) / t, s = .5 * (1 - Math.cos(f * Math.PI));
			Q[n] *= s;
		}
	}
	var OI = class {
		cache = {};
		getWindow(Q, I) {
			const A = `${Q}_${I}`;
			if (!this.cache[A]) {
				const i = new Float32Array(Q);
				let E = 0, C = 0;
				for (let o = 0; o < Q; o++) {
					let a = 1;
					const t = 2 * Math.PI * o / (Q - 1);
					if (I === "Hann") a = .5 * (1 - Math.cos(t));
					else if (I === "Hamming") a = .54 - .46 * Math.cos(t);
					else if (I === "FlatTop") a = 1 - 1.93 * Math.cos(t) + 1.29 * Math.cos(2 * t) - .388 * Math.cos(3 * t) + .0322 * Math.cos(4 * t);
					else if (I === "BlackmanHarris") a = .35875 - .48829 * Math.cos(t) + .14128 * Math.cos(2 * t) - .01168 * Math.cos(3 * t);
					else if (I === "HFT223D") a = 1 - 1.9329348896 * Math.cos(t) + 1.2813988316 * Math.cos(2 * t) - .3807315853 * Math.cos(3 * t) + .0293292167 * Math.cos(4 * t);
					else if (I === "Exponential") {
						const n = Q / 5;
						a = Math.exp(-o / n);
					}
					i[o] = a, E += a, C += a * a;
				}
				const r = E / Q;
				for (let o = 0; o < Q; o++) i[o] /= r;
				this.cache[A] = i;
			}
			return this.cache[A];
		}
		apply(Q, I) {
			if (I === "Rectangular") return;
			const A = Q.length, i = this.getWindow(A, I);
			for (let E = 0; E < A; E++) Q[E] *= i[E];
		}
	}, oI, zI = EA((() => {
		oI = (() => {
			var Q = self.location.href;
			return (function(I = {}) {
				var A = I, i, E;
				A.ready = new Promise((g, e) => {
					i = g, E = e;
				});
				var C = Object.assign({}, A), r = !0, o = !1, a = "";
				function t(g) {
					return A.locateFile ? A.locateFile(g, a) : a + g;
				}
				var n;
				(r || o) && (o ? a = self.location.href : typeof document < "u" && document.currentScript && (a = document.currentScript.src), Q && (a = Q), a.indexOf("blob:") !== 0 ? a = a.substr(0, a.replace(/[?#].*/, "").lastIndexOf("/") + 1) : a = "", o && (n = (g) => {
					var e = new XMLHttpRequest();
					return e.open("GET", g, !1), e.responseType = "arraybuffer", e.send(null), new Uint8Array(e.response);
				})), A.print || console.log.bind(console);
				var f = A.printErr || console.error.bind(console);
				Object.assign(A, C), C = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && L("no native wasm support detected");
				var D, h, w = !1, F, l;
				function R() {
					var g = D.buffer;
					A.HEAP8 = F = new Int8Array(g), A.HEAP16 = new Int16Array(g), A.HEAP32 = new Int32Array(g), A.HEAPU8 = l = new Uint8Array(g), A.HEAPU16 = new Uint16Array(g), A.HEAPU32 = new Uint32Array(g), A.HEAPF32 = new Float32Array(g), A.HEAPF64 = new Float64Array(g);
				}
				var N = [], M = [], m = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) V(A.preRun.shift());
					_(N);
				}
				function q() {
					_(M);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) S(A.postRun.shift());
					_(m);
				}
				function V(g) {
					N.unshift(g);
				}
				function P(g) {
					M.unshift(g);
				}
				function S(g) {
					m.unshift(g);
				}
				var G = 0, Y = null, v = null;
				function x(g) {
					G++, A.monitorRunDependencies && A.monitorRunDependencies(G);
				}
				function U(g) {
					if (G--, A.monitorRunDependencies && A.monitorRunDependencies(G), G == 0 && (Y !== null && (clearInterval(Y), Y = null), v)) {
						var e = v;
						v = null, e();
					}
				}
				function L(g) {
					A.onAbort && A.onAbort(g), g = "Aborted(" + g + ")", f(g), w = !0, g += ". Build with -sASSERTIONS for more info.";
					var e = new WebAssembly.RuntimeError(g);
					throw E(e), e;
				}
				var j = "data:application/octet-stream;base64,";
				function z(g) {
					return g.startsWith(j);
				}
				var p = "data:application/octet-stream;base64,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GCAZkzgCBCAHIBcgHpM4AgAgBUEIaiEFIAdBCGohByAEQQhqIQQgAUEIaiEBIABBCGohACAJQQFqIgkgBkcNAAsMAQsgBSgCACELIAlBA3QQByEIAkAgCUECSA0AIAZBAEwNACAFQYgCaiENIAlBfHEhDiAJQQNxIQogCUEBa0EDSSEPQQAhBwNAIAchAUEAIQRBACEDIA9FBEADQCAIIARBA3QiBWogACABQQN0aikCADcCACAIIAVBCHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBEHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBGHJqIAAgASAGaiIBQQN0aikCADcCACAEQQRqIQQgASAGaiEBIANBBGoiAyAORw0ACwtBACEFIAoEQANAIAggBEEDdGogACABQQN0aikCADcCACAEQQFqIQQgASAGaiEBIAVBAWoiBSAKRw0ACwsgCCkCACIvp74hFUEAIQwgByEDA0AgACADQQN0aiIFIC83AgAgAiADbCEQIAUqAgQhFEEBIQEgFSETQQAhBANAIAUgEyAIIAFBA3RqIhEqAgAiFiANIAQgEGoiBCALQQAgBCALThtrIgRBA3RqIhIqAgAiF5QgEioCBCIYIBEqAgQiGZSTkiITOAIAIAUgFCAWIBiUIBcgGZSSkiIUOAIEIAFBAWoiASAJRw0ACyADIAZqIQMgDEEBaiIMIAlHDQALIAdBAWoiByAGRw0ACwsgCBAGCwsDAAELwQEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABAEDAELIAAgAKEgAkGAgMD/B08NABoCQAJAAkACQCAAIAEQC0EDcQ4DAAECAwsgASsDACABKwMIEAQMAwsgASsDACABKwMIQQEQA5oMAgsgASsDACABKwMIEASaDAELIAErAwAgASsDCEEBEAMLIQAgAUEQaiQAIAALuBgDFH8EfAF+IwBBMGsiCCQAAkACQAJAIAC9IhpCIIinIgNB/////wdxIgZB+tS9gARNBEAgA0H//z9xQfvDJEYNASAGQfyyi4AETQRAIBpCAFkEQCABIABEAABAVPsh+b+gIgBEMWNiGmG00L2gIhY5AwAgASAAIBahRDFjYhphtNC9oDkDCEEB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IAIgC0chCiACQQFqIQIgCg0ACwsgBUGgAWogBkEDdGogADkDACAEQQBKIQIgBEEBayEEIAINAAsLRAAAAAAAAAAAIQAgA0EATgRAIAMhAgNAIAIiBEEBayECIAAgBUGgAWogBEEDdGorAwCgIQAgBA0ACwsgCCAAmiAAIAwbOQMAIAUrA6ABIAChIQBBASECIANBAEoEQANAIAAgBUGgAWogAkEDdGorAwCgIQAgAiADRyEEIAJBAWohAiAEDQALCyAIIACaIAAgDBs5AwggBUGwBGokACAHQQdxIQMgCCsDACEAIBpCAFMEQCABIACaOQMAIAEgCCsDCJo5AwhBACADayEDDAELIAEgADkDACABIAgrAwg5AwgLIAhBMGokACADC8UBAQJ/IwBBEGsiASQAAkAgAL1CIIinQf////8HcSICQfvDpP8DTQRAIAJBgIDA8gNJDQEgAEQAAAAAAAAAAEEAEAMhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCwJAAkACQAJAIAAgARALQQNxDgMAAQIDCyABKwMAIAErAwhBARADIQAMAwsgASsDACABKwMIEAQhAAwCCyABKwMAIAErAwhBARADmiEADAELIAErAwAgASsDCBAEmiEACyABQRBqJAAgAAuhBAEDfyABIAJGBEAgACgCAEEDdBAHIgQgAUEBQQEgAEEIaiAAEAggBCECAkAgACgCAEEDdCIDQYAETwRAIAEgAiADEAEMAQsgASADaiEAAkAgASACc0EDcUUEQAJAIAFBA3FFDQAgA0UNAANAIAEgAi0AADoAACACQQFqIQIgAUEBaiIBQQNxRQ0BIAAgAUsNAAsLAkAgAEF8cSIDQcAASQ0AIAEgA0FAaiIFSw0AA0AgASACKAIANgIAIAEgAigCBDYCBCABIAIoAgg2AgggASACKAIMNgIMIAEgAigCEDYCECABIAIoAhQ2AhQgASACKAIYNgIYIAEgAigCHDYCHCABIAIoAiA2AiAgASACKAIkNgIkIAEgAigCKDYCKCABIAIoAiw2AiwgASACKAIwNgIwIAEgAigCNDYCNCABIAIoAjg2AjggASACKAI8NgI8IAJBQGshAiABQUBrIgEgBU0NAAsLIAEgA08NAQNAIAEgAigCADYCACACQQRqIQIgAUEEaiIBIANJDQALDAELIABBBEkNACAB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";
				z(p) || (p = t(p));
				function iA(g) {
					if (g == p && s) return new Uint8Array(s);
					var e = eA(g);
					if (e) return e;
					if (n) return n(g);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function gA(g, e) {
					var c, d = iA(g);
					return c = new WebAssembly.Module(d), [new WebAssembly.Instance(c, e), c];
				}
				function BA() {
					var g = { a: K };
					function e(c, d) {
						var H = c.exports;
						return h = H, D = h.c, R(), h.j, P(h.d), U("wasm-instantiate"), H;
					}
					if (x("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(g, e);
					} catch (c) {
						f("Module.instantiateWasm callback failed with error: " + c), E(c);
					}
					return e(gA(p, g)[0]);
				}
				var _ = (g) => {
					for (; g.length > 0;) g.shift()(A);
				}, IA = (g, e, c) => l.copyWithin(g, e, e + c), CA = (g) => {
					L("OOM");
				}, $ = (g) => {
					l.length, g >>>= 0, CA(g);
				};
				function AA(g) {
					return A["_" + g];
				}
				var QA = (g, e) => {
					F.set(g, e);
				}, nA = (g) => {
					for (var e = 0, c = 0; c < g.length; ++c) {
						var d = g.charCodeAt(c);
						d <= 127 ? e++ : d <= 2047 ? e += 2 : d >= 55296 && d <= 57343 ? (e += 4, ++c) : e += 3;
					}
					return e;
				}, aA = (g, e, c, d) => {
					if (!(d > 0)) return 0;
					for (var H = c, k = c + d - 1, y = 0; y < g.length; ++y) {
						var u = g.charCodeAt(y);
						if (u >= 55296 && u <= 57343) {
							var X = g.charCodeAt(++y);
							u = 65536 + ((u & 1023) << 10) | X & 1023;
						}
						if (u <= 127) {
							if (c >= k) break;
							e[c++] = u;
						} else if (u <= 2047) {
							if (c + 1 >= k) break;
							e[c++] = 192 | u >> 6, e[c++] = 128 | u & 63;
						} else if (u <= 65535) {
							if (c + 2 >= k) break;
							e[c++] = 224 | u >> 12, e[c++] = 128 | u >> 6 & 63, e[c++] = 128 | u & 63;
						} else {
							if (c + 3 >= k) break;
							e[c++] = 240 | u >> 18, e[c++] = 128 | u >> 12 & 63, e[c++] = 128 | u >> 6 & 63, e[c++] = 128 | u & 63;
						}
					}
					return e[c] = 0, c - H;
				}, sA = (g, e, c) => aA(g, l, e, c), hA = (g) => {
					var e = nA(g) + 1, c = UA(e);
					return sA(g, c, e), c;
				}, FA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, RA = (g, e, c) => {
					for (var d = e + c, H = e; g[H] && !(H >= d);) ++H;
					if (H - e > 16 && g.buffer && FA) return FA.decode(g.subarray(e, H));
					for (var k = ""; e < H;) {
						var y = g[e++];
						if (!(y & 128)) {
							k += String.fromCharCode(y);
							continue;
						}
						var u = g[e++] & 63;
						if ((y & 224) == 192) {
							k += String.fromCharCode((y & 31) << 6 | u);
							continue;
						}
						var X = g[e++] & 63;
						if ((y & 240) == 224 ? y = (y & 15) << 12 | u << 6 | X : y = (y & 7) << 18 | u << 12 | X << 6 | g[e++] & 63, y < 65536) k += String.fromCharCode(y);
						else {
							var Z = y - 65536;
							k += String.fromCharCode(55296 | Z >> 10, 56320 | Z & 1023);
						}
					}
					return k;
				}, DA = (g, e) => g ? RA(l, g, e) : "", NA = function(g, e, c, d, H) {
					var k = {
						string: (O) => {
							var xA = 0;
							return O != null && O !== 0 && (xA = hA(O)), xA;
						},
						array: (O) => {
							var xA = UA(O.length);
							return QA(O, xA), xA;
						}
					};
					function y(O) {
						return e === "string" ? DA(O) : e === "boolean" ? !!O : O;
					}
					var u = AA(g), X = [], Z = 0;
					if (d) for (var cA = 0; cA < d.length; cA++) {
						var yA = k[c[cA]];
						yA ? (Z === 0 && (Z = vA()), X[cA] = yA(d[cA])) : X[cA] = d[cA];
					}
					var uA = u.apply(null, X);
					function J(O) {
						return Z !== 0 && GA(Z), y(O);
					}
					return uA = J(uA), uA;
				}, MA = function(g, e, c, d) {
					var H = !c || c.every((k) => k === "number" || k === "boolean");
					return e !== "string" && H && !d ? AA(g) : function() {
						return NA(g, e, c, arguments, d);
					};
				}, K = {
					b: IA,
					a: $
				}, rA = BA();
				rA.d, A._kiss_fft_free = rA.e, A._free = rA.f, A._kiss_fft_alloc = rA.g, A._malloc = rA.h, A._kiss_fft = rA.i, rA.__errno_location;
				var vA = rA.k, GA = rA.l, UA = rA.m;
				function mA(g) {
					try {
						for (var e = atob(g), c = new Uint8Array(e.length), d = 0; d < e.length; ++d) c[d] = e.charCodeAt(d);
						return c;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function eA(g) {
					if (z(g)) return mA(g.slice(j.length));
				}
				A.ccall = NA, A.cwrap = MA;
				var wA;
				v = function g() {
					wA || B(), wA || (v = g);
				};
				function B() {
					if (G > 0 || (b(), G > 0)) return;
					function g() {
						wA || (wA = !0, A.calledRun = !0, !w && (q(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
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
	})), kA, zA, nI, _A, sI, _I = EA((() => {
		zI(), kA = oI({}), zA = kA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), nI = kA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), _A = kA.cwrap("kiss_fft_free", "void", ["number"]), sI = class {
			constructor(Q) {
				this.size = Q, this.fcfg = zA(this.size, !1), this.icfg = zA(this.size, !0), this.inptr = kA._malloc(this.size * 8), this.cin = new Float32Array(kA.HEAPU8.buffer, this.inptr, this.size * 2);
			}
			fft = function(Q) {
				const I = kA._malloc(this.size * 8), A = new Float32Array(kA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(Q), nI(this.fcfg, this.inptr, I);
				let i = new Float32Array(this.size * 2);
				return i.set(A), kA._free(I), i;
			};
			dispose() {
				_A(this.fcfg), _A(this.icfg), kA._free(this.inptr);
			}
		};
	}));
	function fA(Q) {
		if (this.size = Q | 0, this.size <= 1 || (this.size & this.size - 1) !== 0) throw new Error("FFT size must be a power of two and bigger than 1");
		this._csize = Q << 1;
		for (var I = new Array(this.size * 2), A = 0; A < I.length; A += 2) {
			const a = Math.PI * A / this.size;
			I[A] = Math.cos(a), I[A + 1] = -Math.sin(a);
		}
		this.table = I;
		for (var i = 0, E = 1; this.size > E; E <<= 1) i++;
		this._width = i % 2 === 0 ? i - 1 : i, this._bitrev = new Array(1 << this._width);
		for (var C = 0; C < this._bitrev.length; C++) {
			this._bitrev[C] = 0;
			for (var r = 0; r < this._width; r += 2) {
				var o = this._width - r - 2;
				this._bitrev[C] |= (C >>> r & 3) << o;
			}
		}
		this._out = null, this._data = null, this._inv = 0;
	}
	var $I = EA((() => {
		fA.prototype.fromComplexArray = function(I, A) {
			for (var i = A || new Array(I.length >>> 1), E = 0; E < I.length; E += 2) i[E >>> 1] = I[E];
			return i;
		}, fA.prototype.createComplexArray = function() {
			const I = new Array(this._csize);
			for (var A = 0; A < I.length; A++) I[A] = 0;
			return I;
		}, fA.prototype.toComplexArray = function(I, A) {
			for (var i = A || this.createComplexArray(), E = 0; E < i.length; E += 2) i[E] = I[E >>> 1], i[E + 1] = 0;
			return i;
		}, fA.prototype.completeSpectrum = function(I) {
			for (var A = this._csize, i = A >>> 1, E = 2; E < i; E += 2) I[A - E] = I[E], I[A - E + 1] = -I[E + 1];
		}, fA.prototype.transform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._transform4(), this._out = null, this._data = null;
		}, fA.prototype.realTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 0, this._realTransform4(), this._out = null, this._data = null;
		}, fA.prototype.inverseTransform = function(I, A) {
			if (I === A) throw new Error("Input and output buffers must be different");
			this._out = I, this._data = A, this._inv = 1, this._transform4();
			for (var i = 0; i < I.length; i++) I[i] /= this.size;
			this._out = null, this._data = null;
		}, fA.prototype._transform4 = function() {
			var I = this._out, A = this._csize, i = 1 << this._width, E = A / i << 1, C, r, o = this._bitrev;
			if (E === 4) for (C = 0, r = 0; C < A; C += E, r++) {
				const h = o[r];
				this._singleTransform2(C, h, i);
			}
			else for (C = 0, r = 0; C < A; C += E, r++) {
				const h = o[r];
				this._singleTransform4(C, h, i);
			}
			var a = this._inv ? -1 : 1, t = this.table;
			for (i >>= 2; i >= 2; i >>= 2) {
				E = A / i << 1;
				var n = E >>> 2;
				for (C = 0; C < A; C += E) for (var f = C + n, s = C, D = 0; s < f; s += 2, D += i) {
					const h = s, w = h + n, F = w + n, l = F + n, R = I[h], N = I[h + 1], M = I[w], m = I[w + 1], b = I[F], q = I[F + 1], T = I[l], V = I[l + 1], P = R, S = N, G = t[D], Y = a * t[D + 1], v = M * G - m * Y, x = M * Y + m * G, U = t[2 * D], L = a * t[2 * D + 1], j = b * U - q * L, z = b * L + q * U, p = t[3 * D], iA = a * t[3 * D + 1], gA = T * p - V * iA, BA = T * iA + V * p, _ = P + j, IA = S + z, CA = P - j, $ = S - z, AA = v + gA, QA = x + BA, nA = a * (v - gA), aA = a * (x - BA), sA = _ + AA, hA = IA + QA, FA = _ - AA, RA = IA - QA, DA = CA + aA, NA = $ - nA, MA = CA - aA, K = $ + nA;
					I[h] = sA, I[h + 1] = hA, I[w] = DA, I[w + 1] = NA, I[F] = FA, I[F + 1] = RA, I[l] = MA, I[l + 1] = K;
				}
			}
		}, fA.prototype._singleTransform2 = function(I, A, i) {
			const E = this._out, C = this._data, r = C[A], o = C[A + 1], a = C[A + i], t = C[A + i + 1], n = r + a, f = o + t, s = r - a, D = o - t;
			E[I] = n, E[I + 1] = f, E[I + 2] = s, E[I + 3] = D;
		}, fA.prototype._singleTransform4 = function(I, A, i) {
			const E = this._out, C = this._data, r = this._inv ? -1 : 1, o = i * 2, a = i * 3, t = C[A], n = C[A + 1], f = C[A + i], s = C[A + i + 1], D = C[A + o], h = C[A + o + 1], w = C[A + a], F = C[A + a + 1], l = t + D, R = n + h, N = t - D, M = n - h, m = f + w, b = s + F, q = r * (f - w), T = r * (s - F), V = l + m, P = R + b, S = N + T, G = M - q, Y = l - m, v = R - b, x = N - T, U = M + q;
			E[I] = V, E[I + 1] = P, E[I + 2] = S, E[I + 3] = G, E[I + 4] = Y, E[I + 5] = v, E[I + 6] = x, E[I + 7] = U;
		}, fA.prototype._realTransform4 = function() {
			var I = this._out, A = this._csize, i = 1 << this._width, E = A / i << 1, C, r, o = this._bitrev;
			if (E === 4) for (C = 0, r = 0; C < A; C += E, r++) {
				const k = o[r];
				this._singleRealTransform2(C, k >>> 1, i >>> 1);
			}
			else for (C = 0, r = 0; C < A; C += E, r++) {
				const k = o[r];
				this._singleRealTransform4(C, k >>> 1, i >>> 1);
			}
			var a = this._inv ? -1 : 1, t = this.table;
			for (i >>= 2; i >= 2; i >>= 2) {
				E = A / i << 1;
				var n = E >>> 1, f = n >>> 1, s = f >>> 1;
				for (C = 0; C < A; C += E) for (var D = 0, h = 0; D <= s; D += 2, h += i) {
					var w = C + D, F = w + f, l = F + f, R = l + f, N = I[w], M = I[w + 1], m = I[F], b = I[F + 1], q = I[l], T = I[l + 1], V = I[R], P = I[R + 1], S = N, G = M, Y = t[h], v = a * t[h + 1], x = m * Y - b * v, U = m * v + b * Y, L = t[2 * h], j = a * t[2 * h + 1], z = q * L - T * j, p = q * j + T * L, iA = t[3 * h], gA = a * t[3 * h + 1], BA = V * iA - P * gA, _ = V * gA + P * iA, IA = S + z, CA = G + p, $ = S - z, AA = G - p, QA = x + BA, nA = U + _, aA = a * (x - BA), sA = a * (U - _), hA = IA + QA, FA = CA + nA, RA = $ + sA, DA = AA - aA;
					if (I[w] = hA, I[w + 1] = FA, I[F] = RA, I[F + 1] = DA, D === 0) {
						var NA = IA - QA, MA = CA - nA;
						I[l] = NA, I[l + 1] = MA;
						continue;
					}
					if (D !== s) {
						var K = $, rA = -AA, vA = IA, GA = -CA, UA = -a * sA, mA = -a * aA, eA = -a * nA, wA = -a * QA, B = K + UA, g = rA + mA, e = vA + wA, c = GA - eA, d = C + f - D, H = C + n - D;
						I[d] = B, I[d + 1] = g, I[H] = e, I[H + 1] = c;
					}
				}
			}
		}, fA.prototype._singleRealTransform2 = function(I, A, i) {
			const E = this._out, C = this._data, r = C[A], o = C[A + i], a = r + o, t = r - o;
			E[I] = a, E[I + 1] = 0, E[I + 2] = t, E[I + 3] = 0;
		}, fA.prototype._singleRealTransform4 = function(I, A, i) {
			const E = this._out, C = this._data, r = this._inv ? -1 : 1, o = i * 2, a = i * 3, t = C[A], n = C[A + i], f = C[A + o], s = C[A + a], D = t + f, h = t - f, w = n + s, F = r * (n - s), l = D + w, R = h, N = -F, M = D - w, m = h, b = F;
			E[I] = l, E[I + 1] = 0, E[I + 2] = R, E[I + 3] = N, E[I + 4] = M, E[I + 5] = 0, E[I + 6] = m, E[I + 7] = b;
		};
	})), $A, Ag = EA((() => {
		$I(), $A = class {
			constructor(Q) {
				this.size = Q, this.indutnyFft = new fA(Q);
			}
			fft(Q) {
				const I = new Float32Array(2 * this.size);
				return this.indutnyFft.transform(I, Q), I;
			}
		};
	})), DI, Ig = EA((() => {
		DI = (() => {
			var Q = self.location.href;
			return (function(I = {}) {
				var A = I, i, E;
				A.ready = new Promise((B, g) => {
					i = B, E = g;
				});
				var C = Object.assign({}, A), r = !0, o = !1, a = "";
				function t(B) {
					return A.locateFile ? A.locateFile(B, a) : a + B;
				}
				var n;
				(r || o) && (o ? a = self.location.href : typeof document < "u" && document.currentScript && (a = document.currentScript.src), Q && (a = Q), a.indexOf("blob:") !== 0 ? a = a.substr(0, a.replace(/[?#].*/, "").lastIndexOf("/") + 1) : a = "", o && (n = (B) => {
					var g = new XMLHttpRequest();
					return g.open("GET", B, !1), g.responseType = "arraybuffer", g.send(null), new Uint8Array(g.response);
				})), A.print || console.log.bind(console);
				var f = A.printErr || console.error.bind(console);
				Object.assign(A, C), C = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && L("no native wasm support detected");
				var D, h, w = !1, F, l;
				function R() {
					var B = D.buffer;
					A.HEAP8 = F = new Int8Array(B), A.HEAP16 = new Int16Array(B), A.HEAP32 = new Int32Array(B), A.HEAPU8 = l = new Uint8Array(B), A.HEAPU16 = new Uint16Array(B), A.HEAPU32 = new Uint32Array(B), A.HEAPF32 = new Float32Array(B), A.HEAPF64 = new Float64Array(B);
				}
				var N = [], M = [], m = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) V(A.preRun.shift());
					_(N);
				}
				function q() {
					_(M);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) S(A.postRun.shift());
					_(m);
				}
				function V(B) {
					N.unshift(B);
				}
				function P(B) {
					M.unshift(B);
				}
				function S(B) {
					m.unshift(B);
				}
				var G = 0, Y = null, v = null;
				function x(B) {
					G++, A.monitorRunDependencies && A.monitorRunDependencies(G);
				}
				function U(B) {
					if (G--, A.monitorRunDependencies && A.monitorRunDependencies(G), G == 0 && (Y !== null && (clearInterval(Y), Y = null), v)) {
						var g = v;
						v = null, g();
					}
				}
				function L(B) {
					A.onAbort && A.onAbort(B), B = "Aborted(" + B + ")", f(B), w = !0, B += ". Build with -sASSERTIONS for more info.";
					var g = new WebAssembly.RuntimeError(B);
					throw E(g), g;
				}
				var j = "data:application/octet-stream;base64,";
				function z(B) {
					return B.startsWith(j);
				}
				var p = "data:application/octet-stream;base64,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ACACSwRAQbgeIAI2AgALIAIgBmohAUHoISEAAkACQAJAA0AgASAAKAIARwRAIAAoAggiAA0BDAILCyAALQAMQQhxRQ0BC0HoISEAA0AgAyAAKAIAIgFPBEAgASAAKAIEaiIEIANLDQMLIAAoAgghAAwACwALIAAgAjYCACAAIAAoAgQgBmo2AgQgAkF4IAJrQQdxaiIHIAVBA3I2AgQgAUF4IAFrQQdxaiIGIAUgB2oiBWshACADIAZGBEBBwB4gBTYCAEG0HkG0HigCACAAaiIANgIAIAUgAEEBcjYCBAwIC0G8HigCACAGRgRAQbweIAU2AgBBsB5BsB4oAgAgAGoiADYCACAFIABBAXI2AgQgACAFaiAANgIADAgLIAYoAgQiA0EDcUEBRw0GIANBeHEhCSADQf8BTQRAIAYoAgwiASAGKAIIIgJGBEBBqB5BqB4oAgBBfiADQQN2d3E2AgAMBwsgAiABNgIMIAEgAjYCCAwGCyAGKAIYIQggBiAGKAIMIgJHBEAgBigCCCIBIAI2AgwgAiABNgIIDAULIAZBFGoiASgCACIDRQRAIAYoAhAiA0UNBCAGQRBqIQELA0AgASEEIAMiAkEUaiIBKAIAIgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHY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";
				z(p) || (p = t(p));
				function iA(B) {
					if (B == p && s) return new Uint8Array(s);
					var g = mA(B);
					if (g) return g;
					if (n) return n(B);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function gA(B, g) {
					var e, c = iA(B);
					return e = new WebAssembly.Module(c), [new WebAssembly.Instance(e, g), e];
				}
				function BA() {
					var B = { a: MA };
					function g(e, c) {
						var d = e.exports;
						return h = d, D = h.b, R(), h.e, P(h.c), U("wasm-instantiate"), d;
					}
					if (x("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(B, g);
					} catch (e) {
						f("Module.instantiateWasm callback failed with error: " + e), E(e);
					}
					return g(gA(p, B)[0]);
				}
				var _ = (B) => {
					for (; B.length > 0;) B.shift()(A);
				}, IA = (B) => {
					L("OOM");
				}, CA = (B) => {
					l.length, B >>>= 0, IA(B);
				};
				function $(B) {
					return A["_" + B];
				}
				var AA = (B, g) => {
					F.set(B, g);
				}, QA = (B) => {
					for (var g = 0, e = 0; e < B.length; ++e) {
						var c = B.charCodeAt(e);
						c <= 127 ? g++ : c <= 2047 ? g += 2 : c >= 55296 && c <= 57343 ? (g += 4, ++e) : g += 3;
					}
					return g;
				}, nA = (B, g, e, c) => {
					if (!(c > 0)) return 0;
					for (var d = e, H = e + c - 1, k = 0; k < B.length; ++k) {
						var y = B.charCodeAt(k);
						if (y >= 55296 && y <= 57343) {
							var u = B.charCodeAt(++k);
							y = 65536 + ((y & 1023) << 10) | u & 1023;
						}
						if (y <= 127) {
							if (e >= H) break;
							g[e++] = y;
						} else if (y <= 2047) {
							if (e + 1 >= H) break;
							g[e++] = 192 | y >> 6, g[e++] = 128 | y & 63;
						} else if (y <= 65535) {
							if (e + 2 >= H) break;
							g[e++] = 224 | y >> 12, g[e++] = 128 | y >> 6 & 63, g[e++] = 128 | y & 63;
						} else {
							if (e + 3 >= H) break;
							g[e++] = 240 | y >> 18, g[e++] = 128 | y >> 12 & 63, g[e++] = 128 | y >> 6 & 63, g[e++] = 128 | y & 63;
						}
					}
					return g[e] = 0, e - d;
				}, aA = (B, g, e) => nA(B, l, g, e), sA = (B) => {
					var g = QA(B) + 1, e = GA(g);
					return aA(B, e, g), e;
				}, hA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, FA = (B, g, e) => {
					for (var c = g + e, d = g; B[d] && !(d >= c);) ++d;
					if (d - g > 16 && B.buffer && hA) return hA.decode(B.subarray(g, d));
					for (var H = ""; g < d;) {
						var k = B[g++];
						if (!(k & 128)) {
							H += String.fromCharCode(k);
							continue;
						}
						var y = B[g++] & 63;
						if ((k & 224) == 192) {
							H += String.fromCharCode((k & 31) << 6 | y);
							continue;
						}
						var u = B[g++] & 63;
						if ((k & 240) == 224 ? k = (k & 15) << 12 | y << 6 | u : k = (k & 7) << 18 | y << 12 | u << 6 | B[g++] & 63, k < 65536) H += String.fromCharCode(k);
						else {
							var X = k - 65536;
							H += String.fromCharCode(55296 | X >> 10, 56320 | X & 1023);
						}
					}
					return H;
				}, RA = (B, g) => B ? FA(l, B, g) : "", DA = function(B, g, e, c, d) {
					var H = {
						string: (J) => {
							var O = 0;
							return J != null && J !== 0 && (O = sA(J)), O;
						},
						array: (J) => {
							var O = GA(J.length);
							return AA(J, O), O;
						}
					};
					function k(J) {
						return g === "string" ? RA(J) : g === "boolean" ? !!J : J;
					}
					var y = $(B), u = [], X = 0;
					if (c) for (var Z = 0; Z < c.length; Z++) {
						var cA = H[e[Z]];
						cA ? (X === 0 && (X = rA()), u[Z] = cA(c[Z])) : u[Z] = c[Z];
					}
					var yA = y.apply(null, u);
					function uA(J) {
						return X !== 0 && vA(X), k(J);
					}
					return yA = uA(yA), yA;
				}, NA = function(B, g, e, c) {
					var d = !e || e.every((H) => H === "number" || H === "boolean");
					return g !== "string" && d && !c ? $(B) : function() {
						return DA(B, g, e, arguments, c);
					};
				}, MA = { a: CA }, K = BA();
				K.c, A._fftCross = K.d, K.__errno_location, A._malloc = K.f, A._free = K.g;
				var rA = K.h, vA = K.i, GA = K.j;
				function UA(B) {
					try {
						for (var g = atob(B), e = new Uint8Array(g.length), c = 0; c < g.length; ++c) e[c] = g.charCodeAt(c);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function mA(B) {
					if (z(B)) return UA(B.slice(j.length));
				}
				A.ccall = DA, A.cwrap = NA;
				var eA;
				v = function B() {
					eA || wA(), eA || (v = B);
				};
				function wA() {
					if (G > 0 || (b(), G > 0)) return;
					function B() {
						eA || (eA = !0, A.calledRun = !0, !w && (q(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), B();
					}, 1)) : B();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return wA(), I;
			});
		})();
	}));
	function gg(Q) {
		this.size = Q, this.n = Q * 8, this.ptr = bA._malloc(this.n * 4), this.ri = new Uint8Array(bA.HEAPU8.buffer, this.ptr, this.n), this.ii = new Uint8Array(bA.HEAPU8.buffer, this.ptr + this.n, this.n), this.transform = function(I, A, i) {
			var E = this.ptr, C = this.n;
			return this.ri.set(new Uint8Array(I.buffer)), this.ii.set(new Uint8Array(A.buffer)), hI(this.size, i, E, E + C, E + C * 2, E + C * 3), {
				real: new Float64Array(bA.HEAPU8.buffer, E + C * 2, this.size),
				imag: new Float64Array(bA.HEAPU8.buffer, E + C * 3, this.size)
			};
		}, this.dispose = function() {
			bA._free(this.ptr);
		};
	}
	var bA, hI, Bg = EA((() => {
		Ig(), bA = DI({}), hI = bA.cwrap("fftCross", "void", [
			"number",
			"number",
			"number",
			"number",
			"number",
			"number"
		]);
	})), cI, Cg = EA((() => {
		Bg(), cI = class {
			constructor(Q) {
				this.size = Q, this.fftcross = new gg(Q), this.real = new Float64Array(this.size), this.imag = new Float64Array(this.size);
			}
			fft(Q) {
				for (var I = 0; I < this.size; I++) this.real[I] = Q[2 * I], this.imag[I] = Q[2 * I + 1];
				const A = this.fftcross.transform(this.real, this.imag, !1), i = new Float32Array(2 * this.size);
				for (var I = 0; I < this.size; I++) i[2 * I] = A.real[I], i[2 * I + 1] = A.imag[I];
				return i;
			}
		};
	}));
	function Qg(Q) {
		this.n = Q, this.levels = -1;
		for (var I = 0; I < 32; I++) 1 << I == Q && (this.levels = I);
		if (this.levels == -1) throw "Length is not a power of 2";
		this.cosTable = new Array(Q / 2), this.sinTable = new Array(Q / 2);
		for (var I = 0; I < Q / 2; I++) this.cosTable[I] = Math.cos(2 * Math.PI * I / Q), this.sinTable[I] = Math.sin(2 * Math.PI * I / Q);
		this.forward = function(A, i) {
			for (var E = this.n, C = 0; C < E; C++) {
				var r = h(C, this.levels);
				if (r > C) {
					var o = A[C];
					A[C] = A[r], A[r] = o, o = i[C], i[C] = i[r], i[r] = o;
				}
			}
			for (var a = 2; a <= E; a *= 2) for (var t = a / 2, n = E / a, C = 0; C < E; C += a) for (var r = C, f = 0; r < C + t; r++, f += n) {
				var s = A[r + t] * this.cosTable[f] + i[r + t] * this.sinTable[f], D = -A[r + t] * this.sinTable[f] + i[r + t] * this.cosTable[f];
				A[r + t] = A[r] - s, i[r + t] = i[r] - D, A[r] += s, i[r] += D;
			}
			function h(w, F) {
				for (var l = 0, R = 0; R < F; R++) l = l << 1 | w & 1, w >>>= 1;
				return l;
			}
		}, this.inverse = function(A, i) {
			forward(i, A);
		};
	}
	var Eg = EA((() => {})), wI, ig = EA((() => {
		Eg(), wI = class {
			constructor(Q) {
				this.size = Q, this.fftNayuki = new Qg(Q);
			}
			fft(Q) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), i = new Float32Array(this.size * 2);
				for (var E = 0; E < this.size; ++E) I[E] = Q[E * 2], A[E] = Q[E * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var E = 0; E < this.size; ++E) i[E * 2] = I[E], i[E * 2 + 1] = A[E];
				return i;
			}
		};
	})), fI, rg = EA((() => {
		fI = (() => {
			var Q = self.location.href;
			return (function(I = {}) {
				var A = I, i, E;
				A.ready = new Promise((B, g) => {
					i = B, E = g;
				});
				var C = Object.assign({}, A), r = !0, o = !1, a = "";
				function t(B) {
					return A.locateFile ? A.locateFile(B, a) : a + B;
				}
				var n;
				(r || o) && (o ? a = self.location.href : typeof document < "u" && document.currentScript && (a = document.currentScript.src), Q && (a = Q), a.indexOf("blob:") !== 0 ? a = a.substr(0, a.replace(/[?#].*/, "").lastIndexOf("/") + 1) : a = "", o && (n = (B) => {
					var g = new XMLHttpRequest();
					return g.open("GET", B, !1), g.responseType = "arraybuffer", g.send(null), new Uint8Array(g.response);
				})), A.print || console.log.bind(console);
				var f = A.printErr || console.error.bind(console);
				Object.assign(A, C), C = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && L("no native wasm support detected");
				var D, h, w = !1, F, l;
				function R() {
					var B = D.buffer;
					A.HEAP8 = F = new Int8Array(B), A.HEAP16 = new Int16Array(B), A.HEAP32 = new Int32Array(B), A.HEAPU8 = l = new Uint8Array(B), A.HEAPU16 = new Uint16Array(B), A.HEAPU32 = new Uint32Array(B), A.HEAPF32 = new Float32Array(B), A.HEAPF64 = new Float64Array(B);
				}
				var N = [], M = [], m = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) V(A.preRun.shift());
					_(N);
				}
				function q() {
					_(M);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) S(A.postRun.shift());
					_(m);
				}
				function V(B) {
					N.unshift(B);
				}
				function P(B) {
					M.unshift(B);
				}
				function S(B) {
					m.unshift(B);
				}
				var G = 0, Y = null, v = null;
				function x(B) {
					G++, A.monitorRunDependencies && A.monitorRunDependencies(G);
				}
				function U(B) {
					if (G--, A.monitorRunDependencies && A.monitorRunDependencies(G), G == 0 && (Y !== null && (clearInterval(Y), Y = null), v)) {
						var g = v;
						v = null, g();
					}
				}
				function L(B) {
					A.onAbort && A.onAbort(B), B = "Aborted(" + B + ")", f(B), w = !0, B += ". Build with -sASSERTIONS for more info.";
					var g = new WebAssembly.RuntimeError(B);
					throw E(g), g;
				}
				var j = "data:application/octet-stream;base64,";
				function z(B) {
					return B.startsWith(j);
				}
				var p = "data:application/octet-stream;base64,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IgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHYIGohAQJAAkBBrB4oAgAiBEEBIAB0IgZxRQRAQaweIAQgBnI2AgAgASADNgIADAELIAJBGSAAQQF2a0EAIABBH0cbdCEAIAEoAgAhBANAIAQiASgCBEF4cSACRg0CIABBHXYhBCAAQQF0IQAgASAEQQRxaiIGKAIQIgQNAAsgBiADNgIQCyADIAE2AhggAyADNgIMIAMgAzYCCAwBCyABKAIIIgAgAzYCDCABIAM2AgggA0EANgIYIAMgATYCDCADIAA2AggLQbQeKAIAIgAgBU0NAEG0HiAAIAVrIgE2AgBBwB5BwB4oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADAgLQaQeQTA2AgBBACEADAcLQQAhAgsgCEUNAAJAIAYoAhwiAUECdEHYIGoiBCgCACAGRgRAIAQgAjYCACACDQFBrB5BrB4oAgBBfiABd3E2AgAMAgsgCEEQQRQgCCgCECAGRhtqIAI2AgAgAkUNAQsgAiAINgIYIAYoAhAiAQRAIAIgATYCECABIAI2AhgLIAYoAhQiAUUNACACIAE2AhQgASACNgIYCyAAIAlqIQAgBiAJaiIGKAIEIQMLIAYgA0F+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";
				z(p) || (p = t(p));
				function iA(B) {
					if (B == p && s) return new Uint8Array(s);
					var g = mA(B);
					if (g) return g;
					if (n) return n(B);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function gA(B, g) {
					var e, c = iA(B);
					return e = new WebAssembly.Module(c), [new WebAssembly.Instance(e, g), e];
				}
				function BA() {
					var B = { a: MA };
					function g(e, c) {
						var d = e.exports;
						return h = d, D = h.b, R(), h.l, P(h.c), U("wasm-instantiate"), d;
					}
					if (x("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(B, g);
					} catch (e) {
						f("Module.instantiateWasm callback failed with error: " + e), E(e);
					}
					return g(gA(p, B)[0]);
				}
				var _ = (B) => {
					for (; B.length > 0;) B.shift()(A);
				}, IA = (B) => {
					L("OOM");
				}, CA = (B) => {
					l.length, B >>>= 0, IA(B);
				};
				function $(B) {
					return A["_" + B];
				}
				var AA = (B, g) => {
					F.set(B, g);
				}, QA = (B) => {
					for (var g = 0, e = 0; e < B.length; ++e) {
						var c = B.charCodeAt(e);
						c <= 127 ? g++ : c <= 2047 ? g += 2 : c >= 55296 && c <= 57343 ? (g += 4, ++e) : g += 3;
					}
					return g;
				}, nA = (B, g, e, c) => {
					if (!(c > 0)) return 0;
					for (var d = e, H = e + c - 1, k = 0; k < B.length; ++k) {
						var y = B.charCodeAt(k);
						if (y >= 55296 && y <= 57343) {
							var u = B.charCodeAt(++k);
							y = 65536 + ((y & 1023) << 10) | u & 1023;
						}
						if (y <= 127) {
							if (e >= H) break;
							g[e++] = y;
						} else if (y <= 2047) {
							if (e + 1 >= H) break;
							g[e++] = 192 | y >> 6, g[e++] = 128 | y & 63;
						} else if (y <= 65535) {
							if (e + 2 >= H) break;
							g[e++] = 224 | y >> 12, g[e++] = 128 | y >> 6 & 63, g[e++] = 128 | y & 63;
						} else {
							if (e + 3 >= H) break;
							g[e++] = 240 | y >> 18, g[e++] = 128 | y >> 12 & 63, g[e++] = 128 | y >> 6 & 63, g[e++] = 128 | y & 63;
						}
					}
					return g[e] = 0, e - d;
				}, aA = (B, g, e) => nA(B, l, g, e), sA = (B) => {
					var g = QA(B) + 1, e = GA(g);
					return aA(B, e, g), e;
				}, hA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, FA = (B, g, e) => {
					for (var c = g + e, d = g; B[d] && !(d >= c);) ++d;
					if (d - g > 16 && B.buffer && hA) return hA.decode(B.subarray(g, d));
					for (var H = ""; g < d;) {
						var k = B[g++];
						if (!(k & 128)) {
							H += String.fromCharCode(k);
							continue;
						}
						var y = B[g++] & 63;
						if ((k & 224) == 192) {
							H += String.fromCharCode((k & 31) << 6 | y);
							continue;
						}
						var u = B[g++] & 63;
						if ((k & 240) == 224 ? k = (k & 15) << 12 | y << 6 | u : k = (k & 7) << 18 | y << 12 | u << 6 | B[g++] & 63, k < 65536) H += String.fromCharCode(k);
						else {
							var X = k - 65536;
							H += String.fromCharCode(55296 | X >> 10, 56320 | X & 1023);
						}
					}
					return H;
				}, RA = (B, g) => B ? FA(l, B, g) : "", DA = function(B, g, e, c, d) {
					var H = {
						string: (J) => {
							var O = 0;
							return J != null && J !== 0 && (O = sA(J)), O;
						},
						array: (J) => {
							var O = GA(J.length);
							return AA(J, O), O;
						}
					};
					function k(J) {
						return g === "string" ? RA(J) : g === "boolean" ? !!J : J;
					}
					var y = $(B), u = [], X = 0;
					if (c) for (var Z = 0; Z < c.length; Z++) {
						var cA = H[e[Z]];
						cA ? (X === 0 && (X = rA()), u[Z] = cA(c[Z])) : u[Z] = c[Z];
					}
					var yA = y.apply(null, u);
					function uA(J) {
						return X !== 0 && vA(X), k(J);
					}
					return yA = uA(yA), yA;
				}, NA = function(B, g, e, c) {
					var d = !e || e.every((H) => H === "number" || H === "boolean");
					return g !== "string" && d && !c ? $(B) : function() {
						return DA(B, g, e, arguments, c);
					};
				}, MA = { a: CA }, K = BA();
				K.c, A._malloc = K.d, A._free = K.e, A._precalc = K.f, A._precalc_f = K.g, A._dispose = K.h, A._dispose_f = K.i, A._transform_radix2_precalc = K.j, A._transform_radix2_precalc_f = K.k, K.__errno_location;
				var rA = K.m, vA = K.n, GA = K.o;
				function UA(B) {
					try {
						for (var g = atob(B), e = new Uint8Array(g.length), c = 0; c < g.length; ++c) e[c] = g.charCodeAt(c);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function mA(B) {
					if (z(B)) return UA(B.slice(j.length));
				}
				A.ccall = DA, A.cwrap = NA;
				var eA;
				v = function B() {
					eA || wA(), eA || (v = B);
				};
				function wA() {
					if (G > 0 || (b(), G > 0)) return;
					function B() {
						eA || (eA = !0, A.calledRun = !0, !w && (q(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), B();
					}, 1)) : B();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return wA(), I;
			});
		})();
	}));
	function tg(Q) {
		this.n = Q, this.rptr = YA._malloc(Q * 4 + Q * 4), this.iptr = this.rptr + Q * 4, this.rarr = new Float32Array(YA.HEAPU8.buffer, this.rptr, Q), this.iarr = new Float32Array(YA.HEAPU8.buffer, this.iptr, Q), this.tables = lI(Q), this.forward = function(I, A) {
			this.rarr.set(I), this.iarr.set(A), RI(this.rptr, this.iptr, this.n, this.tables), I.set(this.rarr), A.set(this.iarr);
		}, this.dispose = function() {
			YA._free(this.rptr), FI(this.tables);
		};
	}
	var YA, lI, FI, RI, ag = EA((() => {
		rg(), YA = fI({}), YA.cwrap("precalc", "number", ["number"]), YA.cwrap("dispose", "void", ["number"]), YA.cwrap("transform_radix2_precalc", "void", [
			"number",
			"number",
			"number",
			"number"
		]), lI = YA.cwrap("precalc_f", "number", ["number"]), FI = YA.cwrap("dispose_f", "void", ["number"]), RI = YA.cwrap("transform_radix2_precalc_f", "void", [
			"number",
			"number",
			"number",
			"number"
		]);
	})), NI, eg = EA((() => {
		ag(), NI = class {
			constructor(Q) {
				this.size = Q, this.fftNayuki = new tg(Q);
			}
			fft(Q) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), i = new Float32Array(this.size * 2);
				for (var E = 0; E < this.size; ++E) I[E] = Q[E * 2], A[E] = Q[E * 2 + 1];
				this.fftNayuki.forward(I, A);
				for (var E = 0; E < this.size; ++E) i[E * 2] = I[E], i[E * 2 + 1] = A[E];
				return i;
			}
		};
	})), VA, og = EA((() => {
		VA || (VA = {}), (function(Q) {
			"use strict";
			function I(o, a, t, n, f, s) {
				for (var D = f.twiddle, h = 0; h < s; h++) {
					var w = o[2 * (a + t * h)], F = o[2 * (a + t * h) + 1], l = o[2 * (a + t * (h + s))], R = o[2 * (a + t * (h + s)) + 1], N = D[2 * (0 + n * h)], M = D[2 * (0 + n * h) + 1], m = l * N - R * M, b = l * M + R * N, q = w + m, T = F + b, V = w - m, P = F - b;
					o[2 * (a + t * h)] = q, o[2 * (a + t * h) + 1] = T, o[2 * (a + t * (h + s))] = V, o[2 * (a + t * (h + s)) + 1] = P;
				}
			}
			function A(o, a, t, n, f, s) {
				for (var D = f.twiddle, h = s, w = 2 * s, F = n, l = 2 * n, R = D[2 * (0 + n * s) + 1], N = 0; N < s; N++) {
					var M = o[2 * (a + t * N)], m = o[2 * (a + t * N) + 1], b = o[2 * (a + t * (N + h))], q = o[2 * (a + t * (N + h)) + 1], T = D[2 * (0 + F * N)], V = D[2 * (0 + F * N) + 1], P = b * T - q * V, S = b * V + q * T, G = o[2 * (a + t * (N + w))], Y = o[2 * (a + t * (N + w)) + 1], v = D[2 * (0 + l * N)], x = D[2 * (0 + l * N) + 1], U = G * v - Y * x, L = G * x + Y * v, j = P + U, z = S + L, p = M + j, iA = m + z;
					o[2 * (a + t * N)] = p, o[2 * (a + t * N) + 1] = iA;
					var gA = M - j * .5, BA = m - z * .5, _ = (P - U) * R, IA = (S - L) * R, CA = gA - IA, $ = BA + _;
					o[2 * (a + t * (N + h))] = CA, o[2 * (a + t * (N + h)) + 1] = $;
					var AA = gA + IA, QA = BA - _;
					o[2 * (a + t * (N + w))] = AA, o[2 * (a + t * (N + w)) + 1] = QA;
				}
			}
			function i(o, a, t, n, f, s) {
				for (var D = f.twiddle, h = s, w = 2 * s, F = 3 * s, l = n, R = 2 * n, N = 3 * n, M = 0; M < s; M++) {
					var m = o[2 * (a + t * M)], b = o[2 * (a + t * M) + 1], q = o[2 * (a + t * (M + h))], T = o[2 * (a + t * (M + h)) + 1], V = D[2 * (0 + l * M)], P = D[2 * (0 + l * M) + 1], S = q * V - T * P, G = q * P + T * V, Y = o[2 * (a + t * (M + w))], v = o[2 * (a + t * (M + w)) + 1], x = D[2 * (0 + R * M)], U = D[2 * (0 + R * M) + 1], L = Y * x - v * U, j = Y * U + v * x, z = o[2 * (a + t * (M + F))], p = o[2 * (a + t * (M + F)) + 1], iA = D[2 * (0 + N * M)], gA = D[2 * (0 + N * M) + 1], BA = z * iA - p * gA, _ = z * gA + p * iA, IA = m + L, CA = b + j, $ = m - L, AA = b - j, QA = S + BA, nA = G + _, aA = S - BA, sA = G - _, hA = IA + QA, FA = CA + nA;
					if (f.inverse) var RA = $ - sA, DA = AA + aA;
					else var RA = $ + sA, DA = AA - aA;
					var NA = IA - QA, MA = CA - nA;
					if (f.inverse) var K = $ + sA, rA = AA - aA;
					else var K = $ - sA, rA = AA + aA;
					o[2 * (a + t * M)] = hA, o[2 * (a + t * M) + 1] = FA, o[2 * (a + t * (M + h))] = RA, o[2 * (a + t * (M + h)) + 1] = DA, o[2 * (a + t * (M + w))] = NA, o[2 * (a + t * (M + w)) + 1] = MA, o[2 * (a + t * (M + F))] = K, o[2 * (a + t * (M + F)) + 1] = rA;
				}
			}
			function E(o, a, t, n, f, s, D) {
				for (var h = f.twiddle, w = f.n, F = new Float64Array(2 * D), l = 0; l < s; l++) {
					for (var R = 0, N = l; R < D; R++, N += s) {
						var M = o[2 * (a + t * N)], m = o[2 * (a + t * N) + 1];
						F[2 * R] = M, F[2 * R + 1] = m;
					}
					for (var R = 0, N = l; R < D; R++, N += s) {
						var b = 0, M = F[0], m = F[1];
						o[2 * (a + t * N)] = M, o[2 * (a + t * N) + 1] = m;
						for (var q = 1; q < D; q++) {
							b = (b + n * N) % w;
							var T = o[2 * (a + t * N)], V = o[2 * (a + t * N) + 1], P = F[2 * q], S = F[2 * q + 1], G = h[2 * b], Y = h[2 * b + 1], v = P * G - S * Y, x = P * Y + S * G, U = T + v, L = V + x;
							o[2 * (a + t * N)] = U, o[2 * (a + t * N) + 1] = L;
						}
					}
				}
			}
			function C(o, a, t, n, f, s, D, h, w) {
				var F = h.shift(), l = h.shift();
				if (l == 1) for (var R = 0; R < F * l; R++) {
					var N = n[2 * (f + s * D * R)], M = n[2 * (f + s * D * R) + 1];
					o[2 * (a + t * R)] = N, o[2 * (a + t * R) + 1] = M;
				}
				else for (var R = 0; R < F; R++) C(o, a + t * R * l, t, n, f + R * s * D, s * F, D, h.slice(), w);
				switch (F) {
					case 2:
						I(o, a, t, s, w, l);
						break;
					case 3:
						A(o, a, t, s, w, l);
						break;
					case 4:
						i(o, a, t, s, w, l);
						break;
					default:
						E(o, a, t, s, w, l, F);
						break;
				}
			}
			var r = function(t, n) {
				if (arguments.length < 2) throw new RangeError("You didn't pass enough arguments, passed `" + arguments.length + "'");
				var t = ~~t, n = !!n;
				if (t < 1) throw new RangeError("n is outside range, should be positive integer, was `" + t + "'");
				for (var f = {
					n: t,
					inverse: n,
					factors: [],
					twiddle: new Float64Array(2 * t),
					scratch: new Float64Array(2 * t)
				}, s = f.twiddle, D = 2 * Math.PI / t, h = 0; h < t; h++) {
					if (n) var w = D * h;
					else var w = -D * h;
					s[2 * h] = Math.cos(w), s[2 * h + 1] = Math.sin(w);
				}
				for (var F = 4, l = Math.floor(Math.sqrt(t)); t > 1;) {
					for (; t % F;) {
						switch (F) {
							case 4:
								F = 2;
								break;
							case 2:
								F = 3;
								break;
							default:
								F += 2;
								break;
						}
						F > l && (F = t);
					}
					t /= F, f.factors.push(F), f.factors.push(t);
				}
				this.state = f;
			};
			r.prototype.simple = function(o, a, t) {
				this.process(o, 0, 1, a, 0, 1, t);
			}, r.prototype.process = function(o, a, h, n, f, w, D) {
				var h = ~~h, w = ~~w, F = D == "real" ? D : "complex";
				if (h < 1) throw new RangeError("outputStride is outside range, should be positive integer, was `" + h + "'");
				if (w < 1) throw new RangeError("inputStride is outside range, should be positive integer, was `" + w + "'");
				if (F == "real") {
					for (var l = 0; l < this.state.n; l++) {
						var R = n[f + w * l], N = 0;
						this.state.scratch[2 * l] = R, this.state.scratch[2 * l + 1] = N;
					}
					C(o, a, h, this.state.scratch, 0, 1, 1, this.state.factors.slice(), this.state);
				} else if (n == o) {
					C(this.state.scratch, 0, 1, n, f, 1, w, this.state.factors.slice(), this.state);
					for (var l = 0; l < this.state.n; l++) {
						var R = this.state.scratch[2 * l], N = this.state.scratch[2 * l + 1];
						o[2 * (a + h * l)] = R, o[2 * (a + h * l) + 1] = N;
					}
				} else C(o, a, h, n, f, 1, w, this.state.factors.slice(), this.state);
			}, Q.complex = r;
		})(VA);
	})), yI, ng = EA((() => {
		og(), yI = class {
			constructor(Q) {
				this.size = Q, this.nockertfft = new VA.complex(Q, !1);
			}
			fft(Q) {
				const I = new Float32Array(2 * this.size);
				return this.nockertfft.simple(I, Q, "complex"), I;
			}
		};
	}));
	function sg(Q) {
		if (Q !== 0 && (Q & Q - 1) === 0) W = Q, wg(), fg(), lg();
		else throw new Error("init: radix-2 required");
	}
	function jA(Q, I) {
		AI(Q, I, 1);
	}
	function XA(Q, I) {
		let A = 1 / W;
		AI(Q, I, -1);
		for (let i = 0; i < W; i++) Q[i] *= A, I[i] *= A;
	}
	function Dg(Q, I) {
		AI(Q, I, -1);
	}
	function hg(Q, I) {
		let A = [], i = [], E = 0;
		for (let C = 0; C < W; C++) {
			E = C * W;
			for (let r = 0; r < W; r++) A[r] = Q[r + E], i[r] = I[r + E];
			jA(A, i);
			for (let r = 0; r < W; r++) Q[r + E] = A[r], I[r + E] = i[r];
		}
		for (let C = 0; C < W; C++) {
			for (let r = 0; r < W; r++) E = C + r * W, A[r] = Q[E], i[r] = I[E];
			jA(A, i);
			for (let r = 0; r < W; r++) E = C + r * W, Q[E] = A[r], I[E] = i[r];
		}
	}
	function cg(Q, I) {
		let A = [], i = [], E = 0;
		for (let C = 0; C < W; C++) {
			E = C * W;
			for (let r = 0; r < W; r++) A[r] = Q[r + E], i[r] = I[r + E];
			XA(A, i);
			for (let r = 0; r < W; r++) Q[r + E] = A[r], I[r + E] = i[r];
		}
		for (let C = 0; C < W; C++) {
			for (let r = 0; r < W; r++) E = C + r * W, A[r] = Q[E], i[r] = I[E];
			XA(A, i);
			for (let r = 0; r < W; r++) E = C + r * W, Q[E] = A[r], I[E] = i[r];
		}
	}
	function AI(Q, I, A) {
		let i, E, C, r, o, a, t, n, f, s = W >> 2;
		for (let D = 0; D < W; D++) r = LA[D], D < r && (o = Q[D], Q[D] = Q[r], Q[r] = o, o = I[D], I[D] = I[r], I[r] = o);
		for (let D = 1; D < W; D <<= 1) {
			E = 0, i = W / (D << 1);
			for (let h = 0; h < D; h++) {
				a = lA[E + s], t = A * lA[E];
				for (let w = h; w < W; w += D << 1) C = w + D, n = a * Q[C] + t * I[C], f = a * I[C] - t * Q[C], Q[C] = Q[w] - n, Q[w] += n, I[C] = I[w] - f, I[w] += f;
				E += i;
			}
		}
	}
	function wg() {
		typeof Uint32Array < "u" ? LA = new Uint32Array(W) : LA = [], typeof Float64Array < "u" ? lA = new Float64Array(W * 1.25) : lA = [];
	}
	function fg() {
		let Q = 0, I = 0, A = 0;
		for (LA[0] = 0; ++Q < W;) {
			for (A = W >> 1; A <= I;) I -= A, A >>= 1;
			I += A, LA[Q] = I;
		}
	}
	function lg() {
		let Q = W >> 1, I = W >> 2, A = W >> 3, i = Q + I, E = Math.sin(Math.PI / W), C = 2 * E * E, r = Math.sqrt(C * (2 - C)), o = lA[I] = 1, a = lA[0] = 0;
		E = 2 * C;
		for (let t = 1; t < A; t++) o -= C, C += E * o, a += r, r -= E * a, lA[t] = a, lA[I - t] = o;
		A !== 0 && (lA[A] = Math.sqrt(.5));
		for (let t = 0; t < I; t++) lA[Q - t] = lA[t];
		for (let t = 0; t < i; t++) lA[t + Q] = -lA[t];
	}
	var W, LA, lA, MI, Fg = EA((() => {
		W = 0, LA = null, lA = null, MI = {
			init: sg,
			fft1d: jA,
			ifft1d: XA,
			fft2d: hg,
			ifft2d: cg,
			fft: jA,
			ifft: XA,
			bt: Dg
		};
	})), GI, Rg = EA((() => {
		Fg(), GI = class {
			constructor(Q) {
				this.size = Q, this.FFT_mljs = MI, this.FFT_mljs.init(Q);
			}
			fft(Q) {
				const I = new Float32Array(this.size), A = new Float32Array(this.size), i = new Float32Array(2 * this.size);
				for (var E = 0; E < this.size; ++E) I[E] = Q[E * 2], A[E] = Q[E * 2 + 1];
				this.FFT_mljs.fft(I, A);
				for (var E = 0; E < this.size; ++E) i[E * 2] = I[E], i[E * 2 + 1] = A[E];
				return i;
			}
		};
	}));
	async function Ng() {
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
	async function yg() {
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
	async function Mg() {
		let Q = "Other", I = "Unknown", A = "Other", i = "Unknown", E = navigator.userAgentData, C = navigator.userAgent;
		try {
			if (E) {
				const r = await E.getHighEntropyValues([
					"architecture",
					"model",
					"platform",
					"platformVersion",
					"uaFullVersion"
				]), o = E.brands.find((a) => [
					"Microsoft Edge",
					"Google Chrome",
					"Opera"
				].includes(a.brand));
				Q = o ? o.brand : "Other", I = o ? `v${o.version}` : "Unknown", A = r.platform ? r.platform : "Other", i = r.platformVersion ? `v${r.platformVersion}` : "Unknown";
			}
			if (Q === "Other" || A === "Other") {
				const r = C.split(" "), o = r[r.length - 1], a = /Firefox/.test(o), t = /Safari/.test(o) && !/CriOS/.test(o) && !/Chrome/.test(o), n = /CriOS/.test(o) || /Chrome/.test(o), f = /Edg/.test(o), s = /OPR/.test(o), D = [
					{
						name: "Mozilla Firefox",
						regex: /Firefox\/(\d+\.\d+)/,
						flag: a
					},
					{
						name: "Safari",
						regex: /Version\/(\d+\.\d+)/,
						flag: t
					},
					{
						name: "Google Chrome",
						regex: /CriOS|Chrome\/(\d+\.\d+)/,
						flag: n
					},
					{
						name: "Microsoft Edge",
						regex: /Edg\/(\d+\.\d+)/,
						flag: f
					},
					{
						name: "Opera",
						regex: /OPR\/(\d+\.\d+)/,
						flag: s
					}
				];
				for (const R of D) if (R.flag) {
					Q = R.name;
					const N = o.match(R.regex);
					I = N ? N[1] : "Unknown";
					break;
				}
				const h = C.match(/\(([^)]+)\)/), w = h ? h[1].split("; ") : [];
				console.log(h), console.log(w);
				const F = {
					"10.0": "10",
					"6.3": "8.1",
					"6.2": "8",
					"6.1": "7",
					"6.0": "Vista",
					"5.2": "XP 64-bit",
					"5.1": "XP",
					"5.0": "2000"
				}, l = [
					{
						name: "Windows",
						regex: /Windows NT/,
						transform: (R) => F[R.split(" ")[2]],
						index: 0
					},
					{
						name: "Mac OS X",
						regex: /Mac OS X/,
						transform: (R) => R.replace("_", ".").split(" ")[3],
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
						transform: (R) => R.split(" ")[1],
						index: 0
					},
					{
						name: "iOS",
						regex: /iPhone/,
						transform: (R) => R.split(" ")[1].replace("_", "."),
						index: 0
					}
				];
				for (const R of l) if (R.regex.test(w[0])) {
					A = R.name, console.log(`osDetails: ${w}`), i = R.transform ? R.transform(w[1]) : R.versionMap[w[1].split(" ")[R.index]];
					break;
				}
			}
		} catch (r) {
			console.error("Could not retrieve user agent data", r);
		}
		return {
			browserName: Q,
			browserVersion: I,
			osName: A,
			osVersion: i,
			wasm: typeof WebAssembly == "object",
			relaxedSimd: await Ng(),
			simd: await yg()
		};
	}
	var Gg = EA((() => {})), YI, Yg = EA((() => {
		YI = (() => {
			var Q = self.location.href;
			return (function(I = {}) {
				var A = I, i, E;
				A.ready = new Promise((B, g) => {
					i = B, E = g;
				});
				var C = Object.assign({}, A), r = !0, o = !1, a = "";
				function t(B) {
					return A.locateFile ? A.locateFile(B, a) : a + B;
				}
				var n;
				(r || o) && (o ? a = self.location.href : typeof document < "u" && document.currentScript && (a = document.currentScript.src), Q && (a = Q), a.indexOf("blob:") !== 0 ? a = a.substr(0, a.replace(/[?#].*/, "").lastIndexOf("/") + 1) : a = "", o && (n = (B) => {
					var g = new XMLHttpRequest();
					return g.open("GET", B, !1), g.responseType = "arraybuffer", g.send(null), new Uint8Array(g.response);
				})), A.print || console.log.bind(console);
				var f = A.printErr || console.error.bind(console);
				Object.assign(A, C), C = null, A.arguments && A.arguments, A.thisProgram && A.thisProgram, A.quit && A.quit;
				var s;
				A.wasmBinary && (s = A.wasmBinary), A.noExitRuntime, typeof WebAssembly != "object" && L("no native wasm support detected");
				var D, h, w = !1, F, l;
				function R() {
					var B = D.buffer;
					A.HEAP8 = F = new Int8Array(B), A.HEAP16 = new Int16Array(B), A.HEAP32 = new Int32Array(B), A.HEAPU8 = l = new Uint8Array(B), A.HEAPU16 = new Uint16Array(B), A.HEAPU32 = new Uint32Array(B), A.HEAPF32 = new Float32Array(B), A.HEAPF64 = new Float64Array(B);
				}
				var N = [], M = [], m = [];
				function b() {
					if (A.preRun) for (typeof A.preRun == "function" && (A.preRun = [A.preRun]); A.preRun.length;) V(A.preRun.shift());
					_(N);
				}
				function q() {
					_(M);
				}
				function T() {
					if (A.postRun) for (typeof A.postRun == "function" && (A.postRun = [A.postRun]); A.postRun.length;) S(A.postRun.shift());
					_(m);
				}
				function V(B) {
					N.unshift(B);
				}
				function P(B) {
					M.unshift(B);
				}
				function S(B) {
					m.unshift(B);
				}
				var G = 0, Y = null, v = null;
				function x(B) {
					G++, A.monitorRunDependencies && A.monitorRunDependencies(G);
				}
				function U(B) {
					if (G--, A.monitorRunDependencies && A.monitorRunDependencies(G), G == 0 && (Y !== null && (clearInterval(Y), Y = null), v)) {
						var g = v;
						v = null, g();
					}
				}
				function L(B) {
					A.onAbort && A.onAbort(B), B = "Aborted(" + B + ")", f(B), w = !0, B += ". Build with -sASSERTIONS for more info.";
					var g = new WebAssembly.RuntimeError(B);
					throw E(g), g;
				}
				var j = "data:application/octet-stream;base64,";
				function z(B) {
					return B.startsWith(j);
				}
				var p = "data:application/octet-stream;base64,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";
				z(p) || (p = t(p));
				function iA(B) {
					if (B == p && s) return new Uint8Array(s);
					var g = mA(B);
					if (g) return g;
					if (n) return n(B);
					throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
				}
				function gA(B, g) {
					var e, c = iA(B);
					return e = new WebAssembly.Module(c), [new WebAssembly.Instance(e, g), e];
				}
				function BA() {
					var B = { a: MA };
					function g(e, c) {
						var d = e.exports;
						return h = d, D = h.b, R(), h.i, P(h.c), U("wasm-instantiate"), d;
					}
					if (x("wasm-instantiate"), A.instantiateWasm) try {
						return A.instantiateWasm(B, g);
					} catch (e) {
						f("Module.instantiateWasm callback failed with error: " + e), E(e);
					}
					return g(gA(p, B)[0]);
				}
				var _ = (B) => {
					for (; B.length > 0;) B.shift()(A);
				}, IA = (B) => {
					L("OOM");
				}, CA = (B) => {
					l.length, B >>>= 0, IA(B);
				};
				function $(B) {
					return A["_" + B];
				}
				var AA = (B, g) => {
					F.set(B, g);
				}, QA = (B) => {
					for (var g = 0, e = 0; e < B.length; ++e) {
						var c = B.charCodeAt(e);
						c <= 127 ? g++ : c <= 2047 ? g += 2 : c >= 55296 && c <= 57343 ? (g += 4, ++e) : g += 3;
					}
					return g;
				}, nA = (B, g, e, c) => {
					if (!(c > 0)) return 0;
					for (var d = e, H = e + c - 1, k = 0; k < B.length; ++k) {
						var y = B.charCodeAt(k);
						if (y >= 55296 && y <= 57343) {
							var u = B.charCodeAt(++k);
							y = 65536 + ((y & 1023) << 10) | u & 1023;
						}
						if (y <= 127) {
							if (e >= H) break;
							g[e++] = y;
						} else if (y <= 2047) {
							if (e + 1 >= H) break;
							g[e++] = 192 | y >> 6, g[e++] = 128 | y & 63;
						} else if (y <= 65535) {
							if (e + 2 >= H) break;
							g[e++] = 224 | y >> 12, g[e++] = 128 | y >> 6 & 63, g[e++] = 128 | y & 63;
						} else {
							if (e + 3 >= H) break;
							g[e++] = 240 | y >> 18, g[e++] = 128 | y >> 12 & 63, g[e++] = 128 | y >> 6 & 63, g[e++] = 128 | y & 63;
						}
					}
					return g[e] = 0, e - d;
				}, aA = (B, g, e) => nA(B, l, g, e), sA = (B) => {
					var g = QA(B) + 1, e = GA(g);
					return aA(B, e, g), e;
				}, hA = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0, FA = (B, g, e) => {
					for (var c = g + e, d = g; B[d] && !(d >= c);) ++d;
					if (d - g > 16 && B.buffer && hA) return hA.decode(B.subarray(g, d));
					for (var H = ""; g < d;) {
						var k = B[g++];
						if (!(k & 128)) {
							H += String.fromCharCode(k);
							continue;
						}
						var y = B[g++] & 63;
						if ((k & 224) == 192) {
							H += String.fromCharCode((k & 31) << 6 | y);
							continue;
						}
						var u = B[g++] & 63;
						if ((k & 240) == 224 ? k = (k & 15) << 12 | y << 6 | u : k = (k & 7) << 18 | y << 12 | u << 6 | B[g++] & 63, k < 65536) H += String.fromCharCode(k);
						else {
							var X = k - 65536;
							H += String.fromCharCode(55296 | X >> 10, 56320 | X & 1023);
						}
					}
					return H;
				}, RA = (B, g) => B ? FA(l, B, g) : "", DA = function(B, g, e, c, d) {
					var H = {
						string: (J) => {
							var O = 0;
							return J != null && J !== 0 && (O = sA(J)), O;
						},
						array: (J) => {
							var O = GA(J.length);
							return AA(J, O), O;
						}
					};
					function k(J) {
						return g === "string" ? RA(J) : g === "boolean" ? !!J : J;
					}
					var y = $(B), u = [], X = 0;
					if (c) for (var Z = 0; Z < c.length; Z++) {
						var cA = H[e[Z]];
						cA ? (X === 0 && (X = rA()), u[Z] = cA(c[Z])) : u[Z] = c[Z];
					}
					var yA = y.apply(null, u);
					function uA(J) {
						return X !== 0 && vA(X), k(J);
					}
					return yA = uA(yA), yA;
				}, NA = function(B, g, e, c) {
					var d = !e || e.every((H) => H === "number" || H === "boolean");
					return g !== "string" && d && !c ? $(B) : function() {
						return DA(B, g, e, arguments, c);
					};
				}, MA = { a: CA }, K = BA();
				K.c, A._kiss_fft_free = K.d, A._free = K.e, A._kiss_fft_alloc = K.f, A._malloc = K.g, A._kiss_fft = K.h, K.__errno_location;
				var rA = K.j, vA = K.k, GA = K.l;
				function UA(B) {
					try {
						for (var g = atob(B), e = new Uint8Array(g.length), c = 0; c < g.length; ++c) e[c] = g.charCodeAt(c);
						return e;
					} catch {
						throw new Error("Converting base64 string to bytes failed.");
					}
				}
				function mA(B) {
					if (z(B)) return UA(B.slice(j.length));
				}
				A.ccall = DA, A.cwrap = NA;
				var eA;
				v = function B() {
					eA || wA(), eA || (v = B);
				};
				function wA() {
					if (G > 0 || (b(), G > 0)) return;
					function B() {
						eA || (eA = !0, A.calledRun = !0, !w && (q(), i(A), A.onRuntimeInitialized && A.onRuntimeInitialized(), T()));
					}
					A.setStatus ? (A.setStatus("Running..."), setTimeout(function() {
						setTimeout(function() {
							A.setStatus("");
						}, 1), B();
					}, 1)) : B();
				}
				if (A.preInit) for (typeof A.preInit == "function" && (A.preInit = [A.preInit]); A.preInit.length > 0;) A.preInit.pop()();
				return wA(), I;
			});
		})();
	})), dA, II, kI, gI, dI, kg = EA((() => {
		Yg(), dA = YI({}), II = dA.cwrap("kiss_fft_alloc", "number", [
			"number",
			"number",
			"number",
			"number"
		]), kI = dA.cwrap("kiss_fft", "void", [
			"number",
			"number",
			"number"
		]), gI = dA.cwrap("kiss_fft_free", "void", ["number"]), dI = class {
			constructor(Q) {
				this.size = Q, this.fcfg = II(Q, !1), this.icfg = II(Q, !0), this.inptr = dA._malloc(Q * 8 + Q * 8), this.cin = new Float32Array(dA.HEAPU8.buffer, this.inptr, Q * 2);
			}
			fft = function(Q) {
				const I = dA._malloc(this.size * 8), A = new Float32Array(dA.HEAPU8.buffer, I, this.size * 2);
				this.cin.set(Q), kI(this.fcfg, this.inptr, I);
				let i = new Float32Array(this.size * 2);
				return i.set(A), dA._free(I), i;
			};
			dispose() {
				gI(this.fcfg), gI(this.icfg), dA._free(this.inptr);
			}
		};
	}));
	function ZA(Q) {
		this.size = Q, this._csize = Q << 1;
		for (var I = new Array(this.size * 2), A = 0; A < I.length; A += 2) {
			const a = Math.PI * A / this.size;
			I[A] = Math.cos(a), I[A + 1] = -Math.sin(a);
		}
		this.table = I;
		for (var i = 0, E = 1; this.size > E; E <<= 1) i++;
		this._width = i % 2 === 0 ? i - 1 : i, this._bitrev = new Array(1 << this._width);
		for (var C = 0; C < this._bitrev.length; C++) {
			this._bitrev[C] = 0;
			for (var r = 0; r < this._width; r += 2) {
				var o = this._width - r - 2;
				this._bitrev[C] |= (C >>> r & 3) << o;
			}
		}
		this._data = null;
	}
	var dg = EA((() => {
		ZA.prototype.fft = function(I) {
			this._data = I, this._out = new Float32Array(2 * this.size);
			var A = this._csize, i = 1 << this._width, E = A / i << 1, C, r, o = this._bitrev;
			if (E === 4) for (C = 0, r = 0; C < A; C += E, r++) {
				const s = o[r];
				this._singleTransform2(C, s, i);
			}
			else for (C = 0, r = 0; C < A; C += E, r++) {
				const s = o[r];
				this._singleTransform4(C, s, i);
			}
			for (i >>= 2; i >= 2; i >>= 2) {
				E = A / i << 1;
				var a = E >>> 2;
				for (C = 0; C < A; C += E) for (var t = C + a, n = C, f = 0; n < t; n += 2, f += i) {
					const s = n, D = s + a, h = D + a, w = h + a, F = this._out[s], l = this._out[s + 1], R = this._out[D], N = this._out[D + 1], M = this._out[h], m = this._out[h + 1], b = this._out[w], q = this._out[w + 1], T = F, V = l, P = this.table[f], S = this.table[f + 1], G = R * P - N * S, Y = R * S + N * P, v = this.table[2 * f], x = this.table[2 * f + 1], U = M * v - m * x, L = M * x + m * v, j = this.table[3 * f], z = this.table[3 * f + 1], p = b * j - q * z, iA = b * z + q * j, gA = T + U, BA = V + L, _ = T - U, IA = V - L, CA = G + p, $ = Y + iA, AA = G - p, QA = Y - iA;
					this._out[s] = gA + CA, this._out[s + 1] = BA + $, this._out[D] = _ + QA, this._out[D + 1] = IA - AA, this._out[h] = gA - CA, this._out[h + 1] = BA - $, this._out[w] = _ - QA, this._out[w + 1] = IA + AA;
				}
			}
			return this._out;
		}, ZA.prototype._singleTransform2 = function(I, A, i) {
			const E = this._data[A], C = this._data[A + 1], r = this._data[A + i], o = this._data[A + i + 1];
			this._out[I] = E + r, this._out[I + 1] = C + o, this._out[I + 2] = E - r, this._out[I + 3] = C - o;
		}, ZA.prototype._singleTransform4 = function(I, A, i) {
			const E = i * 2, C = i * 3, r = this._data[A], o = this._data[A + 1], a = this._data[A + i], t = this._data[A + i + 1], n = this._data[A + E], f = this._data[A + E + 1], s = this._data[A + C], D = this._data[A + C + 1], h = r + n, w = o + f, F = r - n, l = o - f, R = a + s, N = t + D, M = a - s, m = t - D;
			this._out[I] = h + R, this._out[I + 1] = w + N, this._out[I + 2] = F + m, this._out[I + 3] = l - M, this._out[I + 4] = h - R, this._out[I + 5] = w - N, this._out[I + 6] = F - m, this._out[I + 7] = l + M;
		};
	})), Ug = KI({ default: () => UI }), BI, UI, Sg = EA((() => {
		_I(), Ag(), Cg(), ig(), eg(), ng(), Rg(), Gg(), kg(), dg(), BI = [
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
		], UI = class {
			constructor(Q = 128, I = "indutnyJavascript", A = !0) {
				if (!BI.includes(Q)) throw new Error("Size must be a power of 2 between 4 and 131072");
				this.size = Q, this.outputArr = new Float32Array(2 * Q), this.subLibrary = I, this.fftLibrary = void 0;
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
			setSubLibrary(Q) {
				switch (Q) {
					case "nayukiJavascript":
						this.fftLibrary = new wI(this.size);
						break;
					case "nayuki3Wasm":
						this.fftLibrary = new NI(this.size);
						break;
					case "kissWasm":
						this.fftLibrary = new sI(this.size);
						break;
					case "crossWasm":
						this.fftLibrary = new cI(this.size), this.size > 16384 && (this.fftLibrary = new $A(this.size));
						break;
					case "nockertJavascript":
						this.fftLibrary = new yI(this.size);
						break;
					case "indutnyJavascript":
						this.fftLibrary = new $A(this.size);
						break;
					case "mljsJavascript":
						this.fftLibrary = new GI(this.size);
						break;
					case "kissfftmodifiedWasm":
						this.fftLibrary = new dI(this.size);
						break;
					case "indutnyModifiedJavascript":
						this.fftLibrary = new ZA(this.size);
						break;
					default: throw new Error("Invalid sublibrary");
				}
			}
			fft(Q) {
				if (Q.length !== 2 * this.size) throw new Error("Input array length must be == 2 * size");
				return this.outputArr = this.fftLibrary.fft(Q), this.outputArr;
			}
			fftr(Q) {
				var { outputArr: I, fftLibrary: A, size: i } = this;
				if (Q.length !== i) throw new Error("Input array length must be == size");
				const E = new Float32Array(2 * i);
				E.fill(0);
				for (let C = 0; C < i; C++) E[2 * C] = Q[C];
				return I = A.fft(E), I.slice(i, i * 2);
			}
			fft2d(Q) {
				const I = Q[0].length / 2, A = Q.length;
				if (I !== this.size) throw new Error("Inner array length must be == 2 * size");
				if (!BI.includes(A)) throw new Error("Outter array length must be a power of 2 between 4 and 131072");
				let i = [];
				for (let r = 0; r < A; r++) this.outputArr = this.fft(Q[r]), i.push(this.outputArr);
				this.dispose(), this.size = A, this.setSubLibrary(this.subLibrary);
				let E = [];
				for (let r = 0; r < I; r++) {
					const o = new Float32Array(2 * A);
					o.fill(0);
					for (let t = 0; t < A; t++) o[2 * t] = i[t][2 * r], o[2 * t + 1] = i[t][2 * r + 1];
					let a = new Float32Array(2 * A);
					a = this.fft(o), E.push(a);
				}
				let C = [];
				for (let r = 0; r < A; r++) {
					let o = new Float32Array(2 * I);
					for (let a = 0; a < I; a++) o[2 * a] = E[a][2 * r], o[2 * a + 1] = E[a][2 * r + 1];
					C.push(o);
				}
				return this.dispose(), this.size = I, this.setSubLibrary(this.subLibrary), C;
			}
			profile(Q = 1, I = !0, A = !1) {
				if (!I && this.getCurrentProfile()) return this.getCurrentProfile();
				const i = performance.now();
				let E;
				A ? E = this.availableSubLibrariesQuick() : E = this.availableSubLibraries();
				let C = [];
				const r = Q / E.length / 2;
				for (let n = 0; n < E.length; n++) {
					this.setSubLibrary(E[n]);
					const f = new Float32Array(2 * this.size);
					for (let h = 0; h < this.size; h++) f[2 * h] = Math.random() - .5, f[2 * h + 1] = Math.random() - .5;
					let s = performance.now();
					for (; (performance.now() - s) / 1e3 < r;) this.fft(f);
					s = performance.now();
					let D = 0;
					for (; (performance.now() - s) / 1e3 < r;) this.fft(f), D++;
					C.push(1e3 * D / (performance.now() - s)), this.dispose();
				}
				const o = (performance.now() - i) / 1e3;
				let a = C.indexOf(Math.max(...C));
				const t = {
					fftsPerSecond: C,
					subLibraries: E,
					totalElapsed: o,
					fastestSubLibrary: E[a]
				};
				return console.log("Setting sublibrary to", t.fastestSubLibrary), this.setSubLibrary(t.fastestSubLibrary), typeof localStorage < "u" && localStorage.setItem("webfftProfile", JSON.stringify(t)), t;
			}
			async checkBrowserCapabilities() {
				return await Mg();
			}
			dispose() {
				this.fftLibrary && this.fftLibrary.dispose !== void 0 && this.fftLibrary.dispose();
			}
		};
	}));
	let JA = null, SI = 0;
	async function Hg(Q) {
		try {
			const { default: I } = await Promise.resolve().then(() => (Sg(), Ug));
			JA = new I(Q), await JA.profile(), SI = Q, console.log("[dspWorker] WebFFT initialized:", JA.toString());
		} catch (I) {
			console.warn("[dspWorker] WebFFT not available, using Radix-2 fallback:", I), JA = null;
		}
	}
	function vg(Q, I, A, i) {
		let E = -2 * Math.PI * Q * .0014;
		for (let C = 0; C < A.length; C++) {
			const r = A[C];
			if (r.gain !== 0 || ![
				"peaking",
				"low_shelf",
				"high_shelf"
			].includes(r.type)) {
				const o = r.freq, a = r.gain, t = r.q, n = Math.pow(10, a / 40), f = 2 * Math.PI * o / 48e3, s = Math.sin(f), D = Math.cos(f);
				let h = 0, w = 0, F = 0, l = 1, R = 0, N = 0;
				if (r.type === "peaking") {
					const Y = s / (2 * t);
					h = 1 + Y * n, w = -2 * D, F = 1 - Y * n, l = 1 + Y / n, R = -2 * D, N = 1 - Y / n;
				} else if (r.type === "low_shelf" || r.type === "lowshelf") {
					const Y = s / 2 * Math.sqrt((n + 1 / n) * (1 / t - 1) + 2), v = 2 * Math.sqrt(n) * Y;
					h = n * (n + 1 - (n - 1) * D + v), w = 2 * n * (n - 1 - (n + 1) * D), F = n * (n + 1 - (n - 1) * D - v), l = n + 1 + (n - 1) * D + v, R = -2 * (n - 1 + (n + 1) * D), N = n + 1 + (n - 1) * D - v;
				} else if (r.type === "high_shelf" || r.type === "highshelf") {
					const Y = s / 2 * Math.sqrt((n + 1 / n) * (1 / t - 1) + 2), v = 2 * Math.sqrt(n) * Y;
					h = n * (n + 1 + (n - 1) * D + v), w = -2 * n * (n - 1 + (n + 1) * D), F = n * (n + 1 + (n - 1) * D - v), l = n + 1 - (n - 1) * D + v, R = 2 * (n - 1 - (n + 1) * D), N = n + 1 - (n - 1) * D - v;
				} else if (r.type === "lowpass") {
					const Y = s / (2 * t);
					h = (1 - D) / 2, w = 1 - D, F = (1 - D) / 2, l = 1 + Y, R = -2 * D, N = 1 - Y;
				} else if (r.type === "highpass") {
					const Y = s / (2 * t);
					h = (1 + D) / 2, w = -(1 + D), F = (1 + D) / 2, l = 1 + Y, R = -2 * D, N = 1 - Y;
				} else if (r.type === "notch") {
					const Y = s / (2 * t);
					h = 1, w = -2 * D, F = 1, l = 1 + Y, R = -2 * D, N = 1 - Y;
				} else if (r.type === "bandpass") {
					const Y = s / (2 * t);
					h = Y, w = 0, F = -Y, l = 1 + Y, R = -2 * D, N = 1 - Y;
				} else {
					const Y = s / (2 * t);
					h = 1 + Y * n, w = -2 * D, F = 1 - Y * n, l = 1 + Y / n, R = -2 * D, N = 1 - Y / n;
				}
				const M = 2 * Math.PI * Q / 48e3, m = Math.cos(M), b = Math.sin(M), q = Math.cos(2 * M), T = Math.sin(2 * M), V = -(w * b + F * T), P = h + w * m + F * q, S = -(R * b + N * T), G = l + R * m + N * q;
				E += Math.atan2(V, P) - Math.atan2(S, G);
			}
		}
		if (i) {
			for (const C of i) if (C.enabled) {
				const r = C.frequency, o = C.gain, a = C.q, t = Math.pow(10, o / 40), n = 2 * Math.PI * r / 48e3, f = Math.sin(n), s = Math.cos(n);
				let D = 0, h = 0, w = 0, F = 0, l = 0, R = 0;
				if (C.type === "peaking") {
					const G = f / (2 * a);
					D = 1 + G * t, h = -2 * s, w = 1 - G * t, F = 1 + G / t, l = -2 * s, R = 1 - G / t;
				} else if (C.type === "lowshelf") {
					const G = f / 2 * Math.sqrt((t + 1 / t) * (1 / a - 1) + 2), Y = 2 * Math.sqrt(t) * G;
					D = t * (t + 1 - (t - 1) * s + Y), h = 2 * t * (t - 1 - (t + 1) * s), w = t * (t + 1 - (t - 1) * s - Y), F = t + 1 + (t - 1) * s + Y, l = -2 * (t - 1 + (t + 1) * s), R = t + 1 + (t - 1) * s - Y;
				} else if (C.type === "highshelf") {
					const G = f / 2 * Math.sqrt((t + 1 / t) * (1 / a - 1) + 2), Y = 2 * Math.sqrt(t) * G;
					D = t * (t + 1 + (t - 1) * s + Y), h = -2 * t * (t - 1 + (t + 1) * s), w = t * (t + 1 - (t - 1) * s - Y), F = t + 1 - (t - 1) * s + Y, l = 2 * (t - 1 - (t + 1) * s), R = t + 1 - (t - 1) * s - Y;
				}
				const N = 2 * Math.PI * Q / 48e3, M = Math.cos(N), m = Math.sin(N), b = Math.cos(2 * N), q = Math.sin(2 * N), T = -(h * m + w * q), V = D + h * M + w * b, P = -(l * m + R * q), S = F + l * M + R * b;
				E += Math.atan2(T, V) - Math.atan2(P, S);
			}
		}
		return I && (E += (Math.random() - .5) * .04), E;
	}
	function mg(Q, I, A) {
		let i = .98;
		Q < 45 && (i -= .35 * (1 - Q / 45)), Q > 16e3 && (i -= .12 * (Q - 16e3) / 4e3);
		for (let E = 0; E < A.length; E++) {
			const C = A[E];
			if (C.gain < -5) {
				const r = Math.abs(Math.log2(Q / C.freq));
				r < .25 && (i -= .18 * (1 - r / .25));
			}
			if (C.type === "lowpass" && Q > C.freq) {
				const r = Math.log2(Q / C.freq);
				i -= Math.min(.4, r * .15);
			} else if (C.type === "highpass" && Q < C.freq) {
				const r = Math.log2(C.freq / Q);
				i -= Math.min(.4, r * .15);
			} else if (C.type === "notch") {
				const r = Math.abs(Math.log2(Q / C.freq));
				r < .15 && (i -= .25 * (1 - r / .15));
			}
		}
		return I && (i += (Math.random() - .5) * .015), Math.max(.01, Math.min(1, i));
	}
	function ug(Q, I) {
		if (!I || I.length === 0) return 0;
		if (Q <= I[0].frequency) return I[0].gain;
		if (Q >= I[I.length - 1].frequency) return I[I.length - 1].gain;
		let A = 0, i = I.length - 1;
		for (; i - A > 1;) {
			const s = A + i >> 1;
			I[s].frequency > Q ? i = s : A = s;
		}
		const E = I[A].frequency, C = I[A].gain, r = I[i].frequency, o = I[i].gain, a = Math.log10(Q), t = Math.log10(E), n = Math.log10(r), f = (a - t) / (n - t || 1);
		return C * (1 - f) + o * f;
	}
	let tA, oA, SA, HA, HI, vI, qA, pA, mI, uI, CI, OA, QI, EI, KA, iI, rI, tI, WA, PA, bI = 0, JI = 0, TA = null;
	const bg = new OI();
	self.onmessage = (Q) => {
		if (Q.data && Q.data.type === "run-dsp") {
			const { liveData: I, BINS: A, FFT_SIZE: i, eqResponseCache: E, eqBands: C, calibrationFilters: r, calibrationPoints: o, inputGain: a, displayOffset: t, isMeasuring: n, metrics: f, weightingType: s, averagingType: D, averagingDepth: h, averagingAlpha: w, windowType: F, enableSourceWindow: l, sourceWindowWidthMs: R, sourceWindowOffsetMs: N } = Q.data;
			i && i !== SI && Hg(i), (A !== bI || i !== JI) && (bI = A, JI = i, tA = new Float32Array(A), oA = new Float32Array(A), SA = new Float32Array(A), HA = new Float32Array(A), HI = new Float32Array(A), vI = new Float32Array(A), qA = new Float32Array(i), pA = new Float32Array(i), mI = new Float32Array(i), uI = new Float32Array(i), CI = new Float32Array(A), OA = new Float32Array(A), QI = new Float32Array(A), EI = new Float32Array(A), KA = new Float32Array(i), iI = new Float32Array(i), rI = new Float32Array(A), tI = new Float32Array(A), WA = new Float32Array(A), PA = new Float32Array(A), TA = new jI(A, h || 16)), TA && TA.setDepth(h || 16);
			const M = new Set(f), m = I ? new Float32Array(I) : null;
			for (let S = 0; S < A; S++) {
				const G = S * (24e3 / A) || 1e-6, Y = -50 + Math.sin(S * .05) * .5, v = Math.pow(10, Y / 20), x = 0;
				let U = -50;
				if (m && m.length > 0) U = m[Math.floor(S * m.length / A)] || -120, U += a || 0, U -= ug(G, o), U += eI(G, s || "Z"), U += t || 0;
				else {
					const z = 24e3 / A;
					U = -50 + (E[Math.max(0, Math.min(A - 1, Math.round(G / z)))] || 0) + Math.sin(S * .08) * .3, U += eI(G, s || "Z"), U += t || 0;
				}
				const L = Math.pow(10, U / 20), j = vg(G, n, C, r) + x;
				tA[S] = L * Math.cos(j), oA[S] = L * Math.sin(j), SA[S] = v * Math.cos(x), HA[S] = v * Math.sin(x), QI[S] = mg(G, n, C);
			}
			TA && D !== "None" && (D === "FIFO" ? (TA.processFIFO(tA, oA, WA, PA), tA.set(WA), oA.set(PA)) : D === "LPF" && (TA.processLPF(tA, oA, WA, PA, w || .1), tA.set(WA), oA.set(PA)));
			let b = 0;
			for (let S = 0; S < A; S++) {
				const G = Math.sqrt(tA[S] * tA[S] + oA[S] * oA[S]);
				G > b && (b = G);
			}
			const q = 20 * Math.log10(b || 1e-6), T = M.has("Magnitude") || M.has("Spectrum") || M.has("Spectrogram") || M.has("Impulse") || M.has("Step"), V = M.has("Phase") || M.has("Group Delay"), P = M.has("Impulse") || M.has("Step");
			if (T && WI(tA, oA, SA, HA, CI, HI, vI), V && PI(tA, oA, SA, HA, OA), M.has("Crest Factor")) for (let S = 0; S < A; S++) {
				const G = Math.sqrt(tA[S] * tA[S] + oA[S] * oA[S]), Y = 20 * Math.log10(G + 1e-12);
				let v = 0, x = 0;
				for (let L = Math.max(0, S - 2); L <= Math.min(A - 1, S + 2); L++) {
					const j = Math.sqrt(tA[L] * tA[L] + oA[L] * oA[L]);
					v += j * j, x++;
				}
				const U = 10 * Math.log10(v / x + 1e-24);
				tI[S] = Math.max(0, Math.min(30, Y - U));
			}
			if (P) {
				if (JA && JA.size === i) {
					const S = tA.length, G = S * 2, Y = 1e-10;
					for (let U = 0; U < S; U++) {
						const L = SA[U] * SA[U] + HA[U] * HA[U] + Y, j = (tA[U] * SA[U] + oA[U] * HA[U]) / L, z = (oA[U] * SA[U] - tA[U] * HA[U]) / L;
						qA[U] = j, pA[U] = z;
					}
					for (let U = 1; U < S; U++) qA[G - U] = qA[U], pA[G - U] = -pA[U];
					const v = new Float32Array(G * 2);
					for (let U = 0; U < G; U++) v[U * 2] = qA[U], v[U * 2 + 1] = -pA[U];
					const x = JA.fft(v);
					for (let U = 0; U < G; U++) KA[U] = x[U * 2] / G;
				} else XI(tA, oA, SA, HA, KA, qA, pA, mI, uI);
				l && ZI(KA, R, N, 48e3), F !== "Rectangular" && bg.apply(KA, F);
			}
			if (M.has("Step") && xI(KA, iI), M.has("Group Delay")) {
				for (let S = 0; S < A; S++) rI[S] = OA[S] * Math.PI / 180;
				VI(rI, 24e3 / A, EI);
			}
			self.postMessage({
				type: "dsp-results",
				outputMagnitude: CI.slice().buffer,
				outputPhase: OA.slice().buffer,
				outputCoherence: QI.slice().buffer,
				outputGroupDelay: EI.slice().buffer,
				outputImpulse: KA.slice().buffer,
				outputStep: iI.slice().buffer,
				outputCrestFactor: tI.slice().buffer,
				dbIn: q
			});
		}
	};
})();
