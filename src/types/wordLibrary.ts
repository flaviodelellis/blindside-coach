export type Language = "it" | "en";

export type WordEntry = {
  word: string;
  language: Language;
  categories: string[];
  length: number;
  is_pseudoword: boolean;
};

export type WordLibrary = {
  version: string;
  note?: string;
  entries: WordEntry[];
};
