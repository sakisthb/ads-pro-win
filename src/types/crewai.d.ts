declare module 'crewai' {
  export class CrewAI {
    constructor();
    run(process: Process): Promise<unknown>;
  }

  export class Agent {
    constructor(config: {
      name: string;
      role: string;
      goal: string;
      backstory: string;
      verbose?: boolean;
      allowDelegation?: boolean;
      tools?: string[];
    });
  }

  export class Task {
    constructor(config: {
      description: string;
      agent: Agent;
      expectedOutput: string;
    });
  }

  export class Process {
    constructor(config: {
      agents: Agent[];
      tasks: Task[];
      verbose?: boolean;
    });
  }
} 