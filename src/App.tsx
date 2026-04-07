import { useState, useEffect, useCallback, useRef } from 'react';
import { Slider } from './components/Slider/Slider';
import { Chart } from './components/Chart/Chart';
import { Controls } from './components/Controls/Controls';
import { MMCQueueingModel, QueueingParameters } from './models/QueueingModel';
import { MMCKQueueingModel, MMCKQueueingParameters, MMCKQueueMetrics } from './models/MMCKQueueingModel';
import { QueueSimulation } from './simulation/QueueSimulation';
import styles from './App.module.scss';

interface DataPoint {
  time: number;
  queueLength: number;
}

type QueueModelType = 'MMC' | 'MMCK';

const VALID_MODELS: QueueModelType[] = ['MMC', 'MMCK'];

function readModelFromUrl(): QueueModelType {
  const param = new URLSearchParams(window.location.search).get('model');
  const upper = param?.toUpperCase() as QueueModelType;
  return VALID_MODELS.includes(upper) ? upper : 'MMC';
}

function writeModelToUrl(model: QueueModelType): void {
  const params = new URLSearchParams(window.location.search);
  if (model === 'MMC') {
    params.delete('model');
  } else {
    params.set('model', model.toLowerCase());
  }
  const query = params.toString();
  history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
}

/**
 * Main Application Component
 *
 * This component orchestrates the M/M/c / M/M/c/K queueing simulation by:
 * 1. Managing user-adjustable parameters (λ, μ, c, K, speed)
 * 2. Running the discrete event simulation
 * 3. Displaying theoretical vs. simulated metrics
 * 4. Rendering real-time visualization
 */
function App() {
  // Simulation parameters (adjustable by user)
  const [arrivalRate, setArrivalRate] = useState(3000); // λ (customers per minute)
  const [serviceRate, setServiceRate] = useState(189.87342); // μ (customers per minute per server)
  const [numServers, setNumServers] = useState(16); // c (number of servers)
  const [simulationSpeed, setSimulationSpeed] = useState(1); // Speed multiplier

  // Model selection — initialised from ?model= querystring (default: MMC)
  const [selectedModel, setSelectedModel] = useState<QueueModelType>(readModelFromUrl);
  const [maxCapacity, setMaxCapacity] = useState(10); // K (max customers in system)

  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [data, setData] = useState<DataPoint[]>([{ time: 0, queueLength: 0 }]);

  // Simulation engine instance (persistent across renders)
  const simulationRef = useRef<QueueSimulation>(
    new QueueSimulation({
      arrivalRate,
      serviceRate,
      numServers,
      timeStep: 0.1, // Update every 0.1 seconds
    })
  );

  // Auto-bump K if numServers increases past maxCapacity-1
  useEffect(() => {
    if (maxCapacity <= numServers) {
      setMaxCapacity(numServers + 1);
    }
  }, [numServers, maxCapacity]);

  // Update simulation config when parameters change
  useEffect(() => {
    simulationRef.current.updateConfig({
      arrivalRate,
      serviceRate,
      numServers,
      maxCapacity: selectedModel === 'MMCK' ? maxCapacity : undefined,
    });
  }, [arrivalRate, serviceRate, numServers, selectedModel, maxCapacity]);

  // Calculate theoretical metrics using the active model
  const theoreticalMetrics = useCallback(() => {
    if (selectedModel === 'MMCK') {
      const params: MMCKQueueingParameters = {
        arrivalRate,
        serviceRate,
        numServers,
        maxCapacity,
      };
      return MMCKQueueingModel.calculateMetrics(params);
    }
    const params: QueueingParameters = {
      arrivalRate,
      serviceRate,
      numServers,
    };
    return MMCQueueingModel.calculateMetrics(params);
  }, [arrivalRate, serviceRate, numServers, selectedModel, maxCapacity]);

  const metrics = theoreticalMetrics();

  /**
   * Simulation loop - runs at ~100ms intervals
   */
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const simulation = simulationRef.current;

      // Run simulation steps based on speed multiplier
      const stepsToRun = Math.ceil(simulationSpeed);
      for (let i = 0; i < stepsToRun; i++) {
        simulation.step();
      }

      const currentTime = simulation.getCurrentTime();
      const queueLength = simulation.getQueueLength();

      // Record every tick — the interval itself is the throttle (100ms = 10 samples/sec)
      setData((prevData) => {
        const newData = [...prevData, { time: currentTime, queueLength }];
        // Keep last 600 points (~60s of history at 1× speed) as a rolling window
        return newData.slice(-600);
      });
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [isRunning, simulationSpeed]);

  const handlePlayPause = () => {
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    simulationRef.current.reset();
    setData([{ time: 0, queueLength: 0 }]);
  };

  const handleModelChange = (model: QueueModelType) => {
    setSelectedModel(model);
    writeModelToUrl(model);
    setIsRunning(false);
    simulationRef.current.reset();
    setData([{ time: 0, queueLength: 0 }]);
  };

  const currentState = simulationRef.current.getState();

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <h1>QueueForge</h1>
          <p>M/M/c Queue Simulation</p>
        </div>

        <div className={styles.parameters}>
          <h2>Parameters</h2>

          <div className={styles.modelSelectWrapper}>
            <label className={styles.modelSelectLabel} htmlFor="model-select">
              Queue Model
            </label>
            <select
              id="model-select"
              className={styles.modelSelect}
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value as QueueModelType)}
            >
              <option value="MMC">M/M/c — Infinite capacity</option>
              <option value="MMCK">M/M/c/K — Finite capacity</option>
            </select>
          </div>

          <Slider
            label="Arrival Rate (λ)"
            value={arrivalRate}
            min={60}
            max={6000}
            step={60}
            unit=" customers/min"
            tooltip="Average number of customers arriving per minute (Poisson process)"
            onChange={setArrivalRate}
          />
          <Slider
            label="Service Rate (μ)"
            value={serviceRate}
            min={189}
            max={190}
            step={0.001}
            unit=" customers/min"
            tooltip="Average number of customers one server can handle per minute (Exponential service times)"
            onChange={setServiceRate}
          />
          <Slider
            label="Number of Servers (c)"
            value={numServers}
            min={1}
            max={20}
            step={1}
            tooltip="Number of servers available to handle customers (M/M/c model)"
            onChange={setNumServers}
          />
          {selectedModel === 'MMCK' && (
            <Slider
              label="Max Capacity (K)"
              value={maxCapacity}
              min={numServers + 1}
              max={50}
              step={1}
              tooltip="Maximum total customers in system (queue + servers). Arrivals beyond K are rejected."
              onChange={setMaxCapacity}
            />
          )}
          <Slider
            label="Simulation Speed"
            value={simulationSpeed}
            min={0.5}
            max={5}
            step={0.5}
            unit="×"
            tooltip="Speed multiplier for the simulation (1× = real-time)"
            onChange={setSimulationSpeed}
          />
        </div>

        <Controls
          isRunning={isRunning}
          onPlayPause={handlePlayPause}
          onReset={handleReset}
        />

        <div className={styles.metrics}>
          <h3>Current Metrics</h3>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Simulation Time</span>
            <span className={styles.metricValue}>
              {currentState.currentTime.toFixed(1)}s
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Queue Length</span>
            <span className={styles.metricValue}>{currentState.queueLength}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Servers Busy</span>
            <span className={styles.metricValue}>
              {currentState.serversBusy} / {numServers}
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Load on system</span>
            <span className={styles.metricValue}>
              {(metrics.utilization * numServers).toFixed(1)} Erlang
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Load per server</span>
            <span className={styles.metricValue}>
              {(metrics.utilization * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className={styles.metrics}>
          <h3>Theoretical ({selectedModel === 'MMCK' ? 'M/M/c/K' : 'M/M/c'})</h3>
          {metrics.isStable ? (
            <>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Avg Queue Length (Lq)</span>
                <span className={styles.metricValue}>
                  {metrics.averageQueueLength.toFixed(2)}
                </span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Avg Wait Time (Wq)</span>
                <span className={styles.metricValue}>
                  {metrics.averageWaitTime.toFixed(2)} sec
                </span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Avg System Length (L)</span>
                <span className={styles.metricValue}>
                  {metrics.averageSystemLength.toFixed(2)}
                </span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Avg System Time (W)</span>
                <span className={styles.metricValue}>
                  {metrics.averageSystemTime.toFixed(2)} sec
                </span>
              </div>
              {'rejectionProbability' in metrics && (
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Rejection Prob. (Pb)</span>
                  <span className={styles.metricValue}>
                    {((metrics as MMCKQueueMetrics).rejectionProbability * 100).toFixed(2)}%
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className={styles.warning}>
              ⚠️ System Unstable
              <div className={styles.warningDetail}>
                Arrival rate (λ = {arrivalRate}) exceeds capacity (c×μ ={' '}
                {numServers}×{serviceRate} = {numServers * serviceRate}). Queue will
                grow infinitely.
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <Chart
          data={data}
          title="Queue Length Over Time"
          yAxisLabel="Queue Length (customers)"
          xAxisLabel="Time (seconds)"
        />
      </main>
    </div>
  );
}

export default App;
