// Production stages a desk goes through. Each stage is mirrored on the
// Shopify order as a tag (build-cutting, ...) so staff can filter orders.

export const STAGES = ['queued', 'cutting', 'assembly', 'quality_check', 'shipped'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  queued: 'Queued',
  cutting: 'Cutting',
  assembly: 'Assembly',
  quality_check: 'Quality check',
  shipped: 'Shipped',
};

// What the customer is told when their desk reaches a stage (none for "queued").
export const STAGE_EMAILS: Partial<Record<Stage, { subject: string; body: string }>> = {
  cutting: {
    subject: 'Your desk is being made',
    body: 'Good news: we have started cutting the top for your desk ({build}). We will let you know when it is assembled.',
  },
  assembly: {
    subject: 'Your desk is being assembled',
    body: 'Your desk ({build}) is in assembly. Next it gets a full quality check before it ships.',
  },
  quality_check: {
    subject: 'Your desk is in its final check',
    body: 'Your desk ({build}) is assembled and going through its final quality check.',
  },
  shipped: {
    subject: 'Your desk is on its way',
    body: 'Your desk ({build}) has shipped. You will get the tracking link from us in a separate email.',
  },
};

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

export function nextStage(stage: Stage): Stage | null {
  const index = STAGES.indexOf(stage);
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1] : null;
}

export const stageTag = (stage: Stage) => `build-${stage.replace('_', '-')}`;

/** Tags to add and remove on the order when a build moves to `stage`. */
export function tagChanges(stage: Stage) {
  return {
    add: [stageTag(stage)],
    remove: STAGES.filter((s) => s !== stage).map(stageTag),
  };
}
