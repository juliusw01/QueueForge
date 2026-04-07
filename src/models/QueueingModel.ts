/**
 * Queueing Theory Mathematical Models
 *
 * This module implements the M/M/c queueing model, which represents:
 * - M: Markovian (Poisson) arrivals
 * - M: Markovian (exponential) service times
 * - c: Number of servers
 *
 * The model is commonly used for call centers, help desks, and service systems
 * where customers arrive randomly and service times are exponentially distributed.
 */

export interface QueueingParameters {
  /** λ (lambda) - Average arrival rate (customers per minute) */
  arrivalRate: number;

  /** μ (mu) - Average service rate per server (customers per minute) */
  serviceRate: number;

  /** c - Number of servers available */
  numServers: number;
}

export interface QueueMetrics {
  /** ρ (rho) - System utilization (0-1, where 1 means fully utilized) */
  utilization: number;

  /** Average number of customers in queue (waiting, not being served) */
  averageQueueLength: number;

  /** Average number of customers in system (waiting + being served) */
  averageSystemLength: number;

  /** Average time a customer spends waiting in queue (minutes) */
  averageWaitTime: number;

  /** Average time a customer spends in system (waiting + service, minutes) */
  averageSystemTime: number;

  /** Whether the system is stable (arrivals < capacity) */
  isStable: boolean;
}

/**
 * Calculate theoretical M/M/c queue metrics using Erlang C formula
 *
 * These formulas provide the steady-state (long-run average) behavior
 * of the queueing system. The simulation should converge to these values
 * over time if the system is stable.
 */
export class MMCQueueingModel {
  /**
   * Calculate system utilization (ρ = λ / (c * μ))
   *
   * Utilization represents the fraction of time servers are busy.
   * - ρ < 1: System is stable (can handle the arrival rate)
   * - ρ ≥ 1: System is unstable (arrivals exceed capacity)
   */
  static calculateUtilization(params: QueueingParameters): number {
    const { arrivalRate, serviceRate, numServers } = params;
    return arrivalRate / (serviceRate * numServers);
  }

  /**
   * Check if the system is stable
   * A stable system means arrivals can be handled without infinite queue growth
   */
  static isSystemStable(params: QueueingParameters): boolean {
    return this.calculateUtilization(params) < 1.0;
  }

  /**
   * Calculate probability that all servers are busy (Erlang C formula)
   * This is also called the "delay probability" - probability a customer must wait
   *
   * Uses the Erlang C formula:
   * C(c, a) = (a^c / c!) * (c / (c - a)) / [Σ(a^k / k!) + (a^c / c!) * (c / (c - a))]
   * where a = λ/μ (offered load)
   */
  static calculateErlangC(params: QueueingParameters): number {
    const { arrivalRate, serviceRate, numServers } = params;
    const a = arrivalRate / serviceRate; // Offered load (λ/μ)

    if (a >= numServers) {
      // System is unstable, probability of waiting approaches 1
      return 1.0;
    }

    // Calculate numerator: (a^c / c!) * (c / (c - a))
    let numerator = Math.pow(a, numServers) / this.factorial(numServers);
    numerator *= numServers / (numServers - a);

    // Calculate denominator: Σ(a^k / k!) for k=0 to c-1
    let denominator = 0;
    for (let k = 0; k < numServers; k++) {
      denominator += Math.pow(a, k) / this.factorial(k);
    }
    denominator += numerator;

    return numerator / denominator;
  }

  /**
   * Calculate average queue length (Lq)
   * This is the average number of customers waiting (not being served)
   *
   * Formula: Lq = C(c,a) * ρ / (1 - ρ)
   * where ρ = λ/(c*μ) and C(c,a) is Erlang C
   */
  static calculateAverageQueueLength(params: QueueingParameters): number {
    if (!this.isSystemStable(params)) {
      return Infinity; // Unstable system has infinite queue growth
    }

    const rho = this.calculateUtilization(params);
    const erlangC = this.calculateErlangC(params);

    return (erlangC * rho) / (1 - rho);
  }

  /**
   * Calculate average number in system (L)
   * This includes both waiting customers and those being served
   *
   * Formula: L = Lq + λ/μ
   */
  static calculateAverageSystemLength(params: QueueingParameters): number {
    if (!this.isSystemStable(params)) {
      return Infinity;
    }

    const { arrivalRate, serviceRate } = params;
    const lq = this.calculateAverageQueueLength(params);
    return lq + (arrivalRate / serviceRate);
  }

  /**
   * Calculate average waiting time in queue (Wq)
   * By Little's Law: Wq = Lq / λ
   */
  static calculateAverageWaitTime(params: QueueingParameters): number {
    if (!this.isSystemStable(params)) {
      return Infinity;
    }

    const lq = this.calculateAverageQueueLength(params);
    return (lq / params.arrivalRate) * 60; //get wait time in seconds
  }

  /**
   * Calculate average time in system (W)
   * By Little's Law: W = L / λ
   */
  static calculateAverageSystemTime(params: QueueingParameters): number {
    if (!this.isSystemStable(params)) {
      return Infinity;
    }

    const l = this.calculateAverageSystemLength(params);
    return (l / params.arrivalRate) * 60; //get system time in seconds
  }

  /**
   * Calculate all metrics at once
   */
  static calculateMetrics(params: QueueingParameters): QueueMetrics {
    const utilization = this.calculateUtilization(params);
    const isStable = this.isSystemStable(params);

    if (!isStable) {
      return {
        utilization,
        averageQueueLength: Infinity,
        averageSystemLength: Infinity,
        averageWaitTime: Infinity,
        averageSystemTime: Infinity,
        isStable: false,
      };
    }

    return {
      utilization,
      averageQueueLength: this.calculateAverageQueueLength(params),
      averageSystemLength: this.calculateAverageSystemLength(params),
      averageWaitTime: this.calculateAverageWaitTime(params),
      averageSystemTime: this.calculateAverageSystemTime(params),
      isStable: true,
    };
  }

  /**
   * Helper: Calculate factorial
   */
  private static factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }
}
