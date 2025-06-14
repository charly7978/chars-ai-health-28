import { useState, useEffect, useRef } from "react";
import { PPGProcessor } from "../modules/signal-processing/PPGProcessor";
import type { VitalSigns, SignalQuality } from "../modules/signal-processing/types";

export function useVitalMeasurement() {
	const [measurements, setMeasurements] = useState<VitalSigns>({
		heartRate: 0,
		confidence: 0,
		quality: { snr: 0, stability: 0, amplitude: 0, regularity: 0, overall: 0 },
		timestamp: Date.now(),
	});
	const [isProcessing, setIsProcessing] = useState(false);
	const [quality, setQuality] = useState<SignalQuality | null>(null);
	const [elapsedTime, setElapsedTime] = useState(0);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const processorRef = useRef<PPGProcessor | null>(null);
	const animationFrameId = useRef<number | null>(null);
	const startTimeRef = useRef<number | null>(null);
	const intervalRef = useRef<number | null>(null);

	const MEASUREMENT_DURATION = 30000; // 30 segundos

	useEffect(() => {
		processorRef.current = new PPGProcessor();
		return () => {
			stopMeasurement();
		};
	}, []);

	const initializeCamera = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "user",
					width: { ideal: 640 },
					height: { ideal: 480 },
					frameRate: { ideal: 30 },
				},
			});
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play();
			}
		} catch (err) {
			console.error("Error al acceder a la cámara:", err);
			setIsProcessing(false);
		}
	};

	const processFrame = () => {
		if (!isProcessing || !videoRef.current || !canvasRef.current || !processorRef.current) {
			animationFrameId.current = null;
			return;
		}

		const context = canvasRef.current.getContext("2d");
		if (context) {
			canvasRef.current.width = videoRef.current.videoWidth;
			canvasRef.current.height = videoRef.current.videoHeight;
			context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
			const frame = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
			const result = processorRef.current.processFrame(frame);

			setQuality(result.quality);
			setMeasurements((prev) => ({
				...prev,
				heartRate: 0, // PPGProcessor no devuelve bpm directamente. Este valor debe ser calculado por VitalSignsProcessor o HeartBeatProcessor.
				quality: result.quality,
				timestamp: Date.now(),
			}));
		}
		animationFrameId.current = requestAnimationFrame(processFrame);
	};

	const startMeasurement = async () => {
		setIsProcessing(true);
		setElapsedTime(0);
		startTimeRef.current = Date.now();
		await initializeCamera();
		animationFrameId.current = requestAnimationFrame(processFrame);

		intervalRef.current = window.setInterval(() => {
			if (startTimeRef.current) {
				const elapsed = Date.now() - startTimeRef.current;
				setElapsedTime(elapsed);
				if (elapsed >= MEASUREMENT_DURATION) {
					stopMeasurement();
				}
			}
		}, 1000); // Actualizar cada segundo
	};

	const stopMeasurement = () => {
		setIsProcessing(false);
		if (animationFrameId.current) {
			cancelAnimationFrame(animationFrameId.current);
		}
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
		}
		if (videoRef.current && videoRef.current.srcObject) {
			(videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
			videoRef.current.srcObject = null;
		}
	};

	return {
		measurements,
		isProcessing,
		quality,
		elapsedTime,
		videoRef,
		canvasRef,
		startMeasurement,
		stopMeasurement,
		isComplete: elapsedTime >= MEASUREMENT_DURATION,
	};
}
