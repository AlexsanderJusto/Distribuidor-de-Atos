export enum Lawyer {
  ALEXSANDER = "Dr. Alexsander",
  PABLINY = "Dra. Pabliny",
  GABRIEL = "Dr. Gabriel",
  MATHEUS = "Dr. Matheus"
}

export interface ProceduralAct {
  id: string;
  title: string;
  type: string;
  lawyer: Lawyer;
  court: string;
  chamber: string;
  caseNumber: string;
  parties: string;
  date: string;
  summary: string;
  originalTextSnippet: string;
  isFulfilled: boolean;
  pageNumber?: number;
}

export interface ClassificationResult {
  acts: ProceduralAct[];
  totalActs: number;
}
