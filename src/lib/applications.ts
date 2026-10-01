export const STATUSES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected",
] as const;

export type Status = (typeof STATUSES)[number];

export type Application = {
  id: string;
  company: string;
  role: string;
  status: Status;
  appliedDate: string;
  jobDescription: string;
  nextStep: string;
  link: string;
  notes: string;
};

export type ApplicationInput = Omit<Application, "id">;

export const STATUS_STYLES: Record<Status, string> = {
  Applied: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Screening:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Interview:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Offer: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
