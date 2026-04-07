import React, { useEffect, useRef } from 'react';
import styles from './Chart.module.scss';

interface DataPoint {
  time: number;
  queueLength: number;
}

interface ChartProps {
  data: DataPoint[];
  title: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

export const Chart: React.FC<ChartProps> = ({
  data,
  title,
  yAxisLabel = 'Queue Length',
  xAxisLabel = 'Time (seconds)',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 56, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scales
    const maxTime = Math.max(...data.map((d) => d.time), 60);
    const maxQueue = Math.max(...data.map((d) => d.queueLength), 10);

    const xScale = (time: number) => padding.left + (time / maxTime) * chartWidth;
    const yScale = (queue: number) =>
      height - padding.bottom - (queue / maxQueue) * chartHeight;

    // Draw grid lines
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw data line
    if (data.length > 1) {
      ctx.strokeStyle = '#0066cc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xScale(data[0].time), yScale(data[0].queueLength));

      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(xScale(data[i].time), yScale(data[i].queueLength));
      }

      ctx.stroke();
    }

    // Draw labels
    ctx.fillStyle = '#6c757d';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxQueue * (5 - i)) / 5);
      const y = padding.top + (i * chartHeight) / 5;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(value.toString(), padding.left - 10, y);
    }

    // X-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxTime * i) / 5);
      const x = padding.left + (i * chartWidth) / 5;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(value.toString(), x, height - padding.bottom + 5);
    }

    // Axis labels
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yAxisLabel, 0, -15);
    ctx.restore();

    // X-axis label — positioned in the lower portion of padding, below tick numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xAxisLabel, width / 2, height - 4);
  }, [data, yAxisLabel, xAxisLabel]);

  return (
    <div className={styles.chartContainer}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    </div>
  );
};
