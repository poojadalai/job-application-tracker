export const STATUSES = [
  "Wishlist",
  "Applied",
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
  link: string;
  notes: string;
};

export type ApplicationInput = Omit<Application, "id">;
