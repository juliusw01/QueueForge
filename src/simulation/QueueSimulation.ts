/**
 * Discrete Event Simulation for M/M/c Queueing Systems
 *
 * This module implements a time-stepped discrete event simulation that
 * models the behavior of a queueing system with:
 * - Random arrivals (Poisson process)
 * - Random service times (Exponential distribution)
 * - Multiple servers (c servers)
 *
 * The simulation generates empirical data that should match the theoretical
 * values from the QueueingModel over long run times.
 */

export interface SimulationState {
  /** Current simulation time (seconds) */
  currentTime: number;

  /** Number of customers currently waiting in queue */
  queueLength: number;

  /** Number of servers currently busy */
  serversBusy: number;

  /** Total customers that have arrived */
  totalArrivals: number;

  /** Total customers that have been served */
  totalServed: number;

  /** Total customers rejected because the system was at capacity */
  totalRejected: number;

  /** Sum of all queue lengths observed (for calculating average) */
  cumulativeQueueLength: number;

  /** Number of time steps taken (for calculating averages) */
  timeSteps: number;
}

export interface SimulationConfig {
  /** λ - Arrival rate (customers per minute) */
  arrivalRate: number;

  /** μ - Service rate per server (customers per minute) */
  serviceRate: number;

  /** c - Number of servers */
  numServers: number;

  /** Time step size (seconds) for simulation updates */
  timeStep: number;

  /** K — Maximum customers in system. Undefined = infinite (M/M/c). */
  maxCapacity?: number;
}

/**
 * M/M/c Queue Discrete Event Simulation
 *
 * This simulation uses a time-stepped approach where at each time step:
 * 1. Check if new customers arrive (Poisson process)
 * 2. Check if servers complete service (Exponential service times)
 * 3. Assign waiting customers to available servers (FIFO)
 * 4. Record queue state for statistics
 */
export class QueueSimulation {
  private state: SimulationState;
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.state = this.getInitialState();
  }

  /**
   * Initialize simulation state
   */
  private getInitialState(): SimulationState {
    return {
      currentTime: 0,
      queueLength: 0,
      serversBusy: 0,
      totalArrivals: 0,
      totalServed: 0,
      totalRejected: 0,
      cumulativeQueueLength: 0,
      timeSteps: 0,
    };
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    this.state = this.getInitialState();
  }

  /**
   * Update simulation configuration
   */
  updateConfig(config: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current simulation state (read-only)
   */
  getState(): Readonly<SimulationState> {
    return { ...this.state };
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.state.queueLength;
  }

  /**
   * Get current simulation time
   */
  getCurrentTime(): number {
    return this.state.currentTime;
  }

  /**
   * Get average queue length over the simulation run
   */
  getAverageQueueLength(): number {
    if (this.state.timeSteps === 0) return 0;
    return this.state.cumulativeQueueLength / this.state.timeSteps;
  }

  /**
   * Get the fraction of arriving customers that were rejected due to full capacity
   */
  getRejectionRate(): number {
    if (this.state.totalArrivals === 0) return 0;
    return this.state.totalRejected / this.state.totalArrivals;
  }

  /**
   * Advance simulation by one time step
   *
   * This is the core simulation loop that:
   * 1. Simulates arrivals using Poisson process
   * 2. Simulates service completions using exponential distribution
   * 3. Manages queue and server states
   * 4. Collects statistics
   */
  step(): void {
    const { arrivalRate, serviceRate, numServers, timeStep, maxCapacity } = this.config;

    // Convert rates from per-minute to per-second
    const arrivalRatePerSec = arrivalRate / 60;
    const serviceRatePerSec = serviceRate / 60;

    const poisson = (mean: number): number => {
      const L = Math.exp(-mean);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= Math.random();
      } while (p > L);
      return k - 1;
    };

    const binomial = (n: number, p: number): number => {
      let x = 0;
      for (let i = 0; i < n; i++) {
        if (Math.random() < p) x++;
      }
      return x;
    };

    // 1. Simulate arrivals (Poisson process)
    // For small time steps, probability of one arrival ≈ λ * Δt
    // We use a Bernoulli trial to determine if an arrival occurs
    //const arrivalProbability = arrivalRatePerSec * timeStep;
    //const arrivals = Math.random() < arrivalProbability ? 1 : 0;
    const arrivals = poisson(arrivalRatePerSec * timeStep)

    this.state.totalArrivals += arrivals;

    let acceptedArrivals = arrivals;

    if (maxCapacity !== undefined) {
      const currentSystemSize = this.state.queueLength + this.state.serversBusy;
      const availableSpace = Math.max(0, maxCapacity - currentSystemSize);

      acceptedArrivals = Math.min(arrivals, availableSpace);
      this.state.totalRejected += (arrivals - acceptedArrivals);
    }

    this.state.queueLength += acceptedArrivals;
    /**
    if (maxCapacity !== undefined && this.state.queueLength + this.state.serversBusy >= maxCapacity) {
      this.state.totalRejected += arrivals;
    } else {
      this.state.queueLength += arrivals;
    }
    **/

    // 2. Simulate service completions (Exponential service times)
    // Each busy server has probability μ * Δt of completing service
    // Total completions depends on how many servers are actually busy
    const idleServers = numServers - this.state.serversBusy
    const startingService = Math.min(this.state.queueLength, idleServers);

    this.state.queueLength -= startingService;
    this.state.serversBusy += startingService;

    const completionProb = Math.min(1, serviceRatePerSec * timeStep); // guard against >1
    const completions = binomial(this.state.serversBusy, completionProb);

    // 3. Update server and queue states
    // Servers complete service, customers leave system
    this.state.serversBusy -= completions;
    this.state.totalServed += completions;

    // 4. Record statistics for calculating averages
    this.state.cumulativeQueueLength += this.state.queueLength;
    this.state.timeSteps++;
    this.state.currentTime += timeStep;
  }

  /**
   * Run simulation for a specified duration
   * @param duration Duration to simulate (seconds)
   * @returns Array of queue length samples
   */
  simulate(duration: number): number[] {
    const samples: number[] = [];
    const targetTime = this.state.currentTime + duration;

    while (this.state.currentTime < targetTime) {
      this.step();
      samples.push(this.state.queueLength);
    }

    return samples;
  }
}
