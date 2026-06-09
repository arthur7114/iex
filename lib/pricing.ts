export const complexityImpacts = {
  technicalComplexity: {
    baixo: 0,
    medio: 0.08,
    alto: 0.15
  },
  urgency: {
    normal: 0,
    alta: 0.10,
    critica: 0.20
  },
  materialQuality: {
    boa: 0,
    media: 0.05,
    ruim: 0.10
  },
  compatibilityLevel: {
    baixo: 0,
    medio: 0.06,
    alto: 0.12
  },
  publicAgencyApproval: {
    nao: 0,
    sim: 0.08
  },
  expectedRevisions: {
    baixa: 0,
    media: 0.04,
    alta: 0.08
  },
  perceivedRisk: {
    baixo: 0,
    medio: 0.06,
    alto: 0.12
  },
  clientProfile: {
    recorrente: -0.03,
    estrategico: -0.05,
    novo: 0,
    complexo: 0.08
  }
};

export type ComplexityFactors = {
  technicalComplexity: "baixo" | "medio" | "alto";
  urgency: "normal" | "alta" | "critica";
  materialQuality: "boa" | "media" | "ruim";
  compatibilityLevel: "baixo" | "medio" | "alto";
  publicAgencyApproval: "nao" | "sim";
  expectedRevisions: "baixa" | "media" | "alta";
  perceivedRisk: "baixo" | "medio" | "alto";
  clientProfile: "recorrente" | "estrategico" | "novo" | "complexo";
};

export const defaultComplexity: ComplexityFactors = {
  technicalComplexity: "medio",
  urgency: "normal",
  materialQuality: "boa",
  compatibilityLevel: "medio",
  publicAgencyApproval: "nao",
  expectedRevisions: "media",
  perceivedRisk: "medio",
  clientProfile: "novo"
};

export function calculateComplexityMultiplier(comp: Partial<ComplexityFactors>) {
  let impact = 0;
  
  if (comp.technicalComplexity) impact += complexityImpacts.technicalComplexity[comp.technicalComplexity];
  if (comp.urgency) impact += complexityImpacts.urgency[comp.urgency];
  if (comp.materialQuality) impact += complexityImpacts.materialQuality[comp.materialQuality];
  if (comp.compatibilityLevel) impact += complexityImpacts.compatibilityLevel[comp.compatibilityLevel];
  if (comp.publicAgencyApproval) impact += complexityImpacts.publicAgencyApproval[comp.publicAgencyApproval];
  if (comp.expectedRevisions) impact += complexityImpacts.expectedRevisions[comp.expectedRevisions];
  if (comp.perceivedRisk) impact += complexityImpacts.perceivedRisk[comp.perceivedRisk];
  if (comp.clientProfile) impact += complexityImpacts.clientProfile[comp.clientProfile];

  return 1 + impact;
}

export function calculateSuggestedValue(areaM2: number, baseRateM2: number, minimumFee: number, multiplier: number) {
  if (baseRateM2 === 0) return minimumFee;
  const calculated = areaM2 * baseRateM2 * multiplier;
  return Math.round(Math.max(calculated, minimumFee));
}
