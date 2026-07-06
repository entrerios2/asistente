/**
 * FastPathWorker: Monitorea el SharedArrayBuffer en tiempo real.
 */
self.onmessage = (event) => {
    const { sab, sampleRate, blockSize } = event.data;
    if (!sab) return;

    const sharedArray = new Float32Array(sab);
    const threshold = 0.99; // Umbral de clipping
    let lastReadIndex = 0;

    const check = () => {
        // En una implementación real, necesitaríamos el writeIndex del Worklet.
        // Como no lo tenemos de forma reactiva simple aquí, leemos el buffer completo
        // o esperamos a ser notificados del progreso.
        // Simplificación: Escaneamos el buffer buscando picos.
        
        let maxPeak = 0;
        let sumSq = 0;
        let clippingCount = 0;

        // Solo procesamos un fragmento para no saturar el hilo del worker
        for (let i = 0; i < sharedArray.length; i++) {
            const val = Math.abs(sharedArray[i]);
            if (val > maxPeak) maxPeak = val;
            sumSq += val * val;
            if (val >= threshold) clippingCount++;
        }

        const rms = Math.sqrt(sumSq / sharedArray.length);

        if (clippingCount > (sharedArray.length * 0.05)) { // > 5% de clipping
            self.postMessage({ type: 'CLIPPING_DETECTED', peak: maxPeak });
        }

        self.postMessage({ type: 'STATS', rms, peak: maxPeak });

        // Intervalo de monitoreo (aprox 100ms)
        setTimeout(check, 100);
    };

    check();
};
