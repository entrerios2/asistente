(function() {
	self.onmessage = (r) => {
		const { sab: l, sampleRate: h, blockSize: p } = r.data;
		if (!l) return;
		const t = new Float32Array(l), i = .99, n = () => {
			let s = 0, o = 0, c = 0;
			for (let a = 0; a < t.length; a++) {
				const e = Math.abs(t[a]);
				e > s && (s = e), o += e * e, e >= i && c++;
			}
			const f = Math.sqrt(o / t.length);
			c > t.length * .05 && self.postMessage({
				type: "CLIPPING_DETECTED",
				peak: s
			}), self.postMessage({
				type: "STATS",
				rms: f,
				peak: s
			}), setTimeout(n, 100);
		};
		n();
	};
})();
